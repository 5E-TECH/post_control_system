# Beepost Printer Service - Windows

Windows uchun MQTT orqali TSPL thermal printer server.

## Talablar

- Windows 10/11
- Node.js 18+
- USB Thermal Printer (TSPL qo'llab-quvvatlaydigan)

## Tezkor o'rnatish

```bash
# 1. Paketlarni o'rnatish
npm install

# 2. Printeringizni tekshirish
node scripts/test-printer.js

# 3. EXE yaratish
npm run package
```

## Batafsil o'rnatish

### 1. Printeringizni aniqlash

Avval printeringiz qaysi portda ekanini aniqlang:

```bash
# Auto detect - barcha portlarni sinab ko'radi
node scripts/test-printer.js

# Yoki manual port bilan sinash
node scripts/test-printer.js COM3
node scripts/test-printer.js USB001
```

Test muvaffaqiyatli bo'lsa, qaysi port ishlaganini ko'rsatadi.

### 2. Config sozlash

`config.json` faylini o'zgartiring:

```json
{
  "mqtt": {
    "host": "mqtt://13.234.20.96:1883",
    "username": "shodiyor",
    "password": "root",
    "topic": "beepost/printer/print",
    "reconnectPeriod": 2000,
    "connectTimeout": 5000
  },
  "printer": {
    "port": "auto"
  },
  "app": {
    "name": "Beepost Printer Service",
    "logFile": "beepost-printer.log"
  }
}
```

**Printer port sozlamalari:**
| Qiymat | Ta'rif |
|--------|--------|
| `"auto"` | Avtomatik aniqlash |
| `"COM3"` | Serial/USB-Serial port |
| `"COM4"` | Boshqa COM port |
| `"USB001"` | USB printer port |
| `"LPT1"` | Parallel port |

**Muhim:** Agar `"auto"` ishlamasa, Device Manager dan printeringiz portini aniqlang va qo'lda yozing.

### 3. EXE yaratish va ishlatish

```bash
# Build va package
npm run package

# release/ papkasida beepost-printer.exe paydo bo'ladi
```

EXE faylni va `config.json` ni bir papkaga qo'ying va ishga tushiring.

## Ishlatish

### Oddiy ishga tushirish

```bash
# Development mode
npm run dev

# Production (build qilgandan keyin)
npm start

# EXE bilan
beepost-printer.exe
```

### Test print

```bash
# Test label chop etish
npm run dev -- --test

# Yoki EXE bilan
beepost-printer.exe --test
```

### Windows Service (ixtiyoriy)

Administrator CMD da:

```bash
# Service o'rnatish
npm run install-service

# Service o'chirish
npm run uninstall-service
```

## Muammolarni hal qilish

### 1. Printer topilmadi

**Device Manager tekshiring:**
1. `Win + X` -> Device Manager
2. "Ports (COM & LPT)" bo'limini oching
3. Printeringiz qaysi portda ekanini ko'ring (masalan: "USB Serial Device (COM3)")
4. `config.json` da shu portni yozing:
   ```json
   "printer": { "port": "COM3" }
   ```

### 2. USB port ishlamayapti

**Zadig driver o'rnating:**
1. https://zadig.akeo.ie/ dan yuklab oling
2. Options -> List All Devices
3. Printeringizni ro'yxatdan tanlang
4. WinUSB driver o'rnating
5. Kompyuterni restart qiling

### 3. MQTT ulanmayapti

1. **Internet tekshiring**
2. **Firewall tekshiring:** 1883 port ochiq bo'lishi kerak
3. **Config tekshiring:** host, username, password to'g'ri bo'lishi kerak

### 4. Print buyrug'i keldi, lekin chop bo'lmadi

1. Printerda qog'oz borligini tekshiring
2. Printer yoniq va USB ulangan ekanini tekshiring
3. Log faylni tekshiring: `beepost-printer.log`

## Arxitektura

```
printer-windows/
├── src/
│   ├── index.ts          # Main entry point
│   ├── printer.ts        # Windows USB/COM printer driver
│   ├── mqtt-client.ts    # MQTT client
│   ├── tspl-generator.ts # TSPL command generator
│   ├── logger.ts         # File logger
│   └── types.ts          # TypeScript types
├── scripts/
│   ├── test-printer.js      # Printer test utility
│   ├── install-service.js   # Windows service o'rnatish
│   └── uninstall-service.js # Windows service o'chirish
├── release/              # EXE chiqadigan papka
├── config.json           # Configuration
└── package.json
```

## Log fayllar

Barcha loglar `beepost-printer.log` faylida saqlanadi.

## Qo'llab-quvvatlanadigan printerlar

- Xprinter
- TSC
- HPRT
- Generic TSPL printers

## Yordam

Muammo bo'lsa: https://github.com/5E-TECH/post_control_system/issues
