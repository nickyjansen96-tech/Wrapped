# Huishoudboek (app)

Het Huishoudboek-artifact als installeerbare web-app (PWA): ABN AMRO-export
inlezen, transacties categoriseren met regels, budgetteren per maand en je
vermogen volgen. Werkt offline en bewaart alle gegevens alleen op je eigen
toestel (in de browser); er gaat niets naar een server.

## Openen

- **Via de bestaande server:** `npm start` en open
  http://localhost:3000/huishoudboek/
- **Als losse statische site:** zet de map `huishoudboek/` op een host met
  HTTPS (bijv. GitHub Pages, Netlify of Cloudflare Pages). HTTPS is nodig om
  de app te kunnen installeren en offline te laten werken.

## Online via GitHub Pages

Na het eenmalig aanzetten van Pages (Settings → Pages → *Deploy from a branch*,
branch `claude/stock-app-calendar-feed-a8vjd6`, map `/ (root)`) staat de app op
https://nickyjansen96-tech.github.io/Wrapped/huishoudboek/ en wordt hij bij elke
push automatisch bijgewerkt. Er staan alleen app-bestanden online, geen
financiële gegevens: die blijven op je toestel.

## Op je telefoon of iPad zetten

- **iPhone/iPad (Safari):** open de pagina → Deel-knop → *Zet op beginscherm*.
  Gebruik de app daarna via het icoon: Safari en de beginscherm-app hebben
  ieder hun eigen opslag.
- **Android (Chrome):** open de pagina → menu ⋮ → *App installeren*.
- **Computer (Chrome/Edge):** het installeer-icoon in de adresbalk.

## Profielen

Er zijn twee profielen, **Nicky** en **Heleen**, te kiezen rechtsboven. Elk
profiel heeft eigen transacties, regels, budgetten, vermogen en back-ups. De
app onthoudt welk profiel het laatst open stond. Profielen staan in `PROFILES`
bovenin `app.js`.

## Budgetten voor het hele jaar

Tabblad *Budgetten*: per categorie één rij met een bedrag **per maand** of
**per jaar** (het andere veld rekent mee). Enter gaat naar de volgende
categorie. Daarnaast:

- het gemiddelde per maand uit je transacties (van dat jaar, of het jaar
  ervoor); tik erop om het over te nemen, of vul alle lege velden in één keer;
- *Budget vorig jaar overnemen* en *Alles wissen*;
- met › open je de 12 maanden om afwijkende bedragen in te vullen
  (bijv. vakantie in juli);
- bovenaan het totaal van inkomsten, uitgaven, sparen en wat er niet begroot is.

Je kunt ook al budgetten maken voor volgend jaar.

## Regels laten maken door Claude

Bovenaan het tabblad *Regels*:

1. **Vraag kopiëren** (of *Delen met Claude-app*): de app zet de tegenpartijen
   zonder categorie, je bestaande regels en de vaste categorieën in één vraag.
   Er gaan alleen namen, korte omschrijvingen en bedragen mee, geen
   rekeningnummers.
2. Plak die vraag in een chat met Claude (bijv. de Claude-app op je iPad).
3. Plak het antwoord van Claude terug in de app en tik **Antwoord inlezen**.
4. Controleer de voorstellen: per regel zie je hoeveel transacties hij raakt;
   je kunt trefwoord en categorie aanpassen of een regel uitvinken.
   Onbekende categorieën en bestaande regels staan standaard uit.
5. **Regels toevoegen**: ze komen onderaan, zodat je eigen regels voorrang houden.

Doe dit na elke nieuwe import om ook nieuwe winkels en partijen te laten indelen.

## Gegevens

- Opslag: `localStorage` onder `hhb:<profiel>:*` (dezelfde indeling als het
  artifact: `rules`, `overrides`, `budgets`, `wealth`, `tx-JJJJ-MM`). Gegevens
  van vóór de profielen worden automatisch naar Nicky verplaatst.
- Profielen staan per toestel: wat op de ene telefoon staat, staat niet
  vanzelf op de andere. Overzetten kan met een back-up.
- Onder *Importeren en back-up* maak je per profiel een JSON-back-up en zet je die terug,
  bijvoorbeeld om naar een ander toestel over te stappen.
- Een back-up-bestand (`.json`) kun je ook gewoon in het importvak slepen.

## Bestanden

- `index.html`, `style.css`, `app.js` — de app zelf
- `sw.js` — service worker voor offline gebruik; verhoog `VERSION` na wijzigingen
- `manifest.webmanifest`, `icon*.png`, `icon.svg` — installatie en iconen
- `vendor/xlsx.full.min.js` — SheetJS 0.18.5 voor het lezen van Excel-exports
  (Apache-2.0, zie `vendor/xlsx-LICENSE`)
