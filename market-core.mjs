// DOM-free market data normalization and event-study helpers.

const round = (value, digits = 2) => Number(Number(value).toFixed(digits));

export function normalizeYahooChart(payload) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  return timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    if (!Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(close) || close <= 0) return [];
    return [{
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      close: round(close),
    }];
  });
}

export function latestMarketSummary(market) {
  if (market.length < 2) return null;
  const previous = market.at(-2);
  const current = market.at(-1);
  const change = current.close - previous.close;
  return {
    price: current.close,
    previousClose: previous.close,
    change: round(change),
    changePercent: round((change / previous.close) * 100),
    date: current.date,
  };
}

export function normalizeYahooQuote(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
  const meta = payload?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  const previousClose = Number(meta?.previousClose ?? meta?.chartPreviousClose);
  const quoteSeconds = Number(meta?.regularMarketTime);
  if (!Number.isFinite(price) || price <= 0
    || !Number.isFinite(previousClose) || previousClose <= 0
    || !Number.isFinite(quoteSeconds) || quoteSeconds < 946684800
    || quoteSeconds > nowSeconds) {
    throw new TypeError('Missing or invalid Yahoo quote metadata fields');
  }
  const timezone = meta?.exchangeTimezoneName ?? '';
  const regular = meta?.currentTradingPeriod?.regular;
  if (!regular || !Number.isFinite(regular.start) || regular.start < 946684800
    || !Number.isFinite(regular.end) || regular.end < 946684800
    || regular.end <= regular.start
    || regular.end - regular.start < 60 * 60
    || regular.end - regular.start > 24 * 60 * 60
    || regular.end < nowSeconds - 7 * 24 * 60 * 60
    || regular.start > nowSeconds + 24 * 60 * 60) {
    throw new TypeError('Missing currentTradingPeriod metadata in Yahoo quote');
  }
  const sessionIsOpen = nowSeconds >= regular.start && nowSeconds <= regular.end;
  const quoteIsFresh = quoteSeconds >= regular?.start
    && nowSeconds >= quoteSeconds
    && nowSeconds - quoteSeconds <= 15 * 60;
  const marketState = !sessionIsOpen ? 'CLOSED' : quoteIsFresh ? 'REGULAR' : 'STALE';
  const rawChange = price - previousClose;
  const change = round(rawChange);
  return {
    price: round(price),
    previousClose: round(previousClose),
    change,
    changePercent: round((rawChange / previousClose) * 100),
    quoteAt: new Date(quoteSeconds * 1000).toISOString(),
    exchangeTimezone: meta.exchangeTimezoneName ?? 'Asia/Jakarta',
    marketState,
  };
}

export function normalizeUsdIdrQuote(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
  return {
    symbol: 'IDR=X',
    pair: 'USD/IDR',
    baseCurrency: 'USD',
    quoteCurrency: 'IDR',
    ...normalizeYahooQuote(payload, nowSeconds),
  };
}

export function markMarketSnapshotStale(market) {
  return market ? { ...market, marketState: 'STALE' } : null;
}

export function mergeQuoteIntoDailySeries(points, quoteDate, price) {
  const next = points.map((point) => ({ ...point }));
  const index = next.findIndex((point) => point.date === quoteDate);
  const quotePoint = { date: quoteDate, close: round(price) };
  if (index >= 0) next[index] = quotePoint;
  else next.push(quotePoint);
  return next.sort((a, b) => a.date.localeCompare(b.date));
}

export function filterMarketRange(market, months) {
  if (!market.length || !Number.isFinite(months) || months <= 0) return [...market];
  const points = [...market].sort((a, b) => a.date.localeCompare(b.date));
  const end = new Date(`${points.at(-1).date}T00:00:00Z`);
  const targetMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months, 1));
  const daysInTargetMonth = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  targetMonth.setUTCDate(Math.min(end.getUTCDate(), daysInTargetMonth));
  const cutoff = targetMonth.toISOString().slice(0, 10);
  return points.filter((point) => point.date >= cutoff);
}

export function nearestMarketPoint(market, date) {
  if (!market.length) return null;
  const index = market.findIndex((point) => point.date >= date);
  const resolvedIndex = index < 0 ? market.length - 1 : index;
  return { index: resolvedIndex, point: market[resolvedIndex] };
}

