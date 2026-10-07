import { useMemo, useState } from 'react'
import type { House } from '../domain/types'
import { matchesFilter, sortHouses, type Filter, type SortKey } from '../logic/houseList'
import { houseMonthly } from '../logic/costs'
import { euro, formatDate } from '../logic/format'
import { scoreHouse, type HouseScore } from '../logic/score'
import { go } from '../state/router'
import { useStore } from '../state/store'

const SORT_KEY = 'huizenjacht:sort'
const FILTER_KEY = 'huizenjacht:filter'

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback
  } catch {
    return fallback
  }
}

export function HuizenPage() {
  const { data } = useStore()
  const [sort, setSort] = useState<SortKey>(() => readPref(SORT_KEY, 'match'))
  const [filter, setFilter] = useState<Filter>(() => readPref(FILTER_KEY, 'alle'))
  const persist = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* niet erg */
    }
  }

  const items = useMemo(
    () => data.houses.map((house) => ({ house, score: scoreHouse(house, data.criteria) })),
    [data.houses, data.criteria],
  )
  const shown = sortHouses(
    items.filter((i) => matchesFilter(i.house, i.score, filter)),
    sort,
  )

  return (
    <div className="stack">
      {data.houses.length > 0 && (
        <div className="filters">
          <select
            aria-label="Sorteren"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey)
              persist(SORT_KEY, e.target.value)
            }}
          >
            <option value="match">Sorteer: beste match</option>
            <option value="prijs-op">Prijs: laag → hoog</option>
            <option value="prijs-af">Prijs: hoog → laag</option>
            <option value="toegevoegd">Datum: nieuwst toegevoegd</option>
            <option value="bezichtiging">Datum: bezichtiging</option>
          </select>
          <select
            aria-label="Filteren"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as Filter)
              persist(FILTER_KEY, e.target.value)
            }}
          >
            <option value="alle">Alle huizen</option>
            <option value="geen-eisfout">Voldoet aan alle eisen</option>
            <optgroup label="Bezichtiging">
              <option value="v-nee">Nog niet gepland</option>
              <option value="v-gepland">Gepland</option>
              <option value="v-geweest">Geweest</option>
            </optgroup>
            <optgroup label="Bod">
              <option value="b-uitgebracht">Bod uitgebracht</option>
              <option value="b-geaccepteerd">Bod geaccepteerd</option>
              <option value="b-afgewezen">Bod afgewezen</option>
            </optgroup>
          </select>
        </div>
      )}

      {data.houses.length === 0 && (
        <div className="card stack" style={{ textAlign: 'center', padding: 28 }}>
          <p style={{ fontSize: '2rem' }}>⌂</p>
          <p>Nog geen huizen. Voeg een huis toe dat je hebt gezien, bijvoorbeeld op Funda.</p>
          <p className="small muted">Elk huis krijgt automatisch een matchpercentage op basis van jullie wensen.</p>
        </div>
      )}
      {data.houses.length > 0 && shown.length === 0 && <p className="muted">Geen huizen met dit filter.</p>}

      {shown.map(({ house, score }) => (
        <HouseCard key={house.id} house={house} score={score} />
      ))}

      <button className="fab" onClick={() => go('huizen/nieuw')}>
        + Huis
      </button>
    </div>
  )
}

function HouseCard({ house, score }: { house: House; score: HouseScore }) {
  const { data } = useStore()
  const monthly = houseMonthly(house, data.mortgage, data.norms)
  return (
    <button className="card house-card" onClick={() => go(`huizen/${house.id}`)}>
      <ScoreCircle score={score} />
      <div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
        <span className="title">{house.address || 'Zonder adres'}</span>
        <span className="meta">
          {house.price != null && <span>{euro(house.price)}</span>}
          {house.area != null && <span>{house.area} m²</span>}
          {house.bedrooms != null && <span>{house.bedrooms} slk</span>}
          {house.energyLabel && <span>label {house.energyLabel}</span>}
        </span>
        <span className="meta">
          <span>
            {score.assessed} van {score.total} beoordeeld
          </span>
          <StatusChips house={house} />
        </span>
        {monthly && (
          <span className="meta">
            <span>
              Bruto {euro(monthly.grossFirstMonth)} · netto ≈ {euro(monthly.netFirstYear)} p/m
            </span>
          </span>
        )}
        {score.failedRequirements.length > 0 && (
          <span className="warning">⚠ Voldoet niet aan eis: {score.failedRequirements.map((c) => c.name).join(', ')}</span>
        )}
      </div>
    </button>
  )
}

export function ScoreCircle({ score, large }: { score: HouseScore; large?: boolean }) {
  const p = score.percentage
  return (
    <div
      className={'score' + (score.failedRequirements.length ? ' bad' : '')}
      style={{ ['--p' as string]: p ?? 0, ...(large ? { width: 84, height: 84, fontSize: '1.3rem' } : {}) }}
      aria-label={p == null ? 'Nog geen score' : `Match ${p} procent`}
    >
      <span>{p == null ? '–' : `${p}%`}</span>
    </div>
  )
}

export function StatusChips({ house }: { house: House }) {
  const v = house.viewing
  const b = house.bid
  return (
    <>
      {v.status === 'gepland' && <span className="chip chip-warn">Bezichtiging {formatDate(v.date)}</span>}
      {v.status === 'geweest' && <span className="chip">Bezichtigd</span>}
      {b.status === 'uitgebracht' && <span className="chip chip-warn">Bod {euro(b.amount)}</span>}
      {b.status === 'geaccepteerd' && <span className="chip chip-ok">Bod geaccepteerd</span>}
      {b.status === 'afgewezen' && <span className="chip chip-eis">Bod afgewezen</span>}
    </>
  )
}
