import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme, nextTheme } from '../theme-core.mjs';

test('resolveTheme respects a stored explicit preference', () => {
  assert.equal(resolveTheme('light', false), 'light');
  assert.equal(resolveTheme('dark', true), 'dark');
});

test('resolveTheme falls back to the system preference', () => {
  assert.equal(resolveTheme(null, true), 'light');
  assert.equal(resolveTheme(null, false), 'dark');
  assert.equal(resolveTheme('invalid', true), 'light');
});

test('nextTheme toggles between light and dark', () => {
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'light');
});
