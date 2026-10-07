# Huizenjacht

Webapp om samen de zoektocht naar je eerste koophuis bij te houden. Gemaakt voor de
telefoon en in het Nederlands. Er zijn vier tabs:

- **Wensen**: criteria per categorie, elk een harde eis of een wens, met gewicht 1–5
  en (bij getallen) een drempelwaarde.
- **Regelen**: checklist van het aankoopproces per fase, met status, deadline,
  notitie, contactpersoon en kosten.
- **Huizen**: de huizen die je bekijkt, met matchpercentage, waarschuwingen bij
  harde eisen en de verwachte bruto/netto maandlast.
- **Hypotheek**: maximale hypotheek (leennormen 2026) en gewenste hypotheek
  (maandlasten per jaar, kosten koper).

Via ⚙ (rechtsboven) vind je back-up/delen en alle jaarcijfers met hun bron.

> Alle uitkomsten zijn een **indicatie, geen hypotheekadvies**.

## Starten

Nodig: Node.js 20 of nieuwer.

```bash
cd huizenjacht
npm install
npm run dev        # ontwikkelserver op http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # productieversie in dist/
npm run preview    # productieversie lokaal bekijken
```

Open de app op je telefoon in hetzelfde wifi-netwerk met `npm run dev -- --host` en
het adres dat Vite toont.

### Op je telefoon installeren

De map `dist/` (na `npm run build`) is een statische site. Je kunt hem op elke
statische host zetten (GitHub Pages, Netlify, een eigen server). De paden zijn
relatief, dus een submap werkt ook. Open de site daarna op je telefoon en kies
**Zet op beginscherm** (iPhone: deelknop; Android: menu ⋮).

## Data, back-up en delen

- Alles wordt opgeslagen in de browser (`localStorage`) van het apparaat zelf. Er
  gaat niets naar een server.
- **⚙ → Exporteren** maakt een JSON-bestand met álle data: wensen, taken, huizen,
  hypotheekinstellingen en jaarcijfers. **Delen…** opent op je telefoon het
  deelmenu (bijvoorbeeld WhatsApp of AirDrop).
- **⚙ → Importeren** vervangt de data op dit apparaat door die uit het bestand. Zo
  zet je een back-up terug of neem je de stand van je partner over. Let op:
  importeren voegt niets samen, het vervangt alles.

### Later een gedeelde database

Alle opslag loopt via één laag, `src/storage/storage.ts`:

```ts
interface DataStore {
  load(): Promise<AppData | null>
  save(data: AppData): Promise<void>
}
```

Voor een gedeelde database (bijvoorbeeld Supabase of Firebase) schrijf je een
class die `DataStore` implementeert. Die geef je mee in `src/main.tsx`. De rest
van de app hoeft niet te veranderen. `src/storage/migrate.ts` vult oudere of
onvolledige data automatisch aan. Verander je de datastructuur, verhoog dan
`SCHEMA_VERSION` in `src/data/defaults.ts`.

## Opbouw

```
src/
  config/norms.ts              ← ALLE jaarcijfers, met bron en peildatum
  config/financieringslast2026.ts  ← financieringslasttabel
  data/                        ← startset criteria en taken, standaardwaarden
  domain/types.ts              ← datatypes
  logic/                       ← pure rekenfuncties + tests (*.test.ts)
    score.ts                   ← matchpercentage en automatisch beoordelen
    mortgage.ts                ← annuïteit/lineair, netto, maximale hypotheek
    costs.ts                   ← kosten koper, maximale koopsom, maandlast per huis
    progress.ts, houseList.ts, format.ts, tableText.ts
  storage/                     ← opslaglaag, import/export, migratie
  pages/, components/          ← schermen (React)
```

### Hoe er wordt gerekend

- **Matchpercentage** = som van de gewichten van criteria die voldoen ÷ som van de
  gewichten van alle beoordeelde criteria × 100. "Weet nog niet" telt niet mee.
  Criteria met een drempelwaarde (prijs, m², slaapkamers, bouwjaar, VvE-bijdrage,
  energielabel, woningtype) worden automatisch beoordeeld zodra het gegeven bij
  het huis is ingevuld. Ontbreekt het gegeven, dan geldt je eigen oordeel.
- **Maximale hypotheek** (Tijdelijke regeling hypothecair krediet):
  1. Toetsinkomen = hoogste inkomen + tweede inkomen × 100%.
  2. Toetsrente = werkelijke rente. Bij een rentevaste periode korter dan 10 jaar
     geldt minimaal de AFM-toetsrente (5%).
  3. Maximale woonlast = toetsinkomen × financieringslastpercentage ÷ 12.
  4. Daarvan gaan af: het maandbedrag studieschuld × bruteringsfactor, en andere
     leningen (2% van de kredietlimiet).
  5. Het restant wordt omgerekend naar een hypotheekbedrag (annuïtair, 30 jaar).
  6. Daarbij komt het bedrag voor het energielabel, plus eventueel het bedrag voor
     energiebesparende maatregelen.

  De maximale koopsom houdt er rekening mee dat de hypotheek niet hoger mag zijn
  dan 100% van de woningwaarde. Kosten koper betaal je dus uit eigen geld.
