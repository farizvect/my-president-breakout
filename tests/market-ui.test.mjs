import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
  }

  add(...names) {
    const classes = new Set(this.owner.className.split(/\s+/).filter(Boolean));
    names.forEach((name) => classes.add(name));
    this.owner.className = [...classes].join(' ');
  }

  remove(...names) {
    const removed = new Set(names);
    this.owner.className = this.owner.className.split(/\s+/).filter((name) => name && !removed.has(name)).join(' ');
  }

  contains(name) {
    return this.owner.className.split(/\s+/).includes(name);
  }
}

class FakeElement {
  constructor(tagName, document) {
    this.tagName = tagName;
    this.ownerDocument = document;
    this.children = [];
    this.attributes = new Map();
    this.className = '';
    this.classList = new FakeClassList(this);
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.listeners = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  append(...nodes) {
    nodes.forEach((node) => {
      const existingIndex = this.children.indexOf(node);
      if (existingIndex >= 0) this.children.splice(existingIndex, 1);
      this.children.push(node);
    });
  }

  replaceChildren(...nodes) {
    this.children = [...nodes];
    if (!nodes.length) this.textContent = '';
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }
}

function fakeDocument(elements) {
  const document = {
    activeElement: null,
    getElementById: (id) => elements[id],
    createElement: (name) => new FakeElement(name, document),
    createElementNS: (_namespace, name) => new FakeElement(name, document),
    createTextNode: (text) => ({ textContent: text }),
  };
  return document;
}

const marketModule = import('../market.js');

function validSeries(overrides = {}) {
  return {
    price: 6230.5,
    previousClose: 6196.8,
    change: 33.7,
    changePercent: 0.54,
    quoteAt: '2026-07-27T02:40:00.000Z',
    marketState: 'REGULAR',
    points: [
      { date: '2026-07-24', close: 6196.8 },
      { date: '2026-07-27', close: 6230.5 },
    ],
    ...overrides,
  };
}

test('event selector preserves the focused native button when selection changes', async () => {
  const elements = {};
  globalThis.document = fakeDocument(elements);
  elements['event-selector'] = new FakeElement('div', document);
  const { renderEventSelector } = await marketModule;
  const events = [
    { id: 'first', date: '2026-05-20', title: 'First address' },
    { id: 'second', date: '2026-07-23', title: 'Second address' },
  ];

  renderEventSelector(events, 'first', () => {});
  const focusedButton = elements['event-selector'].children[1];
  focusedButton.focus();
  renderEventSelector(events, 'second', () => {});

  assert.equal(elements['event-selector'].children[1], focusedButton);
  assert.equal(document.activeElement, focusedButton);
  assert.equal(focusedButton.getAttribute('aria-pressed'), 'true');
});

test('sparse chart render clears stale interaction state and displays a message', async () => {
  const elements = {};
  globalThis.document = fakeDocument(elements);
  elements['market-chart'] = new FakeElement('svg', document);
  elements['chart-tooltip'] = new FakeElement('div', document);
  const svg = elements['market-chart'];
  const tooltip = elements['chart-tooltip'];
  svg.onpointermove = () => {};
  svg.onpointerleave = () => {};
  svg.onpointerdown = () => {};
  svg.onpointerup = () => {};
  svg.onpointercancel = () => {};
  svg.onlostpointercapture = () => {};
  tooltip.classList.add('visible');
  tooltip.style.left = '120px';
  tooltip.style.top = '80px';
  tooltip.append({ textContent: 'stale tooltip' });
  const { renderChart } = await marketModule;

  renderChart([{ date: '2026-07-24', close: 6196.43 }], [], null, () => {});

  assert.equal(svg.onpointermove, null);
  assert.equal(svg.onpointerleave, null);
  assert.equal(svg.onpointerdown, null);
  assert.equal(svg.onpointerup, null);
  assert.equal(svg.onpointercancel, null);
  assert.equal(svg.onlostpointercapture, null);
  assert.equal(tooltip.classList.contains('visible'), false);
  assert.equal(tooltip.children.length, 0);
  assert.equal(tooltip.style.left, '');
  assert.equal(tooltip.style.top, '');
  assert.match(svg.children[0].textContent, /insufficient market data/i);
});

test('touch press shows chart price until the pointer is released', async () => {
  const elements = {};
  globalThis.document = fakeDocument(elements);
  const svg = new FakeElement('svg', document);
  const tooltip = new FakeElement('div', document);
  elements['market-chart'] = svg;
  elements['chart-tooltip'] = tooltip;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 580, height: 290 });
  let capturedPointer = null;
  svg.setPointerCapture = (pointerId) => { capturedPointer = pointerId; };
  svg.hasPointerCapture = (pointerId) => capturedPointer === pointerId;
  svg.releasePointerCapture = (pointerId) => {
    if (capturedPointer === pointerId) capturedPointer = null;
  };
  const { renderChart } = await marketModule;
  const points = [
    { date: '2026-07-21', close: 6100 },
    { date: '2026-07-22', close: 6200 },
    { date: '2026-07-23', close: 6300 },
  ];
  renderChart(points, [], null, () => {});

