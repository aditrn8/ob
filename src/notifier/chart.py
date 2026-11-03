"""
Visual Candlestick Chart Generator for SMC Setups
Creates TradingView-style charts using mplfinance with:
- Dark mode aesthetics
- Swing Order Block zones (shaded green for Bullish, red for Bearish)
- Strong Low / Strong High level lines
- Clean indicators and price markers
"""

import io
import os
import logging
from typing import Optional
import matplotlib
matplotlib.use('Agg')  # Headless backend for VPS and servers
import matplotlib.pyplot as plt
import mplfinance as mpf
import pandas as pd

from src.engine.smc import SMCSetup

logger = logging.getLogger(__name__)


class SMCChartGenerator:
    def __init__(self, display_candles: int = 60):
        self.display_candles = display_candles

    def generate_setup_chart(
        self,
        df: pd.DataFrame,
        setup: SMCSetup,
        output_path: Optional[str] = None
    ) -> Optional[bytes]:
        """
        Renders a chart highlighting the setup and returns PNG bytes or saves to file.
        """
        try:
            if df.empty or len(df) < 15:
                return None

            # Slice to recent candles for clean visualization
            plot_df = df.tail(self.display_candles).copy()
            if plot_df.empty:
                return None

            # Custom dark trading style
            mc = mpf.make_marketcolors(
                up='#089981',        # TradingView emerald green
                down='#f23645',      # TradingView red
                edge='inherit',
                wick='inherit',
                volume='in'
            )
            s = mpf.make_mpf_style(
                base_mpf_style='nightclouds',
                marketcolors=mc,
                gridcolor='#2a2e39',
                facecolor='#131722',
                figcolor='#131722',
                rc={
                    'axes.labelcolor': '#d1d4dc',
                    'xtick.color': '#787b86',
                    'ytick.color': '#787b86',
                    'font.size': 9
                }
            )

            # Create figure
            fig, axlist = mpf.plot(
                plot_df,
                type='candle',
                style=s,
                returnfig=True,
                figsize=(11, 6),
                panel_ratios=(1,),
                tight_layout=True
            )
            ax = axlist[0]

            is_long = setup.signal_type == 'LONG'
            ob_color = '#089981' if is_long else '#f23645'
            strong_label = f"STRONG LOW: ${setup.strong_level:,.2f}" if is_long else f"STRONG HIGH: ${setup.strong_level:,.2f}"

            # Highlight Order Block zone
            ax.axhspan(
                ymin=setup.ob_bottom,
                ymax=setup.ob_top,
                color=ob_color,
                alpha=0.25,
                label=f"Swing {'Bullish' if is_long else 'Bearish'} OB [${setup.ob_bottom:,.2f} - ${setup.ob_top:,.2f}]"
            )

            # Draw Strong High / Low line
            ax.axhline(
                y=setup.strong_level,
                color='#2962ff' if is_long else '#e91e63',
                linestyle='--',
                linewidth=1.5,
                alpha=0.9,
                label=strong_label
            )

            # Draw current price line
            ax.axhline(
                y=setup.current_price,
                color='#fbc02d',
                linestyle=':',
                linewidth=1.2,
                alpha=0.9,
                label=f"Current: ${setup.current_price:,.2f} ({setup.distance_pct}% to OB)"
            )

            # Title (Clean text without emojis to prevent font glyph warnings)
            title_prefix = "[LONG SETUP]" if is_long else "[SHORT SETUP]"
            ax.set_title(
                f"{title_prefix} | {setup.symbol} [{setup.timeframe.upper()}] - SMC Swing Order Block Re-Test",
                fontsize=12,
                fontweight='bold',
                color='#ffffff',
                pad=12
            )

            # Legend
            ax.legend(
                loc='upper left',
                facecolor='#1e222d',
                edgecolor='#363a45',
                labelcolor='#ffffff',
                fontsize=8
            )

            buf = io.BytesIO()
            fig.savefig(buf, format='png', dpi=120, bbox_inches='tight', facecolor=fig.get_facecolor())
            plt.close(fig)
            buf.seek(0)
            png_bytes = buf.getvalue()

            if output_path:
                out_dir = os.path.dirname(output_path)
                if out_dir:
                    os.makedirs(out_dir, exist_ok=True)
                with open(output_path, 'wb') as f:
                    f.write(png_bytes)

            return png_bytes

        except Exception as e:
            logger.error(f"Error generating chart for {setup.symbol}: {e}", exc_info=True)
            return None
