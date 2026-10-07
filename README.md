# Mijn Aandelen

Een kleine webapp voor je eigen aandelenportfolio: voeg zelf aandelen toe, bekijk
live koersen, en zie een agenda met belangrijke gebeurtenissen (kwartaalcijfers /
earnings en dividenden) rondom die aandelen. De koersen en agenda-data komen live
uit de [Finnhub](https://finnhub.io) API.

> Ook in deze repo: het **Huishoudboek** als installeerbare app, zie
> [`huishoudboek/README.md`](huishoudboek/README.md) — met `npm start` te openen op
> http://localhost:3000/huishoudboek/.
>
> En **Huizenjacht** (zoektocht naar een koophuis: wensen, checklist, huizen,
> hypotheek), een React/Vite-app in [`huizenjacht/`](huizenjacht/README.md).

## Features

- **Eigen portfolio** — voeg aandelen toe via ticker-zoekopdracht (bv. `AAPL`,
  `MSFT`, of Europese tickers zoals `ASML.AS`) en verwijder ze weer.
- **Live koersen** — huidige prijs, verandering (€/%) en dag laag/hoog, elke
  20 seconden automatisch ververst.
- **Agenda** — komende 90 dagen aan kwartaalcijfers (earnings) en, indien
  beschikbaar op je Finnhub-plan, ex-dividenddata voor de aandelen in je
  portfolio, gegroepeerd per dag.
- Portfolio wordt lokaal opgeslagen in `data/portfolio.json` (geen database
  nodig).

## Aan de slag

1. **Node.js 18+** is vereist (voor de ingebouwde `fetch`).
2. Installeer dependencies:

   ```bash
   npm install
   ```

3. Vraag een **gratis API key** aan bij Finnhub: https://finnhub.io/register
4. Kopieer `.env.example` naar `.env` en vul je key in:

   ```bash
   cp .env.example .env
   ```

   ```
   FINNHUB_API_KEY=jouw_finnhub_api_key
   PORT=3000
   ```

5. Start de app:

   ```bash
   npm start
   ```

6. Open http://localhost:3000 in je browser.

## Hoe het werkt

- **Backend** (`server/`): een Express-server die:
  - je portfolio bijhoudt in `data/portfolio.json`;
  - koersen ophaalt via `GET /quote` en bedrijfsnamen via `GET /stock/profile2`
    van Finnhub, met een korte cache (15s) om binnen de gratis rate limit te
    blijven;
  - de agenda samenstelt uit `GET /calendar/earnings` (kwartaalcijfers) en
    `GET /stock/dividend2` (dividenden) per aandeel, gecached voor 6 uur.
- **Frontend** (`public/`): een simpele, afhankelijkheidsvrije HTML/CSS/JS
  pagina die de backend-API's aanroept en automatisch ververst.

## Een andere live feed gebruiken

Wil je een andere databron (bv. Alpha Vantage, Twelve Data, IEX Cloud)?
Alle externe aanroepen zitten geïsoleerd in `server/finnhub.js` — vervang de
implementatie daar en de rest van de app (routes, frontend) blijft
ongewijzigd werken.

## Beperkingen

- Sommige agenda-data (met name dividenden) kan op het gratis Finnhub-plan
  beperkt of niet beschikbaar zijn. De app degradeert dan stil: die
  gebeurtenissen verschijnen dan niet, de rest van de agenda blijft werken.
- Dit is een single-user, lokale app zonder authenticatie — bedoeld om zelf
  te draaien, niet publiek te hosten zonder extra beveiliging.
