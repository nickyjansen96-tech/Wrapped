import { describe, expect, it } from 'vitest'
import { DEFAULT_NORMS, type Norms } from '../config/norms'
import {
  annuityPayment,
  annuityPrincipal,
  deductionRate,
  eigenwoningforfait,
  lookupFinancingPct,
  marginalRate,
  maxMortgage,
  monthlyCost,
  monthlySchedule,
  studentDebtFactor,
  yearlyTaxEffect,
} from './mortgage'

const norms: Norms = structuredClone(DEFAULT_NORMS)

describe('annuïteit', () => {
  it('€ 300.000, 4%, 30 jaar = € 1.432,25 per maand (standaardvoorbeeld)', () => {
    expect(annuityPayment(300000, 4, 360)).toBeCloseTo(1432.25, 2)
  })
  it('annuityPrincipal is de inverse', () => {
    expect(annuityPrincipal(annuityPayment(250000, 3.9, 360), 3.9, 360)).toBeCloseTo(250000, 6)
  })
  it('0% rente', () => {
    expect(annuityPayment(360000, 0, 360)).toBe(1000)
  })
  it('schema lost volledig af en eerste maand rente = saldo × r', () => {
    const s = monthlySchedule(300000, 4, 30, 'annuitair')
    expect(s).toHaveLength(360)
    expect(s[0].interest).toBeCloseTo(1000, 6)
    expect(s[0].repayment).toBeCloseTo(432.25, 2)
    expect(s[359].balanceAfter).toBeCloseTo(0, 6)
    expect(s.reduce((x, m) => x + m.repayment, 0)).toBeCloseTo(300000, 4)
  })
})

describe('lineair', () => {
  it('€ 300.000, 4%, 30 jaar: eerste maand € 1.833,33, daarna dalend', () => {
    const s = monthlySchedule(300000, 4, 30, 'lineair')
    expect(s[0].gross).toBeCloseTo(1833.33, 2)
    expect(s[0].repayment).toBeCloseTo(833.33, 2)
    expect(s[359].gross).toBeLessThan(840)
    expect(s[359].balanceAfter).toBeCloseTo(0, 6)
  })
})

describe('belasting', () => {
  it('marginaal tarief per schijf 2026', () => {
    expect(marginalRate(30000, norms.incomeTaxBrackets.value)).toBe(35.75)
    expect(marginalRate(60000, norms.incomeTaxBrackets.value)).toBe(37.56)
    expect(marginalRate(100000, norms.incomeTaxBrackets.value)).toBe(49.5)
  })
  it('aftrek gemaximeerd op 37,56%', () => {
    expect(deductionRate(100000, norms)).toBe(37.56)
    expect(deductionRate(30000, norms)).toBe(35.75)
    expect(deductionRate(null, norms)).toBe(37.56)
  })
  it('eigenwoningforfait 0,35% en villataks', () => {
    expect(eigenwoningforfait(400000, norms)).toBeCloseTo(1400, 6)
    expect(eigenwoningforfait(1450000, norms)).toBeCloseTo(4725 + 100000 * 0.0235, 6)
  })
  it('renteaftrek: (rente − forfait) × tarief', () => {
    // rente 12.000, forfait 1.400 → 10.600 × 37,56% = 3.981,36
    expect(yearlyTaxEffect(12000, 400000, 37.56, norms)).toBeCloseTo(3981.36, 2)
  })
  it('Wet Hillen bij lage rente: alleen niet-weggestreept deel belast', () => {
    // forfait 1.400, rente 400 → verschil 1.000, 71,867% weggestreept → 281,33 belast à 37,56%
    expect(yearlyTaxEffect(400, 400000, 37.56, norms)).toBeCloseTo(-1000 * (1 - 0.71867) * 0.3756, 6)
  })
  it('netto < bruto bij hypotheek met rente', () => {
    const c = monthlyCost(300000, 4, 30, 'annuitair', 350000, 37.56, norms)
    expect(c.grossFirstMonth).toBeCloseTo(1432.25, 2)
    // rente jaar 1 ≈ 11.889, forfait 1.225 → aftrek ≈ (11.889 − 1.225) × 0,3756 / 12 ≈ 333,8
    expect(c.netFirstYear).toBeGreaterThan(1095)
    expect(c.netFirstYear).toBeLessThan(1102)
    expect(c.years).toHaveLength(30)
    // netto stijgt over de jaren omdat de renteaftrek daalt
    expect(c.years[29].netMonthly).toBeGreaterThan(c.years[0].netMonthly)
  })
})

