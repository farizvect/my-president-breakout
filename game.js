// Pidato Presiden — Simulator IHSG. Vanilla canvas, no deps.
// Bola = pernyataan. Paddle = podium. Brick = emiten. Indeks cuma bisa turun.
'use strict';

const TICKERS = [
  'BBCA','BBRI','BMRI','BBNI','TLKM','ASII','UNVR','ICBP','INDF','HMSP',
  'GGRM','KLBF','ANTM','ADRO','PTBA','INCO','MDKA','AMRT','UNTR','SMGR',
  'INTP','CPIN','JPFA','MYOR','SIDO','TOWR','EXCL','ISAT','MEDC','PGAS',
  'AKRA','BRPT','TPIA','ESSA','MAPI','ACES','ERAA','BRIS','BTPS','ARTO',
  'BUKA','GOTO','EMTK','SCMA','MNCN','PWON','CTRA','BSDE','SMRA','WIKA',
];

// Kalimat yang muncul tiap satu emiten kena. Rakyat tenang, indeks tidak.
const QUOTES = [
  'Fundamental kita kuat.',
  'Ini hanya koreksi teknikal.',
  'Investor tidak perlu khawatir.',
  'Pertumbuhan kita di atas rata-rata dunia.',
  'Ekonomi kita resilient.',
  'Semua sudah sesuai kajian.',
  'Angka-angka ini bersifat sementara.',
  'Kami sedang mengkaji.',
  'Ini bagian dari transformasi.',
  'Dunia sedang tidak baik-baik saja.',
  'Tidak ada yang perlu dipanikkan.',
  'Justru ini momentum yang tepat.',
];

const W = 880, H = 620;
const COLS = 10, ROWS = 5;
const PAD_X = 24, TOP = 78, CELL_W = (W - PAD_X * 2) / COLS, CELL_H = 52;
const BRICK_W = CELL_W - 8, BRICK_H = CELL_H - 10;
const PADDLE_W = 168, PADDLE_H = 22, PADDLE_Y = H - 46;
const BALL_R = 6, BASE_SPEED = 6.2, MAX_SPEED = 12;
const IHSG_OPEN = 7000;

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const el = {
  score: document.getElementById('score'),
  delta: document.getElementById('delta'),
  lives: document.getElementById('lives'),
  cleared: document.getElementById('cleared'),
  overlay: document.getElementById('overlay'),
  otitle: document.getElementById('otitle'),
  omsg: document.getElementById('omsg'),
  start: document.getElementById('start'),
};

// ponytail: logos loaded as plain <img>, no sprite atlas. Add atlas when 50 -> 200+ bricks.
const images = TICKERS.map((t) => {
  const img = new Image();
  img.src = `logos/${t}.png`;
  return img;
});

let bricks, paddleX, ball, ihsg, lives, running, launched, paused, quote, quoteAt;
const keys = { left: false, right: false };

function reset(full) {
  bricks = TICKERS.map((t, i) => ({
    t,
    img: images[i],
    x: PAD_X + (i % COLS) * CELL_W + (CELL_W - BRICK_W) / 2,
    y: TOP + Math.floor(i / COLS) * CELL_H,
    alive: true,
  }));
  if (full) { ihsg = IHSG_OPEN; lives = 3; quote = ''; quoteAt = 0; }
  resetBall();
}

function resetBall() {
  paddleX = (W - PADDLE_W) / 2;
  ball = { x: W / 2, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 0 };
  launched = false;
}

function launch() {
  if (launched || !running || paused) return;
  const dir = Math.random() < 0.5 ? -1 : 1;
  ball.vx = dir * BASE_SPEED * 0.55;
  ball.vy = -BASE_SPEED * 0.83;
  launched = true;
}

function hud() {
  const pct = ((ihsg - IHSG_OPEN) / IHSG_OPEN) * 100;
  el.score.textContent = ihsg.toFixed(2);
  el.delta.textContent = `${pct <= 0 ? '' : '+'}${pct.toFixed(2)}%`;
  el.delta.className = pct < 0 ? 'down' : '';
  el.lives.textContent = '●'.repeat(Math.max(lives, 0)).padEnd(3, '○');
  el.cleared.textContent = `${bricks.filter((b) => !b.alive).length}/${bricks.length}`;
}

function overlay(title, msg, btn) {
  el.otitle.textContent = title;
  el.omsg.textContent = msg;
  el.start.textContent = btn;
  el.overlay.hidden = false;
}

