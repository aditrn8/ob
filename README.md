# ⚡ SMC Crypto Scanner Agent (TradingView LuxAlgo Style)

AI/Python Scanner otomatis untuk mendeteksi setup presisi tinggi berbasis **Smart Money Concepts (SMC)** ala indikator **LuxAlgo TradingView**:
- 🟢 **LONG Setup:** Harga mendekati **Swing Bullish Order Block (OB)** yang berhimpitan dengan **Strong Low**.
- 🔴 **SHORT Setup:** Harga mendekati **Swing Bearish Order Block (OB)** yang berhimpitan dengan **Strong High**.

Hasil scan dikirim secara real-time ke **Telegram Bot**, lengkap dengan snapshot visual **grafik candlestick dark-mode ala TradingView**, level Entry Zone, Anchor Strong Level, dan Stop Loss rekomendasi.

---

## 🚀 Fitur Utama

- 🧠 **Algoritma LuxAlgo SMC Presisi:**
  - Deteksi Swing High / Swing Low berbasis Dynamic Pivot Lookback.
  - Break of Structure (BOS) & Change of Character (CHoCH).
  - Klasifikasi **Strong High / Strong Low** (level terlindungi yang memicu breakout struktur).
  - Identifikasi **Unmitigated Swing Order Blocks** (hanya zona segar yang belum pernah di-tap/ditembus).
- 🕒 **Timeframe Dual Focus:** Men-scan timeframe **1H** dan **4H** (sweet spot untuk swing SMC).
- 📊 **Top Volume Auto-Scanner:** Otomatis mengambil Top 40-50 koin crypto Futures dengan volume trading 24 jam tertinggi.
- 🖼️ **Visual Chart Snapshot:** Menghasilkan gambar candlestick resolusi tinggi dengan kotak area Order Block dan garis Strong Level langsung di Telegram.
- 🛡️ **Anti-Spam Cooldown:** Mencegah spam notifikasi berulang jika harga bermain-main lama di zona yang sama.
- ☁️ **VPS Free-Tier Ready (Dockerized):** Siap dijalankan 24/7 nonstop di VPS gratis (Oracle Cloud Always Free / Google Cloud).

---

## 📁 Struktur Folder

```
SMC-Agent/
├── config/
│   └── settings.yaml          # Konfigurasi exchange, timeframe, threshold %, dll.
├── src/
│   ├── engine/
│   │   └── smc.py             # Logika LuxAlgo SMC (Pivot, BOS, Strong Low/High, OB)
│   ├── data/
│   │   └── fetcher.py         # CCXT data fetcher (OKX, Binance, Bybit)
│   ├── notifier/
│   │   ├── chart.py           # Generator grafik candlestick dark-mode (mplfinance)
│   │   └── telegram.py        # Pengirim alert Telegram (Text & Photo)
│   ├── scanner/
│   │   └── core.py            # Loop scanner utama & state cooldown
│   └── main.py                # CLI entry point
├── .env.example               # Contoh konfigurasi kredensial Telegram
├── docker-compose.yml         # 1-klik deploy di VPS / Docker
├── Dockerfile                 # Image build container
├── requirements.txt           # Python dependencies
└── README.md                  # Dokumentasi
```

---

## 🛠️ Panduan Instalasi Lokal

### 1. Prasyarat
- Python 3.10+
- Git

