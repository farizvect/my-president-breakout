import { calculateEventImpact, pickNextEvent } from './market-core.mjs';

const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const number = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });

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

function nearestPointIndex(points, date) {
  const exactOrAfter = points.findIndex((point) => point.date >= date);
  return exactOrAfter < 0 ? points.length - 1 : exactOrAfter;
}

function renderChart(points, events) {
  const svg = $('market-chart');
  svg.replaceChildren();
  if (points.length < 2) return;

  const width = 580;
  const height = 270;
  const margin = { top: 15, right: 48, bottom: 30, left: 8 };
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
      points[pointIndex].date.slice(0, 7)));
  }

  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)},${y(point.close).toFixed(2)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${height - margin.bottom} L${x(0)},${height - margin.bottom} Z`;
  svg.append(svgElement('path', { d: area, class: 'chart-area' }));
  svg.append(svgElement('path', { d: line, class: 'chart-line' }));

  for (const event of events) {
    if (event.date < points[0].date || event.date > points.at(-1).date) continue;
    const index = nearestPointIndex(points, event.date);
    const px = x(index);
    const py = y(points[index].close);
    const group = svgElement('g');
    group.append(svgElement('line', { x1: px, y1: margin.top, x2: px, y2: height - margin.bottom, class: 'chart-event' }));
    group.append(svgElement('circle', { cx: px, cy: py, r: 3.5, class: 'chart-event-dot' }));
    group.append(svgElement('title', {}, `${event.title} · ${dateLabel(event.date)} · IHSG ${number.format(points[index].close)}`));
    svg.append(group);
  }
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

function renderImpacts(events, points) {
  const rows = $('impact-rows');
  rows.replaceChildren();
  const impacts = events.map((event) => ({ event, impact: calculateEventImpact(event, points) }));

  impacts.forEach(({ event, impact }) => {
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
    rows.append(row);
  });

  return impacts.flatMap(({ impact }) => impact ? [impact] : []);
}

function renderNews(headlines) {
  const list = $('news-list');
  list.replaceChildren();
  if (!headlines.length) {
    const item = document.createElement('li');
    item.className = 'muted';
    item.textContent = 'HEADLINES UNAVAILABLE';
    list.append(item);
    return;
  }
  headlines.forEach((headline) => {
    const item = document.createElement('li');
    const stamp = document.createElement('span');
    stamp.className = 'news-time';
    stamp.textContent = headline.publishedAt ? time.format(new Date(headline.publishedAt)) : '--:--';
    const body = document.createElement('div');
    const link = document.createElement('a');
    link.href = headline.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = headline.title;
    const source = document.createElement('span');
    source.className = 'news-source';
    source.textContent = headline.source;
    body.append(link, source);
    item.append(stamp, body);
    list.append(item);
  });
}

async function loadTerminal() {
  try {
    const [liveResponse, eventsResponse] = await Promise.all([
      fetch('./data/live.json', { cache: 'no-store' }),
      fetch('./data/events.json', { cache: 'no-store' }),
    ]);
    if (!liveResponse.ok || !eventsResponse.ok) throw new Error('market snapshot or event archive is unavailable');
    const [live, events] = await Promise.all([liveResponse.json(), eventsResponse.json()]);
    const market = live.market;
    if (!market?.points?.length) throw new Error('market snapshot has no chart points');

    $('market-price').textContent = number.format(market.price);
    setDirectional($('market-change'), market.changePercent,
      `${market.change >= 0 ? '+' : ''}${number.format(market.change)} · ${signed(market.changePercent)}`);
    $('speech-count').textContent = String(events.length);

    const impacts = renderImpacts(events, market.points);
    if (impacts.length) {
      const average = impacts.reduce((sum, impact) => sum + impact.eventReturn, 0) / impacts.length;
      setDirectional($('average-impact'), average);
    } else {
      $('average-impact').textContent = '—';
    }
    renderChart(market.points, events);
    renderSchedule(events);
    renderNews(live.headlines ?? []);

    const generated = new Date(live.generatedAt);
    $('data-age').textContent = `Delayed close ${market.date} · snapshot ${time.format(generated)} WIB`;
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

loadTerminal();
