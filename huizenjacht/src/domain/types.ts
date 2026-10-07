// Centrale datatypes van Huizenjacht. Alles wat wordt opgeslagen staat hier.

import type { Norms } from '../config/norms'

export type CategoryId = 'locatie' | 'woning' | 'buiten' | 'staat' | 'financieel'

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'locatie', label: 'Locatie' },
  { id: 'woning', label: 'Woning' },
  { id: 'buiten', label: 'Buiten' },
  { id: 'staat', label: 'Staat & duurzaamheid' },
  { id: 'financieel', label: 'Financieel & juridisch' },
]

export const ENERGY_LABELS = [
  'A++++',
  'A+++',
  'A++',
  'A+',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
] as const
export type EnergyLabel = (typeof ENERGY_LABELS)[number]

export const HOUSE_TYPES = [
  'appartement',
  'tussenwoning',
  'hoekwoning',
  '2-onder-1-kap',
  'vrijstaand',
] as const
export type HouseType = (typeof HOUSE_TYPES)[number]

/** Huisvelden waarop een criterium automatisch kan worden beoordeeld. */
export type NumericField = 'price' | 'area' | 'bedrooms' | 'buildYear' | 'vveFee'

export type AutoRule =
  | { kind: 'number'; field: NumericField; op: 'min' | 'max'; threshold: number | null }
  | { kind: 'energyLabel'; minLabel: EnergyLabel }
  | { kind: 'houseType'; allowed: HouseType[] }

export interface Criterion {
  id: string
  name: string
  category: CategoryId
  active: boolean
  /** 'eis' = harde eis, 'wens' = nice to have */
  type: 'eis' | 'wens'
  /** 1 t/m 5 */
  weight: number
  /** Optioneel: automatisch beoordelen op basis van huisgegevens. */
  auto?: AutoRule
  note?: string
}

export type Rating = 'ja' | 'nee' | 'onbekend'

export type ViewingStatus =
  | { status: 'nee' }
  | { status: 'gepland'; date: string }
  | { status: 'geweest'; date?: string }

export type BidStatus =
  | { status: 'nee' }
  | { status: 'uitgebracht'; amount: number | null; date: string }
  | { status: 'geaccepteerd'; amount?: number | null; date?: string }
  | { status: 'afgewezen'; amount?: number | null; date?: string }

export interface House {
  id: string
  address: string
  url: string
  price: number | null
  area: number | null
  bedrooms: number | null
  energyLabel: EnergyLabel | null
  houseType: HouseType | null
  buildYear: number | null
  /** VvE-bijdrage per maand */
  vveFee: number | null
  /** WOZ-waarde (optioneel, anders vraagprijs voor eigenwoningforfait) */
  wozValue: number | null
  notes: string
  viewing: ViewingStatus
  bid: BidStatus
  /** Handmatige beoordelingen per criterium-id */
  ratings: Record<string, Rating>
  /** ISO datum-tijd */
  addedAt: string
}

export type TaskStatus = 'todo' | 'bezig' | 'klaar' | 'nvt'

export const TASK_STATUSES: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'Te doen' },
  { id: 'bezig', label: 'Bezig' },
  { id: 'klaar', label: 'Klaar' },
  { id: 'nvt', label: 'N.v.t.' },
]

export interface Phase {
  id: string
  name: string
}

export interface Task {
  id: string
  phaseId: string
  title: string
  info?: string
  status: TaskStatus
  deadline?: string
  note?: string
  contact?: string
  cost?: number | null
}

export type MortgageForm = 'annuitair' | 'lineair'

export interface MortgageSettings {
  // A. Maximale hypotheek
  income1: number | null
  income2: number | null
  ownFunds: number | null
  studentDebtMonthly: number | null
  /** Rente van de studieschuld (DUO), bepaalt de weegfactor */
  studentDebtRate: number | null
  otherLoansMonthly: number | null
  maxEnergyLabel: EnergyLabel | null
  /** Extra te lenen voor energiebesparende maatregelen (kosten) */
  energySavingCosts: number | null
  maxRate: number
  maxFixedYears: number
  termYears: number
  // B. Gewenste hypotheek
  loanAmount: number | null
  form: MortgageForm
  rate: number
  fixedYears: number
  purchasePrice: number | null
  wozValue: number | null
  /** Bruto jaarinkomens voor netto-berekening: zelfde als A, met verdeling aftrek */
  ageBuyer1: number | null
  ageBuyer2: number | null
  withNhg: boolean
  // Kosten koper (zelf in te vullen schattingen)
  costNotary: number
  costValuation: number
  costAdvice: number
  costInspection: number
  costBuyingAgent: number
  costBankGuarantee: number
  costOther: number
}

export interface AppData {
  /** Schemaversie voor migraties */
  version: number
  criteria: Criterion[]
  phases: Phase[]
  tasks: Task[]
  houses: House[]
  mortgage: MortgageSettings
  norms: Norms
  /** ISO datum van laatste wijziging */
  updatedAt: string
}
