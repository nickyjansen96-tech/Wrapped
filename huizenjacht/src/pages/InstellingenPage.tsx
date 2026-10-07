import { useRef, useState } from 'react'
import { Field, NumberInput } from '../components/ui'
import { DEFAULT_NORMS, type FinancingTable, type Norms, type Sourced } from '../config/norms'
import { defaultData } from '../data/defaults'
import { formatDate } from '../logic/format'
import { formatTable, parseTable } from '../logic/tableText'
import { exportJson, importJson } from '../storage/migrate'
import { useStore } from '../state/store'

type NumKey = { [K in keyof Norms]: Norms[K] extends Sourced<number> ? K : never }[keyof Norms]

const NUMBER_FIELDS: { key: NumKey; label: string; suffix?: string; decimals?: boolean }[] = [
  { key: 'testRate', label: 'Toetsrente (minimum bij rentevast < 10 jaar)', suffix: '%', decimals: true },
  { key: 'testRateMinFixedYears', label: 'Rentevaste periode zonder toetsrente vanaf', suffix: 'jaar' },
  { key: 'secondIncomeFactor', label: 'Tweede inkomen telt mee (1 = 100%)', decimals: true },
  { key: 'maxTermYears', label: 'Looptijd voor toets', suffix: 'jaar' },
  { key: 'maxLtv', label: 'Max. hypotheek t.o.v. woningwaarde', suffix: '%' },
  { key: 'maxLtvEnergyExtra', label: 'Extra t.o.v. woningwaarde voor verduurzaming', suffix: '%' },
  { key: 'nhgLimit', label: 'NHG-grens', suffix: '€' },
  { key: 'nhgLimitEnergy', label: 'NHG-grens met energiebesparende voorzieningen', suffix: '€' },
  { key: 'nhgFeePct', label: 'NHG-borgtochtprovisie', suffix: '%', decimals: true },
  { key: 'maxDeductionRate', label: 'Max. aftrektarief hypotheekrente', suffix: '%', decimals: true },
  { key: 'ewfPct', label: 'Eigenwoningforfait', suffix: '%', decimals: true },
  { key: 'ewfMinWoz', label: 'Eigenwoningforfait vanaf WOZ', suffix: '€' },
  { key: 'ewfVillaThreshold', label: 'Grens villataks', suffix: '€' },
  { key: 'ewfVillaPct', label: 'Villataks boven grens', suffix: '%', decimals: true },
  { key: 'hillenPct', label: 'Wet Hillen-aftrek', suffix: '%', decimals: true },
  { key: 'transferTaxPct', label: 'Overdrachtsbelasting eigen woning', suffix: '%', decimals: true },
  { key: 'starterExemptionMaxAge', label: 'Startersvrijstelling t/m leeftijd', suffix: 'jr' },
  { key: 'starterExemptionMaxValue', label: 'Startersvrijstelling woningwaarde max.', suffix: '€' },
]

