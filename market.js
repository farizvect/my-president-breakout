import {
  calculateEventImpact,
  pickNextEvent,
  filterMarketRange,
  nearestMarketPoint,
  chartTickLabel,
  resolveMarketUrlState,
  headlineFreshness,
  safeHttpsUrl,
  isValidPriceSeriesSnapshot,
} from './market-core.mjs';

const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const number = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
const chartPointerCleanup = new WeakMap();

function dateLabel(date) {
  return shortDate.format(new Date(`${date}T12:00:00+07:00`)).toUpperCase();
}

function signed(value) {
  return `${value > 0 ? '+' : ''}${number.format(value)}%`;
}

function directionClass(value) {
  return value < 0 ? 'negative' : value > 0 ? 'positive' : '';
}

function setDirectional(element, value, text = signed(value)) {
  element.textContent = text;
  element.classList.remove('negative', 'positive');
  const className = directionClass(value);
  if (className) element.classList.add(className);
}

function svgElement(name, attributes = {}, textContent = '') {
  const node = document.createElementNS(SVG, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  if (textContent) node.textContent = textContent;
  return node;
}

function htmlElement(name, className, textContent = '') {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (textContent) node.textContent = textContent;
  return node;
}

function compactDate(date) {
  return dateLabel(date).replace(/ 2026$/, '');
}

function renderEventReadout(event, points, fxPoints = []) {
  const container = $('chart-readout');
  container.replaceChildren();
  if (!event) {
    container.append(htmlElement('span', 'muted', 'Select a speech marker to inspect its market context.'));
    return;
  }

  const impact = calculateEventImpact(event, points);
  const head = htmlElement('div', 'readout-head');
  head.append(
    htmlElement('strong', '', event.title),
    htmlElement('span', '', `${dateLabel(event.date)} · ${event.location}`),
  );
  container.append(head);

  if (impact) {
    const stats = htmlElement('div', 'readout-stats');
    const values = [
      ['EVENT CLOSE', number.format(impact.eventClose)],
      ['EVENT DAY', signed(impact.eventReturn)],
      ['NEXT SESSION', signed(impact.nextReturn)],
    ];
    values.forEach(([label, value], index) => {
      const stat = htmlElement('div', 'readout-stat');
      stat.append(htmlElement('small', '', label), htmlElement('b', index ? directionClass(index === 1 ? impact.eventReturn : impact.nextReturn) : '', value));
      stats.append(stat);
    });
    container.append(stats);
  }

  const fxImpact = calculateEventImpact(event, fxPoints);
  if (fxImpact) {
    container.append(htmlElement('p', 'panel-title fx-window-title', 'USD / IDR EVENT WINDOW'));
    const stats = htmlElement('div', 'readout-stats');
    const values = [
      ['EVENT CLOSE', number.format(fxImpact.eventClose), 0],
      ['EVENT DAY', signed(fxImpact.eventReturn), -fxImpact.eventReturn],
      ['NEXT SESSION', signed(fxImpact.nextReturn), -fxImpact.nextReturn],
    ];
    values.forEach(([label, value, direction]) => {
      const stat = htmlElement('div', 'readout-stat');
      stat.append(htmlElement('small', '', label), htmlElement('b', directionClass(direction), value));
      stats.append(stat);
    });
    container.append(stats);
  }

  if (event.reportedIntraday) {
    const intraday = htmlElement('div', 'intraday-report');
    const label = htmlElement('strong', '', `REPORTED INTRADAY (${event.reportedIntraday.publisher.toUpperCase()}) · `);
    intraday.append(label, document.createTextNode(
      `before-speech high ${wholeNumber.format(event.reportedIntraday.preSpeechHigh)} → during-speech low ${wholeNumber.format(event.reportedIntraday.duringSpeechLow)}`,
    ));
    container.append(intraday);
  }

  if (event.reportedDailyClose) {
    const dailyClose = htmlElement('div', 'intraday-report');
    const label = htmlElement('strong', '', `DAILY CLOSE (${event.reportedDailyClose.publisher.toUpperCase()}) · `);
    dailyClose.append(label, document.createTextNode(number.format(event.reportedDailyClose.value)));
    container.append(dailyClose);
  }

  if (event.marketContext) container.append(htmlElement('p', 'market-context', event.marketContext));

  const sources = htmlElement('div', 'readout-sources');
  const official = document.createElement('a');
  official.href = event.source;
  official.target = '_blank';
  official.rel = 'noreferrer';
  official.textContent = 'Official event source ↗';
  sources.append(official);
  (event.marketSources ?? []).forEach((source) => {
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = `${source.publisher} market report ↗`;
    sources.append(link);
  });
  container.append(sources);
}

export function renderEventSelector(events, selectedId, onSelect) {
  const container = $('event-selector');
  const buttons = [...container.children];
  const canUpdateInPlace = buttons.length === events.length
    && buttons.every((button, index) => button.dataset.eventId === events[index].id);

  if (!canUpdateInPlace) {
    container.replaceChildren(...events.map((event) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.eventId = event.id;
      return button;
    }));
  }

  events.forEach((event, index) => {
    const button = container.children[index];
    button.textContent = compactDate(event.date);
    button.title = event.title;
    button.onclick = () => onSelect(event.id);
    button.setAttribute('aria-label', `Show ${event.title} on ${dateLabel(event.date)}`);
    button.setAttribute('aria-pressed', String(event.id === selectedId));
  });
}

