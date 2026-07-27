import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SPEECH_QUOTES,
  SPEECH_QUOTE_TEXTS,
  pickSpeechQuote,
} from '../speech-quotes.mjs';
import { createSeededRandom, dailyChallengeSeed } from '../game-core.mjs';

test('speech quote pool contains sourced, unique, canvas-safe quotations', () => {
  assert.ok(SPEECH_QUOTES.length >= 12);
  assert.equal(SPEECH_QUOTE_TEXTS.length, SPEECH_QUOTES.length);
  assert.equal(new Set(SPEECH_QUOTE_TEXTS).size, SPEECH_QUOTES.length);

  for (const entry of SPEECH_QUOTES) {
    assert.equal(typeof entry.text, 'string');
    assert.ok(entry.text.length > 4);
    assert.ok(entry.text.length <= 90, `quote is too wide for the canvas: ${entry.text}`);
    assert.equal(typeof entry.context, 'string');
    assert.ok(entry.context.length > 4);
    assert.match(entry.source, /^https:\/\//);
    assert.equal(typeof entry.sourceLabel, 'string');
    assert.ok(entry.sourceLabel.length > 2);
  }
});

test('speech quote pool covers the requested documented remarks', () => {
  const text = SPEECH_QUOTE_TEXTS.join('\n');

  assert.match(text, /desa enggak pakai dolar/i);
  assert.match(text, /antek-antek asing/i);
  assert.match(text, /Makan Bergizi Gratis/i);
  assert.match(text, /negara besar/i);
  assert.match(text, /ndasmu etik/i);
});

test('mid-sentence excerpts preserve source casing, punctuation, and omissions', () => {
  const exactExcerpts = [
    '…mereka ya itu, sudah jadi antek-antek asing, …',
    '…semakin pintar, banyak yang pintar, pintar maling.',
    '…sopan-sopan tetap maling, sopan-sopan korupsi.',
    '…nanti maling-maling kita akan semua kejar itu, …',
    'Yang mau membela maling-maling itu, silakan di situ.',
  ];

  for (const excerpt of exactExcerpts) {
    assert.ok(SPEECH_QUOTE_TEXTS.includes(excerpt), `missing source-exact excerpt: ${excerpt}`);
  }
});

test('speech quote pool removes the old fictional market reassurance copy', () => {
  const text = SPEECH_QUOTE_TEXTS.join('\n');

  assert.doesNotMatch(text, /fundamentals remain strong/i);
  assert.doesNotMatch(text, /technical correction/i);
  assert.doesNotMatch(text, /investors should remain calm/i);
});

test('pickSpeechQuote selects a documented quote across the full random range', () => {
  assert.equal(pickSpeechQuote(() => 0), SPEECH_QUOTE_TEXTS[0]);
  assert.equal(pickSpeechQuote(() => 0.999999), SPEECH_QUOTE_TEXTS.at(-1));
});

test('seeded daily runs produce the same documented quote sequence', () => {
  const seed = dailyChallengeSeed('2026-07-27') ^ 0x85EBCA6B;
  const first = createSeededRandom(seed);
  const second = createSeededRandom(seed);
  assert.deepEqual(
    Array.from({ length: 8 }, () => pickSpeechQuote(first)),
    Array.from({ length: 8 }, () => pickSpeechQuote(second)),
  );
});
