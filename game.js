import {
  circleHitsRect,
  reflectFromPaddle,
  clampBallSpeed,
  shouldHandleGameKey,
  createSeededRandom,
  dailyChallengeSeed,
  buildGameResult,
  gameResultLines,
  dateInJakarta,
  shouldTriggerHaptic,
} from './game-core.mjs';
import { pickSpeechQuote } from './speech-quotes.mjs';

const TICKERS = [
  'BBCA','BBRI','BMRI','BBNI','TLKM','ASII','UNVR','ICBP','INDF','HMSP',
  'GGRM','KLBF','ANTM','ADRO','PTBA','INCO','MDKA','AMRT','UNTR','SMGR',
  'INTP','CPIN','JPFA','MYOR','SIDO','TOWR','EXCL','ISAT','MEDC','PGAS',
  'AKRA','BRPT','TPIA','ESSA','MAPI','ACES','ERAA','BRIS','BTPS','ARTO',
  'BUKA','GOTO','EMTK','SCMA','MNCN','PWON','CTRA','BSDE','SMRA','WIKA',
];

const W = 880, H = 620;
const COLS = 10, ROWS = 5;
const PAD_X = 24, TOP = 78, CELL_W = (W - PAD_X * 2) / COLS, CELL_H = 52;
const BRICK_W = CELL_W - 8, BRICK_H = CELL_H - 10;
const BASE_PADDLE_W = 168, PADDLE_H = 22, PADDLE_Y = H - 46;
const BALL_R = 6, BASE_SPEED = 380, MIN_SPEED = 250, MAX_SPEED = 720;
const IHSG_OPEN = 7000;
const FIXED_STEP = 1 / 120;

let challengeDate = dateInJakarta();
let challengeSeed = dailyChallengeSeed(challengeDate);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let gameplayRandom = createSeededRandom(challengeSeed);
let effectsRandom = createSeededRandom(challengeSeed ^ 0x9E3779B9);
let quoteRandom = createSeededRandom(challengeSeed ^ 0x85EBCA6B);
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let palette = {};

function refreshPalette() {
  const styles = getComputedStyle(document.documentElement);
  const color = (name) => styles.getPropertyValue(name).trim();
  palette = {
    brick: color('--canvas-brick'),
    brickBorder: color('--canvas-brick-border'),
    quote: color('--canvas-quote'),
    accent: color('--canvas-accent'),
    fallback: color('--canvas-fallback'),
    paddle: color('--canvas-paddle'),
    paddleText: color('--canvas-paddle-text'),
    ball: color('--canvas-ball'),
  };
}
refreshPalette();
window.addEventListener('themechange', refreshPalette);

const el = {
  score: document.getElementById('score'),
  delta: document.getElementById('delta'),
  lives: document.getElementById('lives'),
  cleared: document.getElementById('cleared'),
  challenge: document.getElementById('challenge-date'),
  overlay: document.getElementById('overlay'),
  otitle: document.getElementById('otitle'),
  omsg: document.getElementById('omsg'),
  start: document.getElementById('start'),
  stage: document.getElementById('stage'),
  result: document.getElementById('result-summary'),
  share: document.getElementById('share-result'),
  shareStatus: document.getElementById('share-status'),
};

const imageFor = (ticker) => {
  const img = new Image();
  img.src = `logos/${ticker}.png`;
  return img;
};
const images = Object.fromEntries(TICKERS.map((ticker) => [ticker, imageFor(ticker)]));

const state = {
  ball: { x: W / 2, y: 0, vx: 0, vy: 0 },
};
let bricks, paddleX, ihsg, lives, running, launched, quote, quoteAt;
let particles = [], trail = [], shake = 0;
let lastTime = 0, accumulator = 0;
let lastResult = null;
const keys = { left: false, right: false };

function reset(full) {
  bricks = TICKERS.map((ticker, i) => ({
    ticker,
    x: PAD_X + (i % COLS) * CELL_W + (CELL_W - BRICK_W) / 2,
    y: TOP + Math.floor(i / COLS) * CELL_H,
    alive: true,
  }));
  if (full) {
    ihsg = IHSG_OPEN;
    lives = 3;
    quote = '';
    quoteAt = 0;
    particles = [];
    trail = [];
    gameplayRandom = createSeededRandom(challengeSeed);
    effectsRandom = createSeededRandom(challengeSeed ^ 0x9E3779B9);
    quoteRandom = createSeededRandom(challengeSeed ^ 0x85EBCA6B);
  }
  resetBall();
}

