# mY President — IDX Breakout

Breakout dengan brick berisi **50 logo emiten Bursa Efek Indonesia**. Paddle-nya
wordmark **`mY President`**.

Terinspirasi [Open Weights Breakout](https://huggingface.co/spaces/burtenshaw/open-weights-breakout)
oleh burtenshaw.

## Main

```
python3 -m http.server 8080   # atau server statis apa pun
# buka http://localhost:8080
```

Kontrol: `←` `→` gerak · `Space` launch · `P` pause · mouse/touch juga jalan.

## Emiten

BBCA BBRI BMRI BBNI TLKM ASII UNVR ICBP INDF HMSP GGRM KLBF ANTM ADRO PTBA
INCO MDKA AMRT UNTR SMGR INTP CPIN JPFA MYOR SIDO TOWR EXCL ISAT MEDC PGAS
AKRA BRPT TPIA ESSA MAPI ACES ERAA BRIS BTPS ARTO BUKA GOTO EMTK SCMA MNCN
PWON CTRA BSDE SMRA WIKA

## Stack

Vanilla HTML + canvas + satu file JS. Tanpa dependensi, tanpa build step.

- `index.html` — shell + HUD
- `game.js` — game loop, fisika, render
- `check.mjs` — self-check (`node check.mjs`): semua ticker punya logo, grid tidak menabrak paddle
- `logos/` — 50 PNG

## Catatan

Logo dan merek dagang milik masing-masing emiten. Proyek ini non-komersial,
untuk keperluan hiburan. Bukan saran investasi.
