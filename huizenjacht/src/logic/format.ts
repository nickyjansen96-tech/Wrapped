const nf0 = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatNumber(n: number): string {
  return nf0.format(n)
}

export function euro(n: number | null | undefined, decimals = false): string {
  if (n == null || !Number.isFinite(n)) return '–'
  return `€ ${(decimals ? nf2 : nf0).format(n)}`
}

export function pct(n: number, digits = 2): string {
  return `${n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Leest een getal zoals Nederlanders het typen: "450.000", "3,85", "€ 1.250,50".
 * Geeft null bij leeg of ongeldig.
 */
export function parseDutchNumber(input: string): number | null {
  let s = input.replace(/[\s€]/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
