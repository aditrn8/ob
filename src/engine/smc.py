"""
Smart Money Concepts (SMC) Engine
Implements LuxAlgo-style SMC logic:
- Pivot High / Pivot Low swing detection
- Market Structure (BOS & CHoCH)
- Strong High / Strong Low classification
- Swing Order Block (Bullish & Bearish) identification and mitigation tracking
- Setup detection with proximity calculation
"""

from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict
import numpy as np
import pandas as pd


@dataclass
class PivotPoint:
    index: int
    timestamp: pd.Timestamp
    price: float
    is_high: bool  # True for Swing High, False for Swing Low


@dataclass
class OrderBlock:
    id: str
    type: str  # 'BULLISH' or 'BEARISH'
    created_index: int
    created_time: pd.Timestamp
    top: float
    bottom: float
    strong_level: float  # The associated Strong Low (for Bullish) or Strong High (for Bearish)
    is_mitigated: bool = False
    is_invalidated: bool = False
    mitigated_index: Optional[int] = None


@dataclass
class SMCSetup:
    symbol: str
    timeframe: str
    signal_type: str  # 'LONG' or 'SHORT'
    current_price: float
    ob_top: float
    ob_bottom: float
    strong_level: float
    distance_pct: float
    is_inside_zone: bool
    timestamp: pd.Timestamp
    ob_created_time: pd.Timestamp
    candle_index: int


