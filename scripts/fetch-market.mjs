#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import {
  normalizeYahooChart,
  normalizeYahooQuote,
  normalizeUsdIdrQuote,
  mergeQuoteIntoDailySeries,
  markMarketSnapshotStale,
  isValidPriceSeriesSnapshot,
} from '../market-core.mjs';

const ROOT = new URL('../', import.meta.url);
const OUTPUT = new URL('data/market.json', ROOT);
const LEGACY = new URL('data/live.json', ROOT);
const MARKET_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?range=1y&interval=1d';
const QUOTE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?range=1d&interval=1m';
const FX_HISTORY_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/IDR%3DX?range=1y&interval=1d';
const FX_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/IDR%3DX?range=1d&interval=1m';
const headers = { 'user-agent': 'Mozilla/5.0 (compatible; IHSG-Speech-Impact/1.0)' };

async function fetchText(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function previousSnapshot() {
  for (const path of [OUTPUT, LEGACY]) {
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8'));
      return {
        market: isValidPriceSeriesSnapshot(parsed?.market) ? parsed.market : null,
        fx: isValidPriceSeriesSnapshot(parsed?.fx) ? parsed.fx : null,
      };
    } catch {
      // try next
    }
  }
  return { market: null, fx: null };
}

function dateInTimeZone(isoDate, timeZone) {
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone,
  }).formatToParts(new Date(isoDate));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

const previous = await previousSnapshot();
const errors = [];
let market = previous.market;
let fx = previous.fx;

try {
  const [dailyPayload, quotePayload] = await Promise.all([
    fetchText(MARKET_URL).then(JSON.parse),
    fetchText(QUOTE_URL).then(JSON.parse),
  ]);
  let points = normalizeYahooChart(dailyPayload);
  if (points.length < 20) throw new Error(`market series too short: ${points.length}`);
  const quote = normalizeYahooQuote(quotePayload);
  const quoteDate = dateInTimeZone(quote.quoteAt, quote.exchangeTimezone);
  points = mergeQuoteIntoDailySeries(points, quoteDate, quote.price);
  market = {
    symbol: '^JKSE',
    name: 'IDX Composite',
    currency: 'IDR',
    delayed: true,
    refreshIntervalMinutes: 5,
    ...quote,
    date: quoteDate,
    points,
    fetchedAt: quote.quoteAt,
  };
} catch (error) {
  errors.push(`market: ${error.message}`);
  market = markMarketSnapshotStale(market);
}

const [fxHistoryResult, fxQuoteResult] = await Promise.allSettled([
  fetchText(FX_HISTORY_URL).then(JSON.parse).then((payload) => {
    const points = normalizeYahooChart(payload);
    if (points.length < 20) throw new Error(`FX series too short: ${points.length}`);
    return points;
  }),
  fetchText(FX_URL).then(JSON.parse).then((payload) => normalizeUsdIdrQuote(payload)),
]);

const historyPoints = fxHistoryResult.status === 'fulfilled' ? fxHistoryResult.value : null;
const freshFxQuote = fxQuoteResult.status === 'fulfilled' ? fxQuoteResult.value : null;
if (fxHistoryResult.status === 'rejected') errors.push(`fx history: ${fxHistoryResult.reason?.message ?? String(fxHistoryResult.reason)}`);
if (fxQuoteResult.status === 'rejected') errors.push(`fx quote: ${fxQuoteResult.reason?.message ?? String(fxQuoteResult.reason)}`);

if (freshFxQuote) {
  const quoteDate = dateInTimeZone(freshFxQuote.quoteAt, freshFxQuote.exchangeTimezone);
  const basePoints = historyPoints ?? fx?.points ?? [];
  fx = {
    ...freshFxQuote,
    delayed: true,
    refreshIntervalMinutes: 5,
    points: mergeQuoteIntoDailySeries(basePoints, quoteDate, freshFxQuote.price),
    fetchedAt: freshFxQuote.quoteAt,
  };
} else if (fx) {
  fx = {
    ...markMarketSnapshotStale(fx),
    points: historyPoints ?? fx.points ?? [],
  };
}

if (!isValidPriceSeriesSnapshot(market)) {
  throw new Error(`No valid market snapshot available. ${errors.join('; ')}`);
}
if (fx && !isValidPriceSeriesSnapshot(fx)) {
  errors.push('fx: assembled snapshot failed validation');
  fx = null;
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  market,
  fx,
  errors,
  sources: {
    market: 'Yahoo Finance ^JKSE intraday (5-minute workflow; delayed)',
    fx: 'Yahoo Finance IDR=X daily history + intraday (5-minute workflow; delayed)',
  },
};
await mkdir(new URL('data/', ROOT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote ${OUTPUT.pathname}: ${market.points.length} market points, fx=${fx ? 'yes' : 'no'}${errors.length ? `; fallback: ${errors.join('; ')}` : ''}`);
