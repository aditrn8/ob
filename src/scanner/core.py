"""
SMC Scanner Core Engine
Coordinates data fetching, SMC analysis, alert filtering, and notification delivery.
"""

import os
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import yaml
from dotenv import load_dotenv

from src.data.fetcher import CryptoDataFetcher
from src.engine.smc import SMCEngine, SMCSetup
from src.notifier.telegram import TelegramNotifier
from src.notifier.chart import SMCChartGenerator

logger = logging.getLogger(__name__)


class SMCScanner:
    def __init__(self, config_path: str = "config/settings.yaml"):
        load_dotenv()

        with open(config_path, "r") as f:
            self.config = yaml.safe_load(f)

        # Exchange & data settings
        ex_cfg = self.config.get("exchange", {})
        self.exchange_id = ex_cfg.get("id", "binance")
        self.market_type = ex_cfg.get("market_type", "swap")
        self.quote = ex_cfg.get("quote", "USDT")
        self.top_coins_limit = ex_cfg.get("top_coins_limit", 40)
        self.candle_limit = ex_cfg.get("candle_limit", 250)

        # Scanner settings
        sc_cfg = self.config.get("scanner", {})
        self.timeframes = sc_cfg.get("timeframes", ["1h", "4h"])
        self.scan_interval = sc_cfg.get("scan_interval_seconds", 180)
        self.proximity_threshold_pct = sc_cfg.get("proximity_threshold_pct", 0.85)
        self.cooldown_hours = sc_cfg.get("cooldown_hours", 3)
        self.pivot_lookback = sc_cfg.get("pivot_lookback", 5)

        # Telegram settings
        tg_cfg = self.config.get("telegram", {})
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
        self.telegram_enabled = tg_cfg.get("enabled", True)
        self.send_chart = tg_cfg.get("send_chart_image", True)
        chart_display = tg_cfg.get("chart_candles_display", 60)

        # Initialize modules
        self.fetcher = CryptoDataFetcher(exchange_id=self.exchange_id, market_type=self.market_type)
        self.engine = SMCEngine(pivot_lookback=self.pivot_lookback)
        self.notifier = TelegramNotifier(bot_token=bot_token, chat_id=chat_id, enabled=self.telegram_enabled)
        self.chart_gen = SMCChartGenerator(display_candles=chart_display)

        # State tracking: (symbol, timeframe, signal_type, round(ob_bottom, 2)) -> last_alert_datetime
        self.alert_cache: Dict[Tuple[str, str, str, float], datetime] = {}
        self.cached_pairs: List[str] = []
        self.pairs_last_updated: Optional[datetime] = None

    def refresh_pairs(self, force: bool = False) -> List[str]:
        """Refreshes the top volume trading pairs if expired or forced."""
        now = datetime.utcnow()
        if force or not self.cached_pairs or not self.pairs_last_updated or (now - self.pairs_last_updated) > timedelta(hours=6):
            logger.info("Updating top trading pairs list...")
            pairs = self.fetcher.get_top_volume_pairs(quote=self.quote, limit=self.top_coins_limit)
            if pairs:
                self.cached_pairs = pairs
                self.pairs_last_updated = now
        return self.cached_pairs

    def is_cooling_down(self, setup: SMCSetup) -> bool:
        """Determines if a setup is currently on alert cooldown to prevent duplicate spam."""
        cache_key = (
            setup.symbol,
            setup.timeframe,
            setup.signal_type,
            round(setup.ob_bottom, 2)
        )
        now = datetime.utcnow()
        if cache_key in self.alert_cache:
            last_alert = self.alert_cache[cache_key]
            if (now - last_alert) < timedelta(hours=self.cooldown_hours):
                return True

        self.alert_cache[cache_key] = now
        return False

    def scan_once(self) -> List[SMCSetup]:
        """Performs a single complete scanning cycle across all pairs and timeframes."""
        pairs = self.refresh_pairs()
        if not pairs:
            logger.warning("No trading pairs found to scan.")
            return []

        logger.info(f"--- Starting Scan Cycle ({len(pairs)} pairs on {self.timeframes}) ---")
        detected_setups: List[SMCSetup] = []

        for symbol in pairs:
            for tf in self.timeframes:
                try:
                    df = self.fetcher.fetch_ohlcv(symbol=symbol, timeframe=tf, limit=self.candle_limit)
                    if df is None or df.empty:
                        continue

                    setups = self.engine.scan_for_setups(
                        symbol=symbol,
                        timeframe=tf,
                        df=df,
                        proximity_threshold_pct=self.proximity_threshold_pct
                    )

                    for setup in setups:
                        detected_setups.append(setup)

                        if self.is_cooling_down(setup):
                            logger.info(f"Skipping cooled down alert: {symbol} [{tf}] {setup.signal_type}")
                            continue

                        logger.info(
                            f"🔥 TRIGGER: {setup.signal_type} {symbol} [{tf}] - "
                            f"Price: ${setup.current_price} | Dist: {setup.distance_pct}% | "
                            f"Strong Level: ${setup.strong_level}"
                        )

                        # Generate visual chart if enabled
                        chart_bytes = None
                        if self.send_chart:
                            chart_bytes = self.chart_gen.generate_setup_chart(df=df, setup=setup)

                        # Send alert to Telegram
                        self.notifier.send_alert(setup=setup, image_bytes=chart_bytes)

                    # Small delay between requests to be gentle on exchange rate limits
                    time.sleep(0.05)

                except Exception as e:
                    logger.error(f"Error scanning {symbol} ({tf}): {e}")

        logger.info(f"--- Scan Cycle Complete. Detected {len(detected_setups)} active setups. ---")
        return detected_setups

    def run_forever(self):
        """Runs the scanner continuously in a daemon loop."""
        logger.info("Starting SMC Crypto Scanner Agent daemon...")
        if self.notifier.enabled:
            self.notifier.test_connection()

        while True:
            start_time = time.time()
            try:
                self.scan_once()
            except Exception as e:
                logger.error(f"Unexpected error in scanner loop: {e}", exc_info=True)

            elapsed = time.time() - start_time
            sleep_time = max(1, self.scan_interval - elapsed)
            logger.info(f"Sleeping for {sleep_time:.1f}s until next scan cycle...\n")
            time.sleep(sleep_time)
