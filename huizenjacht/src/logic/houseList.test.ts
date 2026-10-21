import { describe, expect, it } from 'vitest'
import type { House } from '../domain/types'
import { matchesFilter, sortHouses } from './houseList'
import type { HouseScore } from './score'

const h = (id: string, over: Partial<House> = {}): House => ({
  id, address: id, url: '', price: null, area: null, bedrooms: null, energyLabel: null, houseType: null, buildYear: null,
  vveFee: null, wozValue: null, notes: '', viewing: { status: 'nee' }, bid: { status: 'nee' }, ratings: {}, addedAt: '2026-01-01', ...over,
})
const sc = (percentage: number | null, failed = 0): HouseScore =>
  ({ percentage, assessed: 0, total: 0, weightMet: 0, weightAssessed: 0, failedRequirements: Array(failed).fill({}), results: [] }) as HouseScore

const items = [
  { house: h('a', { price: 400000, addedAt: '2026-03-01', viewing: { status: 'gepland', date: '2026-11-02' } }), score: sc(60) },
  { house: h('b', { price: 300000, addedAt: '2026-05-01' }), score: sc(null) },
  { house: h('c', { price: null, addedAt: '2026-01-01', viewing: { status: 'gepland', date: '2026-10-20' }, bid: { status: 'uitgebracht', amount: 1, date: '' } }), score: sc(90, 1) },
]
const ids = (x: typeof items) => x.map((i) => i.house.id).join('')

describe('sorteren', () => {
  it('op match, huizen zonder score achteraan', () => expect(ids(sortHouses(items, 'match'))).toBe('cab'))
  it('op prijs oplopend/aflopend, zonder prijs achteraan', () => {
    expect(ids(sortHouses(items, 'prijs-op'))).toBe('bac')
    expect(ids(sortHouses(items, 'prijs-af'))).toBe('abc')
  })
  it('op datum toegevoegd (nieuwste eerst)', () => expect(ids(sortHouses(items, 'toegevoegd'))).toBe('bac'))
  it('op bezichtigingsdatum', () => expect(ids(sortHouses(items, 'bezichtiging'))).toBe('cab'))
})

describe('filteren', () => {
  it('op status bezichtiging en bod, en op eisen', () => {
    expect(items.filter((i) => matchesFilter(i.house, i.score, 'v-gepland')).length).toBe(2)
    expect(items.filter((i) => matchesFilter(i.house, i.score, 'b-uitgebracht')).length).toBe(1)
    expect(items.filter((i) => matchesFilter(i.house, i.score, 'geen-eisfout')).length).toBe(2)
  })
})
