import { DEFAULT_NORMS, type Norms } from '../config/norms'
import { defaultData, SCHEMA_VERSION } from '../data/defaults'
import type { AppData } from '../domain/types'

/**
 * Maakt van willekeurige (oudere of geïmporteerde) data een geldige AppData.
 * Ontbrekende onderdelen worden aangevuld met standaardwaarden.
 */
export function migrate(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('Geen geldig Huizenjacht-bestand')
  const input = raw as Partial<AppData>
  if (typeof input.version === 'number' && input.version > SCHEMA_VERSION) {
    throw new Error('Dit bestand komt uit een nieuwere versie van Huizenjacht')
  }
  const base = defaultData()
  const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback)

  return {
    version: SCHEMA_VERSION,
    criteria: arr(input.criteria, base.criteria),
    phases: arr(input.phases, base.phases),
    tasks: arr(input.tasks, base.tasks),
    houses: arr(input.houses, base.houses).map((h) => ({ ...emptyHouseFields, ...h })),
    mortgage: { ...base.mortgage, ...(input.mortgage ?? {}) },
    norms: mergeNorms(input.norms),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : base.updatedAt,
  }
}

const emptyHouseFields = {
  url: '',
  price: null,
  area: null,
  bedrooms: null,
  energyLabel: null,
  houseType: null,
  buildYear: null,
  vveFee: null,
  wozValue: null,
  notes: '',
  viewing: { status: 'nee' as const },
  bid: { status: 'nee' as const },
  ratings: {},
}

function mergeNorms(n: unknown): Norms {
  const defaults = structuredClone(DEFAULT_NORMS)
  if (!n || typeof n !== 'object') return defaults
  const out = { ...defaults, ...(n as Partial<Norms>) }
  // Velden die in de opgeslagen versie ontbreken, aanvullen.
  for (const k of Object.keys(defaults) as (keyof Norms)[]) {
    if (out[k] === undefined) (out as Record<string, unknown>)[k] = defaults[k]
  }
  return out
}

export function exportJson(data: AppData): string {
  return JSON.stringify({ app: 'huizenjacht', exportedAt: new Date().toISOString(), ...data }, null, 2)
}

export function importJson(text: string): AppData {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Het bestand is geen geldige JSON')
  }
  const p = parsed as Record<string, unknown>
  if (p && p.app !== undefined && p.app !== 'huizenjacht') throw new Error('Dit is geen Huizenjacht-bestand')
  const { app: _a, exportedAt: _e, ...rest } = p
  return migrate(rest)
}
