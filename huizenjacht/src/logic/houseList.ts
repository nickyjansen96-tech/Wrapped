import type { House } from '../domain/types'
import type { HouseScore } from './score'

export type SortKey = 'match' | 'prijs-op' | 'prijs-af' | 'toegevoegd' | 'bezichtiging'
export type Filter = 'alle' | 'v-nee' | 'v-gepland' | 'v-geweest' | 'b-uitgebracht' | 'b-geaccepteerd' | 'b-afgewezen' | 'geen-eisfout'

export function sortHouses(items: { house: House; score: HouseScore }[], sort: SortKey) {
  const byNull = (a: number | null, b: number | null, dir: 1 | -1) =>
    a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : (a - b) * dir
  return [...items].sort((a, b) => {
    switch (sort) {
      case 'match':
        return byNull(a.score.percentage, b.score.percentage, -1)
      case 'prijs-op':
        return byNull(a.house.price, b.house.price, 1)
      case 'prijs-af':
        return byNull(a.house.price, b.house.price, -1)
      case 'toegevoegd':
        return b.house.addedAt.localeCompare(a.house.addedAt)
      case 'bezichtiging': {
        const d = (h: House) => (h.viewing.status !== 'nee' && h.viewing.date ? Date.parse(h.viewing.date) : null)
        return byNull(d(a.house), d(b.house), 1)
      }
    }
  })
}

export function matchesFilter(house: House, score: HouseScore, f: Filter): boolean {
  if (f === 'alle') return true
  if (f === 'geen-eisfout') return score.failedRequirements.length === 0
  if (f.startsWith('v-')) return house.viewing.status === f.slice(2)
  return house.bid.status === f.slice(2)
}

