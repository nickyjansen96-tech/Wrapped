// Financieringslasttabel 2026, tabel 1 (aftrekbare rente, jonger dan AOW-leeftijd).
//
// LET OP – VOORLOPIG, NIET VOLLEDIG GEVERIFIEERD (peildatum 2026-10-07):
// De officiële bron (Staatscourant 2025, 36471, bijlage tabel 1) was vanuit de
// bouwomgeving niet bereikbaar. Deze waarden zijn een verkorte transcriptie
// (rijen per € 5.000, kolommen 2,501–5,500%) overgenomen uit het open-source
// npm-pakket "huischeck" 1.0.3 (src/lib/research/finance-norms.ts), dat zelf
// naar de Staatscourant verwijst.
// Controles:
//  - € 50.000 bij 3,501–4,000% = 22,6%: bevestigd door hypotheek-rentetarieven.nl/hypotheeknormen.
//  - Vorm (vlak tussen ca. € 35.000 en € 60.000, stijgend vanaf ca. € 70.000):
//    in lijn met Nibud, Advies hypotheeknormen 2026.
//  - € 100.000: andere bron noemt 26,7% (niet in deze tabel) → onzeker.
// Vervang deze tabel door de officiële waarden: zie README "Jaarcijfers bijwerken".
import type { FinancingTable } from './norms'

export const FINANCIERINGSLAST_2026: FinancingTable = {
  incomes: [0, 35000, 40000, 45000, 50000, 55000, 60000, 65000, 70000, 75000, 80000, 85000, 90000, 95000, 100000, 105000, 110000, 115000, 120000, 125000],
  rateUpperBounds: [3.0, 3.5, 4.0, 4.5, 5.0, 5.5],
  values: [
    [18.4, 19.3, 20.1, 20.9, 21.6, 22.2], // t/m 34.999 (rij € 30.000)
    [20.6, 21.6, 22.6, 23.6, 24.6, 25.5],
    [20.6, 21.6, 22.6, 23.6, 24.6, 25.5],
    [20.6, 21.6, 22.6, 23.6, 24.6, 25.5],
    [20.6, 21.6, 22.6, 23.6, 24.6, 25.5],
    [20.6, 21.6, 22.6, 23.6, 24.6, 25.5],
    [20.7, 21.6, 22.6, 23.6, 24.6, 25.5],
    [21.0, 22.0, 22.9, 23.8, 24.7, 25.5],
    [21.7, 22.7, 23.6, 24.5, 25.3, 26.2],
    [22.6, 23.7, 24.6, 25.6, 26.4, 27.3],
    [23.2, 24.3, 25.3, 26.3, 27.2, 28.1],
    [23.5, 24.5, 25.5, 26.5, 27.4, 28.3],
    [23.7, 24.7, 25.7, 26.7, 27.6, 28.5],
    [23.9, 25.0, 25.9, 26.9, 27.8, 28.7],
    [24.2, 25.2, 26.1, 27.1, 28.0, 28.9],
    [24.5, 25.5, 26.5, 27.3, 28.2, 29.1],
    [24.8, 25.8, 26.7, 27.7, 28.5, 29.3],
    [25.0, 26.0, 26.9, 27.9, 28.7, 29.5],
    [25.2, 26.2, 27.2, 28.1, 28.9, 29.8],
    [25.5, 26.5, 27.4, 28.3, 29.2, 30.0],
  ],
}
