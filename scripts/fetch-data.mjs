#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { normalizeYahooChart, parseNewsRss, latestMarketSummary } from '../market-core.mjs';

const ROOT = new URL('../', import.meta.url);
const OUTPUT = new URL('data/live.json', ROOT);
const MARKET_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?range=1y&interval=1d';
const NEWS_URL = 'https://news.google.com/rss/search?q=IHSG%20when%3A7d&hl=id&gl=ID&ceid=ID:id';
const headers = { 'user-agent': 'Mozilla/5.0 (compatible; IHSG-Speech-Impact/1.0)' };

async function fetchText(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function previousSnapshot() {
  try { return JSON.parse(await readFile(OUTPUT, 'utf8')); }
  catch { return { market: null, headlines: [] }; }
}

const previous = await previousSnapshot();
const errors = [];
let market = previous.market;
let headlines = previous.headlines ?? [];

try {
  const payload = JSON.parse(await fetchText(MARKET_URL));
  const result = payload?.chart?.result?.[0];
  const points = normalizeYahooChart(payload);
  if (points.length < 20) throw new Error(`market series too short: ${points.length}`);
  const meta = result?.meta ?? {};
  const latest = latestMarketSummary(points);
  market = {
    symbol: '^JKSE',
    name: 'IDX Composite',
    currency: meta.currency ?? 'IDR',
    exchangeTimezone: meta.exchangeTimezoneName ?? 'Asia/Jakarta',
    delayed: true,
    ...latest,
    points,
    fetchedAt: new Date().toISOString(),
  };
} catch (error) {
  errors.push(`market: ${error.message}`);
}

try {
  const xml = await fetchText(NEWS_URL);
  const parsed = parseNewsRss(xml, 8);
  if (!parsed.length) throw new Error('no usable headlines');
  headlines = parsed;
} catch (error) {
  errors.push(`news: ${error.message}`);
}

if (!market) throw new Error(`No market snapshot available. ${errors.join('; ')}`);

const snapshot = {
  generatedAt: new Date().toISOString(),
  market,
  headlines,
  errors,
  sources: {
    market: 'Yahoo Finance ^JKSE (delayed)',
    news: 'Google News RSS; articles belong to linked publishers',
  },
};
await mkdir(new URL('data/', ROOT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote ${OUTPUT.pathname}: ${market.points.length} market points, ${headlines.length} headlines${errors.length ? `; fallback: ${errors.join('; ')}` : ''}`);
