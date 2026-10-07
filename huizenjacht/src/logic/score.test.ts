import { describe, expect, it } from 'vitest'
import type { Criterion, House } from '../domain/types'
import { assessCriterion, scoreHouse } from './score'

const house = (over: Partial<House> = {}): House => ({
  id: 'h1',
  address: 'Teststraat 1',
  url: '',
  price: 400000,
  area: 80,
  bedrooms: 3,
  energyLabel: 'B',
  houseType: 'tussenwoning',
  buildYear: 1985,
  vveFee: null,
  wozValue: null,
  notes: '',
  viewing: { status: 'nee' },
  bid: { status: 'nee' },
  ratings: {},
  addedAt: '2026-10-01T10:00:00Z',
  ...over,
})

const crit = (over: Partial<Criterion>): Criterion => ({
  id: 'c',
  name: 'C',
  category: 'woning',
  active: true,
  type: 'wens',
  weight: 3,
  ...over,
})

describe('automatisch beoordelen', () => {
  it('min-drempel: voldoet bij gelijk of hoger', () => {
    const c = crit({ auto: { kind: 'number', field: 'area', op: 'min', threshold: 80 } })
    expect(assessCriterion(c, house()).rating).toBe('ja')
    expect(assessCriterion(c, house({ area: 79 })).rating).toBe('nee')
  })
  it('max-drempel op prijs', () => {
    const c = crit({ auto: { kind: 'number', field: 'price', op: 'max', threshold: 400000 } })
    expect(assessCriterion(c, house()).rating).toBe('ja')
    expect(assessCriterion(c, house({ price: 400001 })).rating).toBe('nee')
  })
  it('energielabel: A+ is beter dan C, D niet', () => {
    const c = crit({ auto: { kind: 'energyLabel', minLabel: 'C' } })
    expect(assessCriterion(c, house({ energyLabel: 'A+' })).rating).toBe('ja')
    expect(assessCriterion(c, house({ energyLabel: 'C' })).rating).toBe('ja')
    expect(assessCriterion(c, house({ energyLabel: 'D' })).rating).toBe('nee')
  })
  it('woningtype', () => {
    const c = crit({ auto: { kind: 'houseType', allowed: ['hoekwoning'] } })
    expect(assessCriterion(c, house()).rating).toBe('nee')
    expect(assessCriterion(c, house({ houseType: 'hoekwoning' })).rating).toBe('ja')
  })
  it('ontbrekend gegeven valt terug op handmatig oordeel', () => {
    const c = crit({ id: 'vve', auto: { kind: 'number', field: 'vveFee', op: 'max', threshold: 200 } })
    const r1 = assessCriterion(c, house())
    expect(r1.rating).toBe('onbekend')
    const r2 = assessCriterion(c, house({ ratings: { vve: 'ja' } }))
    expect(r2).toMatchObject({ rating: 'ja', source: 'handmatig' })
  })
  it('auto-oordeel gaat voor handmatig als het gegeven er is', () => {
    const c = crit({ id: 'opp', auto: { kind: 'number', field: 'area', op: 'min', threshold: 100 } })
    expect(assessCriterion(c, house({ ratings: { opp: 'ja' } }))).toMatchObject({ rating: 'nee', source: 'auto' })
  })
})

describe('matchpercentage', () => {
  it('rekent gewogen en negeert "weet nog niet"', () => {
    const criteria = [
      crit({ id: 'a', weight: 5 }),
      crit({ id: 'b', weight: 3 }),
      crit({ id: 'c', weight: 2 }),
      crit({ id: 'd', weight: 4 }),
    ]
    const s = scoreHouse(house({ ratings: { a: 'ja', b: 'nee', c: 'ja' } }), criteria)
    // (5 + 2) / (5 + 3 + 2) = 70%
    expect(s.percentage).toBe(70)
    expect(s.assessed).toBe(3)
    expect(s.total).toBe(4)
  })
  it('inactieve criteria tellen niet mee', () => {
    const criteria = [crit({ id: 'a', weight: 5 }), crit({ id: 'b', weight: 5, active: false })]
    const s = scoreHouse(house({ ratings: { a: 'ja', b: 'nee' } }), criteria)
    expect(s.percentage).toBe(100)
    expect(s.total).toBe(1)
  })
  it('null als nog niets beoordeeld', () => {
    expect(scoreHouse(house(), [crit({ id: 'a' })]).percentage).toBeNull()
  })
  it('meldt harde eisen die niet voldoen', () => {
    const criteria = [crit({ id: 'a', type: 'eis', name: 'Tuin' }), crit({ id: 'b', type: 'wens' })]
    const s = scoreHouse(house({ ratings: { a: 'nee', b: 'nee' } }), criteria)
    expect(s.failedRequirements.map((c) => c.name)).toEqual(['Tuin'])
  })
  it('herberekent bij gewijzigde wensen (pure functie)', () => {
    const h = house()
    const c1 = [crit({ id: 'p', auto: { kind: 'number', field: 'price', op: 'max', threshold: 350000 } })]
    const c2 = [crit({ id: 'p', auto: { kind: 'number', field: 'price', op: 'max', threshold: 450000 } })]
    expect(scoreHouse(h, c1).percentage).toBe(0)
    expect(scoreHouse(h, c2).percentage).toBe(100)
  })
})
