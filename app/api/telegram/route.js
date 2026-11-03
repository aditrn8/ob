import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { setup } = body;

    if (!setup) {
      return NextResponse.json({ success: false, error: 'No setup provided' }, { status: 400 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN || '8888160575:AAG2qKvl8o2UB3gklJkkulE23myRd1b1zB8';
    const chatId = process.env.TELEGRAM_CHAT_ID || '8304389417';

    const isLong = setup.signalType === 'LONG';
    const emoji = isLong ? '🟢 [BULLISH SMC SETUP]' : '🔴 [BEARISH SMC SETUP]';
    const zoneName = isLong ? 'Swing Bullish Order Block' : 'Swing Bearish Order Block';
    const anchorName = isLong ? 'STRONG LOW' : 'STRONG HIGH';

    const statusText = setup.isInsideZone
      ? '⚠️ *HARGA SEDANG BERADA DI DALAM ZONA ORDER BLOCK!*'
      : `🎯 Jarak ke zona: *${setup.distancePct}%*`;

    const text = `
${emoji} *${setup.symbol}* [${setup.timeframe.toUpperCase()}]
━━━━━━━━━━━━━━━━━━━━━━
${statusText}

📦 *SMC Structure (Bitunix Futures):*
• *Setup:* ${zoneName}
• *Anchor:* \`${anchorName}\` @ \`$${setup.strongLevel.toLocaleString()}\`
• *OB Zone:* \`$${setup.obBottom.toLocaleString()}\` — \`$${setup.obTop.toLocaleString()}\`
• *Current Price:* \`$${setup.currentPrice.toLocaleString()}\`

💡 *Trading Plan Suggestion:*
• *Entry:* Sekitar area OB ($${setup.obBottom.toLocaleString()} - $${setup.obTop.toLocaleString()})
• *Stop Loss:* ${isLong ? `< $${setup.suggestedSL.toLocaleString()}` : `> $${setup.suggestedSL.toLocaleString()}`} (Proteksi ${anchorName})
• *Take Profit:* $${setup.suggestedTP.toLocaleString()} (Target R:R 1:2)

🔗 [Buka Chart di Bitunix](https://www.bitunix.com/futures/${setup.symbol})
━━━━━━━━━━━━━━━━━━━━━━
⏱️ _Scanned from SMC Web Agent_
    `.trim();

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    const tgJson = await tgRes.json();
    if (!tgJson.ok) {
      throw new Error(tgJson.description || 'Telegram API error');
    }

    return NextResponse.json({ success: true, message: 'Alert sent to Telegram' });
  } catch (error) {
    console.error('Telegram alert error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
