/**
 * Bitunix Public Futures REST API Client
 * Docs: https://fapi.bitunix.com
 */

const BASE_URL = 'https://fapi.bitunix.com';

// Blacklist of traditional US/Global stocks, ETFs, indices, commodities, and fiat/stablecoins
const NON_CRYPTO_ASSETS = new Set([
  // Commodities & Precious Metals
  'XAU', 'XAG', 'CL', 'BZ', 'NG', 'HG', 'OIL', 'GOLD', 'SILVER', 'BCO', 'WTI', 'XAUT', 'PAXG', 'COPPER',
  // US & Global Stocks & Pre-IPOs
  'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOG', 'GOOGL', 'META', 'AMD',
  'COIN', 'PLTR', 'BABA', 'MSTR', 'NFLX', 'INTC', 'DIS', 'NKE', 'XOM',
  'JPM', 'V', 'WMT', 'PG', 'MA', 'HD', 'UNH', 'BAC', 'SNDK', 'BIDU',
  'UBER', 'PYPL', 'ABNB', 'ORCL', 'CRM', 'CSCO', 'ADBE', 'QCOM', 'TXN',
  'MU', 'MUU', 'CRCL', 'SPCX', 'SKHYNIX', 'SKHY', 'SAMSUNG', 'ANTHROPIC',
  'OPENAI', 'BYD', 'TENCENT', 'MEITUAN', 'PDD', 'XIAOMI', 'NAVER', 'HPE',
  'BRKB', 'DKNG', 'KODEX200', 'EWJ', 'AVGO', 'GAMESTOP', 'GME', 'AMC', 'LITE',
  'COST', 'SHLD', 'MRVL', 'CRWV', 'ARIA', 'AKE', 'ICNT',
  // ETFs & Traditional Indices
  'SPY', 'QQQ', 'DJI', 'SOXL', 'SOXS', 'TQQQ', 'SQQQ', 'ARKK', 'IWM', 'DIA', 'KORU', 'SNXX',
  // Fiat & Stablecoins
  'USDC', 'FDUSD', 'TUSD', 'BUSD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'USDE', 'DAI'
]);

export async function getBitunixTopPairs(limit = 40) {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/futures/market/tickers`, {
      next: { revalidate: 60 }, // Cache on Vercel for 60 seconds
    });
    const json = await res.json();
    if (json.code !== 0 || !Array.isArray(json.data)) {
      throw new Error(json.msg || 'Failed to fetch Bitunix tickers');
    }

    const valid = [];
    for (const item of json.data) {
      const sym = item.symbol;
      // Must end with USDT and not USDC/USD coin-margined
      if (!sym || !sym.endsWith('USDT') || sym.endsWith('USDC') || sym.endsWith('USD')) continue;

      // Extract base asset
      const base = sym.slice(0, -4);
      if (NON_CRYPTO_ASSETS.has(base)) continue;

      const quoteVol = parseFloat(item.quoteVol || 0);
      const lastPrice = parseFloat(item.lastPrice || 0);

      if (quoteVol > 0 && lastPrice > 0) {
        valid.push({
          symbol: sym,
          lastPrice,
          quoteVol,
          high: parseFloat(item.high || 0),
          low: parseFloat(item.low || 0),
        });
      }
    }

    // Sort by 24h volume descending
    valid.sort((a, b) => b.quoteVol - a.quoteVol);
    return valid.slice(0, limit);
  } catch (err) {
    console.error('Error fetching Bitunix top pairs:', err);
    return [];
  }
}

export async function getBitunixKlines(symbol, interval = '1h', limit = 120) {
  try {
    const res = await fetch(
      `${BASE_URL}/api/v1/futures/market/kline?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { cache: 'no-store' }
    );
    const json = await res.json();
    if (json.code !== 0 || !Array.isArray(json.data)) {
      return [];
    }

    // Bitunix returns newest candle first. Reverse to chronological order (oldest -> newest)
    const candles = json.data
      .map((c) => ({
        time: parseInt(c.time, 10),
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseFloat(c.quoteVol || c.baseVol || 0),
      }))
      .reverse();

    return candles;
  } catch (err) {
    console.warn(`Error fetching klines for ${symbol} (${interval}):`, err.message);
    return [];
  }
}

/**
 * Concurrency runner to scan pairs in parallel chunks
 */
export async function runInBatches(items, fn, batchSize = 6) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}