  svg.onpointerdown({ clientX: 290, pointerId: 7, pointerType: 'touch' });

  assert.equal(capturedPointer, 7);
  assert.equal(tooltip.classList.contains('visible'), true);
  assert.equal(tooltip.children[0].textContent, '6,200.00');
  svg.onpointerdown({ clientX: 570, pointerId: 8, pointerType: 'touch' });
  assert.equal(capturedPointer, 7);
  assert.equal(tooltip.children[0].textContent, '6,200.00');
  svg.onpointerleave();
  assert.equal(tooltip.classList.contains('visible'), true);

  svg.onpointerup({ pointerId: 7, pointerType: 'touch' });
  assert.equal(capturedPointer, null);
  assert.equal(tooltip.classList.contains('visible'), false);
});

test('mini USD/IDR chart supports the same pointer price inspection contract', async () => {
  const elements = {};
  globalThis.document = fakeDocument(elements);
  const svg = new FakeElement('svg', document);
  const tooltip = new FakeElement('div', document);
  elements['fx-sparkline'] = svg;
  elements['fx-tooltip'] = tooltip;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 880, height: 92 });
  let capturedPointer = null;
  svg.setPointerCapture = (pointerId) => { capturedPointer = pointerId; };
  svg.hasPointerCapture = (pointerId) => capturedPointer === pointerId;
  svg.releasePointerCapture = () => { capturedPointer = null; };
  const { renderFxSparkline } = await marketModule;
  const points = [
    { date: '2026-07-21', close: 16200 },
    { date: '2026-07-22', close: 16300 },
    { date: '2026-07-23', close: 16400 },
  ];

  renderFxSparkline(points, []);
  svg.onpointermove({ clientX: 440, pointerId: 1, pointerType: 'mouse' });

  assert.equal(tooltip.classList.contains('visible'), true);
  assert.equal(tooltip.children[0].textContent, '16,300.00');
  assert.equal(tooltip.children[1].textContent, '22 JUL 2026');
  svg.onpointerleave();
  svg.onpointerdown({ clientX: 2, pointerId: 7, pointerType: 'touch' });
  svg.onpointermove({ clientX: 878, pointerId: 7, pointerType: 'touch' });
  assert.equal(capturedPointer, 7);
  assert.equal(tooltip.children[0].textContent, '16,400.00');
  svg.onpointerup({ pointerId: 7, pointerType: 'touch' });
  assert.equal(capturedPointer, null);
  assert.equal(tooltip.classList.contains('visible'), false);
  svg.onfocus();
  assert.equal(tooltip.children[0].textContent, '16,400.00');
  let prevented = false;
  svg.onkeydown({ key: 'ArrowLeft', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(tooltip.children[0].textContent, '16,300.00');
  svg.onblur();
  assert.equal(tooltip.classList.contains('visible'), false);
});

