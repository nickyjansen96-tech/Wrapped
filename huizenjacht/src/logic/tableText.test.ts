import { describe, expect, it } from 'vitest'
import { FINANCIERINGSLAST_2026 } from '../config/financieringslast2026'
import { formatTable, parseTable } from './tableText'

describe('tabel als tekst', () => {
  it('format → parse geeft dezelfde tabel', () => {
    expect(parseTable(formatTable(FINANCIERINGSLAST_2026))).toEqual(FINANCIERINGSLAST_2026)
  })
  it('accepteert Nederlandse notatie en puntkomma', () => {
    const t = parseTable('inkomen;3,0;3,5\n30.000;18,4;19,3\n35.000;20,6;21,6')
    expect(t).toEqual({ incomes: [30000, 35000], rateUpperBounds: [3, 3.5], values: [[18.4, 19.3], [20.6, 21.6]] })
  })
  it('geeft duidelijke fout bij verkeerd aantal kolommen', () => {
    expect(() => parseTable('x\t3\t4\n30000\t18')).toThrow(/verwacht inkomen \+ 2/)
  })
  it('inkomens moeten oplopen', () => {
    expect(() => parseTable('x\t3\n40000\t1\n30000\t2')).toThrow(/oplopen/)
  })
})
