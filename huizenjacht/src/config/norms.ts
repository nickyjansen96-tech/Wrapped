// Alle jaarafhankelijke cijfers van Huizenjacht staan in dit ene bestand.
// Elke waarde heeft een bron en een peildatum. In de app zijn ze aan te passen
// via Instellingen (de aangepaste versie wordt opgeslagen bij je data).
// Bijwerken voor een nieuw jaar: zie README.md, "Jaarcijfers bijwerken".

import type { EnergyLabel } from '../domain/types'
import { FINANCIERINGSLAST_2026 } from './financieringslast2026'

export interface Sourced<T> {
  value: T
  /** Korte omschrijving van de bron */
  source: string
  url?: string
  /** Datum waarop de waarde is gecontroleerd (JJJJ-MM-DD) */
  checked: string
}

/**
 * Financieringslasttabel: per toetsinkomen (rij) en toetsrente (kolom) het
 * percentage van het bruto inkomen dat aan woonlasten besteed mag worden.
 */
export interface FinancingTable {
  /** Ondergrens toetsinkomen per rij, oplopend. Rij i geldt van incomes[i] tot incomes[i+1]. */
  incomes: number[]
  /** Bovengrens toetsrente per kolom (in %), oplopend. Laatste kolom geldt ook voor hogere rentes. */
  rateUpperBounds: number[]
  /** values[rij][kolom], in procenten (bv. 24.6) */
  values: number[][]
}

export interface Norms {
  year: number
  /** Peildatum van de hele set */
  checked: string

  financingTable: Sourced<FinancingTable>
  /** Ondergrens toetsrente bij rentevaste periode < 10 jaar (AFM, per kwartaal) */
  testRate: Sourced<number>
  /** Rentevaste periode vanaf waar de werkelijke rente gebruikt mag worden */
  testRateMinFixedYears: Sourced<number>
  /** Aandeel van het tweede (laagste) inkomen dat meetelt (1 = 100%) */
  secondIncomeFactor: Sourced<number>
  /** Looptijd waarmee de maximale hypotheek wordt berekend (jaren, annuïtair) */
  maxTermYears: Sourced<number>
  /** Maximale hypotheek als % van de marktwaarde */
  maxLtv: Sourced<number>
  /** Extra leenruimte bovenop de LTV voor energiebesparende voorzieningen (%) */
  maxLtvEnergyExtra: Sourced<number>
  /** Bedrag dat buiten de financieringslast blijft, per energielabel van de woning */
  energyLabelExtra: Sourced<Record<EnergyLabel | 'geen', number>>
  /** Maximaal extra bedrag voor energiebesparende voorzieningen, per energielabel */
  energySavingExtra: Sourced<Record<EnergyLabel | 'geen', number>>
  /** Bruteringsfactor studieschuld per hypotheekrente-band: [bovengrens %, factor] */
  studentDebtFactors: Sourced<[number, number][]>

  nhgLimit: Sourced<number>
  nhgLimitEnergy: Sourced<number>
  nhgFeePct: Sourced<number>

  /** Box 1-schijven: [bovengrens schijf, tarief %]; laatste bovengrens = null */
  incomeTaxBrackets: Sourced<[number | null, number][]>
  /** Maximaal tarief waartegen hypotheekrente aftrekbaar is (%) */
  maxDeductionRate: Sourced<number>
  /** Eigenwoningforfait: [ondergrens WOZ, percentage of vast bedrag] */
  ewfPct: Sourced<number>
  ewfMinWoz: Sourced<number>
  ewfVillaThreshold: Sourced<number>
  ewfVillaPct: Sourced<number>
  /** Wet Hillen: aftrek bij geen/kleine eigenwoningschuld (% van verschil) */
  hillenPct: Sourced<number>

  transferTaxPct: Sourced<number>
  starterExemptionMaxAge: Sourced<number>
  starterExemptionMaxValue: Sourced<number>

  /** Startwaarden hypotheekrente (geen live koppeling) */
  rates: Sourced<{
    nhg10: number
    nhg20: number
    noNhg10: number
    noNhg20: number
  }>
}

const CHECKED = '2026-10-07'
const BD = 'Belastingdienst'