export function renderChart(points, events, selectedId, onSelect) {
  const svg = $('market-chart');
  const tooltip = $('chart-tooltip');
  chartPointerCleanup.get(svg)?.();
  chartPointerCleanup.delete(svg);
  svg.replaceChildren();
  svg.onpointermove = null;
  svg.onpointerleave = null;
  svg.onpointerdown = null;
  svg.onpointerup = null;
  svg.onpointercancel = null;
  svg.onlostpointercapture = null;
  tooltip.classList.remove('visible');
  tooltip.replaceChildren();
  tooltip.style.left = '';
  tooltip.style.top = '';
  if (points.length < 2) {
    svg.append(svgElement('text', {
      x: 290, y: 145, class: 'chart-empty', 'text-anchor': 'middle',
    }, 'INSUFFICIENT MARKET DATA'));
    return;
  }

  const width = 580;
  const height = 290;
  const margin = { top: 16, right: 50, bottom: 32, left: 8 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const values = points.map((point) => point.close);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.08, 1);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const x = (index) => margin.left + (index / (points.length - 1)) * plotWidth;
  const y = (value) => margin.top + ((max - value) / (max - min)) * plotHeight;

  for (let index = 0; index <= 4; index += 1) {
    const value = min + ((max - min) * index) / 4;
    const py = y(value);
    svg.append(svgElement('line', { x1: margin.left, y1: py, x2: width - margin.right, y2: py, class: 'chart-grid' }));
    svg.append(svgElement('text', { x: width - margin.right + 7, y: py + 3, class: 'chart-label' }, Math.round(value).toLocaleString('en-US')));
  }

  for (let index = 0; index <= 4; index += 1) {
    const pointIndex = Math.round(((points.length - 1) * index) / 4);
    svg.append(svgElement('text', { x: x(pointIndex), y: height - 8, class: 'chart-label', 'text-anchor': index === 0 ? 'start' : index === 4 ? 'end' : 'middle' },
      chartTickLabel(points[pointIndex].date, points.length)));
  }

  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)},${y(point.close).toFixed(2)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${height - margin.bottom} L${x(0)},${height - margin.bottom} Z`;
  svg.append(svgElement('path', { d: area, class: 'chart-area' }));
  svg.append(svgElement('path', { d: line, class: 'chart-line' }));

  for (const event of events) {
    if (event.date < points[0].date || event.date > points.at(-1).date) continue;
    const { index, point } = nearestMarketPoint(points, event.date);
    const px = x(index);
    const py = y(point.close);
    const group = svgElement('g', {
      class: `chart-event-group${event.id === selectedId ? ' selected' : ''}`,
    });
    group.append(svgElement('line', { x1: px, y1: margin.top, x2: px, y2: height - margin.bottom, class: 'chart-event' }));
    group.append(svgElement('circle', { cx: px, cy: py, r: 3.5, class: 'chart-event-dot' }));
    group.append(svgElement('circle', { cx: px, cy: py, r: 12, class: 'chart-event-hit' }));
    group.append(svgElement('title', {}, `${event.title} · ${dateLabel(event.date)} · IHSG ${number.format(point.close)}`));
    group.addEventListener('click', () => onSelect(event.id));
    svg.append(group);
  }

  svg.append(svgElement('circle', {
    cx: x(points.length - 1), cy: y(points.at(-1).close), r: 3, class: 'chart-latest-dot',
  }));

  const crosshair = svgElement('line', {
    x1: 0, y1: margin.top, x2: 0, y2: height - margin.bottom, class: 'chart-crosshair', display: 'none',
  });
  const hoverDot = svgElement('circle', { cx: 0, cy: 0, r: 4, class: 'chart-hover-dot', display: 'none' });
  svg.append(crosshair, hoverDot);

  let activePointerId = null;

  const showPriceAtPointer = (pointerEvent) => {
    const rect = svg.getBoundingClientRect();
    const localX = ((pointerEvent.clientX - rect.left) / rect.width) * width;
    const ratio = Math.max(0, Math.min(1, (localX - margin.left) / plotWidth));
    const index = Math.round(ratio * (points.length - 1));
    const point = points[index];
    const px = x(index);
    const py = y(point.close);
    crosshair.setAttribute('x1', px);
    crosshair.setAttribute('x2', px);
    crosshair.removeAttribute('display');
    hoverDot.setAttribute('cx', px);
    hoverDot.setAttribute('cy', py);
    hoverDot.removeAttribute('display');
    tooltip.replaceChildren(
      document.createTextNode(number.format(point.close)),
      htmlElement('span', '', dateLabel(point.date)),
    );
    tooltip.style.left = `${Math.max(62, Math.min(rect.width - 62, (px / width) * rect.width))}px`;
    tooltip.style.top = `${(py / height) * rect.height}px`;
    tooltip.classList.add('visible');
  };

  const hidePrice = () => {
    crosshair.setAttribute('display', 'none');
    hoverDot.setAttribute('display', 'none');
    tooltip.classList.remove('visible');
  };

  svg.onpointerdown = (pointerEvent) => {
    if (pointerEvent.pointerType === 'touch' || pointerEvent.pointerType === 'pen') {
      if (activePointerId !== null) return;
      activePointerId = pointerEvent.pointerId;
      svg.setPointerCapture?.(pointerEvent.pointerId);
    }
    showPriceAtPointer(pointerEvent);
  };
  svg.onpointermove = (pointerEvent) => {
    if (pointerEvent.pointerType !== 'mouse' && activePointerId !== pointerEvent.pointerId) return;
    showPriceAtPointer(pointerEvent);
  };
  svg.onpointerleave = () => {
    if (activePointerId === null) hidePrice();
  };
  const finishTouch = (pointerEvent) => {
    if (pointerEvent.pointerId !== activePointerId) return;
    const pointerId = activePointerId;
    activePointerId = null;
    if (svg.hasPointerCapture?.(pointerId)) svg.releasePointerCapture(pointerId);
    hidePrice();
  };
  svg.onpointerup = (pointerEvent) => {
    if (pointerEvent.pointerType === 'touch' || pointerEvent.pointerType === 'pen') finishTouch(pointerEvent);
  };
  svg.onpointercancel = (pointerEvent) => {
    if (activePointerId === null) hidePrice();
    else finishTouch(pointerEvent);
  };
  svg.onlostpointercapture = (pointerEvent) => {
    if (pointerEvent.pointerId !== activePointerId) return;
    activePointerId = null;
    hidePrice();
  };
  chartPointerCleanup.set(svg, () => {
    const pointerId = activePointerId;
    activePointerId = null;
    if (pointerId !== null && svg.hasPointerCapture?.(pointerId)) svg.releasePointerCapture(pointerId);
    hidePrice();
  });
}

function setupInteractiveChart(allPoints, events, fxPoints = []) {
  const urlState = resolveMarketUrlState(globalThis.location?.search ?? '', events);
  let range = urlState.range;
  let selectedId = urlState.eventId
    ?? events.find((event) => event.reportedIntraday)?.id
    ?? events.at(-1)?.id
    ?? null;

  const syncUrl = () => {
    if (!globalThis.history || !globalThis.location) return;
    const url = new URL(globalThis.location.href);
    if (selectedId) url.searchParams.set('event', selectedId);
    else url.searchParams.delete('event');
    url.searchParams.set('range', String(range));
    globalThis.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const update = () => {
    const points = filterMarketRange(allPoints, range);
    const visibleEvents = events.filter((event) => event.date >= points[0].date && event.date <= points.at(-1).date);
    if (!visibleEvents.some((event) => event.id === selectedId)) {
      selectedId = visibleEvents.find((event) => event.reportedIntraday)?.id ?? visibleEvents.at(-1)?.id ?? null;
    }
    const select = (id) => { selectedId = id; update(); };
    renderChart(points, visibleEvents, selectedId, select);
    renderEventSelector(visibleEvents, selectedId, select);
    renderEventReadout(events.find((event) => event.id === selectedId), allPoints, fxPoints);
    const label = range === 12 ? 'ONE-YEAR' : `${range}-MONTH`;
    $('chart-title').textContent = `${label} IHSG · OFFICIAL SPEECH DATES MARKED`;
    document.querySelectorAll('[data-range]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.range) === range));
    });
    syncUrl();
  };

  document.querySelectorAll('[data-range]').forEach((button) => {
    button.addEventListener('click', () => { range = Number(button.dataset.range); update(); });
  });
  update();
}

function renderSchedule(events) {
  const next = pickNextEvent(events);
  const container = $('next-speech');
  container.replaceChildren();
  if (!next) {
    const title = document.createElement('strong');
    title.textContent = 'NO CONFIRMED UPCOMING SPEECH';
    const note = document.createElement('div');
    note.className = 'empty-schedule';
    note.textContent = 'Official sources publish past speeches reliably, but expose no stable forward calendar.';
    container.append(title, note);
  } else {
    const title = document.createElement('strong');
    title.textContent = next.title;
    const meta = document.createElement('div');
    meta.className = 'event-meta';
    meta.textContent = `${dateLabel(next.date)} · ${next.location}`;
    container.append(title, meta);
  }

  const list = $('speech-list');
  list.replaceChildren();
  [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).forEach((event) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = event.source;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = event.title;
    const meta = document.createElement('div');
    meta.className = 'event-meta';
    const date = document.createElement('span');
    date.textContent = dateLabel(event.date);
    const status = document.createElement('span');
    status.textContent = event.status.toUpperCase();
    meta.append(date, status);
    item.append(link, meta);
    list.append(item);
  });
}

function renderImpacts(events, points, fxPoints = []) {
  const rows = $('impact-rows');
  rows.replaceChildren();
  const impacts = events.map((event) => ({
    event,
    impact: calculateEventImpact(event, points),
    fxImpact: calculateEventImpact(event, fxPoints),
  }));

  impacts.forEach(({ event, impact, fxImpact }) => {
    const row = document.createElement('tr');
    const name = document.createElement('td');
    const link = document.createElement('a');
    link.href = event.source;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = event.title;
    name.append(link);
    row.append(name);

    if (!impact) {
      const unavailable = document.createElement('td');
      unavailable.colSpan = 3;
      unavailable.className = 'muted';
      unavailable.textContent = 'DATA UNAVAILABLE';
      row.append(unavailable);
    } else {
      const close = document.createElement('td');
      close.textContent = number.format(impact.eventClose);
      const eventReturn = document.createElement('td');
      setDirectional(eventReturn, impact.eventReturn);
      const nextReturn = document.createElement('td');
      setDirectional(nextReturn, impact.nextReturn);
      row.append(close, eventReturn, nextReturn);
    }
    const fxReturn = document.createElement('td');
    if (fxImpact) {
      setDirectional(fxReturn, -fxImpact.eventReturn, signed(fxImpact.eventReturn));
    } else {
      fxReturn.className = 'muted';
      fxReturn.textContent = '—';
    }
    row.append(fxReturn);
    rows.append(row);
  });

  return impacts.flatMap(({ impact }) => impact ? [impact] : []);
}

const newsFetchFailed = (live, feed = 'news') => Array.isArray(live?.errors)
  && live.errors.some((error) => String(error).startsWith(`${feed}:`));

export function renderNews(headlines, nowMs = Date.now(), fetchFailed = false, options = {}) {
  const {
    statusId = 'headline-status',
    listId = 'news-list',
    emptyLabel = 'HEADLINES UNAVAILABLE',
  } = options;
  const freshness = headlineFreshness(headlines, nowMs, fetchFailed);
  const status = $(statusId);
  if (status) {
    if (!freshness.latestAt) {
      status.textContent = freshness.state === 'FETCH_FAILED' ? 'HEADLINE FETCH FAILED' : emptyLabel;
    } else {
      const prefix = freshness.state === 'FETCH_FAILED' ? 'FETCH FAILED · LAST'
        : freshness.state === 'NO_NEW' ? 'NO NEW HEADLINES · LAST' : 'UPDATED';
      status.textContent = `${prefix} ${shortDate.format(new Date(freshness.latestAt)).toUpperCase()} ${time.format(new Date(freshness.latestAt))} WIB`;
    }
  }
  const list = $(listId);
  if (!list) return;
  list.replaceChildren();
  if (!headlines.length) {
    const item = document.createElement('li');
    item.className = 'muted';
    item.textContent = emptyLabel;
    list.append(item);
    return;
  }
  headlines.forEach((headline) => {
    const item = document.createElement('li');
    const stamp = document.createElement('span');
    stamp.className = 'news-time';
    const publishedAt = new Date(headline.publishedAt);
    stamp.textContent = Number.isFinite(publishedAt.getTime())
      ? `${shortDate.format(publishedAt).toUpperCase()} · ${time.format(publishedAt)} WIB`
      : 'DATE UNAVAILABLE';
    const body = document.createElement('div');
    const safeUrl = safeHttpsUrl(headline.url);
    const link = document.createElement(safeUrl ? 'a' : 'span');
    if (safeUrl) {
      link.href = safeUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
    }
    link.textContent = headline.title;
    const source = document.createElement('span');
    source.className = 'news-source';
    source.textContent = headline.source;
    body.append(link, source);
    item.append(stamp, body);
    list.append(item);
  });
}

function renderSnapshotNews(live, nowMs = Date.now(), forceFailure = false) {
  if ($('news-list')) {
    renderNews(live.headlines ?? [], nowMs, forceFailure || newsFetchFailed(live, 'news'));
  }
  if ($('stock-news-list')) {
    renderNews(live.stockNews ?? [], nowMs, forceFailure || newsFetchFailed(live, 'stock news'), {
      statusId: 'stock-news-status', listId: 'stock-news-list', emptyLabel: 'STOCK NEWS UNAVAILABLE',
    });
  }
  if ($('macro-news-list')) {
    renderNews(live.macroNews ?? [], nowMs, forceFailure || newsFetchFailed(live, 'macro news'), {
      statusId: 'macro-news-status', listId: 'macro-news-list', emptyLabel: 'MACRO NEWS UNAVAILABLE',
    });
  }
}

export function renderFxSparkline(points, events) {
  const svg = $('fx-sparkline');
  const tooltip = $('fx-tooltip');
  if (!svg || !tooltip) return;
  chartPointerCleanup.get(svg)?.();
  chartPointerCleanup.delete(svg);
  svg.replaceChildren();
  svg.onpointermove = null;
  svg.onpointerleave = null;
  svg.onpointerdown = null;
  svg.onpointerup = null;
  svg.onpointercancel = null;
  svg.onlostpointercapture = null;
  svg.onfocus = null;
  svg.onblur = null;
  svg.onkeydown = null;
  tooltip.classList.remove('visible');
  tooltip.replaceChildren();
  tooltip.style.left = '';
  tooltip.style.top = '';

  const visible = [...(points ?? [])]
    .filter((point) => point?.date && Number.isFinite(point.close))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
  if (visible.length < 2) {
    svg.append(svgElement('text', { x: 440, y: 45, class: 'chart-empty', 'text-anchor': 'middle' }, 'USD / IDR HISTORY UNAVAILABLE'));
    return;
  }
  const width = 880;
  const height = 92;
  const margin = { top: 10, right: 74, bottom: 20, left: 2 };
  const plotWidth = width - margin.left - margin.right;
  const min = Math.min(...visible.map((point) => point.close));
  const max = Math.max(...visible.map((point) => point.close));
  const spread = Math.max(max - min, 1);
  const x = (index) => margin.left + (index / (visible.length - 1)) * plotWidth;
  const y = (value) => margin.top + ((max - value) / spread) * (height - margin.top - margin.bottom);
  const line = visible.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)},${y(point.close).toFixed(2)}`).join(' ');
  svg.append(svgElement('path', { d: line, class: 'chart-line' }));
  events.forEach((event) => {
    if (event.date < visible[0].date || event.date > visible.at(-1).date) return;
    const nearest = nearestMarketPoint(visible, event.date);
    svg.append(svgElement('line', {
      x1: x(nearest.index), y1: margin.top, x2: x(nearest.index), y2: height - margin.bottom, class: 'chart-event',
    }));
  });
  svg.append(
    svgElement('text', { x: margin.left, y: height - 4, class: 'chart-label' }, compactDate(visible[0].date)),
    svgElement('text', { x: width - margin.right, y: height - 4, class: 'chart-label', 'text-anchor': 'end' }, compactDate(visible.at(-1).date)),
    svgElement('text', { x: width - margin.right + 8, y: y(visible.at(-1).close) + 3, class: 'chart-label' }, wholeNumber.format(visible.at(-1).close)),
  );

  const crosshair = svgElement('line', {
    x1: 0, y1: margin.top, x2: 0, y2: height - margin.bottom, class: 'chart-crosshair', display: 'none',
  });
  const hoverDot = svgElement('circle', { cx: 0, cy: 0, r: 5, class: 'chart-hover-dot', display: 'none' });
  svg.append(crosshair, hoverDot);
  let activePointerId = null;
  let keyboardIndex = visible.length - 1;

  const showPriceAtIndex = (index) => {
    const rect = svg.getBoundingClientRect();
    const point = visible[index];
    const px = x(index);
    const py = y(point.close);
    crosshair.setAttribute('x1', px);
    crosshair.setAttribute('x2', px);
    crosshair.removeAttribute('display');
    hoverDot.setAttribute('cx', px);
    hoverDot.setAttribute('cy', py);
    hoverDot.removeAttribute('display');
    tooltip.replaceChildren(
      document.createTextNode(number.format(point.close)),
      htmlElement('span', '', dateLabel(point.date)),
    );
    tooltip.style.left = `${Math.max(62, Math.min(rect.width - 62, (px / width) * rect.width))}px`;
    tooltip.style.top = `${(py / height) * rect.height}px`;
    tooltip.classList.add('visible');
  };
  const showPriceAtPointer = (pointerEvent) => {
    const rect = svg.getBoundingClientRect();
    const localX = ((pointerEvent.clientX - rect.left) / rect.width) * width;
    const ratio = Math.max(0, Math.min(1, (localX - margin.left) / plotWidth));
    keyboardIndex = Math.round(ratio * (visible.length - 1));
    showPriceAtIndex(keyboardIndex);
  };
  const hidePrice = () => {
    crosshair.setAttribute('display', 'none');
    hoverDot.setAttribute('display', 'none');
    tooltip.classList.remove('visible');
  };
  svg.onpointerdown = (pointerEvent) => {
    if (pointerEvent.pointerType === 'touch' || pointerEvent.pointerType === 'pen') {
      if (activePointerId !== null) return;
      activePointerId = pointerEvent.pointerId;
      svg.setPointerCapture?.(pointerEvent.pointerId);
    }
    showPriceAtPointer(pointerEvent);
  };
  svg.onpointermove = (pointerEvent) => {
    if (pointerEvent.pointerType !== 'mouse' && activePointerId !== pointerEvent.pointerId) return;
    showPriceAtPointer(pointerEvent);
  };
  svg.onpointerleave = () => {
    if (activePointerId === null) hidePrice();
  };
  const finishTouch = (pointerEvent) => {
    if (pointerEvent.pointerId !== activePointerId) return;
    const pointerId = activePointerId;
    activePointerId = null;
    if (svg.hasPointerCapture?.(pointerId)) svg.releasePointerCapture(pointerId);
    hidePrice();
  };
  svg.onpointerup = (pointerEvent) => {
    if (pointerEvent.pointerType === 'touch' || pointerEvent.pointerType === 'pen') finishTouch(pointerEvent);
  };
  svg.onpointercancel = (pointerEvent) => {
    if (activePointerId === null) hidePrice();
    else finishTouch(pointerEvent);
  };
  svg.onlostpointercapture = (pointerEvent) => {
    if (pointerEvent.pointerId !== activePointerId) return;
    activePointerId = null;
    hidePrice();
  };
  svg.onfocus = () => showPriceAtIndex(keyboardIndex);
  svg.onblur = hidePrice;
  svg.onkeydown = (keyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(keyboardEvent.key)) return;
    keyboardEvent.preventDefault();
    keyboardIndex = Math.max(0, Math.min(visible.length - 1,
      keyboardIndex + (keyboardEvent.key === 'ArrowRight' ? 1 : -1)));
    showPriceAtIndex(keyboardIndex);
  };
  chartPointerCleanup.set(svg, () => {
    const pointerId = activePointerId;
    activePointerId = null;
    if (pointerId !== null && svg.hasPointerCapture?.(pointerId)) svg.releasePointerCapture(pointerId);
    hidePrice();
  });
}


