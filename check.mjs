// Self-check: node check.mjs
// Verifies every ticker in game.js has a logo file and the brick grid fits the canvas.
import { readFileSync, existsSync } from 'node:fs';

const src = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const tickers = src.match(/const TICKERS = \[([\s\S]*?)\];/)[1].match(/'([A-Z]{4})'/g).map((s) => s.slice(1, -1));
const num = (k) => Number(src.match(new RegExp(`\\b${k} = ([\\d.]+)`))[1]);

const [W, H, COLS, ROWS, PAD_X, TOP, CELL_H] = ['W', 'H', 'COLS', 'ROWS', 'PAD_X', 'TOP', 'CELL_H'].map(num);
const PADDLE_Y = H - 46;

const powerTickers = src.match(/const POWER_UPS = \[([\s\S]*?)\];/)[1]
  .match(/ticker: '[A-Z]{4}'/g).map((s) => s.slice(-5, -1));
const allLogos = [...tickers, ...powerTickers];
const missing = allLogos.filter((t) => !existsSync(new URL(`./logos/${t}.png`, import.meta.url)));
if (missing.length) throw new Error(`missing logos: ${missing.join(', ')}`);
if (powerTickers.length < 5) throw new Error('expected at least five power-up stocks');
if (tickers.length !== COLS * ROWS) throw new Error(`${tickers.length} tickers != ${COLS}x${ROWS} grid`);
if (new Set(tickers).size !== tickers.length) throw new Error('duplicate tickers');
if (TOP + ROWS * CELL_H >= PADDLE_Y) throw new Error('brick grid overlaps paddle');
if (PAD_X * 2 >= W) throw new Error('bad horizontal padding');

// premis satirnya: indeks hanya boleh turun, tidak pernah naik
const drop = src.match(/ihsg -= ([\s\S]*?);/)[1];
if (/ihsg \+=/.test(src)) throw new Error('IHSG naik di suatu tempat — premis satirnya rusak');
const open = num('IHSG_OPEN');
const worst = open - tickers.length * (12 + (ROWS - 1) * 6);
if (worst <= 0) throw new Error(`IHSG bisa tembus nol (${worst})`);

const quotes = src.match(/const QUOTES = \[([\s\S]*?)\];/)[1].match(/'[^']+'/g);
if (quotes.length < 5) throw new Error('kutipan pidatonya kurang banyak');

console.log(`ok — ${tickers.length} bricks + ${powerTickers.length} power-ups, all logos present, grid clears paddle by ${PADDLE_Y - (TOP + ROWS * CELL_H)}px, `
  + `${quotes.length} quotes, IHSG ${open} -> minimum ${worst} (drop: ${drop.trim()})`);
