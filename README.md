# Pidato Presiden — Simulator IHSG

> Beliau naik podium. Bursa mulai berkeringat.

Breakout satir. **Paddle-nya podium bertuliskan `Pidato Presiden`**, bricknya
**50 emiten Bursa Efek Indonesia**, dan bolanya adalah pernyataan.

Setiap kalimat yang mendarat bikin satu emiten kena ARB dan IHSG turun.
Tidak ada mekanik untuk menaikkan indeks. Memang tidak disediakan — itu
premisnya, dan `check.mjs` menegakkannya sebagai invariant.

Terinspirasi [Open Weights Breakout](https://huggingface.co/spaces/burtenshaw/open-weights-breakout)
oleh burtenshaw.

## Main

```
python3 -m http.server 8080   # atau server statis apa pun
# buka http://localhost:8080
```

Kontrol: `←` `→` geser podium · `Space` mulai bicara · `P` jeda · mouse/touch jalan.

## Aturan

| elemen | artinya |
|--------|---------|
| bola | pernyataan |
| paddle | podium |
| brick | emiten IDX |
| brick pecah | ARB, IHSG turun |
| baris bawah | blue chip, bobot turunnya lebih berat |
| bola jatuh | mikrofon mati, bursa dapat napas |
| nyawa habis | sisa emiten selamat karena pidatonya keburu habis |

IHSG buka di 7000.00. Clear sheet = 5200.00. Tidak ada jalan lain.

## Emiten

BBCA BBRI BMRI BBNI TLKM ASII UNVR ICBP INDF HMSP GGRM KLBF ANTM ADRO PTBA
INCO MDKA AMRT UNTR SMGR INTP CPIN JPFA MYOR SIDO TOWR EXCL ISAT MEDC PGAS
AKRA BRPT TPIA ESSA MAPI ACES ERAA BRIS BTPS ARTO BUKA GOTO EMTK SCMA MNCN
PWON CTRA BSDE SMRA WIKA

## Stack

Vanilla HTML + canvas + satu file JS. Tanpa dependensi, tanpa build step.

- `index.html` — shell, HUD indeks, catatan kaki
- `game.js` — game loop, fisika, render, kutipan
- `check.mjs` — self-check (`node check.mjs`): logo lengkap, grid tidak menabrak
  podium, dan IHSG tidak pernah naik
- `logos/` — 50 PNG

## Catatan

Satir, bukan saran investasi. Korelasi pidato dan indeks di sini dilebih-lebihkan
untuk keperluan komedi. Logo dan merek dagang milik masing-masing emiten;
kemunculannya di sini bukan endorsement dan bukan pernyataan tentang kinerja
perusahaan mana pun.
