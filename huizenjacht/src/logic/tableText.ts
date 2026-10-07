import type { FinancingTable } from '../config/norms'

/** Tabel → tekst (tab-gescheiden), zodat je hem kunt bekijken en kopiëren. */
export function formatTable(t: FinancingTable): string {
  const head = ['inkomen vanaf', ...t.rateUpperBounds.map((r) => `≤${String(r).replace('.', ',')}`)].join('\t')
  const rows = t.incomes.map((inc, i) => [inc, ...t.values[i].map((v) => String(v).replace('.', ','))].join('\t'))
  return [head, ...rows].join('\n')
}

const num = (s: string) => Number(s.replace(/[≤<%€]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))

/**
 * Tekst → tabel. Eerste regel: kop met de rente-bovengrenzen (eerste cel wordt genegeerd).
 * Daarna per regel: toetsinkomen vanaf + één percentage per rentekolom.
 */
export function parseTable(text: string): FinancingTable {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) throw new Error('Minimaal een kopregel en één rij nodig')
  const split = (l: string) => l.split(/\t|;|\s{2,}|\s(?=[\d≤<])/).map((c) => c.trim()).filter(Boolean)
  const head = split(lines[0])
  const rateUpperBounds = head.slice(1).map(num)
  if (!rateUpperBounds.length || rateUpperBounds.some((r) => !Number.isFinite(r))) throw new Error('Kopregel: rente-bovengrenzen niet herkend')
  const incomes: number[] = []
  const values: number[][] = []
  for (const line of lines.slice(1)) {
    const cells = split(line).map(num)
    if (cells.length !== rateUpperBounds.length + 1 || cells.some((c) => !Number.isFinite(c)))
      throw new Error(`Regel "${line}": verwacht inkomen + ${rateUpperBounds.length} percentages`)
    incomes.push(cells[0])
    values.push(cells.slice(1))
  }
  for (let i = 1; i < incomes.length; i++) if (incomes[i] <= incomes[i - 1]) throw new Error('Inkomens moeten oplopen')
  for (let i = 1; i < rateUpperBounds.length; i++) if (rateUpperBounds[i] <= rateUpperBounds[i - 1]) throw new Error('Rentekolommen moeten oplopen')
  return { incomes, rateUpperBounds, values }
}