function renderFeedFreshness(live, nowMs = Date.now()) {
  const describe = (quote) => {
    if (!quote || !Number.isFinite(Date.parse(quote.quoteAt))) return 'DATA UNAVAILABLE';
    const quoteMs = Date.parse(quote.quoteAt);
    const age = nowMs - quoteMs;
    const fresh = quote.marketState === 'REGULAR' && age >= -60_000 && age <= 15 * 60_000;
    const state = fresh ? 'FRESH' : quote.marketState === 'CLOSED' ? 'LAST QUOTE' : 'STALE';
    return `${state} · ${shortDate.format(new Date(quoteMs)).toUpperCase()} ${time.format(new Date(quoteMs))} WIB`;
  };
  const marketStatus = $('market-freshness');
  const fxStatus = $('fx-freshness');
  if (marketStatus) marketStatus.textContent = describe(live?.market);
  if (fxStatus) fxStatus.textContent = describe(live?.fx);
}

// Live market data is committed by the refresh workflow. Pages only hosts the
// static app — do NOT redeploy Pages just to pick up a new live.json. Public
// hosts read the latest committed file from raw.githubusercontent.com (CORS *).
// Local/LAN servers and Node tests keep same-origin/relative so offline/dev works.
const LIVE_JSON_RAW =
  'https://raw.githubusercontent.com/farizvect/my-president-breakout/master/data/live.json';

