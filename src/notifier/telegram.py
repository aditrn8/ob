"""
Telegram Notifier Module
Handles formatting and dispatching Telegram alerts with optional chart images.
"""

import logging
from typing import Optional
import requests
from src.engine.smc import SMCSetup

logger = logging.getLogger(__name__)


class TelegramNotifier:
    def __init__(self, bot_token: str, chat_id: str, enabled: bool = True):
        self.bot_token = bot_token.strip() if bot_token else ""
        self.chat_id = str(chat_id).strip() if chat_id else ""
        self.enabled = enabled and bool(self.bot_token) and bool(self.chat_id)
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}"

    def test_connection(self) -> bool:
        """Tests whether the bot token and chat ID are valid."""
        if not self.enabled:
            logger.warning("Telegram notifier is disabled or credentials are missing.")
            return False

        try:
            url = f"{self.api_url}/getMe"
            res = requests.get(url, timeout=10)
            data = res.json()
            if not data.get("ok"):
                logger.error(f"Telegram Bot test failed: {data.get('description')}")
                return False

            bot_user = data["result"]["username"]
            logger.info(f"Connected to Telegram Bot: @{bot_user}")

            # Send a ping message to verify chat ID
            msg_res = self.send_message(
                "🤖 *SMC Crypto Scanner Agent* connected successfully!\n"
                "Ready to scan for Swing Order Blocks & Strong High/Lows."
            )
            return msg_res
        except Exception as e:
            logger.error(f"Telegram connection error: {e}")
            return False

    def format_setup_message(self, setup: SMCSetup) -> str:
        """Formats an SMCSetup dataclass into a clean Telegram Markdown message."""
        is_long = setup.signal_type == 'LONG'
        emoji = "🟢 [BULLISH SMC SETUP]" if is_long else "🔴 [BEARISH SMC SETUP]"
        zone_name = "Swing Bullish Order Block" if is_long else "Swing Bearish Order Block"
        anchor_name = "STRONG LOW" if is_long else "STRONG HIGH"

        if setup.is_inside_zone:
            status_text = "⚠️ *PRICE IS CURRENTLY INSIDE THE ORDER BLOCK!*"
        else:
            status_text = f"🎯 *{setup.distance_pct:.2f}%* distance to Order Block zone"

        # Calculate suggested stop loss level
        buffer = (setup.ob_top - setup.ob_bottom) * 0.2
        if is_long:
            suggested_sl = min(setup.ob_bottom, setup.strong_level) - buffer
            entry_zone = f"${setup.ob_bottom:,.4f} - ${setup.ob_top:,.4f}"
            trade_idea = (
                f"• *Entry Zone:* {entry_zone}\n"
                f"• *Suggested SL:* Below {anchor_name} (< ${suggested_sl:,.4f})\n"
                f"• *Target:* Recent Weak High / R:R 1:2 - 1:3"
            )
        else:
            suggested_sl = max(setup.ob_top, setup.strong_level) + buffer
            entry_zone = f"${setup.ob_bottom:,.4f} - ${setup.ob_top:,.4f}"
            trade_idea = (
                f"• *Entry Zone:* {entry_zone}\n"
                f"• *Suggested SL:* Above {anchor_name} (> ${suggested_sl:,.4f})\n"
                f"• *Target:* Recent Weak Low / R:R 1:2 - 1:3"
            )

        msg = (
            f"{emoji} *{setup.symbol}* [{setup.timeframe.upper()}]\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"{status_text}\n\n"
            f"📦 *Setup Details:*\n"
            f"• *Structure:* Retest {zone_name}\n"
            f"• *Anchor Level:* `{anchor_name}` @ `${setup.strong_level:,.4f}`\n"
            f"• *OB Boundaries:* `${setup.ob_bottom:,.4f}` — `${setup.ob_top:,.4f}`\n"
            f"• *Current Price:* `${setup.current_price:,.4f}`\n"
            f"• *OB Formation:* `{setup.ob_created_time.strftime('%Y-%m-%d %H:%M UTC')}`\n\n"
            f"💡 *Trading Plan Suggestion:*\n"
            f"{trade_idea}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🕒 _Scan Time: {setup.timestamp.strftime('%Y-%m-%d %H:%M UTC')}_"
        )
        return msg

    def send_message(self, text: str) -> bool:
        """Sends a plain or markdown text message."""
        if not self.enabled:
            return False

        try:
            url = f"{self.api_url}/sendMessage"
            payload = {
                "chat_id": self.chat_id,
                "text": text,
                "parse_mode": "Markdown",
                "disable_web_page_preview": True,
            }
            res = requests.post(url, json=payload, timeout=15)
            data = res.json()
            if not data.get("ok"):
                logger.error(f"Telegram sendMessage failed: {data}")
                return False
            return True
        except Exception as e:
            logger.error(f"Error sending Telegram message: {e}")
            return False

    def send_alert(self, setup: SMCSetup, image_bytes: Optional[bytes] = None) -> bool:
        """Sends an alert with caption and optional chart photo."""
        if not self.enabled:
            logger.info(f"[TELEGRAM DISABLED] Alert: {setup.symbol} {setup.signal_type} {setup.timeframe}")
            return False

        caption = self.format_setup_message(setup)

        if image_bytes:
            try:
                url = f"{self.api_url}/sendPhoto"
                data = {
                    "chat_id": self.chat_id,
                    "caption": caption,
                    "parse_mode": "Markdown",
                }
                files = {
                    "photo": ("chart.png", image_bytes, "image/png")
                }
                res = requests.post(url, data=data, files=files, timeout=25)
                res_data = res.json()
                if res_data.get("ok"):
                    logger.info(f"Telegram photo alert sent for {setup.symbol} ({setup.timeframe})")
                    return True
                else:
                    logger.warning(f"Telegram sendPhoto failed: {res_data}. Falling back to text message.")
            except Exception as e:
                logger.warning(f"Failed to send Telegram photo: {e}. Falling back to text message.")

        # Fallback to text message
        return self.send_message(caption)