### 2. Clone Repository & Setup Environment
```bash
git clone <url-repo-github-kamu>
cd SMC-Agent

# Buat virtual environment
python -m venv .venv

# Aktifkan virtual environment
# Di Windows PowerShell:
.venv\Scripts\Activate.ps1
# Di Linux / macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Buat Bot Telegram & Chat ID
1. Buka Telegram dan cari **[@BotFather](https://t.me/BotFather)**.
2. Ketik `/newbot`, ikuti petunjuknya hingga mendapatkan **Bot Token** (contoh: `7123456789:AAH...`).
3. Kirim pesan apa saja (misal `hello`) ke bot yang baru kamu buat.
4. Cari bot **[@userinfobot](https://t.me/userinfobot)** di Telegram untuk melihat **Chat ID** akun Telegram kamu (angka, misal: `123456789`).
5. Copy file konfigurasi:
   ```bash
   cp .env.example .env
   ```
6. Buka `.env` dan masukkan token serta chat ID:
   ```env
   TELEGRAM_BOT_TOKEN="7123456789:AAH..."
   TELEGRAM_CHAT_ID="123456789"
   ```

### 4. Test Koneksi & Algoritma
```bash
# 1. Test koneksi Telegram (akan mengirim pesan test ke akun kamu)
python src/main.py --test-telegram

# 2. Test algoritma SMC pada BTC/USDT & generate contoh gambar chart
python src/main.py --test-smc

# 3. Jalankan satu kali putaran scan
python src/main.py --scan-once

# 4. Jalankan bot secara daemon (terus menerus 24/7)
python src/main.py
```

---

## ⚙️ Kustomisasi (`config/settings.yaml`)

Kamu dapat mengatur preferensi scanner di `config/settings.yaml`:
```yaml
exchange:
  id: "okx"                     # okx (bebas blokir), binance, atau bybit
  quote: "USDT"
  market_type: "swap"           # Perpetual Futures
  top_coins_limit: 40           # Jumlah koin liquid teratas
  candle_limit: 250             # Jumlah candle untuk deteksi pivot

scanner:
  timeframes:
    - "1h"
    - "4h"
  scan_interval_seconds: 180    # Interval jeda antar putaran scan (detik)
  proximity_threshold_pct: 0.85 # Alert jika jarak harga ke OB <= 0.85%
  cooldown_hours: 3             # Cooldown notifikasi per koin
  pivot_lookback: 5             # Lookback pivot swing (default LuxAlgo: 5)

telegram:
  enabled: true
  send_chart_image: true        # Kirim gambar chart visual
  chart_candles_display: 60     # Jumlah candle yang ditampilkan di gambar
```

---

## ☁️ Panduan Deploy 24/7 di VPS Gratis (Oracle Cloud)

Oracle Cloud menyediakan **Always Free Tier** dengan spesifikasi hingga 4 OCPU dan RAM 24 GB (permanen gratis).

### Langkah 1: Buat Instance di Oracle Cloud
1. Daftar akun di [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/).
2. Buat Compute Instance baru:
   - **Image:** Ubuntu 22.04 atau 24.04 LTS
   - **Shape:** Ampere VM.Standard.A1.Flex (ARM) atau AMD VM.Standard.E2.1.Micro
   - Download file private key SSH (`.key` / `.pem`).
3. Buka terminal laptop kamu dan hubungkan ke VPS:
   ```bash
   ssh -i /path/ke/private_key.key ubuntu@<IP_PUBLIC_VPS>
   ```

### Langkah 2: Install Docker di VPS
Jalankan perintah ini di VPS:
```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose
sudo apt install -y docker.io docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

### Langkah 3: Clone Repo & Jalankan
```bash
# Clone repo kamu dari GitHub
git clone https://github.com/<username-kamu>/<nama-repo>.git
cd <nama-repo>

# Buat file .env dengan token Telegram kamu
nano .env
# (Paste TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID, lalu tekan Ctrl+O, Enter, Ctrl+X)

# Jalankan bot di latar belakang (background)
docker compose up -d --build
```

### Langkah 4: Cek Status Bot
```bash
# Lihat log real-time
docker compose logs -f

# Cek apakah container berjalan
docker compose ps

# Menghentikan bot jika ingin update
docker compose down
```
> Karena menggunakan setting `restart: always`, bot akan **otomatis hidup kembali** bahkan jika VPS di-restart!

---

## 📜 Lisensi
MIT License. Dibuat untuk tujuan riset dan edukasi trading. Tetap gunakan risk management yang ketat!
