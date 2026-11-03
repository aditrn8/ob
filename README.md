# ⚡ SMC Crypto Scanner Web App (Bitunix Edition)

Web App & Scanner otomatis berbasis **Smart Money Concepts (SMC)** ala **LuxAlgo TradingView** khusus koin-koin di **Bitunix Futures**:
- 🟢 **LONG Setup:** Harga mendekati **Swing Bullish Order Block (OB)** yang berhimpitan dengan **Strong Low**.
- 🔴 **SHORT Setup:** Harga mendekati **Swing Bearish Order Block (OB)** yang berhimpitan dengan **Strong High**.

Dilengkapi dengan Web Dashboard modern (Next.js), tombol **SCAN BITUNIX NOW**, filter timeframe (1H & 4H), slider toleransi jarak (%), tombol direct ke chart Bitunix/TradingView, dan tombol **Kirim Sinyal ke Telegram** (`@obxsinner_bot`).

---

## 🚀 Fitur Utama Web Dashboard

- 🌐 **Web Dashboard Responsive:** Buka kapan saja dari HP atau Laptop lewat browser.
- ⚡ **Khusus Koin Bitunix Futures:** Men-scan likuiditas top koin di exchange Bitunix secara real-time via Bitunix Public API.
- 🔘 **One-Click Scan:** Klik tombol **"SCAN BITUNIX NOW"** untuk memindai seluruh market dalam hitungan detik.
- 🎛️ **Filter Fleksibel:**
  - Pilihan timeframe: **1H**, **4H**, atau **Keduanya**.
  - Filter setup: **Semua**, **🟢 Long Saja**, atau **🔴 Short Saja**.
  - Slider toleransi jarak zona (**0.5% — 3.0%**).
  - Search box pencarian simbol koin (misal: `BTC`, `SOL`, `ETH`).
- ✈️ **One-Click Telegram Alert:** Tombol langsung kirim detail setup ke bot Telegram **`@obxsinner_bot`**.
- 📈 **Direct Chart Links:** Tombol langsung menuju grafik koin tersebut di Bitunix Futures dan TradingView.

---

## ☁️ Cara Deploy ke Vercel (100% Gratis & Tanpa Kartu Kredit!)

Vercel adalah platform hosting web terbaik di dunia — **100% Gratis dan tidak butuh kartu kredit sama sekali!**

### Langkah 1: Buka Vercel
1. Buka [**vercel.com**](https://vercel.com/) lalu klik **Sign Up** (pilih **Continue with GitHub**).

### Langkah 2: Import Repository
1. Di dashboard Vercel, klik tombol **Add New...** di pojok kanan atas ➔ pilih **Project**.
2. Cari repository lu: **`aditrn8/ob`** ➔ klik tombol **Import**.

### Langkah 3: Masukkan Token Telegram (Environment Variables)
1. Sebelum klik Deploy, buka accordion **Environment Variables**:
   * **Key:** `TELEGRAM_BOT_TOKEN`
     * **Value:** `8888160575:AAG2qKvl8o2UB3gklJkkulE23myRd1b1zB8`
   * **Key:** `TELEGRAM_CHAT_ID`
     * **Value:** `8304389417`

### Langkah 4: Klik Deploy!
1. Klik tombol **Deploy**.
2. Tunggu sekitar 30 detik sampai animasi kembang api selesai.
3. Web lu langsung aktif dengan link publik gratis (contoh: `https://ob-xxx.vercel.app`).
4. Buka link tersebut di HP atau laptop lu kapan saja!

---

## 💻 Menjalankan di Lokal Laptop

```bash
# Install dependencies
npm install

# Jalankan server development
npm run dev

# Buka di browser
# http://localhost:3000
```

---

## 📜 Lisensi
MIT License. Dibuat untuk edukasi dan riset strategi SMC Bitunix.
