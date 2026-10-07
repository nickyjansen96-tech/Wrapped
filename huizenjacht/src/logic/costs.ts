// Kosten koper, maximale koopsom en de maandlast bij een huis.

import type { Norms } from '../config/norms'
import type { House, MortgageSettings } from '../domain/types'
import { deductionRate, monthlyCost, type MaxMortgageResult, type MonthlyCost } from './mortgage'

/**
 * Overdrachtsbelasting. Bij twee kopers wordt uitgegaan van ieder 50% eigendom;
 * de startersvrijstelling geldt per koper (18 t/m 34 jaar, woningwaarde ≤ grens).
 * Zonder leeftijd: geen vrijstelling.
 */
export function transferTax(price: number, ages: (number | null)[], norms: Norms): { amount: number; exemptShare: number } {
  const buyers = ages.filter((a) => a != null) as number[]
  const list = buyers.length ? buyers : [null]
  const share = 1 / list.length
  const rate = norms.transferTaxPct.value / 100
  const valueOk = price <= norms.starterExemptionMaxValue.value
  let amount = 0
  let exemptShare = 0
  for (const age of list) {
    const exempt = valueOk && age != null && age >= 18 && age <= norms.starterExemptionMaxAge.value
    if (exempt) exemptShare += share
    else amount += price * share * rate
  }
  return { amount, exemptShare }
}

export function nhgAllowed(loan: number, norms: Norms, energySaving = false): boolean {
  return loan > 0 && loan <= (energySaving ? norms.nhgLimitEnergy.value : norms.nhgLimit.value)
}

export interface CostLine {
  label: string
  amount: number
  note?: string
}

export interface BuyerCosts {
  lines: CostLine[]
  total: number
}

export function buyerCosts(price: number, loan: number, s: MortgageSettings, norms: Norms): BuyerCosts {
  const tax = transferTax(price, [s.ageBuyer1, s.ageBuyer2], norms)
  const withNhg = s.withNhg && nhgAllowed(loan, norms)
  const taxNote =
    tax.exemptShare === 1
      ? 'startersvrijstelling'
      : tax.exemptShare > 0
        ? `startersvrijstelling voor ${Math.round(tax.exemptShare * 100)}%`
        : price > norms.starterExemptionMaxValue.value
          ? `boven grens startersvrijstelling, ${norms.transferTaxPct.value}%`
          : s.ageBuyer1 == null && s.ageBuyer2 == null
            ? `${norms.transferTaxPct.value}% (vul leeftijd in voor startersvrijstelling)`
            : `${norms.transferTaxPct.value}%`
  const lines: CostLine[] = [
    { label: 'Overdrachtsbelasting', amount: tax.amount, note: taxNote },
    { label: 'Notaris (levering + hypotheekakte)', amount: s.costNotary },
    { label: 'Taxatie', amount: s.costValuation },
    { label: 'Hypotheekadvies/bemiddeling', amount: s.costAdvice },
    { label: 'Bouwkundige keuring', amount: s.costInspection },
    {
      label: 'NHG-borgtochtprovisie',
      amount: withNhg ? (loan * norms.nhgFeePct.value) / 100 : 0,
      note: withNhg ? `${norms.nhgFeePct.value}% van hypotheek` : s.withNhg ? 'hypotheek boven NHG-grens' : 'zonder NHG',
    },
    { label: 'Aankoopmakelaar', amount: s.costBuyingAgent },
    { label: 'Bankgarantie', amount: s.costBankGuarantee },
    { label: 'Overig', amount: s.costOther },
  ]
  return { lines, total: lines.reduce((sum, l) => sum + l.amount, 0) }
}

/**
 * Benodigde hypotheek bij een koopsom: koopsom + kosten koper − eigen geld,
 * maar nooit meer dan 100% van de koopsom (kosten koper zijn niet mee te financieren).
 * NHG-provisie hangt af van de lening zelf; daarom twee rondes.
 */
export function loanForPrice(price: number, s: MortgageSettings, norms: Norms): { loan: number; costs: BuyerCosts; shortfall: number } {
  const own = Math.max(0, s.ownFunds ?? 0)
  const maxLoan = (price * norms.maxLtv.value) / 100
  let loan = Math.min(maxLoan, Math.max(0, price - own))
  let costs = buyerCosts(price, loan, s, norms)
  for (let i = 0; i < 20; i++) {
    const next = Math.min(maxLoan, Math.max(0, price + costs.total - own))
    const done = Math.abs(next - loan) < 0.001
    loan = next
    costs = buyerCosts(price, loan, s, norms)
    if (done) break
  }
  const gap = price + costs.total - own - loan
  // Centen negeren (afronding van de wisselwerking lening ↔ NHG-provisie).
  const shortfall = gap > 1 ? gap : 0
  return { loan, costs, shortfall }
}

export interface MaxPurchase {
  price: number
  loan: number
  costs: BuyerCosts
  nhg: boolean
}

/**
 * Hoogste koopsom (op € 1.000) waarbij de lening binnen de maximale hypotheek valt
 * en het eigen geld de kosten koper dekt. Stapsgewijs zoeken, omdat de
 * startersvrijstelling een sprong in de kosten geeft.
 */
export function maxPurchasePrice(max: MaxMortgageResult, s: MortgageSettings, norms: Norms): MaxPurchase {
  const own = Math.max(0, s.ownFunds ?? 0)
  const upper = Math.ceil((max.maxMortgage + own) / 1000) * 1000
  for (let price = upper; price >= 0; price -= 1000) {
    const { loan, costs, shortfall } = loanForPrice(price, s, norms)
    if (shortfall === 0 && loan <= max.maxMortgage + 0.005) {
      return { price, loan, costs, nhg: s.withNhg && nhgAllowed(loan, norms) }
    }
  }
  return { price: 0, loan: 0, costs: buyerCosts(0, 0, s, norms), nhg: false }
}

export interface HouseMonthly extends MonthlyCost {
  loan: number
  costs: BuyerCosts
  shortfall: number
  woz: number
}

/** Verwachte maandlast bij een huis, met de instellingen uit de Hypotheek-tab. */
export function houseMonthly(house: House, s: MortgageSettings, norms: Norms): HouseMonthly | null {
  if (!house.price) return null
  const price = house.bid.status !== 'nee' && house.bid.amount ? house.bid.amount : house.price
  const { loan, costs, shortfall } = loanForPrice(price, s, norms)
  const woz = house.wozValue ?? price
  const taxRate = deductionRate(highestIncome(s), norms)
  return { ...monthlyCost(loan, s.rate, s.termYears, s.form, woz, taxRate, norms), loan, costs, shortfall, woz }
}

export function highestIncome(s: MortgageSettings): number | null {
  const list = [s.income1, s.income2].filter((x): x is number => x != null && x > 0)
  return list.length ? Math.max(...list) : null
}