export function InstellingenPage() {
  const { data, update, replace } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const norms = data.norms

  const setNorm = <K extends keyof Norms>(k: K, v: Norms[K]) => update((d) => ({ ...d, norms: { ...d.norms, [k]: v } }))
  const setValue = <K extends NumKey>(k: K, value: number) =>
    setNorm(k, { ...norms[k], value, checked: new Date().toISOString().slice(0, 10), source: norms[k].source } as Norms[K])

  const download = () => {
    const blob = new Blob([exportJson(data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `huizenjacht-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const share = async () => {
    const file = new File([exportJson(data)], `huizenjacht-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Huizenjacht back-up' }).catch(() => {})
    else download()
  }
  const onImport = async (f: File) => {
    try {
      const d = importJson(await f.text())
      if (!confirm(`Alle huidige data vervangen door "${f.name}"? (${d.houses.length} huizen, ${d.criteria.length} criteria)`)) return
      replace(d)
      setMsg(`Geïmporteerd: ${d.houses.length} huizen, ${d.tasks.length} taken.`)
    } catch (e) {
      setMsg('Importeren mislukt: ' + (e as Error).message)
    }
  }

  return (
    <div className="stack">
      <section className="card stack">
        <h2>Back-up en delen</h2>
        <p className="small muted">
          Alle data staat alleen op dit apparaat. Maak regelmatig een back-up, of stuur het bestand naar je partner zodat die het kan
          importeren. Laatst gewijzigd: {formatDate(data.updatedAt)}.
        </p>
        <div className="actions">
          <button className="btn-secondary" onClick={download}>
            Exporteren (JSON)
          </button>
          <button className="btn-secondary" onClick={share}>
            Delen…
          </button>
        </div>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
          Importeren uit bestand
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImport(f)
            e.target.value = ''
          }}
        />
        {msg && <p className="small">{msg}</p>}
      </section>

      <section className="card stack">
        <div className="card-head">
          <h2>Jaarcijfers {norms.year}</h2>
          <span className="small muted">peildatum {formatDate(norms.checked)}</span>
        </div>
        <p className="small muted">
          Deze waarden bepalen alle berekeningen. Werk ze elk jaar bij (zie README). Een aangepaste waarde krijgt de datum van vandaag.
        </p>
        <div className="row-2">
          <Field label="Jaar">
            <NumberInput value={norms.year} grouping={false} onChange={(v) => v && setNorm('year', v)} />
          </Field>
          <Field label="Peildatum">
            <input type="date" value={norms.checked} onChange={(e) => setNorm('checked', e.target.value)} />
          </Field>
        </div>
        {NUMBER_FIELDS.map(({ key, label, suffix, decimals }) => (
          <div key={key} className="stack" style={{ gap: 4 }}>
            <Field label={label}>
              <NumberInput value={norms[key].value} decimals={decimals} suffix={suffix} onChange={(v) => v != null && setValue(key, v)} />
            </Field>
            <SourceLine s={norms[key]} />
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2>Startwaarden hypotheekrente</h2>
        <div className="row-2">
          {(['nhg10', 'nhg20', 'noNhg10', 'noNhg20'] as const).map((k) => (
            <Field key={k} label={{ nhg10: '10 jaar, met NHG', nhg20: '20 jaar, met NHG', noNhg10: '10 jaar, zonder NHG', noNhg20: '20 jaar, zonder NHG' }[k]}>
              <NumberInput
                value={norms.rates.value[k]}
                decimals
                suffix="%"
                onChange={(v) => v != null && setNorm('rates', { ...norms.rates, value: { ...norms.rates.value, [k]: v }, checked: new Date().toISOString().slice(0, 10) })}
              />
            </Field>
          ))}
        </div>
        <SourceLine s={norms.rates} />
      </section>

      <section className="card stack">
        <h2>Extra leenruimte per energielabel</h2>
        <LabelGrid
          value={norms.energyLabelExtra.value}
          onChange={(value) => setNorm('energyLabelExtra', { ...norms.energyLabelExtra, value })}
        />
        <SourceLine s={norms.energyLabelExtra} />
        <h2 style={{ marginTop: 8 }}>Max. extra voor energiebesparende maatregelen</h2>
        <LabelGrid
          value={norms.energySavingExtra.value}
          onChange={(value) => setNorm('energySavingExtra', { ...norms.energySavingExtra, value })}
        />
        <SourceLine s={norms.energySavingExtra} />
      </section>

      <TableEditor
        title="Financieringslasttabel"
        help="Eerste regel: bovengrenzen van de rentekolommen (%). Daarna per regel: toetsinkomen vanaf, gevolgd door de percentages. Scheiden met tab, puntkomma of spaties. Je kunt rijen uit de Staatscourant-tabel plakken."
        sourced={norms.financingTable}
        format={() => formatTable(norms.financingTable.value)}
        parse={(text) => parseTable(text)}
        onSave={(value: FinancingTable, verified) =>
          setNorm('financingTable', { ...norms.financingTable, value, verified, checked: new Date().toISOString().slice(0, 10) })
        }
      />

      <TableEditor
        title="Bruteringsfactoren studieschuld"
        help="Per regel: rente t/m (%) en factor."
        sourced={norms.studentDebtFactors}
        format={() => norms.studentDebtFactors.value.map(([ub, f]) => `${ub}\t${f}`).join('\n')}
        parse={(text) =>
          text
            .trim()
            .split(/\n/)
            .map((line) => {
              const [a, b] = line.trim().split(/[\t; ]+/).map((x) => Number(x.replace(',', '.')))
              if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`Ongeldige regel: "${line}"`)
              return [a, b] as [number, number]
            })
        }
        onSave={(value: [number, number][], verified) =>
          setNorm('studentDebtFactors', { ...norms.studentDebtFactors, value, verified, checked: new Date().toISOString().slice(0, 10) })
        }
      />

      <section className="card stack">
        <h2>Terugzetten</h2>
        <button
          className="btn-secondary"
          onClick={() => confirm('Alle jaarcijfers terugzetten naar de standaardwaarden van deze versie?') && update((d) => ({ ...d, norms: structuredClone(DEFAULT_NORMS) }))}
        >
          Jaarcijfers terugzetten
        </button>
        <button
          className="btn-danger"
          onClick={() => {
            if (confirm('ALLE data wissen (huizen, wensen, taken, instellingen)? Maak eerst een back-up.')) replace(defaultData())
          }}
        >
          Alles wissen
        </button>
      </section>
      <p className="small muted" style={{ textAlign: 'center' }}>
        Huizenjacht · indicatie, geen financieel advies
      </p>
    </div>
  )
}

function SourceLine({ s }: { s: Sourced<unknown> }) {
  return (
    <p className="source">
      {s.verified === false && <strong style={{ color: 'var(--danger)' }}>Niet volledig geverifieerd. </strong>}
      Bron: {s.url ? (
        <a href={s.url} target="_blank" rel="noopener noreferrer">
          {s.source}
        </a>
      ) : (
        s.source
      )}{' '}
      · gecontroleerd {formatDate(s.checked)}
      {s.note && <> · {s.note}</>}
    </p>
  )
}

function LabelGrid<T extends Record<string, number>>({ value, onChange }: { value: T; onChange: (v: T) => void }) {
  return (
    <div className="row-3">
      {Object.entries(value).map(([label, amount]) => (
        <Field key={label} label={label === 'geen' ? 'Geen label' : label}>
          <NumberInput value={amount} onChange={(v) => onChange({ ...value, [label]: v ?? 0 })} />
        </Field>
      ))}
    </div>
  )
}

function TableEditor<T>({
  title,
  help,
  sourced,
  format,
  parse,
  onSave,
}: {
  title: string
  help: string
  sourced: Sourced<T>
  format: () => string
  parse: (text: string) => T
  onSave: (v: T, verified: boolean) => void
}) {
  const [text, setText] = useState<string | null>(null)
  const [verified, setVerified] = useState(sourced.verified !== false)
  const [error, setError] = useState<string | null>(null)
  return (
    <section className="card stack">
      <h2>{title}</h2>
      <SourceLine s={sourced} />
      {text == null ? (
        <button className="btn-secondary" onClick={() => setText(format())}>
          Bekijken / bewerken
        </button>
      ) : (
        <>
          <p className="small muted">{help}</p>
          <textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }} spellCheck={false} />
          <label className="toggle">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            Gecontroleerd bij officiële bron
          </label>
          {error && <p className="warning">{error}</p>}
          <div className="actions">
            <button className="btn-secondary" onClick={() => setText(null)}>
              Annuleren
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                try {
                  onSave(parse(text), verified)
                  setText(null)
                  setError(null)
                } catch (e) {
                  setError((e as Error).message)
                }
              }}
            >
              Opslaan
            </button>
          </div>
        </>
      )}
    </section>
  )
}
