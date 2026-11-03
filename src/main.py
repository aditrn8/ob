"""
Main Entry Point for SMC Crypto Scanner Agent
CLI usage:
  python src/main.py                   # Run scanner in continuous loop (Default)
  python src/main.py --scan-once       # Run a single scan pass and print results
  python src/main.py --test-telegram   # Test Telegram Bot credentials
  python src/main.py --test-smc        # Test SMC algorithm on BTC/USDT & save sample chart
"""

import sys
import os
from pathlib import Path

# Force UTF-8 stdout/stderr encoding for terminal compatibility with emojis
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import argparse
import logging
from dotenv import load_dotenv

from src.scanner.core import SMCScanner
from src.data.fetcher import CryptoDataFetcher
from src.engine.smc import SMCEngine
from src.notifier.chart import SMCChartGenerator
from src.notifier.telegram import TelegramNotifier

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("smc-agent")


def test_telegram():
    load_dotenv()
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print("\n❌ Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing in your .env file!")
        print("Please copy .env.example to .env and fill in your credentials.\n")
        sys.exit(1)

    notifier = TelegramNotifier(bot_token=token, chat_id=chat_id, enabled=True)
    print("\nTesting Telegram connection...")
    success = notifier.test_connection()
    if success:
        print("✅ Telegram connection successful! Test message received in chat.\n")
    else:
        print("❌ Telegram connection failed. Check bot token and chat ID.\n")


def test_smc():
    print("\n--- Testing SMC Algorithm on BTC/USDT (1H) ---")
    scanner = SMCScanner()
    fetcher = scanner.fetcher
    symbol = "BTC/USDT:USDT" if fetcher.exchange_id in ["okx", "bybit"] else "BTC/USDT"
    df = fetcher.fetch_ohlcv(symbol=symbol, timeframe="1h", limit=200)
    if df is None or df.empty:
        # Fallback without contract suffix
        symbol = "BTC/USDT"
        df = fetcher.fetch_ohlcv(symbol=symbol, timeframe="1h", limit=200)

    if df is None or df.empty:
        print(f"❌ Failed to fetch {symbol} candles from {fetcher.client.id}.")
        return

    print(f"✅ Fetched {len(df)} candles for {symbol} on {fetcher.client.id} (Latest Close: ${df.iloc[-1]['close']:,.2f})")

    engine = SMCEngine(pivot_lookback=5)
    active_obs, strong_low, strong_high = engine.analyze_structure_and_order_blocks(df)

    print(f"📊 Active Unmitigated Order Blocks: {len(active_obs)}")
    print(f"🛡️ Latest Strong Low: {f'${strong_low:,.2f}' if strong_low else 'None'}")
    print(f"🛡️ Latest Strong High: {f'${strong_high:,.2f}' if strong_high else 'None'}")

    for idx, ob in enumerate(active_obs):
        print(f"   [{idx+1}] {ob.type} OB | Zone: ${ob.bottom:,.2f} - ${ob.top:,.2f} | Anchor: ${ob.strong_level:,.2f}")

    # Generate a test chart
    if active_obs:
        sample_ob = active_obs[-1]
        dummy_setup = engine.scan_for_setups("BTC/USDT", "1h", df, proximity_threshold_pct=100.0)
        if dummy_setup:
            cg = SMCChartGenerator(display_candles=60)
            output_file = "temp_test_chart.png"
            cg.generate_setup_chart(df, dummy_setup[0], output_path=output_file)
            print(f"🖼️ Sample chart successfully generated at: {os.path.abspath(output_file)}")

    print("--- Test Complete ---\n")


def main():
    parser = argparse.ArgumentParser(description="SMC Crypto Scanner Agent")
    parser.add_argument("--scan-once", action="store_true", help="Perform single scan pass and exit")
    parser.add_argument("--test-telegram", action="store_true", help="Test Telegram connection")
    parser.add_argument("--test-smc", action="store_true", help="Test SMC calculation and generate chart")

    args = parser.parse_args()

    if args.test_telegram:
        test_telegram()
        return

    if args.test_smc:
        test_smc()
        return

    scanner = SMCScanner()

    if args.scan_once:
        print("Running single scan pass...")
        scanner.scan_once()
        print("Done.")
    else:
        scanner.run_forever()


if __name__ == "__main__":
    main()
