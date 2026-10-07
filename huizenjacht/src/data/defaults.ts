import { DEFAULT_NORMS } from '../config/norms'
import type { AppData, MortgageSettings } from '../domain/types'
import { defaultCriteria } from './defaultCriteria'
import { DEFAULT_PHASES, defaultTasks } from './defaultTasks'

export const SCHEMA_VERSION = 1

export function defaultMortgage(): MortgageSettings {
  const r = DEFAULT_NORMS.rates.value
  return {
    income1: null,
    income2: null,
    ownFunds: null,
    studentDebtMonthly: null,
    studentDebtRate: null,
    otherLoansMonthly: null,
    maxEnergyLabel: null,
    energySavingCosts: null,
    maxRate: r.nhg10,
    maxFixedYears: 10,
    termYears: 30,
    loanAmount: null,
    form: 'annuitair',
    rate: r.nhg10,
    fixedYears: 10,
    purchasePrice: null,
    wozValue: null,
    ageBuyer1: null,
    ageBuyer2: null,
    withNhg: true,
    // Indicatieve marktbedragen (incl. btw), zelf aan te passen.
    costNotary: 1200,
    costValuation: 750,
    costAdvice: 3000,
    costInspection: 450,
    costBuyingAgent: 0,
    costBankGuarantee: 0,
    costOther: 0,
  }
}

export function defaultData(): AppData {
  return {
    version: SCHEMA_VERSION,
    criteria: defaultCriteria(),
    phases: DEFAULT_PHASES.map((p) => ({ ...p })),
    tasks: defaultTasks(),
    houses: [],
    mortgage: defaultMortgage(),
    norms: structuredClone(DEFAULT_NORMS),
    updatedAt: new Date().toISOString(),
  }
}