function snapshotUrl() {
  let host = '';
  try {
    host = globalThis.location?.hostname || '';
  } catch {
    host = '';
  }
  const useRaw =
    host.endsWith('github.io')
    || host === 'farizulhammi.ebizu.id'
    || (host.endsWith('.ebizu.id') && host !== 'ebizu.id');
  const base = useRaw ? LIVE_JSON_RAW : './data/live.json';
  return `${base}?v=${Date.now()}`;
}

let lastLiveSnapshot = null;
let lastEvents = [];

function validateRenderableSnapshot(live, nowMs) {
  if (!isValidPriceSeriesSnapshot(live?.market, nowMs) || typeof live.market.date !== 'string') {
    throw new Error('market snapshot has no usable quote');
  }
  if (live.fx != null && !isValidPriceSeriesSnapshot(live.fx, nowMs)) {
    throw new Error('FX snapshot has no usable quote');
  }
}

function renderFxQuote(live, nowMs = Date.now()) {
  const label = $('fx-label');
  const price = $('fx-price');
  const change = $('fx-change');
  const fx = live?.fx;
  if (!fx || !Number.isFinite(fx.price) || !Number.isFinite(fx.changePercent)) {
    label.textContent = 'USD / IDR · UNAVAILABLE';
    price.textContent = 'DATA UNAVAILABLE';
    change.textContent = '—';
    change.classList.remove('positive', 'negative');
    return;
  }

  const quoteAt = new Date(fx.quoteAt);
  const quoteAge = nowMs - quoteAt.getTime();
  const quoteIsFresh = fx.marketState === 'REGULAR'
    && quoteAge >= -60_000
    && quoteAge <= 15 * 60_000;
  label.textContent = fx.marketState === 'CLOSED'
    ? 'USD / IDR · LAST QUOTE'
    : quoteIsFresh ? 'USD / IDR' : 'USD / IDR · STALE';
  price.textContent = number.format(fx.price);
  const display = `${fx.change >= 0 ? '+' : ''}${number.format(fx.change)} · ${signed(fx.changePercent)}`;
  // A rising USD/IDR rate means the rupiah is weakening, so invert only the color direction.
  setDirectional(change, -fx.changePercent, display);
}

