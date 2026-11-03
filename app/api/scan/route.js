import { NextResponse } from 'next/server';
import { getBitunixTopPairs, getBitunixKlines, runInBatches } from '../../../lib/bitunix.js';
import { detectSetups } from '../../../lib/smc.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Vercel Hobby max execution time

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '35', 10), 60);
    const threshold = parseFloat(searchParams.get('threshold') || '1.2');
    const tfParam = searchParams.get('timeframe') || 'all';

    const timeframes = tfParam === 'all' ? ['1h', '4h'] : [tfParam];

    // 1. Fetch Top Bitunix pairs
    const topPairs = await getBitunixTopPairs(limit);
    if (!topPairs.length) {
      return NextResponse.json({
        success: false,
        error: 'No active trading pairs found on Bitunix',
        setups: [],
      });
    }

    const allSetups = [];

    // 2. Scan pairs across selected timeframes in parallel batches
    for (const tf of timeframes) {
      const scanResults = await runInBatches(
        topPairs,
        async (pair) => {
          try {
            const candles = await getBitunixKlines(pair.symbol, tf, 120);
            if (!candles || candles.length < 30) return [];
            return detectSetups(pair.symbol, tf, candles, threshold);
          } catch (err) {
            return [];
          }
        },
        8 // 8 concurrent requests per batch
      );

      for (const res of scanResults) {
        if (Array.isArray(res) && res.length > 0) {
          allSetups.push(...res);
        }
      }
    }

    // Sort setups by smallest distance percentage (closest to zone first)
    allSetups.sort((a, b) => a.distancePct - b.distancePct);

    return NextResponse.json({
      success: true,
      exchange: 'Bitunix Futures',
      totalPairsScanned: topPairs.length,
      timeframes,
      threshold,
      timestamp: new Date().toISOString(),
      setups: allSetups,
    });
  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal scan error' },
      { status: 500 }
    );
  }
}
