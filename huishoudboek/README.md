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

## Op je telefoon zetten

- **iPhone (Safari):** open de pagina → Deel-knop → *Zet op beginscherm*.
- **Android (Chrome):** open de pagina → menu ⋮ → *App installeren*.
- **Computer (Chrome/Edge):** het installeer-icoon in de adresbalk.

## Gegevens

- Opslag: `localStorage` onder de sleutels `hhb:*` (dezelfde indeling als het
  artifact: `rules`, `overrides`, `budgets`, `wealth`, `tx-JJJJ-MM`).
- Onder *Importeren en back-up* maak je een JSON-back-up en zet je die terug,
  bijvoorbeeld om naar een ander toestel over te stappen.
- Een back-up-bestand (`.json`) kun je ook gewoon in het importvak slepen.

## Bestanden

- `index.html`, `style.css`, `app.js` — de app zelf
- `sw.js` — service worker voor offline gebruik; verhoog `VERSION` na wijzigingen
- `manifest.webmanifest`, `icon*.png`, `icon.svg` — installatie en iconen
- `vendor/xlsx.full.min.js` — SheetJS 0.18.5 voor het lezen van Excel-exports
  (Apache-2.0, zie `vendor/xlsx-LICENSE`)