function renderMarketQuote(live, nowMs = Date.now()) {
  validateRenderableSnapshot(live, nowMs);
  const market = live?.market;
  $('market-price').textContent = number.format(market.price);
  setDirectional($('market-change'), market.changePercent,
    `${market.change >= 0 ? '+' : ''}${number.format(market.change)} · ${signed(market.changePercent)}`);
  const quoteAt = new Date(market.quoteAt ?? live.generatedAt);
  const quoteAge = nowMs - quoteAt.getTime();
  const quoteIsFresh = market.marketState === 'REGULAR'
    && quoteAge >= -60_000
    && quoteAge <= 15 * 60_000;
  const status = quoteIsFresh
    ? '5-MIN AUTO REFRESH'
    : market.marketState === 'CLOSED' ? 'LAST QUOTE' : 'STALE QUOTE';
  $('data-age').textContent = `${status} · ${market.date} ${time.format(quoteAt)} WIB · YAHOO DELAYED`;
  renderFxQuote(live, nowMs);
  renderFeedFreshness(live, nowMs);
}

export async function refreshMarketQuote(nowMs = Date.now()) {
  try {
    const response = await fetch(snapshotUrl(), { cache: 'no-store' });
    if (!response.ok) throw new Error(`market refresh returned ${response.status}`);
    const live = await response.json();
    renderMarketQuote(live, nowMs);
    renderSnapshotNews(live, nowMs);
    if ($('fx-sparkline')) renderFxSparkline(live.fx?.points ?? [], lastEvents);
    lastLiveSnapshot = live;
  } catch {
    // Preserve values but keep aging every feed so failed polling cannot claim freshness.
    if (lastLiveSnapshot) {
      const failedSnapshot = {
        ...lastLiveSnapshot,
        market: lastLiveSnapshot.market
          ? { ...lastLiveSnapshot.market, marketState: lastLiveSnapshot.market.marketState === 'CLOSED' ? 'CLOSED' : 'STALE' } : null,
        fx: lastLiveSnapshot.fx
          ? { ...lastLiveSnapshot.fx, marketState: lastLiveSnapshot.fx.marketState === 'CLOSED' ? 'CLOSED' : 'STALE' } : null,
      };
      renderMarketQuote(failedSnapshot, nowMs);
      renderSnapshotNews(failedSnapshot, nowMs, true);
    }
  }
}

