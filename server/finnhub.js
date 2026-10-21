// Dunne wrapper rond de gratis Finnhub API — dit is de "live feed" voor koersen
// en agenda-events. Zie https://finnhub.io/docs/api voor de volledige documentatie.
const BASE_URL = 'https://finnhub.io/api/v1';

function apiKey() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new Error(
      'FINNHUB_API_KEY ontbreekt. Vraag een gratis key aan op https://finnhub.io/register en zet ' +
        'deze in het .env bestand (zie .env.example).'
    );
  }
  return key;
}

async function get(pathname, params = {}) {
  const url = new URL(BASE_URL + pathname);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  url.searchParams.set('token', apiKey());

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Finnhub ${pathname} gaf status ${res.status}${body ? `: ${body}` : ''}`);
  }
  return res.json();
}

/** Live koers voor één symbool (current, change, %change, high, low, open, previous close). */
export function getQuote(symbol) {
  return get('/quote', { symbol });
}

/** Bedrijfsprofiel, vooral gebruikt voor de volledige naam bij het toevoegen van een aandeel. */
export function getProfile(symbol) {
  return get('/stock/profile2', { symbol });
}

/** Ticker/naam zoekopdracht, voor autocomplete bij het toevoegen van een aandeel. */
export function searchSymbol(query) {
  return get('/search', { q: query });
}

/** Earnings-kalender (kwartaalcijfers) in een datumrange. Wordt client-side gefilterd op portfolio. */
export async function getEarningsCalendar(from, to) {
  const data = await get('/calendar/earnings', { from, to });
  return data.earningsCalendar || [];
}

/**
 * Dividend-kalender per symbool. Op sommige gratis Finnhub-plannen is dit endpoint
 * beperkt of niet beschikbaar — falen hier mag de rest van de agenda niet blokkeren,
 * dus de aanroeper vangt fouten af.
 */
export async function getDividends(symbol, from, to) {
  const data = await get('/stock/dividend2', { symbol, from, to });
  return Array.isArray(data) ? data : data.data || [];
}