const testNorms = (): Norms => {
  const n = structuredClone(DEFAULT_NORMS)
  n.financingTable.value = {
    incomes: [0, 50000, 100000],
    rateUpperBounds: [3, 4, 5, 99],
    values: [
      [20, 21, 22, 23],
      [25, 26, 27, 28],
      [30, 31, 32, 33],
    ],
  }
  return n
}

describe('maximale hypotheek (mechaniek, met testtabel)', () => {
  it('opzoeken in tabel', () => {
    const n = testNorms()
    expect(lookupFinancingPct(n, 49999, 3)).toBe(20)
    expect(lookupFinancingPct(n, 50000, 3.01)).toBe(26)
    expect(lookupFinancingPct(n, 200000, 7)).toBe(33)
  })
  it('toetsrente bij rentevast < 10 jaar, anders werkelijke rente', () => {
    const n = testNorms()
    const base = { income1: 60000, income2: null, studentDebtMonthly: null, otherLoansMonthly: null, energyLabel: null, energySavingCosts: null }
    const r5 = maxMortgage({ ...base, ratePct: 3.5, fixedYears: 5 }, n)
    expect(r5).toMatchObject({ usedTestRate: true, toetsrente: 5, financingPct: 27 })
    const r10 = maxMortgage({ ...base, ratePct: 3.5, fixedYears: 10 }, n)
    expect(r10).toMatchObject({ usedTestRate: false, toetsrente: 3.5, financingPct: 26 })
    // 60.000 × 26% / 12 = 1.300 p/m → annuïteit 3,5% 30 jaar
    expect(r10.maxHousingMonthly).toBeCloseTo(1300, 6)
    expect(r10.incomeBased).toBeCloseTo(annuityPrincipal(1300, 3.5, 360), 6)
  })
  it('tweede inkomen telt volledig mee en tabel op gezamenlijk inkomen', () => {
    const n = testNorms()
    const r = maxMortgage(
      { income1: 40000, income2: 70000, studentDebtMonthly: null, otherLoansMonthly: null, energyLabel: null, energySavingCosts: null, ratePct: 4, fixedYears: 10 },
      n,
    )
    expect(r.toetsinkomen).toBe(110000)
    expect(r.financingPct).toBe(31)
  })
  it('studieschuld × bruteringsfactor en andere leningen gaan af van de maandruimte', () => {
    const n = testNorms()
    const r = maxMortgage(
      { income1: 60000, income2: null, studentDebtMonthly: 100, otherLoansMonthly: 50, energyLabel: null, energySavingCosts: null, ratePct: 4.2, fixedYears: 10 },
      n,
    )
    expect(r.studentDebtFactor).toBe(1.25)
    expect(r.availableMonthly).toBeCloseTo(60000 * 0.27 / 12 - 125 - 50, 6)
  })
  it('extra leenruimte per energielabel 2026 en voor verduurzaming', () => {
    const n = testNorms()
    const base = { income1: 60000, income2: null, studentDebtMonthly: null, otherLoansMonthly: null, ratePct: 4, fixedYears: 10 }
    const g = maxMortgage({ ...base, energyLabel: 'G', energySavingCosts: 25000 }, n)
    expect(g.energyLabelExtra).toBe(0)
    expect(g.energySavingExtra).toBe(20000)
    const a3 = maxMortgage({ ...base, energyLabel: 'A+++', energySavingCosts: null }, n)
    expect(a3.energyLabelExtra).toBe(25000)
    expect(a3.maxMortgage).toBe(Math.floor(a3.incomeBased + 25000))
  })
  it('bruteringsfactoren', () => {
    expect(studentDebtFactor(norms, 2)).toBe(1.05)
    expect(studentDebtFactor(norms, 5)).toBe(1.3)
    expect(studentDebtFactor(norms, 7)).toBe(1.4)
  })
})
