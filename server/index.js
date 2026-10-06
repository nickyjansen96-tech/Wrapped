import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as finnhub from './finnhub.js';
import { readPortfolio, addStock, removeStock } from './store.js';
import { cached } from './cache.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/huishoudboek', express.static(path.join(__dirname, '..', 'huishoudboek')));

// --- Portfolio -------------------------------------------------------------

app.get('/api/stocks', async (_req, res) => {
  res.json(await readPortfolio());
});

app.post('/api/stocks', async (req, res) => {
  const symbol = (req.body?.symbol || '').toString().trim().toUpperCase();
  if (!symbol) {
    return res.status(400).json({ error: 'Symbool is verplicht.' });
  }
  try {
    const [quote, profile] = await Promise.all([
      finnhub.getQuote(symbol),
      finnhub.getProfile(symbol).catch(() => ({})),
    ]);
    const isKnown = quote && (quote.c || quote.pc || quote.h || quote.l);
    if (!isKnown) {
      return res.status(404).json({ error: `Onbekend symbool: ${symbol}` });
    }
    const stock = {
      symbol,
      name: profile?.name || symbol,
      addedAt: new Date().toISOString(),
    };
    const stocks = await addStock(stock);
    res.status(201).json(stocks);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.delete('/api/stocks/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  res.json(await removeStock(symbol));
});

// --- Zoeken (autocomplete) ---------------------------------------------------

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json([]);
  try {
    const data = await cached(`search:${q.toLowerCase()}`, 60_000, () => finnhub.searchSymbol(q));
    const results = (data.result || [])
      .filter((r) => !r.type || r.type === 'Common Stock' || r.type === 'ETP')
      .slice(0, 10)
      .map((r) => ({ symbol: r.symbol, description: r.description }));
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Live koersen ------------------------------------------------------------

app.get('/api/quotes', async (_req, res) => {
  try {
    const stocks = await readPortfolio();
    const quotes = await Promise.all(
      stocks.map(async (s) => {
        try {
          const q = await cached(`quote:${s.symbol}`, 15_000, () => finnhub.getQuote(s.symbol));
          return {
            symbol: s.symbol,
            name: s.name,
            price: q.c,
            change: q.d,
            changePercent: q.dp,
            high: q.h,
            low: q.l,
            open: q.o,
            previousClose: q.pc,
            updatedAt: q.t ? new Date(q.t * 1000).toISOString() : null,
          };
        } catch (err) {
          return { symbol: s.symbol, name: s.name, error: err.message };
        }
      })
    );
    res.json(quotes);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Agenda: belangrijke gebeurtenissen (earnings, dividenden) --------------

function hourLabel(hour) {
  if (hour === 'bmo') return 'voor beursopening';
  if (hour === 'amc') return 'na beurssluiting';
  return hour || null;
}

function buildEarningsDetail(e) {
  const parts = [];
  if (e.epsEstimate !== null && e.epsEstimate !== undefined) parts.push(`EPS verwacht: ${e.epsEstimate}`);
  if (e.epsActual !== null && e.epsActual !== undefined) parts.push(`EPS actueel: ${e.epsActual}`);
  if (e.revenueEstimate) {
    parts.push(`Omzet verwacht: ${Math.round(e.revenueEstimate).toLocaleString('nl-NL')}`);
  }
  return parts.join(' • ') || undefined;
}

app.get('/api/calendar', async (_req, res) => {
  try {
    const stocks = await readPortfolio();
    if (stocks.length === 0) return res.json([]);

    const symbols = new Set(stocks.map((s) => s.symbol));
    const nameBySymbol = Object.fromEntries(stocks.map((s) => [s.symbol, s.name]));

    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 90);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const events = [];

    // Earnings (kwartaalcijfers) — één call, dan filteren op eigen portfolio.
    try {
      const earnings = await cached(`earnings:${fromStr}:${toStr}`, 6 * 60 * 60_000, () =>
        finnhub.getEarningsCalendar(fromStr, toStr)
      );
      for (const e of earnings) {
        if (!symbols.has(e.symbol)) continue;
        events.push({
          type: 'earnings',
          symbol: e.symbol,
          name: nameBySymbol[e.symbol] || e.symbol,
          date: e.date,
          title: `Kwartaalcijfers ${e.symbol}${e.hour ? ` (${hourLabel(e.hour)})` : ''}`,
          detail: buildEarningsDetail(e),
        });
      }
    } catch (err) {
      console.warn('Kon earnings-kalender niet ophalen:', err.message);
    }

    // Dividenden per symbool — best effort, faalt stil als het plan dit niet toestaat.
    await Promise.all(
      stocks.map(async (s) => {
        try {
          const divs = await cached(`div:${s.symbol}:${fromStr}:${toStr}`, 6 * 60 * 60_000, () =>
            finnhub.getDividends(s.symbol, fromStr, toStr)
          );
          for (const d of divs) {
            const date = d.exDate || d.date;
            if (!date) continue;
            events.push({
              type: 'dividend',
              symbol: s.symbol,
              name: s.name,
              date,
              title: `Ex-dividend ${s.symbol}`,
              detail: d.amount ? `Bedrag: ${d.amount} ${d.currency || ''}`.trim() : undefined,
            });
          }
        } catch (err) {
          console.warn(`Kon dividenden voor ${s.symbol} niet ophalen:`, err.message);
        }
      })
    );

    events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    res.json(events);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Niet gevonden.' }));

app.listen(PORT, () => {
  console.log(`Stock app draait op http://localhost:${PORT}`);
});