test('chart clears tooltip on lost capture, mouse cancel, and active-touch rerender', async () => {
  const elements = {};
  globalThis.document = fakeDocument(elements);
  const svg = new FakeElement('svg', document);
  const tooltip = new FakeElement('div', document);
  elements['market-chart'] = svg;
  elements['chart-tooltip'] = tooltip;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 580, height: 290 });
  let capturedPointer = null;
  svg.setPointerCapture = (pointerId) => { capturedPointer = pointerId; };
  svg.hasPointerCapture = (pointerId) => capturedPointer === pointerId;
  svg.releasePointerCapture = (pointerId) => {
    if (capturedPointer === pointerId) capturedPointer = null;
  };
  const { renderChart } = await marketModule;
  const points = [
    { date: '2026-07-21', close: 6100 },
    { date: '2026-07-22', close: 6200 },
    { date: '2026-07-23', close: 6300 },
  ];
  renderChart(points, [], null, () => {});

  svg.onpointerdown({ clientX: 290, pointerId: 7, pointerType: 'touch' });
  capturedPointer = null;
  svg.onlostpointercapture({ pointerId: 7 });
  assert.equal(tooltip.classList.contains('visible'), false);

  svg.onpointermove({ clientX: 290, pointerId: 1, pointerType: 'mouse' });
  assert.equal(tooltip.classList.contains('visible'), true);
  svg.onpointercancel({ pointerId: 1, pointerType: 'mouse' });
  assert.equal(tooltip.classList.contains('visible'), false);

  svg.onpointerdown({ clientX: 290, pointerId: 9, pointerType: 'touch' });
  assert.equal(capturedPointer, 9);
  renderChart(points, [], null, () => {});
  assert.equal(capturedPointer, null);
  assert.equal(tooltip.classList.contains('visible'), false);
});

test('DPR event keeps rounded Kompas intraday landmarks separate from Yahoo daily close', async () => {
  const events = JSON.parse(await readFile(new URL('../data/events.json', import.meta.url)));
  const event = events.find(({ id }) => id === 'dpr-kem-ppkf-2027');

  assert.deepEqual(event.reportedIntraday, {
    preSpeechHigh: 6459,
    duringSpeechLow: 6215,
    publisher: 'Kompas',
  });
  assert.deepEqual(event.reportedDailyClose, {
    value: 6318.5,
    publisher: 'Yahoo Finance',
  });
});

test('generated snapshot carries a usable sourced USD/IDR quote', async () => {
  const live = JSON.parse(await readFile(new URL('../data/live.json', import.meta.url)));

  assert.equal(live.fx.symbol, 'IDR=X');
  assert.equal(live.fx.pair, 'USD/IDR');
  assert.equal(live.fx.baseCurrency, 'USD');
  assert.equal(live.fx.quoteCurrency, 'IDR');
  assert.equal(Number.isFinite(live.fx.price) && live.fx.price > 0, true);
  assert.equal(Number.isFinite(live.fx.changePercent), true);
  assert.equal(Array.isArray(live.fx.points) && live.fx.points.length >= 20, true);
  assert.match(live.sources.fx, /Yahoo Finance IDR=X/);
});

test('headline renderer reports fetch failure separately from publication time', async () => {
  const elements = {};
  globalThis.document = fakeDocument(elements);
  elements['headline-status'] = new FakeElement('b');
  elements['news-list'] = new FakeElement('ul');
  const { renderNews } = await marketModule;
  renderNews([{
    title: 'Cached headline',
    url: 'https://example.com/news',
    source: 'Example',
    publishedAt: '2026-07-27T02:00:00.000Z',
  }], Date.parse('2026-07-27T10:00:00.000Z'), true);
  assert.match(elements['headline-status'].textContent, /^FETCH FAILED · LAST/);
  assert.equal(elements['news-list'].children.length, 1);
  renderNews([{
    title: 'Unsafe cached headline',
    url: 'javascript:alert(1)',
    source: 'Compromised',
    publishedAt: '2026-07-27T02:00:00.000Z',
  }], Date.parse('2026-07-27T10:00:00.000Z'));
  assert.equal(elements['news-list'].children[0].children[1].children[0].tagName, 'span');
});

