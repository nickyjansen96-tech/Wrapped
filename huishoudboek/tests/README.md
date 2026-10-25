# Tests

Browsertests die de app doorlopen zoals een gebruiker dat doet: bankbestanden
inlezen, regels maken, budgetten invullen, vergelijken, gebruikers beheren,
de rondleiding en alle schermen op 9 schermformaten.

```bash
huishoudboek/tests/run.sh          # alles
huishoudboek/tests/run.sh 01 08    # alleen bepaalde tests
```

Nodig: Node 18+, Python 3 (voor de lokale server) en Playwright met Chromium
(`npm i -g playwright && npx playwright install chromium`). Staan die ergens
anders, geef dan het pad mee:

```bash
PLAYWRIGHT_MODULE=/pad/naar/playwright/index.mjs CHROMIUM_PATH=/pad/naar/chromium huishoudboek/tests/run.sh
```

| Test | Wat |
|---|---|
| 01-volledig | Lege app, inlezen (TXT Windows/UTF-8, XLS, XLSX, CSV), dubbelen, regels, budgettabel, overzicht, vermogen, back-up, gebruikers, offline |
| 02-rondleiding | Rondleiding: elke stap wijst het juiste onderdeel aan, tooltip in beeld |
| 03-responsive | Alle schermen op 320–1440 px: niets buiten beeld, geen zijwaarts scrollen, tikdoelen groot genoeg |
| 04-ai-antwoorden | Het inlezen van 12 realistische antwoorden van Claude en ChatGPT |
| 05-ai-regels | De AI-stappen: vraag (zonder rekeningnummers), plakken, voorstellen, toevoegen |
| 06-ai-vindbaar | De knoppen "Laat AI indelen" op overzicht, transacties en na het inlezen |
| 07-transacties | Details per transactie, bron van de categorie, regel maken met telling |
| 08-vergelijk | Budget vs werkelijk per hoofdcategorie, nagerekend |
| 09-inkomsten-uitgaven | Alle maanden, inkomsten vs uitgaven per maand (nagerekend) en de samenvatting onder de budgettabel |
| 11-samenvatting | Maandsamenvatting: knoppen, maand kiezen, export nagerekend, geen rekeningnummers, kopiëren en bestand |
| 12-apart | Declaraties en niet meetellen: markeren, buiten de overzichten, openstaand bedrag, filter, regels, AI, bewaren |
| 13-claude | Back-up naar Claude: downloads of deelmenu, CSV nagerekend, vraag gekopieerd |
| 10-banken | ING, Rabobank en bunq: herkenning, bedragen, naam, plaats en soort betaling, dubbelen, opslaan |

De bestanden in `fixtures/` zijn verzonnen voorbeeldtransacties, geen echte
bankgegevens. Logs en schermafbeeldingen komen in een tijdelijke map (of in
`$OUT`).
