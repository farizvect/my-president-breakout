import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeYahooChart,
  calculateEventImpact,
  parseNewsRss,
  pickNextEvent,
  latestMarketSummary,
} from '../market-core.mjs';

test('normalizeYahooChart removes null closes and returns dated points', () => {
  const payload = { chart: { result: [{
    timestamp: [1767229200, 1767315600, 1767402000],
    indicators: { quote: [{ close: [7000.125, null, 6930.5] }] },
  }] } };
  assert.deepEqual(normalizeYahooChart(payload), [
    { date: '2026-01-01', close: 7000.13 },
    { date: '2026-01-03', close: 6930.5 },
  ]);
});

test('calculateEventImpact uses previous, event-day and next trading closes', () => {
  const market = [
    { date: '2026-02-12', close: 7000 },
    { date: '2026-02-13', close: 6860 },
    { date: '2026-02-16', close: 6928.6 },
  ];
  assert.deepEqual(calculateEventImpact({ date: '2026-02-13' }, market), {
    previousClose: 7000,
    eventClose: 6860,
    nextClose: 6928.6,
    eventDate: '2026-02-13',
    nextDate: '2026-02-16',
    eventReturn: -2,
    nextReturn: 1,
  });
});

test('calculateEventImpact shifts a weekend event to the next trading session', () => {
  const market = [
    { date: '2026-02-13', close: 7000 },
    { date: '2026-02-16', close: 6930 },
    { date: '2026-02-17', close: 6964.65 },
  ];
  const result = calculateEventImpact({ date: '2026-02-14' }, market);
  assert.equal(result.eventDate, '2026-02-16');
  assert.equal(result.eventReturn, -1);
});

test('calculateEventImpact returns null when surrounding sessions are incomplete', () => {
  assert.equal(calculateEventImpact({ date: '2026-02-13' }, [
    { date: '2026-02-13', close: 7000 },
  ]), null);
});

test('parseNewsRss decodes and limits usable headlines', () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>IHSG Turun &amp; Rupiah Melemah - Example</title><link>https://example.com/a</link><pubDate>Mon, 27 Jul 2026 07:00:00 GMT</pubDate><source>Example</source></item>
    <item><title>Second headline</title><link>https://example.com/b</link><pubDate>Mon, 27 Jul 2026 06:00:00 GMT</pubDate></item>
  </channel></rss>`;
  assert.deepEqual(parseNewsRss(xml, 1), [{
    title: 'IHSG Turun & Rupiah Melemah',
    url: 'https://example.com/a',
    source: 'Example',
    publishedAt: '2026-07-27T07:00:00.000Z',
  }]);
});

test('pickNextEvent ignores past and unconfirmed events', () => {
  const events = [
    { date: '2026-07-20', status: 'confirmed' },
    { date: '2026-07-29', status: 'reported' },
    { date: '2026-08-01', status: 'confirmed' },
  ];
  assert.deepEqual(pickNextEvent(events, '2026-07-27'), events[2]);
});

test('latestMarketSummary compares the final two sessions, not range metadata', () => {
  assert.deepEqual(latestMarketSummary([
    { date: '2026-07-23', close: 6315.31 },
    { date: '2026-07-24', close: 6196.43 },
  ]), {
    price: 6196.43,
    previousClose: 6315.31,
    change: -118.88,
    changePercent: -1.88,
    date: '2026-07-24',
  });
});
