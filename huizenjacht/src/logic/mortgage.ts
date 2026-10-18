// Pure rekenfuncties voor hypotheken. Geen React, geen opslag.

import type { Norms } from '../config/norms'
import type { EnergyLabel, MortgageForm } from '../domain/types'

const MONTHS = 12

/** Maandelijkse annuïteit. Rente in % per jaar, maandrente = jaarrente / 12. */
export function annuityPayment(principal: number, ratePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  const r = ratePct / 100 / MONTHS
  if (r === 0) return principal / months
  return (principal * r) / (1 - Math.pow(1 + r, -months))
}

/** Hoofdsom die hoort bij een maandelijkse annuïteit (inverse van annuityPayment). */
export function annuityPrincipal(payment: number, ratePct: number, months: number): number {
  if (payment <= 0 || months <= 0) return 0
  const r = ratePct / 100 / MONTHS
  if (r === 0) return payment * months
  return (payment * (1 - Math.pow(1 + r, -months))) / r
}

export interface MonthRow {
  month: number
  interest: number
  repayment: number
  gross: number
  balanceAfter: number
}

export function monthlySchedule(principal: number, ratePct: number, termYears: number, form: MortgageForm): MonthRow[] {
  const n = Math.round(termYears * MONTHS)
  const r = ratePct / 100 / MONTHS
  const rows: MonthRow[] = []
  let balance = principal
  const annuity = annuityPayment(principal, ratePct, n)
  const linearRepay = principal / n
  for (let m = 1; m <= n; m++) {
    const interest = balance * r
    let repayment = form === 'annuitair' ? annuity - interest : linearRepay
    if (m === n || repayment > balance) repayment = balance
    balance -= repayment
    rows.push({ month: m, interest, repayment, gross: interest + repayment, balanceAfter: Math.max(0, balance) })
  }
  return rows
}

// ---------- Belasting / netto ----------

/** Marginaal box 1-tarief bij een bepaald inkomen. */
export function marginalRate(income: number, brackets: [number | null, number][]): number {
  for (const [upper, rate] of brackets) if (upper == null || income <= upper) return rate
  return brackets[brackets.length - 1][1]
}

/** Tarief waartegen hypotheekrente aftrekbaar is: marginaal tarief, gemaximeerd. */
export function deductionRate(highestIncome: number | null, norms: Norms): number {
  const max = norms.maxDeductionRate.value
  if (highestIncome == null || highestIncome <= 0) return max
  return Math.min(marginalRate(highestIncome, norms.incomeTaxBrackets.value), max)
}

/** Eigenwoningforfait per jaar. */
export function eigenwoningforfait(woz: number, norms: Norms): number {
  if (woz <= 0) return 0
  const t = norms.ewfVillaThreshold.value
  const pct = norms.ewfPct.value / 100
  if (woz > t) return t * pct + (woz - t) * (norms.ewfVillaPct.value / 100)
  // Onder de ondergrens gelden lagere percentages; voor koopwoningen nauwelijks relevant.
  if (woz < norms.ewfMinWoz.value) return woz * Math.min(pct, 0.0025)
  return woz * pct
}

/**
 * Jaarlijks belastingeffect eigen woning (positief = je krijgt terug).
 * - Rente > forfait: (rente − forfait) × aftrektarief terug.
 * - Forfait > rente (Wet Hillen): alleen het niet-weggestreepte deel wordt belast.
 */
export function yearlyTaxEffect(interestYear: number, woz: number, rate: number, norms: Norms): number {
  const ewf = eigenwoningforfait(woz, norms)
  const diff = interestYear - ewf
  if (diff >= 0) return diff * (rate / 100)
  const taxable = -diff * (1 - norms.hillenPct.value / 100)
  return -taxable * (rate / 100)
}

export interface YearRow {
  year: number
  interest: number
  repayment: number
  /** Gemiddelde bruto maandlast in dat jaar */
  grossMonthly: number
  /** Gemiddelde netto maandlast in dat jaar */
  netMonthly: number
  taxEffectYear: number
  balanceEnd: number
}

export function yearlyOverview(
  principal: number,
  ratePct: number,
  termYears: number,
  form: MortgageForm,
  woz: number,
  taxRate: number,
  norms: Norms,
): YearRow[] {
  const months = monthlySchedule(principal, ratePct, termYears, form)
  const years: YearRow[] = []
  for (let y = 0; y < Math.ceil(months.length / MONTHS); y++) {
    const slice = months.slice(y * MONTHS, (y + 1) * MONTHS)
    const interest = slice.reduce((s, m) => s + m.interest, 0)
    const repayment = slice.reduce((s, m) => s + m.repayment, 0)
    const tax = yearlyTaxEffect(interest, woz, taxRate, norms)
    years.push({
      year: y + 1,
      interest,
      repayment,
      grossMonthly: (interest + repayment) / slice.length,
      netMonthly: (interest + repayment - tax) / slice.length,
      taxEffectYear: tax,
      balanceEnd: slice[slice.length - 1].balanceAfter,
    })
  }
  return years
}

export interface MonthlyCost {
  grossFirstMonth: number
  interestFirstMonth: number
  repaymentFirstMonth: number
  /** Netto maandlast eerste jaar (gemiddeld) */
  netFirstYear: number
  years: YearRow[]
}