async function loadTerminal() {
  try {
    const [liveResponse, eventsResponse] = await Promise.all([
      fetch(snapshotUrl(), { cache: 'no-store' }),
      fetch('./data/events.json', { cache: 'no-store' }),
    ]);
    if (!liveResponse.ok || !eventsResponse.ok) throw new Error('market snapshot or event archive is unavailable');
    const [live, events] = await Promise.all([liveResponse.json(), eventsResponse.json()]);
    const market = live.market;
    if (!market?.points?.length) throw new Error('market snapshot has no chart points');

    renderMarketQuote(live);
    lastLiveSnapshot = live;
    lastEvents = events;
    $('speech-count').textContent = String(events.length);

    const impacts = renderImpacts(events, market.points, live.fx?.points ?? []);
    if (impacts.length) {
      const average = impacts.reduce((sum, impact) => sum + impact.eventReturn, 0) / impacts.length;
      setDirectional($('average-impact'), average);
    } else {
      $('average-impact').textContent = '—';
    }
    setupInteractiveChart(market.points, events, live.fx?.points ?? []);
    renderFxSparkline(live.fx?.points ?? [], events);
    renderSchedule(events);
    renderSnapshotNews(live);

    if (live.errors?.length) {
      $('terminal-error').hidden = false;
      $('terminal-error').textContent = `PARTIAL DATA: ${live.errors.join(' · ')}`;
    }
  } catch (error) {
    $('terminal-error').hidden = false;
    $('terminal-error').textContent = `DATA UNAVAILABLE · ${error.message}`;
    $('data-age').textContent = 'Static game remains available';
  }
}

if (typeof window !== 'undefined') {
  loadTerminal();
  window.setInterval(refreshMarketQuote, 60_000);
}
