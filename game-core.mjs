// Pure physics and power-up helpers. Kept DOM-free so gameplay behavior is testable.

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

export function reflectFromPaddle(ball, paddle, speed) {
  const relative = Math.max(-1, Math.min(1,
    (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2)));
  const angle = relative * (Math.PI * 0.38); // up to 68.4°, avoids flat horizontal traps
  return {
    vx: Math.sin(angle) * speed,
    vy: -Math.abs(Math.cos(angle) * speed),
  };
}

export function applyPowerUp(state, powerUp, now) {
  if (powerUp.type === 'slow') {
    const slowed = clampBallSpeed({
      vx: state.ball.vx * 0.55,
      vy: state.ball.vy * 0.55,
    }, 4, 12);
    state.ball.vx = slowed.vx;
    state.ball.vy = slowed.vy;
    return;
  }

  if (powerUp.type === 'wide') {
    state.paddleWidth = state.basePaddleWidth * 1.5;
    state.effectUntil = now + 10000;
  }
}

export function advancePowerUps(state, now) {
  if (state.effectUntil && now >= state.effectUntil) {
    state.paddleWidth = state.basePaddleWidth;
    state.effectUntil = 0;
  }
}