export function monthlyCost(
  principal: number,
  ratePct: number,
  termYears: number,
  form: MortgageForm,
  woz: number,
  taxRate: number,
  norms: Norms,
): MonthlyCost {
  const years = yearlyOverview(principal, ratePct, termYears, form, woz, taxRate, norms)
  const first = monthlySchedule(principal, ratePct, termYears, form)[0] ?? { gross: 0, interest: 0, repayment: 0 }
  return {
    grossFirstMonth: first.gross,
    interestFirstMonth: first.interest,
    repaymentFirstMonth: first.repayment,
    netFirstYear: years[0]?.netMonthly ?? 0,
    years,
  }
}

// ---------- Maximale hypotheek (Tijdelijke regeling hypothecair krediet) ----------

/** Zoekt het financieringslastpercentage op in de tabel. */
export function lookupFinancingPct(norms: Norms, toetsinkomen: number, toetsrente: number): number {
  const t = norms.financingTable.value
  let row = 0
  for (let i = 0; i < t.incomes.length; i++) if (toetsinkomen >= t.incomes[i]) row = i
  let col = t.rateUpperBounds.findIndex((ub) => toetsrente <= ub + 1e-9)
  if (col === -1) col = t.rateUpperBounds.length - 1
  return t.values[row]?.[col] ?? 0
}

export function studentDebtFactor(norms: Norms, toetsrente: number): number {
  const list = norms.studentDebtFactors.value
  for (const [ub, f] of list) if (toetsrente <= ub + 1e-9) return f
  return list[list.length - 1]?.[1] ?? 1
}

export interface MaxMortgageInput {
  income1: number | null
  income2: number | null
  studentDebtMonthly: number | null
  otherLoansMonthly: number | null
  energyLabel: EnergyLabel | null
  energySavingCosts: number | null
  ratePct: number
  fixedYears: number
  /** Looptijd in jaren; korter dan de norm (30) geeft een hogere maandlast en dus minder leenruimte. */
  termYears?: number
}

export interface MaxMortgageResult {
  toetsinkomen: number
  toetsrente: number
  usedTestRate: boolean
  financingPct: number
  /** Toetsinkomen of toetsrente valt buiten het bereik van de (verkorte) tabel */
  outsideTable: boolean
  termMonths: number
  maxHousingMonthly: number
  studentDebtFactor: number
  studentDebtCharge: number
  otherLoansCharge: number
  availableMonthly: number
  /** Leenruimte op basis van inkomen, vóór energielabel */
  incomeBased: number
  energyLabelExtra: number
  energySavingExtra: number
  /** Totale maximale hypotheek op basis van inkomen */
  maxMortgage: number
}

export function maxMortgage(input: MaxMortgageInput, norms: Norms): MaxMortgageResult {
  const a = Math.max(0, input.income1 ?? 0)
  const b = Math.max(0, input.income2 ?? 0)
  const toetsinkomen = Math.max(a, b) + Math.min(a, b) * norms.secondIncomeFactor.value

  const usedTestRate = input.fixedYears < norms.testRateMinFixedYears.value && input.ratePct < norms.testRate.value
  const toetsrente = usedTestRate ? norms.testRate.value : input.ratePct

  const financingPct = lookupFinancingPct(norms, toetsinkomen, toetsrente)
  const maxHousingMonthly = (toetsinkomen * financingPct) / 100 / MONTHS
  const factor = studentDebtFactor(norms, toetsrente)
  const studentDebtCharge = Math.max(0, input.studentDebtMonthly ?? 0) * factor
  const otherLoansCharge = Math.max(0, input.otherLoansMonthly ?? 0)
  const availableMonthly = Math.max(0, maxHousingMonthly - studentDebtCharge - otherLoansCharge)
  const termMonths = Math.min(input.termYears ?? norms.maxTermYears.value, norms.maxTermYears.value) * MONTHS
  const incomeBased = annuityPrincipal(availableMonthly, toetsrente, termMonths)
  const t = norms.financingTable.value
  const lowestRateCol = t.rateUpperBounds.length > 1 ? t.rateUpperBounds[0] - (t.rateUpperBounds[1] - t.rateUpperBounds[0]) : 0
  const outsideTable =
    toetsrente > t.rateUpperBounds[t.rateUpperBounds.length - 1] ||
    toetsrente <= lowestRateCol ||
    toetsinkomen >= t.incomes[t.incomes.length - 1] + 5000 ||
    (toetsinkomen > 0 && toetsinkomen < 30000)

  const label = input.energyLabel ?? 'geen'
  const energyLabelExtra = incomeBased > 0 ? norms.energyLabelExtra.value[label] ?? 0 : 0
  const energySavingExtra =
    incomeBased > 0 ? Math.min(Math.max(0, input.energySavingCosts ?? 0), norms.energySavingExtra.value[label] ?? 0) : 0

  return {
    toetsinkomen,
    toetsrente,
    usedTestRate,
    financingPct,
    outsideTable,
    termMonths,
    maxHousingMonthly,
    studentDebtFactor: factor,
    studentDebtCharge,
    otherLoansCharge,
    availableMonthly,
    incomeBased,
    energyLabelExtra,
    energySavingExtra,
    maxMortgage: Math.floor(incomeBased + energyLabelExtra + energySavingExtra),
  }
}
