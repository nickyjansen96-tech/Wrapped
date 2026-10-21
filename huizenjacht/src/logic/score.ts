// Pure functies voor het beoordelen van huizen op criteria.

import {
  ENERGY_LABELS,
  type AutoRule,
  type Criterion,
  type EnergyLabel,
  type House,
  type NumericField,
  type Rating,
} from '../domain/types'
import { formatNumber } from './format'

export interface CriterionResult {
  criterion: Criterion
  rating: Rating
  /** 'auto' als het oordeel uit de huisgegevens komt, anders 'handmatig' */
  source: 'auto' | 'handmatig'
  /** Uitleg waarom het oordeel is zoals het is */
  reason: string
}

export interface HouseScore {
  /** 0–100, of null als nog niets is beoordeeld */
  percentage: number | null
  assessed: number
  total: number
  weightMet: number
  weightAssessed: number
  /** Harde eisen waar het huis niet aan voldoet */
  failedRequirements: Criterion[]
  results: CriterionResult[]
}

const FIELD_LABEL: Record<NumericField, { label: string; unit: string }> = {
  price: { label: 'Vraagprijs', unit: '€' },
  area: { label: 'Woonoppervlak', unit: 'm²' },
  bedrooms: { label: 'Slaapkamers', unit: '' },
  buildYear: { label: 'Bouwjaar', unit: '' },
  vveFee: { label: 'VvE-bijdrage', unit: '€/mnd' },
}

function fmt(field: NumericField, v: number): string {
  const { unit } = FIELD_LABEL[field]
  if (field === 'buildYear') return String(v)
  if (unit === '€') return `€ ${formatNumber(v)}`
  if (unit === '€/mnd') return `€ ${formatNumber(v)} p/m`
  return unit ? `${formatNumber(v)} ${unit}` : formatNumber(v)
}

/** Lager index = beter label. */
export function labelRank(l: EnergyLabel): number {
  return ENERGY_LABELS.indexOf(l)
}

export function describeRule(rule: AutoRule): string {
  switch (rule.kind) {
    case 'number': {
      if (rule.threshold == null) return 'geen drempel ingesteld'
      return `${rule.op === 'min' ? 'minimaal' : 'maximaal'} ${fmt(rule.field, rule.threshold)}`
    }
    case 'energyLabel':
      return `label ${rule.minLabel} of beter`
    case 'houseType':
      return rule.allowed.length ? rule.allowed.join(', ') : 'geen type gekozen'
  }
}

/**
 * Automatisch oordeel op basis van huisgegevens.
 * Geeft null als er niet automatisch geoordeeld kan worden (gegeven ontbreekt).
 */
export function autoAssess(rule: AutoRule, house: House): { rating: Rating; reason: string } | null {
  switch (rule.kind) {
    case 'number': {
      const v = house[rule.field]
      if (v == null || rule.threshold == null) return null
      const ok = rule.op === 'min' ? v >= rule.threshold : v <= rule.threshold
      return {
        rating: ok ? 'ja' : 'nee',
        reason: `${FIELD_LABEL[rule.field].label} ${fmt(rule.field, v)}; eis ${describeRule(rule)}`,
      }
    }
    case 'energyLabel': {
      if (!house.energyLabel) return null
      const ok = labelRank(house.energyLabel) <= labelRank(rule.minLabel)
      return { rating: ok ? 'ja' : 'nee', reason: `Energielabel ${house.energyLabel}; eis ${describeRule(rule)}` }
    }
    case 'houseType': {
      if (!house.houseType || rule.allowed.length === 0) return null
      const ok = rule.allowed.includes(house.houseType)
      return { rating: ok ? 'ja' : 'nee', reason: `Woningtype ${house.houseType}; gewenst: ${describeRule(rule)}` }
    }
  }
}

export function assessCriterion(criterion: Criterion, house: House): CriterionResult {
  if (criterion.auto) {
    const auto = autoAssess(criterion.auto, house)
    if (auto) return { criterion, source: 'auto', ...auto }
  }
  const manual = house.ratings[criterion.id] ?? 'onbekend'
  const reason =
    manual === 'onbekend'
      ? criterion.auto
        ? 'Gegeven ontbreekt bij het huis en nog niet handmatig beoordeeld'
        : 'Nog niet beoordeeld'
      : manual === 'ja'
        ? 'Handmatig: voldoet'
        : 'Handmatig: voldoet niet'
  return { criterion, rating: manual, source: 'handmatig', reason }
}

/**
 * Matchpercentage = som gewichten van criteria die voldoen
 *                 / som gewichten van alle beoordeelde criteria × 100.
 * "Weet nog niet" telt niet mee. Alleen actieve criteria.
 */
export function scoreHouse(house: House, criteria: Criterion[]): HouseScore {
  const results = criteria.filter((c) => c.active).map((c) => assessCriterion(c, house))
  let weightMet = 0
  let weightAssessed = 0
  let assessed = 0
  const failedRequirements: Criterion[] = []
  for (const r of results) {
    if (r.rating === 'onbekend') continue
    assessed++
    weightAssessed += r.criterion.weight
    if (r.rating === 'ja') weightMet += r.criterion.weight
    else if (r.criterion.type === 'eis') failedRequirements.push(r.criterion)
  }
  return {
    percentage: weightAssessed > 0 ? Math.round((weightMet / weightAssessed) * 100) : null,
    assessed,
    total: results.length,
    weightMet,
    weightAssessed,
    failedRequirements,
    results,
  }
}
