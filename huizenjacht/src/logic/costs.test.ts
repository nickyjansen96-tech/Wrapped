import { describe, expect, it } from 'vitest'
import { DEFAULT_NORMS } from '../config/norms'
import { defaultMortgage } from '../data/defaults'
import type { House, MortgageSettings } from '../domain/types'
import { buyerCosts, houseMonthly, loanForPrice, maxPurchasePrice, transferTax } from './costs'
import type { MaxMortgageResult } from './mortgage'

const norms = structuredClone(DEFAULT_NORMS)
const settings = (over: Partial<MortgageSettings> = {}): MortgageSettings => ({ ...defaultMortgage(), ...over })

describe('overdrachtsbelasting', () => {
  it('starters < 35 en koopsom ≤ € 555.000: vrijgesteld', () => {
    expect(transferTax(450000, [30, 33], norms).amount).toBe(0)
  })
  it('35 jaar: geen vrijstelling meer', () => {
    expect(transferTax(400000, [35], norms).amount).toBe(8000)
  })
  it('één partner 36: die betaalt 2% over de helft', () => {
    expect(transferTax(400000, [30, 36], norms).amount).toBe(4000)
  })
  it('koopsom boven grens: volledig 2%, ook voor starters', () => {
    expect(transferTax(560000, [30, 30], norms).amount).toBe(11200)
    expect(transferTax(555000, [30, 30], norms).amount).toBe(0)
  })
})

describe('kosten koper', () => {
  it('NHG-provisie 0,4% bij lening ≤ € 470.000', () => {
    const c = buyerCosts(400000, 380000, settings({ withNhg: true, ageBuyer1: 30 }), norms)
    expect(c.lines.find((l) => l.label.startsWith('NHG'))!.amount).toBeCloseTo(1520, 6)
  })
  it('geen NHG-provisie boven de grens', () => {
    const c = buyerCosts(500000, 480000, settings({ withNhg: true }), norms)
    expect(c.lines.find((l) => l.label.startsWith('NHG'))!.amount).toBe(0)
  })
  it('lening = koopsom + kosten − eigen geld, max 100% koopsom', () => {
    const s = settings({ ownFunds: 30000, ageBuyer1: 30, withNhg: false })
    const fixed = s.costNotary + s.costValuation + s.costAdvice + s.costInspection
    const r = loanForPrice(400000, s, norms)
    expect(r.loan).toBe(400000 + fixed - 30000)
    expect(r.shortfall).toBe(0)
    const r2 = loanForPrice(400000, settings({ ownFunds: 0, ageBuyer1: 30, withNhg: false }), norms)
    expect(r2.loan).toBe(400000)
    expect(r2.shortfall).toBe(fixed)
  })
})

describe('maximale koopsom', () => {
  const max = { maxMortgage: 400000 } as MaxMortgageResult
  it('eigen geld dekt kosten koper, rest uit hypotheek', () => {
    const s = settings({ ownFunds: 30000, ageBuyer1: 30, withNhg: false })
    const fixed = s.costNotary + s.costValuation + s.costAdvice + s.costInspection
    const r = maxPurchasePrice(max, s, norms)
    expect(r.price).toBe(Math.floor((400000 + 30000 - fixed) / 1000) * 1000)
    expect(r.loan).toBeLessThanOrEqual(400000)
  })
  it('zonder eigen geld voor kosten koper: geen koopsom mogelijk', () => {
    expect(maxPurchasePrice(max, settings({ ownFunds: 0 }), norms).price).toBe(0)
  })
})

describe('maandlast bij een huis', () => {
  const house: House = {
    id: 'h', address: 'x', url: '', price: 350000, area: null, bedrooms: null, energyLabel: null, houseType: null,
    buildYear: null, vveFee: null, wozValue: null, notes: '', viewing: { status: 'nee' }, bid: { status: 'nee' }, ratings: {}, addedAt: '',
  }
  it('gebruikt bod als dat is uitgebracht', () => {
    const s = settings({ ownFunds: 50000, ageBuyer1: 30, rate: 4, withNhg: false })
    const a = houseMonthly(house, s, norms)!
    const b = houseMonthly({ ...house, bid: { status: 'uitgebracht', amount: 360000, date: '2026-10-01' } }, s, norms)!
    expect(b.loan - a.loan).toBeCloseTo(10000, 0)
    expect(a.grossFirstMonth).toBeGreaterThan(a.netFirstYear)
  })
  it('null zonder vraagprijs', () => {
    expect(houseMonthly({ ...house, price: null }, settings(), norms)).toBeNull()
  })
})

describe('wisselwerking NHG-provisie en lening', () => {
  it('geen tekort bij ruim voldoende eigen geld, ook met NHG', () => {
    const s = settings({ ownFunds: 40000, ageBuyer1: 29, ageBuyer2: 31, withNhg: true })
    const r = loanForPrice(430000, s, norms)
    expect(r.shortfall).toBe(0)
    expect(r.loan + 40000).toBeCloseTo(430000 + r.costs.total, 2)
  })
})
