"""
Crypto Market Data Fetcher using CCXT
Supports OKX, Binance, and Bybit Futures/Spot public endpoints (No API key required).
Includes automatic fallback if an exchange is blocked in the user's region.
"""

import logging
from typing import List, Optional
import ccxt
import pandas as pd

logger = logging.getLogger(__name__)


class CryptoDataFetcher:
    def __init__(self, exchange_id: str = "okx", market_type: str = "swap"):
        """
        :param exchange_id: 'okx', 'binance', 'bybit', etc.
        :param market_type: 'swap' (Perpetual Futures) or 'spot'
        """
        self.exchange_id = exchange_id.lower()
        self.market_type = market_type.lower()
        self.client = self._init_exchange(exchange_id)

    def _init_exchange(self, ex_id: str) -> ccxt.Exchange:
        ex_id = ex_id.lower()
        exchange_class = getattr(ccxt, ex_id, None)
        if exchange_class is None:
            logger.warning(f"Exchange '{ex_id}' not found, falling back to 'okx'")
            exchange_class = ccxt.okx
            ex_id = 'okx'

        config = {
            'enableRateLimit': True,
            'timeout': 15000,
            'headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }

        if ex_id == 'binance':
            config['options'] = {'defaultType': 'future' if self.market_type == 'swap' else 'spot'}
        elif ex_id == 'okx':
            config['options'] = {'defaultType': 'swap' if self.market_type == 'swap' else 'spot'}
        elif ex_id == 'bybit':
            config['options'] = {'defaultType': 'swap' if self.market_type == 'swap' else 'spot'}

        return exchange_class(config)

    def get_top_volume_pairs(self, quote: str = "USDT", limit: int = 40) -> List[str]:
        """
        Fetches 24hr tickers and returns the top symbols sorted by trading volume.
        Excludes stablecoins and leveraged tokens.
        """
        try:
            tickers = self.client.fetch_tickers()
        except Exception as e:
            logger.error(f"Failed to fetch tickers from {self.client.id}: {e}")
            # Try fallback to okx if initial exchange failed
            if self.client.id != 'okx':
                logger.info("Attempting fallback to OKX for market data...")
                self.client = self._init_exchange('okx')
                return self.get_top_volume_pairs(quote, limit)
            return []

        excluded = {
            "USDC", "FDUSD", "TUSD", "BUSD", "USDP", "EUR", "DAI",
            "USDE", "WBTC", "STETH", "WBETH", "EURT", "XAU", "XAG",
            "BZ", "CL", "BCO"
        }

        valid_tickers = []
        for symbol, ticker in tickers.items():
            if not ticker:
                continue

            # Standardize symbol filter
            if f"/{quote}" not in symbol:
                continue

            base = symbol.split('/')[0] if '/' in symbol else ""
            if base in excluded or "UP/" in symbol or "DOWN/" in symbol:
                continue

            # Determine 24h quote volume across different exchanges
            volume = 0.0
            if ticker.get('quoteVolume') is not None:
                volume = float(ticker['quoteVolume'])
            elif ticker.get('baseVolume') is not None and ticker.get('last') is not None:
                volume = float(ticker['baseVolume']) * float(ticker['last'])
            elif 'info' in ticker and isinstance(ticker['info'], dict):
                info = ticker['info']
                if 'volCcy24h' in info and ticker.get('last'):
                    volume = float(info['volCcy24h']) * float(ticker['last'])

            if volume > 0:
                valid_tickers.append((symbol, volume))

        # Sort by 24h volume descending
        valid_tickers.sort(key=lambda x: x[1], reverse=True)
        top_symbols = [item[0] for item in valid_tickers[:limit]]
        logger.info(f"Loaded top {len(top_symbols)} {quote} pairs from {self.client.id}")
        return top_symbols

    def fetch_ohlcv(
        self, symbol: str, timeframe: str = "1h", limit: int = 250
    ) -> Optional[pd.DataFrame]:
        """
        Fetches historical candlestick (OHLCV) data and formats it into a Pandas DataFrame.
        """
        try:
            raw_candles = self.client.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
            if not raw_candles:
                return None

            df = pd.DataFrame(
                raw_candles,
                columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
            )
            df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms', utc=True)
            df.set_index('datetime', inplace=True)
            for col in ['open', 'high', 'low', 'close', 'volume']:
                df[col] = df[col].astype(float)

            return df
        except Exception as e:
            logger.warning(f"Error fetching OHLCV for {symbol} ({timeframe}) on {self.client.id}: {e}")
            return None
