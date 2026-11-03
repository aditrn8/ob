'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Sliders,
  Send,
  ExternalLink,
  ShieldAlert,
  Zap,
  CheckCircle,
  RefreshCw,
  Clock,
  Layers,
  TrendingUp,
} from 'lucide-react';

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [setups, setSetups] = useState([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [lastScannedTime, setLastScannedTime] = useState(null);
  const [threshold, setThreshold] = useState(1.5);
  const [timeframe, setTimeframe] = useState('all');
  const [signalFilter, setSignalFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [telegramStatus, setTelegramStatus] = useState({});

  const runScan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scan?limit=45&threshold=${threshold}&timeframe=${timeframe}`);
      const data = await res.json();
      if (data.success) {
        setSetups(data.setups || []);
        setTotalScanned(data.totalPairsScanned || 0);
        setLastScannedTime(new Date());
      } else {
        alert('Scan Error: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Gagal mengambil data dari server. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // Run initial scan on load
  useEffect(() => {
    runScan();
  }, []);

  const sendToTelegram = async (setup) => {
    const key = `${setup.symbol}-${setup.timeframe}-${setup.signalType}`;
    setTelegramStatus((prev) => ({ ...prev, [key]: 'sending' }));

    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup }),
      });
      const data = await res.json();
      if (data.success) {
        setTelegramStatus((prev) => ({ ...prev, [key]: 'sent' }));
        setTimeout(() => {
          setTelegramStatus((prev) => ({ ...prev, [key]: null }));
        }, 4000);
      } else {
        alert('Gagal kirim Telegram: ' + data.error);
        setTelegramStatus((prev) => ({ ...prev, [key]: 'error' }));
      }
    } catch (err) {
      alert('Error kirim Telegram: ' + err.message);
      setTelegramStatus((prev) => ({ ...prev, [key]: 'error' }));
    }
  };

  // Filtered setups
  const filteredSetups = setups.filter((s) => {
    if (signalFilter !== 'all' && s.signalType !== signalFilter) return false;
    if (search.trim() !== '' && !s.symbol.toLowerCase().includes(search.toLowerCase().trim())) {
      return false;
    }
    return true;
  });

  const longCount = setups.filter((s) => s.signalType === 'LONG').length;
  const shortCount = setups.filter((s) => s.signalType === 'SHORT').length;

  return (
    <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px 80px' }}>
      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
          paddingBottom: '20px',
          borderBottom: '1px solid #21262d',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '800',
                letterSpacing: '0.5px',
              }}
            >
              BITUNIX FUTURES
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  display: 'inline-block',
                }}
                className="pulse-dot"
              />
              <span style={{ fontSize: '13px', color: '#7ee787', fontWeight: '600' }}>Live Scanner</span>
            </div>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px', color: '#f0f6fc' }}>
            SMC Crypto Scanner
          </h1>
          <p style={{ fontSize: '14px', color: '#8b949e', marginTop: '2px' }}>
            LuxAlgo Logic: Swing Order Blocks + Strong Low (Long) & Strong High (Short)
          </p>
        </div>

        {/* Telegram & Bot badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className="glass-card"
            style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
            }}
          >
            <span style={{ color: '#58a6ff' }}>🤖 Connected Bot:</span>
            <a
              href="https://t.me/obxsinner_bot"
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#58a6ff',
                textDecoration: 'none',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              @obxsinner_bot <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </header>

      {/* Control & Scanner Action Bar */}
      <section
        className="glass-card"
        style={{
          padding: '20px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Big Scan Button */}
          <button
            onClick={runScan}
            disabled={loading}
            style={{
              background: loading
                ? '#30363d'
                : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw size={18} className={loading ? 'pulse-dot' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Scanning Bitunix Pairs...' : 'SCAN BITUNIX NOW'}
          </button>

          {/* Timeframe Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#8b949e', fontWeight: '600' }}>Timeframe:</span>
            {['all', '1h', '4h'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  background: timeframe === tf ? '#238636' : '#21262d',
                  color: timeframe === tf ? '#ffffff' : '#c9d1d9',
                  border: '1px solid',
                  borderColor: timeframe === tf ? '#2ea043' : '#30363d',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {tf === 'all' ? '1H & 4H' : tf.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Threshold Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={16} color="#8b949e" />
            <span style={{ fontSize: '13px', color: '#8b949e', fontWeight: '600' }}>
              Proximity: <b style={{ color: '#58a6ff' }}>{threshold}%</b>
            </span>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              style={{ width: '100px', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            paddingTop: '16px',
            borderTop: '1px solid #21262d',
          }}
        >
          {/* Signal Filter Badges */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'all', label: `All Setups (${setups.length})` },
              { id: 'LONG', label: `🟢 Long Only (${longCount})` },
              { id: 'SHORT', label: `🔴 Short Only (${shortCount})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSignalFilter(f.id)}
                style={{
                  background: signalFilter === f.id ? '#30363d' : 'transparent',
                  color: signalFilter === f.id ? '#ffffff' : '#8b949e',
                  border: '1px solid',
                  borderColor: signalFilter === f.id ? '#58a6ff' : '#30363d',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: '8px',
              padding: '6px 12px',
              width: '220px',
            }}
          >
            <Search size={14} color="#8b949e" />
            <input
              type="text"
              placeholder="Search coin (e.g. BTC)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '13px',
                width: '100%',
              }}
            />
          </div>
        </div>
      </section>

      {/* Metrics Bar */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#8b949e', fontWeight: '600' }}>PAIRS SCANNED</div>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#f0f6fc' }}>
            {totalScanned} <span style={{ fontSize: '13px', fontWeight: '400', color: '#8b949e' }}>Bitunix USDT Pairs</span>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>BULLISH SETUPS (LONG)</div>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#10b981' }}>
            {longCount} <span style={{ fontSize: '13px', fontWeight: '400', color: '#8b949e' }}>at Strong Low OB</span>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600' }}>BEARISH SETUPS (SHORT)</div>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#ef4444' }}>
            {shortCount} <span style={{ fontSize: '13px', fontWeight: '400', color: '#8b949e' }}>at Strong High OB</span>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#8b949e', fontWeight: '600' }}>LAST SCAN TIME</div>
          <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '8px', color: '#c9d1d9' }}>
            {lastScannedTime ? lastScannedTime.toLocaleTimeString() : 'Belum discan'}
          </div>
        </div>
      </section>

      {/* Setups Feed */}
      <section>
        {loading ? (
          <div
            className="glass-card"
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <RefreshCw size={36} color="#3b82f6" className="pulse-dot" />
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Men-scan Koin di Bitunix Futures...</h3>
            <p style={{ fontSize: '14px', color: '#8b949e', maxWidth: '420px' }}>
              Sedang mengambil data candlestick 1H & 4H dari Bitunix dan menghitung Swing Order Block serta Strong Level.
            </p>
          </div>
        ) : filteredSetups.length === 0 ? (
          <div
            className="glass-card"
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <ShieldAlert size={40} color="#8b949e" />
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#c9d1d9' }}>
              Tidak Ada Setup yang Sedang Mendekati Zona ({threshold}%)
            </h3>
            <p style={{ fontSize: '14px', color: '#8b949e', maxWidth: '450px' }}>
              Saat ini belum ada koin di Bitunix yang berada dalam jarak toleransi {threshold}% dari Swing Order Block + Strong Level.
              Coba naikkan slider threshold atau klik tombol <b>SCAN BITUNIX NOW</b>.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '18px',
            }}
          >
            {filteredSetups.map((s, idx) => {
              const isLong = s.signalType === 'LONG';
              const key = `${s.symbol}-${s.timeframe}-${s.signalType}`;
              const tgState = telegramStatus[key];

              return (
                <div
                  key={idx}
                  className={`glass-card ${isLong ? 'glow-bull' : 'glow-bear'}`}
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Signal header stripe */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '18px',
                          fontWeight: '800',
                          color: '#ffffff',
                          letterSpacing: '-0.3px',
                        }}
                      >
                        {s.symbol}
                      </span>
                      <span
                        style={{
                          background: '#30363d',
                          color: '#58a6ff',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                        }}
                      >
                        {s.timeframe.toUpperCase()}
                      </span>
                    </div>

                    <span
                      style={{
                        background: isLong ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: isLong ? '#10b981' : '#ef4444',
                        border: `1px solid ${isLong ? '#10b981' : '#ef4444'}`,
                        borderRadius: '20px',
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isLong ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {isLong ? 'LONG SETUP' : 'SHORT SETUP'}
                    </span>
                  </div>

                  {/* Proximity & Price Box */}
                  <div
                    style={{
                      background: '#0d1117',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      border: '1px solid #21262d',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: '6px',
                      }}
                    >
                      <span style={{ fontSize: '12px', color: '#8b949e' }}>Current Price:</span>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: '#f0f6fc' }} className="mono">
                        ${s.currentPrice.toLocaleString()}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ color: '#8b949e' }}>Distance to Zone:</span>
                      {s.isInsideZone ? (
                        <span style={{ color: '#fbbf24', fontWeight: '800' }}>⚠️ INSIDE ORDER BLOCK!</span>
                      ) : (
                        <span style={{ color: '#58a6ff', fontWeight: '700' }} className="mono">
                          {s.distancePct}% away
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SMC Structure Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8b949e' }}>Anchor Level:</span>
                      <span style={{ fontWeight: '700', color: isLong ? '#34d399' : '#f87171' }} className="mono">
                        {isLong ? 'STRONG LOW' : 'STRONG HIGH'} (${s.strongLevel.toLocaleString()})
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8b949e' }}>OB Boundaries:</span>
                      <span style={{ color: '#e6edf3', fontWeight: '600' }} className="mono">
                        ${s.obBottom.toLocaleString()} — ${s.obTop.toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        borderTop: '1px dashed #21262d',
                        paddingTop: '6px',
                      }}
                    >
                      <span style={{ color: '#8b949e' }}>Suggested SL:</span>
                      <span style={{ color: '#ef4444', fontWeight: '700' }} className="mono">
                        {isLong ? `< $${s.suggestedSL.toLocaleString()}` : `> $${s.suggestedSL.toLocaleString()}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8b949e' }}>Target TP (1:2):</span>
                      <span style={{ color: '#10b981', fontWeight: '700' }} className="mono">
                        ${s.suggestedTP.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      paddingTop: '12px',
                      borderTop: '1px solid #21262d',
                    }}
                  >
                    <a
                      href={`https://www.bitunix.com/futures/${s.symbol}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        flex: 1,
                        background: '#21262d',
                        color: '#c9d1d9',
                        border: '1px solid #30363d',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        fontSize: '12px',
                        fontWeight: '600',
                        textDecoration: 'none',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      Bitunix <ExternalLink size={12} />
                    </a>

                    <a
                      href={`https://www.tradingview.com/chart/?symbol=BINANCE:${s.symbol}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        flex: 1,
                        background: '#21262d',
                        color: '#c9d1d9',
                        border: '1px solid #30363d',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        fontSize: '12px',
                        fontWeight: '600',
                        textDecoration: 'none',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      TradingView <ExternalLink size={12} />
                    </a>

                    <button
                      onClick={() => sendToTelegram(s)}
                      disabled={tgState === 'sending' || tgState === 'sent'}
                      style={{
                        background: tgState === 'sent' ? '#238636' : '#1f6feb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: tgState ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {tgState === 'sending' ? (
                        'Sending...'
                      ) : tgState === 'sent' ? (
                        <>
                          <CheckCircle size={14} /> Sent!
                        </>
                      ) : (
                        <>
                          <Send size={13} /> Telegram
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
