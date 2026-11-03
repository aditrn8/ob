/**
 * Smart Money Concepts (SMC) Engine for JavaScript/Node.js
 * Identifies:
 * - Dynamic Swing Pivots (Lookback 5)
 * - Market Structure (Bullish / Bearish Break of Structure - BOS)
 * - Strong Low (Anchor for Bullish OB) & Strong High (Anchor for Bearish OB)
 * - Unmitigated Swing Order Blocks
 * - Proximity & Retest Setup Detection
 */

export function findPivots(candles, lookback = 5) {
  const pivots = [];
  const n = candles.length;
  if (n < lookback * 2 + 1) return pivots;

  for (let i = lookback; i < n - lookback; i++) {
    const high = candles[i].high;
    let isHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].high >= high) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) {
      pivots.push({ index: i, time: candles[i].time, price: high, isHigh: true });
    }

    const low = candles[i].low;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].low <= low) {
        isLow = false;
        break;
      }
    }
    if (isLow) {
      pivots.push({ index: i, time: candles[i].time, price: low, isHigh: false });
    }
  }

  pivots.sort((a, b) => a.index - b.index);
  return pivots;
}

export function analyzeSMC(candles, lookback = 5) {
  const pivots = findPivots(candles, lookback);
  const orderBlocks = [];
  let lastStrongLow = null;
  let lastStrongHigh = null;

  let activeSwingHigh = null;
  let activeSwingLow = null;

  const pivotMap = new Map();
  for (const p of pivots) {
    pivotMap.set(p.index, p);
  }

  const n = candles.length;
  for (let i = 0; i < n; i++) {
    const confirmedIdx = i - lookback;
    if (pivotMap.has(confirmedIdx)) {
      const p = pivotMap.get(confirmedIdx);
      if (p.isHigh) activeSwingHigh = p;
      else activeSwingLow = p;
    }

    const currClose = candles[i].close;

    // 1. Bullish BOS: Close above active swing high -> confirms STRONG LOW
    if (activeSwingHigh && currClose > activeSwingHigh.price) {
      if (activeSwingLow) {
        lastStrongLow = activeSwingLow.price;

        // Find last bearish candle before impulse rally
        let obCandle = null;
        for (let b = i - 1; b >= Math.max(activeSwingLow.index - 1, 0); b--) {
          if (candles[b].close < candles[b].open) {
            obCandle = candles[b];
            break;
          }
        }
        if (!obCandle) obCandle = candles[activeSwingLow.index];

        const obId = `BULL_${obCandle.time}`;
        if (!orderBlocks.some((ob) => ob.id === obId)) {
          orderBlocks.push({
            id: obId,
            type: 'BULLISH',
            top: obCandle.high,
            bottom: obCandle.low,
            strongLevel: activeSwingLow.price,
            time: obCandle.time,
            createdIndex: i,
            isMitigated: false,
            isInvalidated: false,
          });
        }
      }
      activeSwingHigh = null;
    }

    // 2. Bearish BOS: Close below active swing low -> confirms STRONG HIGH
    if (activeSwingLow && currClose < activeSwingLow.price) {
      if (activeSwingHigh) {
        lastStrongHigh = activeSwingHigh.price;

        // Find last bullish candle before impulse drop
        let obCandle = null;
        for (let b = i - 1; b >= Math.max(activeSwingHigh.index - 1, 0); b--) {
          if (candles[b].close > candles[b].open) {
            obCandle = candles[b];
            break;
          }
        }
        if (!obCandle) obCandle = candles[activeSwingHigh.index];

        const obId = `BEAR_${obCandle.time}`;
        if (!orderBlocks.some((ob) => ob.id === obId)) {
          orderBlocks.push({
            id: obId,
            type: 'BEARISH',
            top: obCandle.high,
            bottom: obCandle.low,
            strongLevel: activeSwingHigh.price,
            time: obCandle.time,
            createdIndex: i,
            isMitigated: false,
            isInvalidated: false,
          });
        }
      }
      activeSwingLow = null;
    }

    // 3. Mitigation & Invalidation check
    for (const ob of orderBlocks) {
      if (ob.isMitigated || ob.isInvalidated) continue;
      if (i <= ob.createdIndex) continue;

      if (ob.type === 'BULLISH') {
        if (candles[i].close < ob.bottom) {
          ob.isInvalidated = true;
        } else if (candles[i].low <= ob.top) {
          ob.isMitigated = true;
        }
      } else {
        if (candles[i].close > ob.top) {
          ob.isInvalidated = true;
        } else if (candles[i].high >= ob.bottom) {
          ob.isMitigated = true;
        }
      }
    }
  }

  const activeOBs = orderBlocks.filter((ob) => !ob.isMitigated && !ob.isInvalidated);
  return { activeOBs, lastStrongLow, lastStrongHigh };
}

export function detectSetups(symbol, timeframe, candles, proximityThresholdPct = 1.0) {
  if (!candles || candles.length < 25) return [];

  const { activeOBs, lastStrongLow, lastStrongHigh } = analyzeSMC(candles);
  const latest = candles[candles.length - 1];
  const currentPrice = latest.close;
  const setups = [];

  for (const ob of activeOBs) {
    if (ob.type === 'BULLISH') {
      let distancePct = 0;
      let isInside = false;

      if (currentPrice >= ob.top) {
        distancePct = ((currentPrice - ob.top) / currentPrice) * 100.0;
      } else if (currentPrice >= ob.bottom) {
        distancePct = 0;
        isInside = true;
      } else {
        continue; // Below bottom
      }

      if (distancePct <= proximityThresholdPct) {
        const buffer = (ob.top - ob.bottom) * 0.2;
        const sl = Math.min(ob.bottom, ob.strongLevel) - buffer;
        const risk = currentPrice - sl;
        const tp = currentPrice + risk * 2.0;

        setups.push({
          symbol,
          timeframe,
          signalType: 'LONG',
          currentPrice,
          obTop: ob.top,
          obBottom: ob.bottom,
          strongLevel: ob.strongLevel,
          distancePct: Number(distancePct.toFixed(2)),
          isInsideZone: isInside,
          obCreatedTime: ob.time,
          suggestedSL: Number(sl.toFixed(4)),
          suggestedTP: Number(tp.toFixed(4)),
          timestamp: latest.time,
        });
      }
    } else if (ob.type === 'BEARISH') {
      let distancePct = 0;
      let isInside = false;

      if (currentPrice <= ob.bottom) {
        distancePct = ((ob.bottom - currentPrice) / currentPrice) * 100.0;
      } else if (currentPrice <= ob.top) {
        distancePct = 0;
        isInside = true;
      } else {
        continue; // Above top
      }

      if (distancePct <= proximityThresholdPct) {
        const buffer = (ob.top - ob.bottom) * 0.2;
        const sl = Math.max(ob.top, ob.strongLevel) + buffer;
        const risk = sl - currentPrice;
        const tp = currentPrice - risk * 2.0;

        setups.push({
          symbol,
          timeframe,
          signalType: 'SHORT',
          currentPrice,
          obTop: ob.top,
          obBottom: ob.bottom,
          strongLevel: ob.strongLevel,
          distancePct: Number(distancePct.toFixed(2)),
          isInsideZone: isInside,
          obCreatedTime: ob.time,
          suggestedSL: Number(sl.toFixed(4)),
          suggestedTP: Number(tp.toFixed(4)),
          timestamp: latest.time,
        });
      }
    }
  }

  return setups;
}
