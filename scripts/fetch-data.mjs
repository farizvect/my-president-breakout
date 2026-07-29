#!/usr/bin/env node
/**
 * Full refresh: market + news, then write a combined data/live.json for
 * local tooling / older bookmarks. CI uses fetch-market.mjs and
 * fetch-news.mjs on separate schedules.
 */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const scripts = [
  new URL('fetch-market.mjs', import.meta.url),
  new URL('fetch-news.mjs', import.meta.url),
];

for (const script of scripts) {
  const result = spawnSync(process.execPath, [fileURLToPath(script)], {
    stdio: 'inherit',
    cwd: fileURLToPath(ROOT),
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const market = JSON.parse(await readFile(new URL('data/market.json', ROOT), 'utf8'));
const news = JSON.parse(await readFile(new URL('data/news.json', ROOT), 'utf8'));
const combined = {
  generatedAt: new Date().toISOString(),
  market: market.market,
  fx: market.fx,
  headlines: news.headlines,
  stockNews: news.stockNews,
  macroNews: news.macroNews,
  errors: [...(market.errors ?? []), ...(news.errors ?? [])],
  sources: { ...(market.sources ?? {}), ...(news.sources ?? {}) },
};
await mkdir(new URL('data/', ROOT), { recursive: true });
await writeFile(new URL('data/live.json', ROOT), `${JSON.stringify(combined, null, 2)}\n`);
console.log(`wrote combined data/live.json`);