class SMCEngine:
    def __init__(self, pivot_lookback: int = 5):
        """
        :param pivot_lookback: Number of bars to the left and right to confirm a swing pivot.
                               (Default 5, standard LuxAlgo setting)
        """
        self.lookback = pivot_lookback

    def find_pivots(self, df: pd.DataFrame) -> List[PivotPoint]:
        """Detect swing highs and swing lows using rolling pivot comparison."""
        pivots: List[PivotPoint] = []
        n = len(df)
        if n < self.lookback * 2 + 1:
            return pivots

        highs = df['high'].values
        lows = df['low'].values
        times = df.index

        for i in range(self.lookback, n - self.lookback):
            # Pivot High check
            current_high = highs[i]
            is_pivot_high = True
            for j in range(i - self.lookback, i + self.lookback + 1):
                if j != i and highs[j] >= current_high:
                    is_pivot_high = False
                    break
            if is_pivot_high:
                pivots.append(PivotPoint(index=i, timestamp=times[i], price=current_high, is_high=True))

            # Pivot Low check
            current_low = lows[i]
            is_pivot_low = True
            for j in range(i - self.lookback, i + self.lookback + 1):
                if j != i and lows[j] <= current_low:
                    is_pivot_low = False
                    break
            if is_pivot_low:
                pivots.append(PivotPoint(index=i, timestamp=times[i], price=current_low, is_high=False))

        # Sort pivots by bar index
        pivots.sort(key=lambda p: p.index)
        return pivots

    def analyze_structure_and_order_blocks(
        self, df: pd.DataFrame
    ) -> Tuple[List[OrderBlock], Optional[float], Optional[float]]:
        """
        Analyzes Market Structure, identifies Strong Highs & Strong Lows,
        and constructs unmitigated Swing Order Blocks.

        Returns:
            - List of active (unmitigated) Order Blocks
            - Latest confirmed Strong Low price
            - Latest confirmed Strong High price
        """
        pivots = self.find_pivots(df)
        if len(pivots) < 2:
            return [], None, None

        closes = df['close'].values
        highs = df['high'].values
        lows = df['low'].values
        opens = df['open'].values
        times = df.index
        n = len(df)

        order_blocks: List[OrderBlock] = []
        last_strong_low: Optional[float] = None
        last_strong_high: Optional[float] = None

        active_swing_high: Optional[PivotPoint] = None
        active_swing_low: Optional[PivotPoint] = None

        pivot_map = {p.index: p for p in pivots}

        for i in range(n):
            # Register confirmed pivots when we pass their right lookback
            # A pivot at index P is only confirmed at P + lookback
            confirmed_idx = i - self.lookback
            if confirmed_idx in pivot_map:
                p = pivot_map[confirmed_idx]
                if p.is_high:
                    active_swing_high = p
                else:
                    active_swing_low = p

            curr_close = closes[i]

            # 1. Bullish BOS: Close above active swing high
            if active_swing_high is not None and curr_close > active_swing_high.price:
                # The swing low that originated this move is the STRONG LOW
                if active_swing_low is not None:
                    last_strong_low = active_swing_low.price

                    # Find Swing Bullish Order Block:
                    # Look for the last down/bearish candle between strong low and breakout bar
                    start_bar = active_swing_low.index
                    ob_cand_idx = None
                    for b in range(i - 1, max(start_bar - 1, 0), -1):
                        if closes[b] < opens[b]:  # Bearish candle
                            ob_cand_idx = b
                            break

                    # Fallback to the strong low bar if no bearish candle found
                    if ob_cand_idx is None:
                        ob_cand_idx = start_bar

                    ob_top = highs[ob_cand_idx]
                    ob_bottom = lows[ob_cand_idx]

                    ob_id = f"BULL_{times[ob_cand_idx].strftime('%Y%m%d%H%M')}_{ob_cand_idx}"
                    # Avoid duplicate OB at same candle
                    if not any(ob.id == ob_id for ob in order_blocks):
                        order_blocks.append(
                            OrderBlock(
                                id=ob_id,
                                type='BULLISH',
                                created_index=ob_cand_idx,
                                created_time=times[ob_cand_idx],
                                top=ob_top,
                                bottom=ob_bottom,
                                strong_level=active_swing_low.price,
                            )
                        )

                # Reset broken swing high
                active_swing_high = None

            # 2. Bearish BOS: Close below active swing low
            if active_swing_low is not None and curr_close < active_swing_low.price:
                # The swing high that originated this move is the STRONG HIGH
                if active_swing_high is not None:
                    last_strong_high = active_swing_high.price

                    # Find Swing Bearish Order Block:
                    # Look for the last up/bullish candle between strong high and breakout bar
                    start_bar = active_swing_high.index
                    ob_cand_idx = None
                    for b in range(i - 1, max(start_bar - 1, 0), -1):
                        if closes[b] > opens[b]:  # Bullish candle
                            ob_cand_idx = b
                            break

                    if ob_cand_idx is None:
                        ob_cand_idx = start_bar

                    ob_top = highs[ob_cand_idx]
                    ob_bottom = lows[ob_cand_idx]

                    ob_id = f"BEAR_{times[ob_cand_idx].strftime('%Y%m%d%H%M')}_{ob_cand_idx}"
                    if not any(ob.id == ob_id for ob in order_blocks):
                        order_blocks.append(
                            OrderBlock(
                                id=ob_id,
                                type='BEARISH',
                                created_index=ob_cand_idx,
                                created_time=times[ob_cand_idx],
                                top=ob_top,
                                bottom=ob_bottom,
                                strong_level=active_swing_high.price,
                            )
                        )

                # Reset broken swing low
                active_swing_low = None

            # 3. Check mitigations / invalidations for existing active OBs
            for ob in order_blocks:
                if ob.is_mitigated or ob.is_invalidated:
                    continue
                if i <= ob.created_index:
                    continue

                if ob.type == 'BULLISH':
                    # If price drops below bottom -> Invalidated (broken)
                    if closes[i] < ob.bottom:
                        ob.is_invalidated = True
                    # If price enters zone -> Mitigated
                    elif lows[i] <= ob.top:
                        ob.is_mitigated = True
                        ob.mitigated_index = i
                elif ob.type == 'BEARISH':
                    # If price closes above top -> Invalidated
                    if closes[i] > ob.top:
                        ob.is_invalidated = True
                    # If price enters zone -> Mitigated
                    elif highs[i] >= ob.bottom:
                        ob.is_mitigated = True
                        ob.mitigated_index = i

        # Return only active (unmitigated & not invalidated) Order Blocks
        active_obs = [ob for ob in order_blocks if not ob.is_mitigated and not ob.is_invalidated]
        return active_obs, last_strong_low, last_strong_high

    def scan_for_setups(
        self,
        symbol: str,
        timeframe: str,
        df: pd.DataFrame,
        proximity_threshold_pct: float = 0.85
    ) -> List[SMCSetup]:
        """
        Scans current dataframe for Bullish or Bearish setups near unmitigated OBs
        associated with Strong Highs / Strong Lows.
        """
        if df.empty or len(df) < self.lookback * 4:
            return []

        active_obs, strong_low, strong_high = self.analyze_structure_and_order_blocks(df)
        current_candle = df.iloc[-1]
        current_price = float(current_candle['close'])
        current_time = df.index[-1]
        candle_idx = len(df) - 1

        setups: List[SMCSetup] = []

        for ob in active_obs:
            if ob.type == 'BULLISH':
                # Long Setup: Current price above or inside the Bullish OB
                if current_price >= ob.top:
                    distance_pct = ((current_price - ob.top) / current_price) * 100.0
                    is_inside = False
                elif current_price >= ob.bottom:
                    distance_pct = 0.0
                    is_inside = True
                else:
                    # Below OB bottom (invalidated / broken down)
                    continue

                if distance_pct <= proximity_threshold_pct:
                    setups.append(
                        SMCSetup(
                            symbol=symbol,
                            timeframe=timeframe,
                            signal_type='LONG',
                            current_price=current_price,
                            ob_top=ob.top,
                            ob_bottom=ob.bottom,
                            strong_level=ob.strong_level,
                            distance_pct=round(distance_pct, 2),
                            is_inside_zone=is_inside,
                            timestamp=current_time,
                            ob_created_time=ob.created_time,
                            candle_index=candle_idx,
                        )
                    )

            elif ob.type == 'BEARISH':
                # Short Setup: Current price below or inside the Bearish OB
                if current_price <= ob.bottom:
                    distance_pct = ((ob.bottom - current_price) / current_price) * 100.0
                    is_inside = False
                elif current_price <= ob.top:
                    distance_pct = 0.0
                    is_inside = True
                else:
                    # Above OB top (invalidated / broken up)
                    continue

                if distance_pct <= proximity_threshold_pct:
                    setups.append(
                        SMCSetup(
                            symbol=symbol,
                            timeframe=timeframe,
                            signal_type='SHORT',
                            current_price=current_price,
                            ob_top=ob.top,
                            ob_bottom=ob.bottom,
                            strong_level=ob.strong_level,
                            distance_pct=round(distance_pct, 2),
                            is_inside_zone=is_inside,
                            timestamp=current_time,
                            ob_created_time=ob.created_time,
                            candle_index=candle_idx,
                        )
                    )

        return setups
