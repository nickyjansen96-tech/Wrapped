import { describe, expect, it } from 'vitest'
import { euro, parseDutchNumber } from './format'

describe('parseDutchNumber', () => {
  it.each([
    ['450000', 450000],
    ['450.000', 450000],
    ['€ 1.250,50', 1250.5],
    ['3,85', 3.85],
    ['3.85', 3.85],
    ['', null],
    ['abc', null],
  ])('%s → %s', (inp, out) => expect(parseDutchNumber(inp)).toBe(out))
})

describe('euro', () => {
  it('formatteert in Nederlandse notatie', () => {
    expect(euro(450000).replace(/\s/g, ' ')).toBe('€ 450.000')
    expect(euro(null)).toBe('–')
  })
})