export const DEFAULT_NORMS: Norms = {
  year: 2026,
  checked: CHECKED,

  financingTable: {
    value: FINANCIERINGSLAST_2026,
    source:
      'Tijdelijke regeling hypothecair krediet, bijlage tabel 1 (Wijzigingsregeling hypothecair krediet 2026, Staatscourant 2025, 36471), op advies van Nibud',
    url: 'https://zoek.officielebekendmakingen.nl/stcrt-2025-36471.html',
    checked: CHECKED,
  },
  testRate: {
    value: 5.0,
    source: 'AFM, toetsrente hypotheken vierde kwartaal 2026 (wettelijk minimum 5%)',
    url: 'https://www.afm.nl/en/sector/actueel/2026/sep/sb-toetsrente',
    checked: CHECKED,
  },
  testRateMinFixedYears: {
    value: 10,
    source: 'Tijdelijke regeling hypothecair krediet, art. 3 (rentevast < 10 jaar → toetsrente)',
    url: 'https://wetten.overheid.nl/BWBR0032503',
    checked: CHECKED,
  },
  secondIncomeFactor: {
    value: 1,
    source: 'Tijdelijke regeling hypothecair krediet: tweede inkomen telt sinds 2024 volledig mee',
    url: 'https://wetten.overheid.nl/BWBR0032503',
    checked: CHECKED,
  },
  maxTermYears: {
    value: 30,
    source: 'Tijdelijke regeling hypothecair krediet: berekening op basis van annuïtaire aflossing in 30 jaar',
    url: 'https://wetten.overheid.nl/BWBR0032503',
    checked: CHECKED,
  },
  maxLtv: {
    value: 100,
    source: 'Tijdelijke regeling hypothecair krediet, art. 2: max. 100% van de marktwaarde',
    url: 'https://wetten.overheid.nl/BWBR0032503',
    checked: CHECKED,
  },
  maxLtvEnergyExtra: {
    value: 6,
    source: 'Tijdelijke regeling hypothecair krediet: +6% marktwaarde voor energiebesparende voorzieningen',
    url: 'https://www.nhg.nl/nhg-actueel/nhg-grens-in-2026-vastgesteld-op-470000/',
    checked: CHECKED,
  },
  energyLabelExtra: {
    value: {
      'A++++': 30000,
      'A+++': 25000,
      'A++': 20000,
      'A+': 20000,
      A: 10000,
      B: 10000,
      C: 5000,
      D: 5000,
      E: 0,
      F: 0,
      G: 0,
      geen: 0,
    },
    source:
      'Wijzigingsregeling hypothecair krediet 2026 (Stcrt. 2025, 36471): A+++ van € 30.000 naar € 25.000, A++++ van € 40.000 naar € 30.000 (met energieprestatiegarantie € 40.000)',
    url: 'https://zoek.officielebekendmakingen.nl/stcrt-2025-36471.html',
    checked: CHECKED,
  },
  energySavingExtra: {
    value: {
      'A++++': 0,
      'A+++': 0,
      'A++': 5000,
      'A+': 5000,
      A: 10000,
      B: 10000,
      C: 15000,
      D: 15000,
      E: 20000,
      F: 20000,
      G: 20000,
      geen: 20000,
    },
    source: 'Tijdelijke regeling hypothecair krediet, bedragen energiebesparende voorzieningen (ongewijzigd in 2026)',
    url: 'https://www.volkshuisvestingnederland.nl/onderwerpen/huren-en-wonen/tijdelijke-regeling-hypothecair-krediet/maximale-hypotheek-op-basis-van-energielabel',
    checked: CHECKED,
  },
  studentDebtFactors: {
    value: [
      [2.0, 1.05],
      [2.5, 1.1],
      [3.0, 1.15],
      [3.5, 1.2],
      [4.0, 1.2],
      [4.5, 1.25],
      [5.0, 1.3],
      [5.5, 1.3],
      [6.0, 1.35],
      [99, 1.4],
    ],
    source: 'Nibud, Advies hypotheeknormen 2026 (bruteringsfactoren studieschuld)',
    url: 'https://zoek.officielebekendmakingen.nl/blg-1221422.pdf',
    checked: CHECKED,
  },

  nhgLimit: {
    value: 470000,
    source: 'NHG, "NHG-grens in 2026 vastgesteld op € 470.000"',
    url: 'https://www.nhg.nl/nhg-actueel/nhg-grens-in-2026-vastgesteld-op-470000/',
    checked: CHECKED,
  },
  nhgLimitEnergy: {
    value: 498200,
    source: 'NHG: met energiebesparende voorzieningen +6%',
    url: 'https://www.nhg.nl/nhg-actueel/nhg-grens-in-2026-vastgesteld-op-470000/',
    checked: CHECKED,
  },
  nhgFeePct: {
    value: 0.4,
    source: 'NHG: borgtochtprovisie 2026 blijft 0,4% van het hypotheekbedrag',
    url: 'https://www.nhg.nl/nhg-actueel/nhg-grens-in-2026-vastgesteld-op-470000/',
    checked: CHECKED,
  },

  incomeTaxBrackets: {
    value: [
      [38883, 35.75],
      [78426, 37.56],
      [null, 49.5],
    ],
    source: `${BD}, box 1-tarieven 2026 (jonger dan AOW-leeftijd)`,
    url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/boxen_en_tarieven/box_1/box_1',
    checked: CHECKED,
  },
  maxDeductionRate: {
    value: 37.56,
    source: `${BD}, tariefsaanpassing 2026: hypotheekrente aftrekbaar tegen max. 37,56%`,
    url: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/aftrek-en-kortingen/content/afbouw-tarief-aftrekposten-bij-hoog-inkomen',
    checked: CHECKED,
  },
  ewfPct: {
    value: 0.35,
    source: `${BD}, eigenwoningforfait 2026: 0,35% voor WOZ € 75.000 – € 1.350.000`,
    url: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/koopwoning/content/hoe-werkt-eigenwoningforfait',
    checked: CHECKED,
  },
  ewfMinWoz: {
    value: 75000,
    source: `${BD}, eigenwoningforfait 2026 (lagere percentages onder € 75.000; vereenvoudigd)`,
    url: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/koopwoning/content/hoe-werkt-eigenwoningforfait',
    checked: CHECKED,
  },
  ewfVillaThreshold: {
    value: 1350000,
    source: `${BD}, eigenwoningforfait 2026: boven € 1.350.000 € 4.725 + 2,35% van het meerdere`,
    url: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/koopwoning/content/hoe-werkt-eigenwoningforfait',
    checked: CHECKED,
  },
  ewfVillaPct: {
    value: 2.35,
    source: `${BD}, eigenwoningforfait 2026 (villataks)`,
    url: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/koopwoning/content/hoe-werkt-eigenwoningforfait',
    checked: CHECKED,
  },
  hillenPct: {
    value: 71.867,
    source: `${BD}, Wet Hillen 2026: aftrek 71,867% van het verschil`,
    url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/woning/eigenwoningforfait/geen_of_een_kleine_eigenwoningschuld/geen_of_een_kleine_eigenwoningschuld',
    checked: CHECKED,
  },

  transferTaxPct: {
    value: 2,
    source: `${BD}, overdrachtsbelasting 2026: 2% voor een woning waar u zelf gaat wonen`,
    url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/woning/overdrachtsbelasting/tarieven_overdrachtsbelasting/laag-tarief',
    checked: CHECKED,
  },
  starterExemptionMaxAge: {
    value: 34,
    source: `${BD}, startersvrijstelling: 18 jaar of ouder en jonger dan 35 jaar bij levering`,
    url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/woning/overdrachtsbelasting/startersvrijstelling/startersvrijstelling',
    checked: CHECKED,
  },
  starterExemptionMaxValue: {
    value: 555000,
    source: `${BD}, startersvrijstelling 2026: woningwaarde max. € 555.000`,
    url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/woning/overdrachtsbelasting/startersvrijstelling/startersvrijstelling',
    checked: CHECKED,
  },

  rates: {
    value: { nhg10: 3.9, nhg20: 4.05, noNhg10: 4.1, noNhg20: 4.35 },
    source:
      'Indicatie laagste/gangbare tarieven grote aanbieders (rentevergelijkers), 100% marktwaarde. Altijd zelf actuele rente invullen.',
    checked: CHECKED,
  },
}
