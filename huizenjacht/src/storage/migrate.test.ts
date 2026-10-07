import { describe, expect, it } from 'vitest'
import { defaultData } from '../data/defaults'
import { exportJson, importJson, migrate } from './migrate'
import { MemoryStore } from './storage'

describe('opslag en import/export', () => {
  it('export → import geeft dezelfde data terug', () => {
    const d = defaultData()
    d.houses.push({
      id: 'h', address: 'Kerkstraat 1', url: 'https://example.nl', price: 1, area: 2, bedrooms: 3,
      energyLabel: 'A', houseType: null, buildYear: null, vveFee: null, wozValue: null, notes: 'x',
      viewing: { status: 'gepland', date: '2026-11-01' }, bid: { status: 'nee' }, ratings: { a: 'ja' }, addedAt: 'now',
    })
    expect(importJson(exportJson(d))).toEqual(d)
  })
  it('vult ontbrekende onderdelen aan met standaardwaarden', () => {
    const m = migrate({ version: 1, houses: [{ id: 'h', address: 'A' }] })
    expect(m.criteria.length).toBeGreaterThan(20)
    expect(m.houses[0].viewing).toEqual({ status: 'nee' })
    expect(m.norms.nhgLimit.value).toBe(470000)
  })
  it('weigert ongeldige bestanden', () => {
    expect(() => importJson('geen json')).toThrow(/geldige JSON/)
    expect(() => importJson('{"app":"iets-anders"}')).toThrow(/Huizenjacht/)
    expect(() => importJson('{"version":999}')).toThrow(/nieuwere versie/)
  })
  it('MemoryStore bewaart kopie', async () => {
    const s = new MemoryStore()
    const d = defaultData()
    await s.save(d)
    d.houses.push({} as never)
    expect((await s.load())!.houses).toHaveLength(0)
  })
})
