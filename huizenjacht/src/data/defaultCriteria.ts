import type { Criterion } from '../domain/types'

type Seed = Omit<Criterion, 'active'> & { active?: boolean }

const seeds: Seed[] = [
  // Locatie
  { id: 'loc-plaats', name: 'Gewenste plaats/wijk', category: 'locatie', type: 'wens', weight: 5, note: 'Vul in welke plaatsen of wijken' },
  { id: 'loc-reistijd', name: 'Max. reistijd naar werk', category: 'locatie', type: 'wens', weight: 4, note: 'Bijv. max. 30 minuten' },
  { id: 'loc-ov', name: 'OV op loopafstand', category: 'locatie', type: 'wens', weight: 3 },
  { id: 'loc-winkels', name: 'Winkels dichtbij', category: 'locatie', type: 'wens', weight: 3 },
  { id: 'loc-scholen', name: 'Scholen/kinderopvang dichtbij', category: 'locatie', type: 'wens', weight: 2 },
  { id: 'loc-rustig', name: 'Rustige straat', category: 'locatie', type: 'wens', weight: 3 },
  { id: 'loc-groen', name: 'Groen in de buurt', category: 'locatie', type: 'wens', weight: 3 },

  // Woning
  { id: 'won-oppervlak', name: 'Min. woonoppervlak', category: 'woning', type: 'eis', weight: 5, auto: { kind: 'number', field: 'area', op: 'min', threshold: 70 } },
  { id: 'won-slaapkamers', name: 'Min. aantal slaapkamers', category: 'woning', type: 'eis', weight: 4, auto: { kind: 'number', field: 'bedrooms', op: 'min', threshold: 2 } },
  { id: 'won-type', name: 'Woningtype', category: 'woning', type: 'wens', weight: 3, auto: { kind: 'houseType', allowed: ['tussenwoning', 'hoekwoning', '2-onder-1-kap', 'vrijstaand'] } },
  { id: 'won-bouwjaar', name: 'Bouwjaar vanaf', category: 'woning', type: 'wens', weight: 2, auto: { kind: 'number', field: 'buildYear', op: 'min', threshold: 1930 } },
  { id: 'won-werkkamer', name: 'Werkkamer', category: 'woning', type: 'wens', weight: 3 },
  { id: 'won-berging', name: 'Bergruimte/schuur', category: 'woning', type: 'wens', weight: 2 },
  { id: 'won-bad', name: 'Badkamer met bad', category: 'woning', type: 'wens', weight: 1 },
  { id: 'won-toilet2', name: 'Tweede toilet', category: 'woning', type: 'wens', weight: 1 },

  // Buiten
  { id: 'bui-tuin', name: 'Tuin', category: 'buiten', type: 'wens', weight: 4 },
  { id: 'bui-balkon', name: 'Balkon/dakterras', category: 'buiten', type: 'wens', weight: 2 },
  { id: 'bui-zon', name: 'Buitenruimte op de zon (zuid/west)', category: 'buiten', type: 'wens', weight: 3 },
  { id: 'bui-parkeren', name: 'Eigen parkeerplek', category: 'buiten', type: 'wens', weight: 2 },
  { id: 'bui-fiets', name: 'Fietsenstalling', category: 'buiten', type: 'wens', weight: 2 },

  // Staat & duurzaamheid
  { id: 'sta-label', name: 'Min. energielabel', category: 'staat', type: 'wens', weight: 3, auto: { kind: 'energyLabel', minLabel: 'C' } },
  { id: 'sta-instap', name: 'Instapklaar', category: 'staat', type: 'wens', weight: 3 },
  { id: 'sta-fundering', name: 'Geen funderingsrisico', category: 'staat', type: 'eis', weight: 5 },
  { id: 'sta-glas', name: 'Dubbel/HR++ glas', category: 'staat', type: 'wens', weight: 2 },
  { id: 'sta-zon', name: 'Zonnepanelen', category: 'staat', type: 'wens', weight: 1 },
  { id: 'sta-warmtepomp', name: 'Warmtepomp of gasloos', category: 'staat', type: 'wens', weight: 1 },
  { id: 'sta-asbest', name: 'Geen asbest', category: 'staat', type: 'eis', weight: 4 },

  // Financieel & juridisch
  { id: 'fin-prijs', name: 'Max. vraagprijs', category: 'financieel', type: 'eis', weight: 5, auto: { kind: 'number', field: 'price', op: 'max', threshold: 450000 } },
  { id: 'fin-grond', name: 'Eigen grond (geen erfpacht)', category: 'financieel', type: 'wens', weight: 3 },
  { id: 'fin-vve', name: 'VvE-bijdrage max. per maand', category: 'financieel', type: 'wens', weight: 2, auto: { kind: 'number', field: 'vveFee', op: 'max', threshold: 200 } },
  { id: 'fin-vvegezond', name: 'Gezonde VvE (reserves, MJOP)', category: 'financieel', type: 'wens', weight: 3 },
]

export function defaultCriteria(): Criterion[] {
  return seeds.map((s) => ({ active: true, ...s }))
}