test('headline renderer shows a complete Jakarta publication date and time', async () => {
  const elements = {};
  globalThis.document = fakeDocument(elements);
  elements['headline-status'] = new FakeElement('b', document);
  elements['news-list'] = new FakeElement('ul', document);
  const { renderNews } = await marketModule;

  renderNews([{
    title: 'IHSG ditutup melemah',
    url: 'https://example.com/ihsg',
    source: 'Example',
    publishedAt: '2026-07-27T02:00:00.000Z',
  }], Date.parse('2026-07-27T03:00:00.000Z'));

  assert.equal(elements['news-list'].children[0].children[0].textContent, '27 JUL 2026 · 09:00 WIB');
});

test('news renderer targets independent stock and macro lists', async () => {
  const elements = {};
  globalThis.document = fakeDocument(elements);
  elements['stock-news-status'] = new FakeElement('b', document);
  elements['stock-news-list'] = new FakeElement('ul', document);
  elements['macro-news-status'] = new FakeElement('b', document);
  elements['macro-news-list'] = new FakeElement('ul', document);
  const { renderNews } = await marketModule;
  const stock = [{
    title: 'BEI suspends two issuers', url: 'https://example.com/stock', source: 'Market Wire',
    publishedAt: '2026-07-27T04:00:00.000Z',
  }];
  const macro = [{
    title: 'Rupiah and gold ahead of the Fed', url: 'https://example.com/macro', source: 'Macro Wire',
    publishedAt: '2026-07-27T03:00:00.000Z',
  }];

  renderNews(stock, Date.parse('2026-07-27T05:00:00.000Z'), false, {
    statusId: 'stock-news-status', listId: 'stock-news-list', emptyLabel: 'STOCK NEWS UNAVAILABLE',
  });
  renderNews(macro, Date.parse('2026-07-27T05:00:00.000Z'), false, {
    statusId: 'macro-news-status', listId: 'macro-news-list', emptyLabel: 'MACRO NEWS UNAVAILABLE',
  });

  assert.equal(elements['stock-news-list'].children[0].children[1].children[0].textContent, stock[0].title);
  assert.equal(elements['macro-news-list'].children[0].children[1].children[0].textContent, macro[0].title);
  assert.match(elements['stock-news-status'].textContent, /^UPDATED/);
  assert.match(elements['macro-news-status'].textContent, /^UPDATED/);
});

test('generated snapshot carries independently sourced stock and macro news', async () => {
  const live = JSON.parse(await readFile(new URL('../data/live.json', import.meta.url)));

  assert.equal(Array.isArray(live.stockNews) && live.stockNews.length > 0, true);
  assert.equal(Array.isArray(live.macroNews) && live.macroNews.length > 0, true);
  assert.match(live.sources.stockNews, /Google News RSS/);
  assert.match(live.sources.macroNews, /Google News RSS/);
});

test('refreshMarketQuote replaces displayed market and USD/IDR quotes', async () => {
  const elements = {};
  globalThis.document = fakeDocument(elements);
  elements['market-price'] = new FakeElement('span', document);
  elements['market-change'] = new FakeElement('span', document);
  elements['fx-label'] = new FakeElement('span', document);
  elements['fx-price'] = new FakeElement('span', document);
  elements['fx-change'] = new FakeElement('span', document);
  elements['data-age'] = new FakeElement('span', document);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      generatedAt: '2026-07-27T02:40:00.000Z',
      market: validSeries({ date: '2026-07-27' }),
      fx: validSeries({
        price: 16425.75,
        previousClose: 16380.25,
        change: 45.5,
        changePercent: 0.28,
        points: [{ date: '2026-07-24', close: 16380.25 }, { date: '2026-07-27', close: 16425.75 }],
      }),
    }),
  });
  const { refreshMarketQuote } = await marketModule;

  await refreshMarketQuote(Date.parse('2026-07-27T02:45:00.000Z'));

  assert.equal(elements['market-price'].textContent, '6,230.50');
  assert.equal(elements['market-change'].textContent, '+33.70 · +0.54%');
  assert.equal(elements['market-change'].classList.contains('positive'), true);
  assert.equal(elements['fx-price'].textContent, '16,425.75');
  assert.equal(elements['fx-change'].textContent, '+45.50 · +0.28%');
  assert.equal(elements['fx-change'].classList.contains('negative'), true);
  assert.equal(elements['fx-label'].textContent, 'USD / IDR');
  assert.equal(elements['data-age'].textContent, 'HOURLY AUTO REFRESH · 2026-07-27 09:40 WIB · YAHOO DELAYED');
  globalThis.fetch = originalFetch;
});

