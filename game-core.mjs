// Pure physics helpers. Kept DOM-free so gameplay behavior is testable.

export function circleHitsRect(circle, rect) {
  const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

export function clampBallSpeed(velocity, minSpeed, maxSpeed) {
  const speed = Math.hypot(velocity.vx, velocity.vy);
  if (speed === 0) return { vx: 0, vy: -minSpeed };
  const target = Math.max(minSpeed, Math.min(maxSpeed, speed));
  const scale = target / speed;
  return { vx: velocity.vx * scale, vy: velocity.vy * scale };
}

export function shouldHandleGameKey(tagName) {
  return !['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(String(tagName).toUpperCase());
}

export function reflectFromPaddle(ball, paddle, speed) {
  const relative = Math.max(-1, Math.min(1,
    (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2)));
  const angle = relative * (Math.PI * 0.38); // up to 68.4°, avoids flat horizontal traps
  return {
    vx: Math.sin(angle) * speed,
    vy: -Math.abs(Math.cos(angle) * speed),
  };
}

export function dailyChallengeSeed(date) {
  let hash = 2166136261;
  for (const character of `presidential-speech:${date}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildGameResult({ open, close, cleared, total, lives, challengeDate }) {
  return {
    open,
    close,
    damagePercent: Number((((close / open) - 1) * 100).toFixed(2)),
    cleared,
    total,
    sessionsRemaining: Math.max(0, lives),
    challengeDate,
  };
}

export function shouldTriggerHaptic(hasVibrationApi) {
  return hasVibrationApi === true;
}

export function gameResultLines(result) {
  const number = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return [
    `DAILY CHALLENGE · ${result.challengeDate}`,
    `IHSG ${number.format(result.open)} → ${number.format(result.close)}`,
    `DAMAGE ${result.damagePercent.toFixed(2)}%`,
    `LIMIT-DOWN ${result.cleared}/${result.total}`,
    `SESSIONS LEFT ${result.sessionsRemaining}`,
  ];
}

export function dateInJakarta(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
