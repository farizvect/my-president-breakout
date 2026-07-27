import test from 'node:test';
import assert from 'node:assert/strict';
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

test('game keyboard shortcuts ignore interactive controls', () => {
  assert.equal(shouldHandleGameKey('BODY'), true);
  assert.equal(shouldHandleGameKey('CANVAS'), true);
  assert.equal(shouldHandleGameKey('BUTTON'), false);
  assert.equal(shouldHandleGameKey('A'), false);
  assert.equal(shouldHandleGameKey('INPUT'), false);
});

test('daily challenge random sequence is deterministic for one Jakarta date', () => {
  const seed = dailyChallengeSeed('2026-07-27');
  assert.equal(seed, dailyChallengeSeed('2026-07-27'));
  assert.notEqual(seed, dailyChallengeSeed('2026-07-28'));

  const first = createSeededRandom(seed);
  const second = createSeededRandom(seed);
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
});

test('buildGameResult produces stable close, damage, and completion statistics', () => {
  assert.deepEqual(buildGameResult({
    open: 7000,
    close: 6514,
    cleared: 18,
    total: 50,
    lives: 2,
    challengeDate: '2026-07-27',
  }), {
    open: 7000,
    close: 6514,
    damagePercent: -6.94,
    cleared: 18,
    total: 50,
    sessionsRemaining: 2,
    challengeDate: '2026-07-27',
  });
});

test('game result lines are suitable for the share card without hidden state', () => {
  const lines = gameResultLines(buildGameResult({
    open: 7000, close: 6514, cleared: 18, total: 50, lives: 2, challengeDate: '2026-07-27',
  }));
  assert.deepEqual(lines, [
    'DAILY CHALLENGE · 2026-07-27',
    'IHSG 7,000.00 → 6,514.00',
    'DAMAGE -6.94%',
    'LIMIT-DOWN 18/50',
    'SESSIONS LEFT 2',
  ]);
});

test('Jakarta challenge date rolls at Jakarta midnight, not UTC midnight', () => {
  assert.equal(dateInJakarta(new Date('2026-07-26T16:59:59.000Z')), '2026-07-26');
  assert.equal(dateInJakarta(new Date('2026-07-26T17:00:00.000Z')), '2026-07-27');
});

test('haptic feedback is always enabled when the vibration API is supported', () => {
  assert.equal(shouldTriggerHaptic(true), true);
  assert.equal(shouldTriggerHaptic(false), false);
});