function resetBall() {
  paddleX = (W - BASE_PADDLE_W) / 2;
  Object.assign(state.ball, { x: W / 2, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 0 });
  trail = [];
  launched = false;
}

function launch() {
  if (launched || !running) return;
  const angle = (gameplayRandom() * 0.5 - 0.25) + (gameplayRandom() < 0.5 ? -0.42 : 0.42);
  state.ball.vx = Math.sin(angle) * BASE_SPEED;
  state.ball.vy = -Math.abs(Math.cos(angle) * BASE_SPEED);
  launched = true;
}

function hud() {
  const pct = ((ihsg - IHSG_OPEN) / IHSG_OPEN) * 100;
  el.score.textContent = ihsg.toFixed(2);
  el.delta.textContent = `${pct.toFixed(2)}%`;
  el.delta.className = pct < 0 ? 'down' : '';
  el.lives.textContent = '●'.repeat(Math.max(lives, 0)).padEnd(3, '○');
  el.cleared.textContent = `${bricks.filter((b) => !b.alive).length}/${bricks.length}`;
}

function overlay(title, msg, button) {
  el.stage.classList.remove('result-active');
  el.otitle.textContent = title;
  el.omsg.textContent = msg;
  el.start.textContent = button;
  el.result.hidden = true;
  el.share.hidden = true;
  el.shareStatus.textContent = '';
  el.overlay.hidden = false;
}

function finish(title, message, button) {
  running = false;
  lastResult = buildGameResult({
    open: IHSG_OPEN,
    close: ihsg,
    cleared: bricks.filter((brick) => !brick.alive).length,
    total: bricks.length,
    lives,
    challengeDate,
  });
  el.otitle.textContent = title;
  el.omsg.textContent = message;
  el.start.textContent = button;
  el.result.replaceChildren(...gameResultLines(lastResult).map((line) => {
    const item = document.createElement('div');
    item.className = 'result-line';
    item.textContent = line;
    return item;
  }));
  el.result.hidden = false;
  el.share.hidden = false;
  el.shareStatus.textContent = '';
  el.stage.classList.add('result-active');
  el.overlay.hidden = false;
}

function resultCardBlob(result) {
  const card = document.createElement('canvas');
  card.width = 1200;
  card.height = 630;
  const cardContext = card.getContext('2d');
  const styles = getComputedStyle(document.documentElement);
  const background = styles.getPropertyValue('--bg').trim() || '#050505';
  const foreground = styles.getPropertyValue('--fg').trim() || '#e9e9e6';
  const muted = styles.getPropertyValue('--muted').trim() || '#92928d';
  const danger = styles.getPropertyValue('--danger').trim() || '#ff6767';
  cardContext.fillStyle = background;
  cardContext.fillRect(0, 0, card.width, card.height);
  cardContext.strokeStyle = foreground;
  cardContext.lineWidth = 2;
  cardContext.strokeRect(56, 56, card.width - 112, card.height - 112);
  cardContext.fillStyle = foreground;
  cardContext.font = '700 38px ui-monospace, monospace';
  cardContext.fillText('PRESIDENTIAL SPEECH RESULT', 92, 132);
  gameResultLines(result).forEach((line, index) => {
    cardContext.fillStyle = index === 2 ? danger : index ? foreground : muted;
    cardContext.font = `${index === 2 ? '700 42px' : '500 30px'} ui-monospace, monospace`;
    cardContext.fillText(line, 92, 214 + index * 65);
  });
  cardContext.fillStyle = muted;
  cardContext.font = '22px ui-monospace, monospace';
  cardContext.fillText('SATIRE · NOT INVESTMENT ADVICE', 92, 548);
  return new Promise((resolve, reject) => card.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('PNG export failed')),
    'image/png',
  ));
}

async function shareResult() {
  if (!lastResult) return;
  el.shareStatus.textContent = 'PREPARING PNG…';
  try {
    const blob = await resultCardBlob(lastResult);
    const filename = `presidential-speech-${lastResult.challengeDate}.png`;
    if (typeof File === 'function' && navigator.share) {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Presidential Speech Result' });
          el.shareStatus.textContent = 'RESULT SHARED';
          return;
        } catch (error) {
          if (error?.name === 'AbortError') {
            el.shareStatus.textContent = 'SHARE CANCELLED';
            return;
          }
          // Fall through to a normal PNG download when native sharing is unavailable at runtime.
        }
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    el.shareStatus.textContent = 'PNG DOWNLOADED';
  } catch (error) {
    if (error?.name === 'AbortError') el.shareStatus.textContent = 'SHARE CANCELLED';
    else el.shareStatus.textContent = 'PNG EXPORT FAILED';
  }
}