export function chartTickLabel(date, pointCount) {
  if (pointCount > 100) return date.slice(0, 7);
  const [, month, day] = date.split('-');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${day} ${months[Number(month) - 1]}`;
}

export function calculateEventImpact(event, market) {
  const points = [...market]
    .filter((point) => point?.date && Number.isFinite(point.close))
    .sort((a, b) => a.date.localeCompare(b.date));
  const eventIndex = points.findIndex((point) => point.date >= event.date);
  if (eventIndex < 1 || eventIndex + 1 >= points.length) return null;

  const previous = points[eventIndex - 1];
  const current = points[eventIndex];
  const next = points[eventIndex + 1];
  return {
    previousClose: previous.close,
    eventClose: current.close,
    nextClose: next.close,
    eventDate: current.date,
    nextDate: next.date,
    eventReturn: round(((current.close / previous.close) - 1) * 100),
    nextReturn: round(((next.close / current.close) - 1) * 100),
  };
}

const decodeXml = (value = '') => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'");

const tag = (xml, name) => {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return decodeXml(match?.[1]?.trim() ?? '');
};

export function safeHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export function parseNewsRss(xml, limit = 8) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .flatMap((match) => {
      const item = match[1];
      const rawTitle = tag(item, 'title');
      const url = safeHttpsUrl(tag(item, 'link'));
      if (!rawTitle || !url) return [];
      const source = tag(item, 'source') || 'News';
      const suffix = ` - ${source}`;
      const title = rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle;
      const published = new Date(tag(item, 'pubDate'));
      return [{
        title,
        url,
        source,
        publishedAt: Number.isNaN(published.valueOf()) ? null : published.toISOString(),
      }];
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.publishedAt);
      const bTime = Date.parse(b.publishedAt);
      return (Number.isFinite(bTime) ? bTime : -Infinity) - (Number.isFinite(aTime) ? aTime : -Infinity);
    })
    .slice(0, limit);
}

export function pickNextEvent(events, today = new Date().toISOString().slice(0, 10)) {
  return [...events]
    .filter((event) => event.status === 'confirmed' && event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

export function resolveMarketUrlState(search, events) {
  const params = new URLSearchParams(search);
  const requestedRange = Number(params.get('range'));
  const requestedEvent = params.get('event');
  return {
    eventId: events.some((event) => event.id === requestedEvent) ? requestedEvent : null,
    range: [3, 6, 12].includes(requestedRange) ? requestedRange : 12,
  };
}

export function headlineFreshness(headlines, nowMs = Date.now(), fetchFailed = false) {
  if (!Array.isArray(headlines) || !headlines.length) {
    return { latestAt: null, state: fetchFailed ? 'FETCH_FAILED' : 'UNAVAILABLE' };
  }
  const timestamps = headlines
    .map((headline) => Date.parse(headline?.publishedAt))
    .filter(Number.isFinite);
  if (!timestamps.length) return { latestAt: null, state: fetchFailed ? 'FETCH_FAILED' : 'UNAVAILABLE' };
  const latestMs = Math.max(...timestamps);
  if (latestMs > nowMs) {
    return { latestAt: null, state: fetchFailed ? 'FETCH_FAILED' : 'UNAVAILABLE' };
  }
  return {
    latestAt: new Date(latestMs).toISOString(),
    state: fetchFailed ? 'FETCH_FAILED'
      : nowMs - latestMs <= 24 * 60 * 60 * 1000 ? 'CURRENT' : 'NO_NEW',
  };
}

export function isValidPriceSeriesSnapshot(candidate, nowMs = Date.now()) {
  const quoteMs = Date.parse(candidate?.quoteAt);
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  const quoteDateParts = Number.isFinite(quoteMs)
    ? new Intl.DateTimeFormat('en', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
    }).formatToParts(new Date(quoteMs)) : [];
  const quoteDateValues = Object.fromEntries(quoteDateParts.map((part) => [part.type, part.value]));
  const quoteDate = `${quoteDateValues.year}-${quoteDateValues.month}-${quoteDateValues.day}`;
  const expectedChange = round(candidate.price - candidate.previousClose);
  const expectedChangePercent = round(((candidate.price / candidate.previousClose) - 1) * 100);
  const pointsAreValid = Array.isArray(candidate.points) && candidate.points.length >= 2
    && candidate.points.every((point) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(point?.date)) return false;
      const parsed = new Date(`${point.date}T00:00:00Z`);
      return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === point.date
        && Number.isFinite(point.close) && point.close > 0;
    })
    && candidate.points.every((point, index) => index === 0 || candidate.points[index - 1].date < point.date);
  const lastPoint = pointsAreValid ? candidate.points.at(-1) : null;
  const previousPoint = pointsAreValid ? candidate.points.at(-2) : null;
  // When daily history has weekend/holiday gaps, Yahoo previousClose often
  // won't match the prior point exactly. Only enforce a tight match when
  // the two trailing points are consecutive calendar days.
  const consecutiveSessions = lastPoint && previousPoint
    && ((Date.parse(`${lastPoint.date}T00:00:00Z`) - Date.parse(`${previousPoint.date}T00:00:00Z`))
      === 24 * 60 * 60 * 1000);
  const previousCloseMatchesSeries = !previousPoint || !consecutiveSessions
    || Math.abs(previousPoint.close - candidate.previousClose)
      <= Math.max(0.02, candidate.previousClose * 0.0001);
  return Number.isFinite(candidate.price) && candidate.price > 0
    && Number.isFinite(candidate.previousClose) && candidate.previousClose > 0
    && Number.isFinite(candidate.change) && Number.isFinite(candidate.changePercent)
    && Math.abs(round(candidate.change - expectedChange)) <= 0.01
    && Math.abs(round(candidate.changePercent - expectedChangePercent)) <= 0.01
    && typeof candidate.quoteAt === 'string' && Number.isFinite(quoteMs)
    && quoteMs >= Date.UTC(2000, 0, 1) && quoteMs <= nowMs
    && ['REGULAR', 'STALE', 'CLOSED'].includes(candidate.marketState)
    && pointsAreValid && lastPoint.date <= quoteDate && lastPoint.close === candidate.price
    && previousCloseMatchesSeries
    && (candidate.date == null || candidate.date === lastPoint.date);
}