test('refreshMarketQuote labels an old same-session quote as stale', async () => {
  const elements = {};
  globalThis.document = fakeDocument(elements);
  elements['market-price'] = new FakeElement('span', document);
  elements['market-change'] = new FakeElement('span', document);
  elements['fx-label'] = new FakeElement('span', document);
  elements['fx-price'] = new FakeElement('span', document);
  elements['fx-change'] = new FakeElement('span', document);
  elements['data-age'] = new FakeElement('span', document);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      market: validSeries({ date: '2026-07-27' }),
      fx: validSeries({
        price: 16425.75,
        previousClose: 16380.25,
        change: 45.5,
        changePercent: 0.28,
        points: [{ date: '2026-07-24', close: 16380.25 }, { date: '2026-07-27', close: 16425.75 }],
      }),
    }),
  });
  const { refreshMarketQuote } = await marketModule;

  await refreshMarketQuote(Date.parse('2026-07-27T04:20:00.000Z'));

  assert.equal(elements['data-age'].textContent, 'STALE QUOTE · 2026-07-27 09:40 WIB · YAHOO DELAYED');
  assert.equal(elements['fx-price'].textContent, '16,425.75');
  assert.equal(elements['fx-label'].textContent, 'USD / IDR · STALE');
  globalThis.fetch = originalFetch;
});