function spawnParticles(x, y) {
  if (reducedMotion) return;
  for (let i = 0; i < 8; i += 1) {
    const angle = effectsRandom() * Math.PI * 2;
    const speed = 45 + effectsRandom() * 100;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0.45 + effectsRandom() * 0.25 });
  }
}


function resolveBrickCollision(brick, previous) {
  const ball = state.ball;
  const cameFromLeft = previous.x + BALL_R <= brick.x;
  const cameFromRight = previous.x - BALL_R >= brick.x + BRICK_W;
  const cameFromTop = previous.y + BALL_R <= brick.y;
  const cameFromBottom = previous.y - BALL_R >= brick.y + BRICK_H;

  if (cameFromLeft) { ball.x = brick.x - BALL_R; ball.vx = -Math.abs(ball.vx); }
  else if (cameFromRight) { ball.x = brick.x + BRICK_W + BALL_R; ball.vx = Math.abs(ball.vx); }
  else if (cameFromTop) { ball.y = brick.y - BALL_R; ball.vy = -Math.abs(ball.vy); }
  else if (cameFromBottom) { ball.y = brick.y + BRICK_H + BALL_R; ball.vy = Math.abs(ball.vy); }
  else {
    const dx = ball.x - (brick.x + BRICK_W / 2);
    const dy = ball.y - (brick.y + BRICK_H / 2);
    if (Math.abs(dx / BRICK_W) > Math.abs(dy / BRICK_H)) ball.vx *= -1;
    else ball.vy *= -1;
  }
}


function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 180 * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
}

function step(dt, now) {
  const movement = 520 * dt;
  if (keys.left) paddleX -= movement;
  if (keys.right) paddleX += movement;
  paddleX = Math.max(0, Math.min(W - BASE_PADDLE_W, paddleX));

  updateParticles(dt);

  if (!launched) {
    state.ball.x = paddleX + BASE_PADDLE_W / 2;
    state.ball.y = PADDLE_Y - BALL_R - 2;
    hud(now);
    return;
  }

  const ball = state.ball;
  const previous = { x: ball.x, y: ball.y };
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); shake = 2; }
  if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); shake = 2; }
  if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); shake = 2; }

  const paddle = { x: paddleX, y: PADDLE_Y, w: BASE_PADDLE_W, h: PADDLE_H };
  if (ball.vy > 0 && circleHitsRect({ x: ball.x, y: ball.y, r: BALL_R }, paddle)) {
    const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.035, MAX_SPEED);
    Object.assign(ball, reflectFromPaddle(ball, paddle, speed));
    ball.y = PADDLE_Y - BALL_R - 0.5;
    shake = 2.5;
  }

  for (const brick of bricks) {
    if (!brick.alive || !circleHitsRect({ x: ball.x, y: ball.y, r: BALL_R },
      { x: brick.x, y: brick.y, w: BRICK_W, h: BRICK_H })) continue;
    resolveBrickCollision(brick, previous);
    brick.alive = false;
    ihsg -= 12 + (ROWS - 1 - Math.floor((brick.y - TOP) / CELL_H)) * 6;
    quote = pickSpeechQuote(quoteRandom);
    quoteAt = now;
    spawnParticles(brick.x + BRICK_W / 2, brick.y + BRICK_H / 2);
    if (shouldTriggerHaptic(typeof navigator.vibrate === 'function')) navigator.vibrate(12);
    shake = 4;
    const safe = clampBallSpeed(ball, MIN_SPEED, MAX_SPEED);
    ball.vx = safe.vx;
    ball.vy = safe.vy;
    hud(now);
    break;
  }

  if (!reducedMotion) {
    trail.unshift({ x: ball.x, y: ball.y });
    if (trail.length > 8) trail.pop();
  }

  if (bricks.every((brick) => !brick.alive)) {
    finish('Speech concluded', `All 50 stocks hit limit-down. The index closed at ${ihsg.toFixed(2)}. Thank you for the guidance.`, 'SPEAK AGAIN');
    return;
  }

  if (ball.y - BALL_R > H) {
    lives -= 1;
    hud(now);
    if (lives <= 0) {
      const saved = bricks.filter((brick) => brick.alive).length;
      finish('Microphone disconnected', `${saved} stocks survived because the speech ended early. IHSG: ${ihsg.toFixed(2)}.`, 'TRY AGAIN');
    } else resetBall();
  }
}