- **Netto maandlast** = bruto − (rente − eigenwoningforfait) × aftrektarief. Het
  aftrektarief is het marginale tarief van het hoogste inkomen, met een maximum
  van 37,56%. Is het forfait hoger dan de rente, dan geldt de Wet Hillen. Voor de
  hele looptijd wordt met de belastingregels van het huidige jaar gerekend.
- **Overdrachtsbelasting**: 2%. De startersvrijstelling geldt per koper: van 18
  tot en met 34 jaar en bij een woningwaarde van maximaal € 555.000. Bij twee
  kopers rekent de app met ieder 50% eigendom.

## Jaarcijfers bijwerken (bijvoorbeeld voor 2027)

Alle cijfers staan in **`src/config/norms.ts`**. In de app kun je ze ook aanpassen
via **⚙ → Jaarcijfers**. Wijzigingen in de app worden bij je data opgeslagen en
gaan mee in de export.

Elk jaar, meestal begin november (leennormen) en in december/januari (belasting):

| Waarde | Waar te vinden |
|---|---|
| Financieringslasttabel | Staatscourant: "Wijzigingsregeling hypothecair krediet 20xx", bijlage tabel 1 (jonger dan AOW-leeftijd). Ook in Nibud, "Advies hypotheeknormen 20xx". |
| Energielabel-bedragen, tweede inkomen | dezelfde wijzigingsregeling / volkshuisvestingnederland.nl |
| Bruteringsfactoren studieschuld | Nibud, Advies hypotheeknormen (bijlage studieschuld) |
| Toetsrente | AFM, "Toetsrente hypotheken … kwartaal" (per kwartaal) |
| NHG-grens en borgtochtprovisie | nhg.nl, "Voorwaarden en Normen 20xx" |
| Box 1-schijven, max. aftrektarief | belastingdienst.nl (box 1, tariefsaanpassing eigen woning) |
| Eigenwoningforfait, Wet Hillen | belastingdienst.nl (eigenwoningforfait) |
| Overdrachtsbelasting, startersvrijstelling | belastingdienst.nl (overdrachtsbelasting) |
| Hypotheekrente (startwaarden) | rentevergelijkers of de sites van de banken |

**Financieringslasttabel vervangen:** ga naar ⚙ → *Financieringslasttabel* →
*Bekijken / bewerken*. De eerste regel bevat de bovengrenzen van de rentekolommen.
Daarna volgt per regel het toetsinkomen ("vanaf") en de percentages, gescheiden
door een tab of puntkomma. Je kunt rijen rechtstreeks uit een spreadsheet plakken.
Vink **Gecontroleerd bij officiële bron** aan en sla op. Wil je de nieuwe waarden
ook als standaard in de code? Pas dan `src/config/financieringslast2026.ts` aan
(of maak `financieringslast2027.ts`), werk `year`, `checked`, `source` en `url`
bij in `norms.ts` en draai `npm test`. Een paar tests rekenen met de
2026-waarden; die moet je dan ook bijwerken.

## Bronnen en status van de cijfers (peildatum 7 oktober 2026)

Elke waarde staat met bron-URL in `src/config/norms.ts` en in de app onder ⚙.
Tijdens het bouwen waren de officiële sites (wetten.overheid.nl,
officielebekendmakingen.nl, nhg.nl, belastingdienst.nl, afm.nl) niet rechtstreeks
bereikbaar. De waarden zijn gecontroleerd via zoekresultaten van precies die
officiële pagina's:

| Waarde | 2026 | Status |
|---|---|---|
| Toetsrente | 5% (Q4 2026) | AFM ✔ |
| Tweede inkomen | 100% | Tijdelijke regeling ✔ |
| Extra leenruimte label | C/D € 5.000 · A/B € 10.000 · A+/A++ € 20.000 · A+++ € 25.000 · A++++ € 30.000 (€ 40.000 met energieprestatiegarantie) | Stcrt. 2025, 36471 / Rijksoverheid ✔ |
| Energiebesparende maatregelen | E/F/G € 20.000 … A+/A++ € 5.000 | NHG/Rijksoverheid ✔ (E/F/G), rest ongewijzigd |
| NHG-grens / met EBV | € 470.000 / € 498.200 | NHG ✔ |
| NHG-provisie | 0,4% | NHG ✔ |
| Box 1 | 35,75% t/m € 38.883 · 37,56% t/m € 78.426 · 49,50% | Belastingdienst ✔ |
| Max. aftrektarief | 37,56% | Belastingdienst ✔ |
| Eigenwoningforfait | 0,35% (WOZ € 75.000 – € 1.350.000) | Belastingdienst ✔ |
| Wet Hillen | 71,867% | Belastingdienst ✔ (een niet-officiële site noemt 71,82%) |
| Overdrachtsbelasting | 2% | Belastingdienst ✔ |
| Startersvrijstelling | < 35 jaar, woningwaarde ≤ € 555.000 | Belastingdienst / Rijksoverheid ✔ |
| Bruteringsfactoren studieschuld | 1,05 – 1,40 | ⚠ via zoekresultaat over het Nibud-advies, pdf niet gezien |
| **Financieringslasttabel** | verkorte tabel | ⚠ **voorlopig**, zie hieronder |
| Hypotheekrente (startwaarden) | 10j NHG 4,25% · 20j NHG 4,70% · 10j zonder 4,50% · 20j zonder 4,95% | geen officiële bron; grootbanken 5 okt 2026, "zonder NHG" geschat |

**Financieringslasttabel: voorlopig.** De officiële tabel was niet te downloaden.
De app gebruikt een verkorte overname (rijen per € 5.000, rente 2,5–5,5%) uit het
open-source pakket *huischeck* (npm), dat naar de Staatscourant verwijst. Wat wel
gecontroleerd is:
- € 50.000 bij 4% = 22,6%: bevestigd door een externe bron.
- De vorm van de tabel klopt met de beschrijving van het Nibud.

Bij € 100.000 noemt een externe bron 26,7% (zie hieronder), deze tabel 26,1%. De
app toont daarom een waarschuwing. **Vervang de tabel door de officiële waarden**
(zie hierboven).

## Rekenvoorbeelden en controle

Zie `src/logic/rekenvoorbeelden.test.ts`. Een online rekentool kon vanuit de
bouwomgeving niet worden ingevuld. Daarom is vergeleken met uitkomsten die
rekentools en vergelijkingssites publiceren.

| # | Invoer | Huizenjacht | Extern | Verschil |
|---|---|---|---|---|
| 1 | € 50.000, 4%, 10 jaar vast | 22,6% → € 941,67 p/m → **€ 197.243** (+ € 5.000 bij label C) | hypotheek-rentetarieven.nl: 22,6%, € 942 p/m, "rond € 197.000" | geen |
| 2 | € 52.000 + € 48.000, 4%, 10 jaar vast | 26,1% → **€ 455.578** | hypotheek-rentetarieven.nl: 26,7%, € 2.225 p/m, ≈ € 466.000 | **−€ 10.400 (−2,2%)**. De rekenmethode is gelijk (met 26,7% geeft de app ook € 466.000); het verschil zit in de voorlopige tabel. Een derde site noemt 27,5%. Zie de waarschuwing hierboven. |
| 3 | € 60.000, 3,8% maar 5 jaar vast, studieschuld € 150 p/m | toetsrente 5% → 24,6%; studieschuld × 1,30 = € 195 → **€ 192.801** (10 jaar vast: € 203.881) | geen gepubliceerd vergelijkbaar voorbeeld gevonden | niet vergeleken; zelf te controleren met de Nibud-rekentool |
| 4 | € 300.000 annuïtair, 4%, 30 jaar, WOZ € 350.000 | bruto **€ 1.432,25**, netto ≈ **€ 1.098** (jaar 1) | ikbenfrits.nl e.a.: € 1.432,25 bruto; netto "ca. € 1.100–1.200" | geen (netto valt binnen de bandbreedte) |
| 4b | idem, lineair | eerste maand **€ 1.833,33** | standaardformule € 833,33 + € 1.000 | geen |

Zelf controleren: vul dezelfde invoer in bij bijvoorbeeld de Nibud-rekentool
"Hoeveel kan ik maximaal lenen?" of de tool van je bank. Verschillen van 1–3%
zijn normaal. Banken gebruiken soms een eigen afronding, een ander aftrektarief
of ander beleid voor studieschuld.

## Beperkingen

- Data staat per apparaat. Synchroniseren gaat via export/import, totdat er een
  gedeelde database is.
- De netto maandlast rekent voor de hele looptijd met de belastingregels en de
  rente van nu. Na afloop van de rentevaste periode kan de rente veranderen.
- Het aftrektarief gaat uit van het hoogste inkomen. Verdeling van de aftrek
  tussen partners en heffingskortingen worden niet berekend.
- Studieschuld: vul het werkelijke maandbedrag van DUO in. Bij 0 (bijvoorbeeld
  draagkrachtregeling) rekenen geldverstrekkers soms anders.