test('failed polling ages the last successful market and FX snapshot', async () => {
  const elements = {};
  globalThis.document = fakeDocument(elements);
  for (const id of ['market-price', 'market-change', 'fx-label', 'fx-price', 'fx-change', 'data-age']) {
    elements[id] = new FakeElement('span', document);
  }
  const originalFetch = globalThis.fetch;
  let mode = 'valid';
  const snapshot = {
    market: validSeries({ date: '2026-07-27' }),
    fx: validSeries({
      price: 16425.75,
      previousClose: 16380.25,
      change: 45.5,
      changePercent: 0.28,
      points: [{ date: '2026-07-24', close: 16380.25 }, { date: '2026-07-27', close: 16425.75 }],
    }),
  };
  globalThis.fetch = async () => {
    if (mode === 'http-error') return { ok: false, status: 503 };
    if (mode === 'bad-market') {
      return { ok: true, json: async () => ({ ...snapshot, market: { ...snapshot.market, change: undefined } }) };
    }
    if (mode === 'bad-fx') {
      return { ok: true, json: async () => ({ ...snapshot, fx: { ...snapshot.fx, change: undefined } }) };
    }
    if (mode === 'future-market') {
      return { ok: true, json: async () => ({
        ...snapshot,
        market: { ...snapshot.market, price: 9999, quoteAt: '2026-07-27T02:48:00.000Z' },
      }) };
    }
    if (mode === 'duplicate-market-points') {
      return { ok: true, json: async () => ({
        ...snapshot,
        market: { ...snapshot.market, price: 9999, points: [snapshot.market.points[0], snapshot.market.points[0]] },
      }) };
    }
    return { ok: true, json: async () => snapshot };
  };
  const { refreshMarketQuote } = await marketModule;

  await refreshMarketQuote(Date.parse('2026-07-27T02:45:00.000Z'));
  assert.equal(elements['data-age'].textContent.startsWith('HOURLY AUTO REFRESH'), true);
  assert.equal(elements['fx-label'].textContent, 'USD / IDR');

  mode = 'http-error';
  await refreshMarketQuote(Date.parse('2026-07-27T02:46:00.000Z'));
  assert.equal(elements['data-age'].textContent.startsWith('STALE QUOTE'), true);
  assert.equal(elements['fx-label'].textContent, 'USD / IDR · STALE');

  mode = 'valid';
  await refreshMarketQuote(Date.parse('2026-07-27T02:46:00.000Z'));
  assert.equal(elements['data-age'].textContent.startsWith('HOURLY AUTO REFRESH'), true);

  mode = 'bad-market';
  await refreshMarketQuote(Date.parse('2026-07-27T02:46:00.000Z'));
  assert.equal(elements['market-change'].textContent, '+33.70 · +0.54%');

  mode = 'bad-fx';
  await refreshMarketQuote(Date.parse('2026-07-27T02:47:00.000Z'));
  assert.equal(elements['fx-change'].textContent, '+45.50 · +0.28%');

  mode = 'future-market';
  await refreshMarketQuote(Date.parse('2026-07-27T02:47:00.000Z'));
  assert.equal(elements['market-price'].textContent, '6,230.50');

  mode = 'duplicate-market-points';
  await refreshMarketQuote(Date.parse('2026-07-27T02:47:00.000Z'));
  assert.equal(elements['market-price'].textContent, '6,230.50');

  mode = 'http-error';
  await refreshMarketQuote(Date.parse('2026-07-27T03:10:00.000Z'));
  assert.equal(elements['data-age'].textContent.startsWith('STALE QUOTE'), true);
  assert.equal(elements['fx-label'].textContent, 'USD / IDR · STALE');
  assert.equal(elements['market-change'].textContent, '+33.70 · +0.54%');
  assert.equal(elements['fx-change'].textContent, '+45.50 · +0.28%');

  snapshot.market.marketState = 'CLOSED';
  snapshot.fx.marketState = 'CLOSED';
  mode = 'valid';
  await refreshMarketQuote(Date.parse('2026-07-27T03:11:00.000Z'));
  mode = 'http-error';
  await refreshMarketQuote(Date.parse('2026-07-27T03:12:00.000Z'));
  assert.equal(elements['data-age'].textContent.startsWith('LAST QUOTE'), true);
  assert.equal(elements['fx-label'].textContent, 'USD / IDR · LAST QUOTE');
  globalThis.fetch = originalFetch;
});

test('FX display recovers from unavailable data and labels a closed quote', async () => {
  const elements = {};
  globalThis.document = fakeDocument(elements);
  for (const id of ['market-price', 'market-change', 'fx-label', 'fx-price', 'fx-change', 'data-age']) {
    elements[id] = new FakeElement('span', document);
  }
  const originalFetch = globalThis.fetch;
  const market = validSeries({ date: '2026-07-27' });
  const snapshots = [
    { market },
    {
      market,
      fx: validSeries({
        price: 16425.75,
        previousClose: 16380.25,
        change: 45.5,
        changePercent: 0.28,
        marketState: 'CLOSED',
        points: [{ date: '2026-07-24', close: 16380.25 }, { date: '2026-07-27', close: 16425.75 }],
      }),
    },
  ];
  globalThis.fetch = async () => ({ ok: true, json: async () => snapshots.shift() });
  const { refreshMarketQuote } = await marketModule;

  await refreshMarketQuote(Date.parse('2026-07-27T02:45:00.000Z'));
  assert.equal(elements['fx-label'].textContent, 'USD / IDR · UNAVAILABLE');
  await refreshMarketQuote(Date.parse('2026-07-27T02:46:00.000Z'));
  assert.equal(elements['fx-label'].textContent, 'USD / IDR · LAST QUOTE');
  assert.equal(elements['fx-price'].textContent, '16,425.75');
  globalThis.fetch = originalFetch;
});
