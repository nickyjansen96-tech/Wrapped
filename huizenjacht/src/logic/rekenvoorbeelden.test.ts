// Rekenvoorbeelden hypotheek, met de vergelijking met externe rekentools/bronnen.
// Zie README.md, "Rekenvoorbeelden en controle", voor de toelichting op afwijkingen.

import { describe, expect, it } from 'vitest'
import { DEFAULT_NORMS } from '../config/norms'
import { maxMortgage, monthlyCost } from './mortgage'

const norms = structuredClone(DEFAULT_NORMS)
const base = {
  income2: null,
  studentDebtMonthly: null,
  otherLoansMonthly: null,
  energyLabel: null,
  energySavingCosts: null,
  fixedYears: 10,
}

describe('Voorbeeld 1: alleenstaand, € 50.000, 4% rente, 10 jaar vast, label C', () => {
  const r = maxMortgage({ ...base, income1: 50000, ratePct: 4, energyLabel: 'C' }, norms)
  it('financieringslast 22,6% → € 941,67 p/m', () => {
    expect(r.financingPct).toBe(22.6)
    expect(r.maxHousingMonthly).toBeCloseTo(941.67, 2)
  })
  it('leenruimte inkomen ≈ € 197.243 (extern: "rond de € 197.000")', () => {
    // hypotheek-rentetarieven.nl/hypotheeknormen: 50.000 bij 4% → 22,6%, € 942 p/m, ≈ € 197.000
    expect(r.incomeBased).toBeGreaterThan(196500)
    expect(r.incomeBased).toBeLessThan(197500)
  })
  it('met label C + € 5.000 → € 202.242', () => {
    expect(r.maxMortgage).toBe(202242)
  })
})

describe('Voorbeeld 2: tweeverdieners € 52.000 + € 48.000, 4% rente, 10 jaar vast', () => {
  const r = maxMortgage({ ...base, income1: 52000, income2: 48000, ratePct: 4 }, norms)
  it('beide inkomens tellen volledig: toetsinkomen € 100.000', () => {
    expect(r.toetsinkomen).toBe(100000)
  })
  it('uitkomst met de voorlopige tabel: 26,1% → € 455.578', () => {
    expect(r.financingPct).toBe(26.1)
    expect(r.maxMortgage).toBe(455578)
  })
  it('AFWIJKING: externe bron noemt 26,7% → ≈ € 466.000 (verschil ≈ −2,2%)', () => {
    // hypotheek-rentetarieven.nl: € 100.000 → 26,7%, € 2.225 p/m, ≈ € 466.000.
    // Met 26,7% rekent deze app exact hetzelfde; het verschil zit in de tabelwaarde.
    const n2 = structuredClone(norms)
    n2.financingTable.value = { incomes: [0], rateUpperBounds: [99], values: [[26.7]] }
    const r2 = maxMortgage({ ...base, income1: 52000, income2: 48000, ratePct: 4 }, n2)
    expect(r2.maxHousingMonthly).toBeCloseTo(2225, 6)
    expect(Math.round(r2.maxMortgage / 1000)).toBe(466)
  })
})

describe('Voorbeeld 3: € 60.000, 3,8% rente maar 5 jaar vast, studieschuld € 150 p/m', () => {
  const r = maxMortgage({ ...base, income1: 60000, ratePct: 3.8, fixedYears: 5, studentDebtMonthly: 150 }, norms)
  it('toetsrente 5% omdat rentevast < 10 jaar', () => {
    expect(r.usedTestRate).toBe(true)
    expect(r.toetsrente).toBe(5)
    expect(r.financingPct).toBe(24.6)
  })
  it('studieschuld × bruteringsfactor 1,30 = € 195 gaat van de maandruimte af', () => {
    expect(r.studentDebtCharge).toBeCloseTo(195, 6)
    expect(r.availableMonthly).toBeCloseTo(1230 - 195, 6)
  })
  it('maximale hypotheek € 192.801 (bij 10 jaar vast: € 203.881)', () => {
    expect(r.maxMortgage).toBe(192801)
    const r10 = maxMortgage({ ...base, income1: 60000, ratePct: 3.8, fixedYears: 10, studentDebtMonthly: 150 }, norms)
    expect(r10.maxMortgage).toBe(203881)
  })
})

describe('Voorbeeld 4: gewenste hypotheek € 300.000, 4%, 30 jaar, WOZ € 350.000', () => {
  it('annuïtair: bruto € 1.432,25 (standaard; o.a. ikbenfrits.nl), netto ≈ € 1.098', () => {
    const c = monthlyCost(300000, 4, 30, 'annuitair', 350000, 37.56, norms)
    expect(c.grossFirstMonth).toBeCloseTo(1432.25, 2)
    // Externe indicatie: "netto ca. € 1.100–1.200" (afhankelijk van aftrektarief/WOZ).
    expect(c.netFirstYear).toBeCloseTo(1098.0, 0)
  })
  it('lineair: eerste maand € 1.833,33, laatste jaar ≈ € 851 bruto', () => {
    const c = monthlyCost(300000, 4, 30, 'lineair', 350000, 37.56, norms)
    expect(c.grossFirstMonth).toBeCloseTo(1833.33, 2)
    expect(c.years[29].grossMonthly).toBeCloseTo(851.39, 1)
  })
})
