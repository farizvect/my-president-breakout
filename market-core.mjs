// DOM-free market data normalization and event-study helpers.

const round = (value, digits = 2) => Number(Number(value).toFixed(digits));

export function normalizeYahooChart(payload) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  return timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    if (!Number.isFinite(close)) return [];
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

export function parseNewsRss(xml, limit = 8) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .slice(0, limit)
    .flatMap((match) => {
      const item = match[1];
      const rawTitle = tag(item, 'title');
      const url = tag(item, 'link');
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
    });
}

export function pickNextEvent(events, today = new Date().toISOString().slice(0, 10)) {
  return [...events]
    .filter((event) => event.status === 'confirmed' && event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}
