#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import {
  normalizeYahooChart,
  normalizeYahooQuote,
  normalizeUsdIdrQuote,
  mergeQuoteIntoDailySeries,
  markMarketSnapshotStale,
  parseNewsRss,
  isValidPriceSeriesSnapshot,
  safeHttpsUrl,
} from '../market-core.mjs';

const ROOT = new URL('../', import.meta.url);
const OUTPUT = new URL('data/live.json', ROOT);
const MARKET_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?range=1y&interval=1d';
const QUOTE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?range=1d&interval=1m';
const FX_HISTORY_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/IDR%3DX?range=1y&interval=1d';
const FX_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/IDR%3DX?range=1d&interval=1m';
const NEWS_URL = 'https://news.google.com/rss/search?q=IHSG%20when%3A7d&hl=id&gl=ID&ceid=ID:id';
const STOCK_NEWS_URL = 'https://news.google.com/rss/search?q=%28saham%20OR%20emiten%29%20%28BEI%20OR%20IDX%29%20when%3A3d&hl=id&gl=ID&ceid=ID:id';
const MACRO_NEWS_URL = 'https://news.google.com/rss/search?q=%28Bank%20Indonesia%20OR%20inflasi%20OR%20rupiah%20OR%20harga%20minyak%20OR%20harga%20emas%20OR%20Wall%20Street%29%20when%3A3d&hl=id&gl=ID&ceid=ID:id';
const headers = { 'user-agent': 'Mozilla/5.0 (compatible; IHSG-Speech-Impact/1.0)' };

async function fetchText(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function previousSnapshot() {
  try {
    const parsed = JSON.parse(await readFile(OUTPUT, 'utf8'));
    const validNews = (items) => Array.isArray(items) ? items.filter((headline) =>
      headline && typeof headline.title === 'string' && safeHttpsUrl(headline.url)
      && typeof headline.source === 'string'
      && (headline.publishedAt == null || Number.isFinite(Date.parse(headline.publishedAt)))) : [];
    return {
      market: isValidPriceSeriesSnapshot(parsed?.market) ? parsed.market : null,
      fx: isValidPriceSeriesSnapshot(parsed?.fx) ? parsed.fx : null,
      headlines: validNews(parsed?.headlines),
      stockNews: validNews(parsed?.stockNews),
      macroNews: validNews(parsed?.macroNews),
    };
  } catch {
    return { market: null, fx: null, headlines: [], stockNews: [], macroNews: [] };
  }
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
let headlines = previous.headlines ?? [];
let stockNews = previous.stockNews ?? [];
let macroNews = previous.macroNews ?? [];

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

const newsFeeds = [
  { key: 'news', url: NEWS_URL, assign: (items) => { headlines = items; } },
  { key: 'stock news', url: STOCK_NEWS_URL, assign: (items) => { stockNews = items; } },
  { key: 'macro news', url: MACRO_NEWS_URL, assign: (items) => { macroNews = items; } },
];
const newsResults = await Promise.allSettled(newsFeeds.map(({ url }) =>
  fetchText(url).then((xml) => {
    const parsed = parseNewsRss(xml, 8);
    if (!parsed.length) throw new Error('no usable headlines');
    return parsed;
  })));
newsResults.forEach((result, index) => {
  const feed = newsFeeds[index];
  if (result.status === 'fulfilled') feed.assign(result.value);
  else errors.push(`${feed.key}: ${result.reason?.message ?? String(result.reason)}`);
});

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
  headlines,
  stockNews,
  macroNews,
  errors,
  sources: {
    market: 'Yahoo Finance ^JKSE intraday (hourly workflow; delayed)',
    fx: 'Yahoo Finance IDR=X daily history + intraday (hourly workflow; delayed)',
    news: 'Google News RSS; articles belong to linked publishers',
    stockNews: 'Google News RSS stock and issuer query; articles belong to linked publishers',
    macroNews: 'Google News RSS macro-market query; articles belong to linked publishers',
  },
};
await mkdir(new URL('data/', ROOT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote ${OUTPUT.pathname}: ${market.points.length} market points, ${headlines.length} IHSG headlines, ${stockNews.length} stock news, ${macroNews.length} macro news${errors.length ? `; fallback: ${errors.join('; ')}` : ''}`);
