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

## Transacties

Per transactie: datum met weekdag, naam, soort betaling (betaalpas, incasso,
overboeking, iDEAL, …) met plaats en tijd of de omschrijving, het bedrag en
de categorie. Onder de categorie staat waar die vandaan komt (*via regel …*,
*zelf gekozen* of *nog geen categorie*). Tik op een transactie voor alle
details: volledige datum en tijd, tegenrekening, omschrijving, kenmerk en de
originele bankomschrijving.

Met **＋ Regel** maak je van een transactie een regel: de app vult het
trefwoord voor, telt meteen hoeveel transacties de regel raakt en deelt na
opslaan alle vergelijkbare transacties in. Zoeken werkt op naam, plaats en
omschrijving.

## Overzicht en budget

Kies bovenaan een jaar en *Heel jaar* of een maand.

- **Bekijken:** bovenaan wat er over is (alle transacties, ook die zonder
  categorie), met inkomsten, uitgaven en gespaard tegenover het budget.
  Daaronder per categorie wat je uitgaf, het budget en een balk (rood als je
  erover zit). Lege categorieën zijn verborgen. Tik op een categorie voor de
  transacties.
- **Budget bewerken:** een tabel met een rij per categorie en een kolom per
  maand, plus *Elke maand* (één bedrag voor het hele jaar) en het jaartotaal.
  Per groep een totaalrij en onderaan *Over* per maand. Enter en de pijltjes
  verplaatsen je door de tabel; je kunt ook een blok getallen uit Excel of
  Numbers plakken. Verder: lege rijen vullen met je gemiddelde, budget van
  vorig jaar overnemen, wissen.
- Bij *Heel jaar* vergelijkt de app met het budget van de maanden waarover je
  transacties hebt ingelezen.
- **Vergelijk per maand:** één tabel met dezelfde opbouw als het budget
  (categorieën per groep, maanden als kolommen, jaarkolom), maar alleen om te
  bekijken. Per categorie vier regels: *Budget*, *Werkelijk*, *Verschil*
  (groen is gunstig) en *Resultaat* (het opgebouwde verschil tot en met die
  maand). Met groepstotalen en onderaan *Over*. Maanden zonder ingelezen
  transacties worden niet vergeleken (·); de jaarkolom telt alleen de
  maanden met transacties. Tik op een werkelijk bedrag voor de transacties.

## Regels laten maken door een AI-chat

In het tabblad **Regels en AI**, bij *Transacties laten indelen door AI*. De
knop **✨ Laat AI indelen** staat ook op het overzicht, bij Transacties en na
het inlezen, zodra er transacties zonder categorie zijn. Werkt met Claude,
ChatGPT of elke andere AI-chat, in drie stappen:

1. **Vraag kopiëren** (of **Delen** naar de app van je keuze). De vraag bevat
   per tegenpartij zonder categorie: naam (filialen samengenomen), soort
   betaling, aantal, gemiddeld en totaal bedrag, periode en tot drie
   voorbeelden van de omschrijving. Rekeningnummers, pasnummers, kenmerken en
   tijdstippen worden eruit gehaald. Ook je bestaande regels en de
   categorieën gaan mee.
2. Plak de vraag in een nieuw gesprek (de knoppen *Claude ↗* en *ChatGPT ↗*
   openen die direct).
3. Kopieer het antwoord en tik **Plakken en inlezen** (of plak het zelf en
   tik *Antwoord inlezen*). De app leest de gevraagde vorm
   (`trefwoord | categorie`), maar ook JSON, tabellen en lijstjes, en herkent
   categorieën die net iets anders gespeld zijn.
4. Controleer de voorstellen: per regel zie je hoeveel transacties hij raakt;
   bij een onbekende categorie kies je er zelf een.
5. **Regels toevoegen**: ze komen onderaan, zodat je eigen regels voorrang
   houden. Bij veel tegenpartijen gaan de 150 meest voorkomende mee; herhaal
   dan de stappen voor de rest.

## Rondleiding

Wie de app voor het eerst opent, krijgt een rondleiding met tooltips langs de
belangrijkste onderdelen (gebruiker kiezen, inlezen, transacties, Claude,
budget, overzicht, back-up). Met de **?**-knop naast de titel, of onderaan
*Importeren*, start je hem opnieuw. Of hij al gezien is, staat in
`localStorage` onder `hhb-rondleiding-gezien`.

## Gebruikers

Rechtsboven kies je de gebruiker; met **+** beheer je ze: gebruikers
toevoegen, hernoemen en verwijderen (met al hun gegevens). Iedere gebruiker
heeft eigen transacties, regels, budgetten, vermogen en back-ups. De lijst
begint met Nicky en Heleen en staat in `localStorage` onder `hhb-gebruikers`;
de app onthoudt welke gebruiker het laatst open stond.

## Gegevens

- Opslag: `localStorage` onder `hhb:<gebruiker-id>:*` (dezelfde indeling als het
  artifact: `rules`, `overrides`, `budgets`, `wealth`, `tx-JJJJ-MM`). Gegevens
  van vóór de profielen worden automatisch naar Nicky verplaatst.
- Gebruikers staan per toestel: wat op de ene telefoon staat, staat niet
  vanzelf op de andere. Overzetten kan met een back-up.
- Onder *Importeren* maak je per profiel een JSON-back-up en zet je die terug,
  bijvoorbeeld om naar een ander toestel over te stappen.
- Een back-up-bestand (`.json`) kun je ook gewoon in het importvak slepen.

## Bestanden

- `index.html`, `style.css`, `app.js` — de app zelf
- `sw.js` — service worker voor offline gebruik; verhoog `VERSION` na wijzigingen
- `manifest.webmanifest`, `icon*.png`, `icon.svg` — installatie en iconen
- `vendor/xlsx.full.min.js` — SheetJS 0.18.5 voor het lezen van Excel-exports
  (Apache-2.0, zie `vendor/xlsx-LICENSE`)
