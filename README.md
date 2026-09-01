# Blisss — Prospect naar Livegang

Een webapp om het Blisss-proces "Prospect naar Livegang" per traject te volgen.
Het maakt in één oogopslag inzichtelijk wie in elke stap betrokken is, welke
activiteiten en resultaten daarbij horen en binnen welke termijn acties
uitgevoerd moeten worden — en laat de verantwoordelijke elke stap aftikken
zodra hij is afgerond.

## Waarom

Het is niet altijd duidelijk wie op welk moment betrokken is binnen een
verkoop- of projecttraject. Hierdoor kunnen verwachtingen verschillen, acties
vertraging oplopen of overdrachtsmomenten minder soepel verlopen dan gewenst.
Deze app is een hulpmiddel om dat te verbeteren: per traject (prospect of
lopend project) is precies te zien in welke fase het zit, wie de eigenaar van
de huidige stap is, en of een stap binnen de afgesproken norm is afgerond.

## Het proces

Het volledige proces bestaat uit 16 stappen, gegroepeerd in 5 logische fases:

1. **Sales — Kwalificatie & kennismaking** — ontstaan/kwalificeren prospect,
   eerste kennismaking, inhoudelijke demo.
2. **Sales — Indicatie & offerte diagnosefase** — projectindicatie opstellen,
   scope bespreken, indicatie bespreken, offerte diagnosefase.
3. **Diagnosefase** — interne projectoverdracht, diagnosefase, projectplan-
   presentatie.
4. **Hoofdfase — Implementatie** — offerte hoofdfase, start-up fase,
   implementatiefase.
5. **Livegang & nazorg** — migratie/acceptatie/go-live voorbereiding,
   livegang, nazorg en overdracht naar support.

Voor elke stap staat vastgelegd: de eigenaar, de betrokken collega's, de
verantwoordelijkheden, de verwachte output, eventuele go/no-go-momenten en de
norm (doorlooptijd). De volledige procesflow is ook te raadplegen als
naslagwerk via **Procesflow** in de app, los van een specifiek traject.

## Aan de slag

1. **Node.js 18+** is vereist.
2. Installeer dependencies:

   ```bash
   npm install
   ```

3. Start de app:

   ```bash
   npm start
   ```

4. Open http://localhost:3000 in je browser (optioneel: zet `PORT` in de
   omgeving om een andere poort te gebruiken).

## Hoe het werkt

- **Backend** (`server/`):
  - `proces.js` bevat de statische procesdefinitie (fases, stappen, eigenaren,
    betrokkenen, verantwoordelijkheden, output, normen en links) — dit is de
    inhoudelijke procesflow uit dit document.
  - `store.js` bewaart de trajecten (prospects/projecten) en hun voortgang in
    `data/trajecten.json` (geen database nodig).
  - `index.js` is de Express-server met de API en berekent per traject de
    voortgang, de huidige fase/stap en of een stap over de afgesproken norm
    heen is (op basis van de afrondingsdatum van de vorige stap).
- **Frontend** (`public/`): een afhankelijkheidsvrije HTML/CSS/JS-app met drie
  schermen:
  - **Trajecten** — dashboard met alle lopende (en gearchiveerde) trajecten,
    inclusief voortgangsbalk en huidige fase; hier start je ook een nieuw
    traject.
  - **Trajectdetail** — de volledige checklist per fase/stap voor één
    traject: elke stap is uit te klappen voor de omschrijving, en de
    verantwoordelijke kan de stap aftikken (naam + optionele notitie) of weer
    heropenen.
  - **Procesflow** — het volledige proces als naslagwerk, los van een
    traject, bedoeld om nieuwe collega's op weg te helpen en als basis voor
    feedback op het proces zelf.

## Een stap toevoegen of aanpassen

Het proces staat volledig gedefinieerd in `server/proces.js` (fases en
stappen). Een stap aanpassen, toevoegen of de norm wijzigen kan door dat
bestand aan te passen — de rest van de app (API, checklist, naslagwerk) werkt
daar automatisch mee.

## Beperkingen

- Dit is een team-tool zonder authenticatie: iedereen met toegang tot de app
  kan stappen aftikken. De naam van de verantwoordelijke wordt bij het
  aftikken zelf ingevuld (en lokaal in de browser onthouden voor het
  volgende bezoek), er is geen inlogsysteem.
- Bedoeld om intern te draaien; niet zonder extra beveiliging publiek te
  hosten.