function step() {
  if (keys.left) paddleX -= 9;
  if (keys.right) paddleX += 9;
  paddleX = Math.max(0, Math.min(W - PADDLE_W, paddleX));

  if (!launched) {
    ball.x = paddleX + PADDLE_W / 2;
    ball.y = PADDLE_Y - BALL_R - 2;
    return;
  }

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
  if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
  if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }

  // podium
  if (ball.vy > 0 && ball.y + BALL_R >= PADDLE_Y && ball.y - BALL_R <= PADDLE_Y + PADDLE_H
      && ball.x >= paddleX - BALL_R && ball.x <= paddleX + PADDLE_W + BALL_R) {
    const hit = (ball.x - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2); // -1..1
    const angle = hit * (Math.PI / 3); // max 60deg
    const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.015, MAX_SPEED);
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.abs(Math.cos(angle) * speed);
    ball.y = PADDLE_Y - BALL_R - 1;
  }

  // emiten — resolve on the shallower overlap axis
  for (const b of bricks) {
    if (!b.alive) continue;
    if (ball.x + BALL_R < b.x || ball.x - BALL_R > b.x + BRICK_W
        || ball.y + BALL_R < b.y || ball.y - BALL_R > b.y + BRICK_H) continue;
    const ox = Math.min(ball.x + BALL_R - b.x, b.x + BRICK_W - (ball.x - BALL_R));
    const oy = Math.min(ball.y + BALL_R - b.y, b.y + BRICK_H - (ball.y - BALL_R));
    if (ox < oy) ball.vx = ball.x < b.x + BRICK_W / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx);
    else ball.vy = ball.y < b.y + BRICK_H / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy);
    b.alive = false;
    // blue chip di baris bawah bobotnya lebih berat
    ihsg -= 12 + (ROWS - 1 - Math.floor((b.y - TOP) / CELL_H)) * 6;
    quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    quoteAt = performance.now();
    hud();
    break;
  }

  if (bricks.every((b) => !b.alive)) {
    running = false;
    overlay('Pidato selesai', `Semua 50 emiten kena ARB. IHSG ditutup di ${ihsg.toFixed(2)}. Terima kasih atas arahannya.`, 'PIDATO LAGI');
    return;
  }

  if (ball.y - BALL_R > H) {
    lives -= 1;
    hud();
    if (lives <= 0) {
      running = false;
      const saved = bricks.filter((b) => b.alive).length;
      overlay('Mikrofon mati', `${saved} emiten selamat karena pidatonya keburu habis. IHSG ${ihsg.toFixed(2)}.`, 'ULANGI');
    } else {
      resetBall();
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // kutipan terakhir
  if (quote && performance.now() - quoteAt < 2200) {
    ctx.fillStyle = '#4a4a4a';
    ctx.font = 'italic 13px ui-monospace, monospace';
    ctx.fillText(`" ${quote} "`, W / 2, 34);
  }

  for (const b of bricks) {
    if (!b.alive) continue;
    ctx.fillStyle = '#101010';
    ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
    ctx.strokeStyle = '#2a2a2a';
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, BRICK_W - 1, BRICK_H - 1);
    if (b.img.complete && b.img.naturalWidth) {
      const pad = 5;
      const s = Math.min((BRICK_W - pad * 2) / b.img.naturalWidth, (BRICK_H - pad * 2) / b.img.naturalHeight);
      const w = b.img.naturalWidth * s, h = b.img.naturalHeight * s;
      ctx.drawImage(b.img, b.x + (BRICK_W - w) / 2, b.y + (BRICK_H - h) / 2, w, h);
    } else {
      ctx.fillStyle = '#888';
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText(b.t, b.x + BRICK_W / 2, b.y + BRICK_H / 2);
    }
  }

  // podium = wordmark
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);
  ctx.fillStyle = '#000';
  ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('Pidato Presiden', paddleX + PADDLE_W / 2, PADDLE_Y + PADDLE_H / 2 + 1);

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = '#e8e8e8';
  ctx.fill();

  if (running && !launched && !paused) {
    ctx.fillStyle = '#666';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText('SPACE / tap untuk mulai bicara', W / 2, PADDLE_Y - 34);
  }
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '600 16px ui-monospace, monospace';
    ctx.fillText('JEDA — bursa menarik napas', W / 2, H / 2);
  }
}

function loop() {
  if (running && !paused) step();
  draw();
  requestAnimationFrame(loop);
}

function begin() {
  reset(true);
  hud();
  running = true; paused = false;
  el.overlay.hidden = true;
}

// input
el.start.addEventListener('click', begin);
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') keys.left = true;
  if (e.key === 'ArrowRight') keys.right = true;
  if (e.code === 'Space') { e.preventDefault(); running ? launch() : begin(); }
  if (e.key === 'p' || e.key === 'P') { if (running) paused = !paused; }
});
addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') keys.left = false;
  if (e.key === 'ArrowRight') keys.right = false;
});

function pointTo(clientX) {
  const r = cv.getBoundingClientRect();
  paddleX = Math.max(0, Math.min(W - PADDLE_W, ((clientX - r.left) / r.width) * W - PADDLE_W / 2));
}
cv.addEventListener('pointermove', (e) => { if (running && !paused) pointTo(e.clientX); });
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (!running) { begin(); return; }
  pointTo(e.clientX);
  launch();
});

reset(true);
hud();
overlay('Pidato Presiden', 'Pantulkan setiap kalimat ke arah emiten. Tenang, indeksnya yang menyesuaikan.', 'MULAI PIDATO');
loop();
