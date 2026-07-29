#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseNewsRss, safeHttpsUrl } from '../market-core.mjs';

const ROOT = new URL('../', import.meta.url);
const OUTPUT = new URL('data/news.json', ROOT);
const LEGACY = new URL('data/live.json', ROOT);
const NEWS_URL = 'https://news.google.com/rss/search?q=IHSG%20when%3A7d&hl=id&gl=ID&ceid=ID:id';
const STOCK_NEWS_URL = 'https://news.google.com/rss/search?q=%28saham%20OR%20emiten%29%20%28BEI%20OR%20IDX%29%20when%3A3d&hl=id&gl=ID&ceid=ID:id';
const MACRO_NEWS_URL = 'https://news.google.com/rss/search?q=%28Bank%20Indonesia%20OR%20inflasi%20OR%20rupiah%20OR%20harga%20minyak%20OR%20harga%20emas%20OR%20Wall%20Street%29%20when%3A3d&hl=id&gl=ID&ceid=ID:id';
const headers = { 'user-agent': 'Mozilla/5.0 (compatible; IHSG-Speech-Impact/1.0)' };

async function fetchText(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

function validNews(items) {
  return Array.isArray(items) ? items.filter((headline) =>
    headline && typeof headline.title === 'string' && safeHttpsUrl(headline.url)
    && typeof headline.source === 'string'
    && (headline.publishedAt == null || Number.isFinite(Date.parse(headline.publishedAt)))) : [];
}

async function previousSnapshot() {
  for (const path of [OUTPUT, LEGACY]) {
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8'));
      return {
        headlines: validNews(parsed?.headlines),
        stockNews: validNews(parsed?.stockNews),
        macroNews: validNews(parsed?.macroNews),
      };
    } catch {
      // try next
    }
  }
  return { headlines: [], stockNews: [], macroNews: [] };
}

const previous = await previousSnapshot();
const errors = [];
let headlines = previous.headlines ?? [];
let stockNews = previous.stockNews ?? [];
let macroNews = previous.macroNews ?? [];

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

if (!headlines.length && !stockNews.length && !macroNews.length) {
  throw new Error(`No usable news feeds. ${errors.join('; ')}`);
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  headlines,
  stockNews,
  macroNews,
  errors,
  sources: {
    news: 'Google News RSS; articles belong to linked publishers',
    stockNews: 'Google News RSS stock and issuer query; articles belong to linked publishers',
    macroNews: 'Google News RSS macro-market query; articles belong to linked publishers',
  },
};
await mkdir(new URL('data/', ROOT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote ${OUTPUT.pathname}: ${headlines.length} IHSG, ${stockNews.length} stock, ${macroNews.length} macro${errors.length ? `; fallback: ${errors.join('; ')}` : ''}`);