function drawImageContained(img, x, y, w, h, padding = 5) {
  if (!img.complete || !img.naturalWidth) return false;
  const scale = Math.min((w - padding * 2) / img.naturalWidth, (h - padding * 2) / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  return true;
}

function draw(now) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (!reducedMotion && shake > 0.1) {
    ctx.translate((effectsRandom() - 0.5) * shake, (effectsRandom() - 0.5) * shake);
    shake *= 0.84;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (quote && now - quoteAt < 2200) {
    ctx.fillStyle = palette.quote;
    ctx.font = 'italic 13px ui-monospace, monospace';
    ctx.fillText(`“ ${quote} ”`, W / 2, 34);
  }

  for (const brick of bricks) {
    if (!brick.alive) continue;
    ctx.fillStyle = palette.brick;
    ctx.fillRect(brick.x, brick.y, BRICK_W, BRICK_H);
    ctx.strokeStyle = palette.brickBorder;
    ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, BRICK_W - 1, BRICK_H - 1);
    if (!drawImageContained(images[brick.ticker], brick.x, brick.y, BRICK_W, BRICK_H)) {
      ctx.fillStyle = palette.fallback;
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText(brick.ticker, brick.x + BRICK_W / 2, brick.y + BRICK_H / 2);
    }
  }


  for (let i = trail.length - 1; i >= 0; i -= 1) {
    const alpha = (trail.length - i) / trail.length * 0.16;
    ctx.beginPath();
    ctx.arc(trail[i].x, trail[i].y, BALL_R * (1 - i / trail.length * 0.55), 0, Math.PI * 2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = palette.accent;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = palette.paddle;
  ctx.fillRect(paddleX, PADDLE_Y, BASE_PADDLE_W, PADDLE_H);
  ctx.fillStyle = palette.paddleText;
  ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('Presidential Speech', paddleX + BASE_PADDLE_W / 2, PADDLE_Y + PADDLE_H / 2 + 1);

  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = palette.ball;
  ctx.fill();

  if (running && !launched) {
    ctx.fillStyle = palette.fallback;
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText('SPACE / tap to begin speaking', W / 2, PADDLE_Y - 34);
  }
  ctx.restore();
}

function loop(now) {
  if (!lastTime) lastTime = now;
  const frameTime = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  if (running) {
    accumulator += frameTime;
    while (accumulator >= FIXED_STEP) {
      step(FIXED_STEP, now);
      accumulator -= FIXED_STEP;
    }
  }
  hud(now);
  draw(now);
  requestAnimationFrame(loop);
}

function begin() {
  challengeDate = dateInJakarta();
  challengeSeed = dailyChallengeSeed(challengeDate);
  el.challenge.textContent = challengeDate;
  el.stage.classList.remove('result-active');
  reset(true);
  hud();
  running = true;
  lastResult = null;
  accumulator = 0;
  el.overlay.hidden = true;
  cv.focus({ preventScroll: true });
}

el.start.addEventListener('click', begin);
el.share.addEventListener('click', shareResult);
addEventListener('keydown', (event) => {
  if (!shouldHandleGameKey(event.target?.tagName)) return;
  if (event.key === 'ArrowLeft') keys.left = true;
  if (event.key === 'ArrowRight') keys.right = true;
  if (event.code === 'Space') { event.preventDefault(); running ? launch() : begin(); }
});
addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft') keys.left = false;
  if (event.key === 'ArrowRight') keys.right = false;
});

function pointTo(clientX) {
  const rect = cv.getBoundingClientRect();
  paddleX = Math.max(0, Math.min(W - BASE_PADDLE_W,
    ((clientX - rect.left) / rect.width) * W - BASE_PADDLE_W / 2));
}
cv.addEventListener('pointermove', (event) => { if (running) pointTo(event.clientX); });
cv.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  if (!running) { begin(); return; }
  pointTo(event.clientX);
  launch();
});

reset(true);
hud();
el.challenge.textContent = challengeDate;
overlay('Presidential Speech', 'Every statement moves the market. Usually in one direction.', 'BEGIN SPEECH');
requestAnimationFrame(loop);
