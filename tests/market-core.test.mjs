import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeYahooChart,
  calculateEventImpact,
  parseNewsRss,
  pickNextEvent,
  latestMarketSummary,
  filterMarketRange,
  nearestMarketPoint,
  chartTickLabel,
  normalizeYahooQuote,
  normalizeUsdIdrQuote,
  mergeQuoteIntoDailySeries,
  markMarketSnapshotStale,
  resolveMarketUrlState,
  headlineFreshness,
  isValidPriceSeriesSnapshot,
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
  assert.deepEqual(parseNewsRss('<item><title>Bad</title><link>javascript:alert(1)</link></item>'), []);
});

test('parseNewsRss returns the newest publications first before applying its limit', () => {
  const xml = `<rss><channel>
    <item><title>Older</title><link>https://example.com/older</link><pubDate>Mon, 27 Jul 2026 06:00:00 GMT</pubDate><source>Wire</source></item>
    <item><title>Newest</title><link>https://example.com/newest</link><pubDate>Mon, 27 Jul 2026 08:00:00 GMT</pubDate><source>Wire</source></item>
    <item><title>Middle</title><link>https://example.com/middle</link><pubDate>Mon, 27 Jul 2026 07:00:00 GMT</pubDate><source>Wire</source></item>
  </channel></rss>`;

  assert.deepEqual(parseNewsRss(xml, 2).map((headline) => headline.title), ['Newest', 'Middle']);
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

test('filterMarketRange keeps points inside the requested trailing calendar months', () => {
  const market = [
    { date: '2026-01-22', close: 7000 },
    { date: '2026-04-23', close: 6800 },
    { date: '2026-04-24', close: 6750 },
    { date: '2026-07-24', close: 6200 },
  ];
  assert.deepEqual(filterMarketRange(market, 3), market.slice(2));
  assert.deepEqual(filterMarketRange(market, 12), market);
});

test('nearestMarketPoint returns the first trading session on or after an event', () => {
  const market = [
    { date: '2026-05-15', close: 6500 },
    { date: '2026-05-18', close: 6400 },
    { date: '2026-05-20', close: 6318.5 },
  ];
  assert.deepEqual(nearestMarketPoint(market, '2026-05-17'), { index: 1, point: market[1] });
  assert.deepEqual(nearestMarketPoint(market, '2026-06-01'), { index: 2, point: market[2] });
});

test('chartTickLabel uses distinct day labels for short ranges', () => {
  assert.equal(chartTickLabel('2026-07-03', 60), '03 JUL');
  assert.equal(chartTickLabel('2026-07-24', 240), '2026-07');
});

test('normalizeYahooQuote calculates the live move from Yahoo intraday metadata', () => {
  const payload = {
    chart: {
      result: [{
        meta: {
          regularMarketPrice: 6196.43,
          previousClose: 6315.31,
          regularMarketTime: 1785120000,
          exchangeTimezoneName: 'Asia/Jakarta',
          currentTradingPeriod: { regular: { start: 1785117600, end: 1785143700 } },
        },
      }],
    },
  };

  assert.deepEqual(normalizeYahooQuote(payload, 1785120000), {
    price: 6196.43,
    previousClose: 6315.31,
    change: -118.88,
    changePercent: -1.88,
    quoteAt: '2026-07-27T02:40:00.000Z',
    exchangeTimezone: 'Asia/Jakarta',
    marketState: 'REGULAR',
  });

  payload.chart.result[0].meta.regularMarketTime = 1784883607;
  assert.equal(normalizeYahooQuote(payload, 1785120000).marketState, 'STALE');

  payload.chart.result[0].meta.regularMarketTime = 1785117600;
  assert.equal(normalizeYahooQuote(payload, 1785124800).marketState, 'STALE');
});

test('normalizeYahooQuote calculates percentage from the unrounded price difference', () => {
  const payload = { chart: { result: [{ meta: {
    regularMarketPrice: 16000.795,
    previousClose: 16000,
    regularMarketTime: 1785120000,
    exchangeTimezoneName: 'Asia/Jakarta',
    currentTradingPeriod: { regular: { start: 1785117600, end: 1785143700 } },
  } }] } };

  const quote = normalizeYahooQuote(payload, 1785120000);
  assert.equal(quote.change, 0.8);
  assert.equal(quote.changePercent, 0);
});

test('markMarketSnapshotStale prevents failed refreshes from retaining REGULAR state', () => {
  const market = { price: 6230.5, quoteAt: '2026-07-27T02:40:00.000Z', marketState: 'REGULAR' };
  const stale = markMarketSnapshotStale(market);

  assert.deepEqual(stale, { ...market, marketState: 'STALE' });
  assert.notEqual(stale, market);
  assert.equal(markMarketSnapshotStale(null), null);
});

test('normalizeUsdIdrQuote returns a labeled USD/IDR snapshot and rupiah move', () => {
  const payload = {
    chart: {
      result: [{
        meta: {
          regularMarketPrice: 16425.75,
          previousClose: 16380.25,
          regularMarketTime: 1785120000,
          exchangeTimezoneName: 'Asia/Jakarta',
          currentTradingPeriod: { regular: { start: 1785117600, end: 1785143700 } },
        },
      }],
    },
  };

  assert.deepEqual(normalizeUsdIdrQuote(payload, 1785120000), {
    symbol: 'IDR=X',
    pair: 'USD/IDR',
    baseCurrency: 'USD',
    quoteCurrency: 'IDR',
    price: 16425.75,
    previousClose: 16380.25,
    change: 45.5,
    changePercent: 0.28,
    quoteAt: '2026-07-27T02:40:00.000Z',
    exchangeTimezone: 'Asia/Jakarta',
    marketState: 'REGULAR',
  });
});

test('mergeQuoteIntoDailySeries updates or appends the live session without mutating history', () => {
  const original = [
    { date: '2026-07-23', close: 6315.31 },
    { date: '2026-07-24', close: 6180 },
  ];
  assert.deepEqual(mergeQuoteIntoDailySeries(original, '2026-07-24', 6196.43), [
    original[0],
    { date: '2026-07-24', close: 6196.43 },
  ]);
  assert.deepEqual(mergeQuoteIntoDailySeries(original, '2026-07-27', 6230), [
    ...original,
    { date: '2026-07-27', close: 6230 },
  ]);
  assert.equal(original[1].close, 6180);
});

test('resolveMarketUrlState accepts only known event ids and supported ranges', () => {
  const events = [{ id: 'one' }, { id: 'two' }];
  assert.deepEqual(resolveMarketUrlState('?event=two&range=6', events), { eventId: 'two', range: 6 });
  assert.deepEqual(resolveMarketUrlState('?event=unknown&range=99', events), { eventId: null, range: 12 });
});

test('headlineFreshness exposes the newest publication time without calling old news latest', () => {
  const headlines = [
    { publishedAt: '2026-07-26T01:00:00.000Z' },
    { publishedAt: '2026-07-27T02:00:00.000Z' },
  ];
  assert.deepEqual(headlineFreshness(headlines, Date.parse('2026-07-27T10:00:00.000Z')), {
    latestAt: '2026-07-27T02:00:00.000Z',
    state: 'CURRENT',
  });
  assert.equal(headlineFreshness(headlines, Date.parse('2026-07-29T10:00:00.000Z')).state, 'NO_NEW');
  assert.deepEqual(headlineFreshness(headlines, Date.parse('2026-07-26T10:00:00.000Z')), {
    latestAt: null,
    state: 'UNAVAILABLE',
  });
  assert.deepEqual(headlineFreshness(
    [{ publishedAt: '2026-07-27T10:00:00.001Z' }],
    Date.parse('2026-07-27T10:00:00.000Z'),
  ), { latestAt: null, state: 'UNAVAILABLE' });
  assert.deepEqual(headlineFreshness([], Date.now()), { latestAt: null, state: 'UNAVAILABLE' });
  assert.deepEqual(headlineFreshness(headlines, Date.parse('2026-07-27T10:00:00.000Z'), true), {
    latestAt: '2026-07-27T02:00:00.000Z',
    state: 'FETCH_FAILED',
  });
  assert.deepEqual(headlineFreshness([{ publishedAt: 'not-a-date' }], Date.now(), true), {
    latestAt: null,
    state: 'FETCH_FAILED',
  });
  assert.deepEqual(headlineFreshness([{ publishedAt: '2099-01-01T00:00:00.000Z' }], Date.now(), true), {
    latestAt: null,
    state: 'FETCH_FAILED',
  });
});

test('normalizeYahooQuote rejects null price/time and missing trading-period metadata', () => {
  const payload = { chart: { result: [{ meta: {
    regularMarketPrice: 7000,
    previousClose: 7010,
    regularMarketTime: 1785120000,
    exchangeTimezoneName: 'Asia/Jakarta',
    currentTradingPeriod: { regular: { start: 1785117600, end: 1785143700 } },
  } }] } };
  for (const field of ['regularMarketPrice', 'regularMarketTime']) {
    const malformed = structuredClone(payload);
    malformed.chart.result[0].meta[field] = null;
    assert.throws(() => normalizeYahooQuote(malformed, 1785120100));
  }
  const missingPeriod = structuredClone(payload);
  delete missingPeriod.chart.result[0].meta.currentTradingPeriod;
  assert.throws(() => normalizeYahooQuote(missingPeriod, 1785120100));
  const futureQuote = structuredClone(payload);
  futureQuote.chart.result[0].meta.regularMarketTime = 1785120160;
  assert.throws(() => normalizeYahooQuote(futureQuote, 1785120100));
  const invalidPeriod = structuredClone(payload);
  invalidPeriod.chart.result[0].meta.currentTradingPeriod.regular.start = -1;
  assert.throws(() => normalizeYahooQuote(invalidPeriod, 1785120100));
  const quoteOutsidePeriod = structuredClone(payload);
  quoteOutsidePeriod.chart.result[0].meta.currentTradingPeriod.regular = {
    start: 946684800,
    end: 946771200,
  };
  assert.throws(() => normalizeYahooQuote(quoteOutsidePeriod, 1785120100));
  const absurdlyLongPeriod = structuredClone(payload);
  absurdlyLongPeriod.chart.result[0].meta.currentTradingPeriod.regular = {
    start: 946684800,
    end: 1816656100,
  };
  assert.throws(() => normalizeYahooQuote(absurdlyLongPeriod, 1785120100));
});

test('cached price-series validation rejects malformed JSON shapes and broken points', () => {
  const valid = {
    price: 7000,
    previousClose: 7010,
    change: -10,
    changePercent: -0.14,
    quoteAt: new Date().toISOString(),
    marketState: 'REGULAR',
    points: [{ date: '2026-07-26', close: 7010 }, { date: '2026-07-27', close: 7000 }],
  };
  assert.equal(isValidPriceSeriesSnapshot(valid), true);
  assert.equal(isValidPriceSeriesSnapshot(null), false);
  assert.equal(isValidPriceSeriesSnapshot([]), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, price: -1 }), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, change: undefined }), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, change: 999 }), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, changePercent: 999 }), false);
  assert.equal(isValidPriceSeriesSnapshot({
    ...valid,
    previousClose: 7100,
    change: -100,
    changePercent: -1.41,
  }), true); // previousClose may diverge from prior bar; day-change math still holds
  assert.equal(isValidPriceSeriesSnapshot({
    ...valid,
    previousClose: 7100,
    change: -50, // broken day-change vs previousClose
    changePercent: -0.7,
  }), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, previousClose: undefined }), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, quoteAt: new Date(Date.now() + 60_000).toISOString() }), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, points: valid.points.slice(0, 1) }), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, points: [{ date: '2026-07-27', close: 0 }] }), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, points: [{ date: '2026-07-27', close: Number.NaN }] }), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, points: [{ date: 'bad', close: 7000 }] }), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, points: [...valid.points].reverse() }), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, points: [valid.points[0], valid.points[0]] }), false);
  assert.equal(isValidPriceSeriesSnapshot({
    ...valid,
    points: [...valid.points, { date: '2099-01-01', close: valid.price }],
  }), false);
  assert.equal(isValidPriceSeriesSnapshot({ ...valid, points: [valid.points[0], { ...valid.points[1], close: 6999 }] }), false);
  // Weekend gap / FX 24h: Yahoo previousClose need not equal the prior daily point.
  // Day-change math still binds previousClose to price.
  assert.equal(isValidPriceSeriesSnapshot({
    ...valid,
    previousClose: 7025,
    change: -25,
    changePercent: -0.36,
    points: [{ date: '2026-07-24', close: 7010 }, { date: '2026-07-27', close: 7000 }],
  }), true);
  assert.equal(isValidPriceSeriesSnapshot({
    ...valid,
    previousClose: 7025,
    change: -25,
    changePercent: -0.36,
  }), true);
});
