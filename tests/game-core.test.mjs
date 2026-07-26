import test from 'node:test';
import assert from 'node:assert/strict';
import {
  circleHitsRect,
  reflectFromPaddle,
  clampBallSpeed,
  applyPowerUp,
  advancePowerUps,
} from '../game-core.mjs';

test('circleHitsRect detects edge and corner contact without false positives', () => {
  const rect = { x: 100, y: 100, w: 80, h: 30 };
  assert.equal(circleHitsRect({ x: 94, y: 115, r: 6 }, rect), true);
  assert.equal(circleHitsRect({ x: 95, y: 95, r: 6 }, rect), false);
  assert.equal(circleHitsRect({ x: 120, y: 80, r: 6 }, rect), false);
});

test('reflectFromPaddle sends center hits upward and edge hits sideways', () => {
  const center = reflectFromPaddle({ x: 200, vx: 1, vy: 7 }, { x: 120, w: 160 }, 8);
  assert.ok(Math.abs(center.vx) < 0.01);
  assert.ok(center.vy < 0);
  assert.ok(Math.abs(Math.hypot(center.vx, center.vy) - 8) < 0.001);

  const edge = reflectFromPaddle({ x: 275, vx: 1, vy: 7 }, { x: 120, w: 160 }, 8);
  assert.ok(edge.vx > 5);
  assert.ok(edge.vy < 0);
});

test('clampBallSpeed enforces both minimum and maximum speed', () => {
  assert.deepEqual(clampBallSpeed({ vx: 1, vy: 0 }, 4, 10), { vx: 4, vy: 0 });
  assert.deepEqual(clampBallSpeed({ vx: 30, vy: 40 }, 4, 10), { vx: 6, vy: 8 });
});

test('slow power-up reduces speed but never below minimum', () => {
  const state = { ball: { vx: 9, vy: -12 }, paddleWidth: 160, effectUntil: 0 };
  applyPowerUp(state, { type: 'slow' }, 1000);
  assert.ok(Math.abs(Math.hypot(state.ball.vx, state.ball.vy) - 8.25) < 0.001);
  assert.equal(state.paddleWidth, 160);
});

test('wide power-up extends paddle and expires back to base width', () => {
  const state = { ball: { vx: 4, vy: -5 }, paddleWidth: 160, basePaddleWidth: 160, effectUntil: 0 };
  applyPowerUp(state, { type: 'wide' }, 1000);
  assert.equal(state.paddleWidth, 240);
  assert.equal(state.effectUntil, 11000);
  advancePowerUps(state, 10999);
  assert.equal(state.paddleWidth, 240);
  advancePowerUps(state, 11000);
  assert.equal(state.paddleWidth, 160);
});
