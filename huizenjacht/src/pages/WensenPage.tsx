import { useState } from 'react'
import { Field, NumberInput, Segmented, Sheet } from '../components/ui'
import {
  CATEGORIES,
  ENERGY_LABELS,
  HOUSE_TYPES,
  type AutoRule,
  type CategoryId,
  type Criterion,
  type EnergyLabel,
  type NumericField,
} from '../domain/types'
import { defaultCriteria } from '../data/defaultCriteria'
import { describeRule } from '../logic/score'
import { newId, useStore } from '../state/store'

export function WensenPage() {
  const { data, update } = useStore()
  const [editing, setEditing] = useState<Criterion | null>(null)

  const setCriterion = (c: Criterion) =>
    update((d) => ({
      ...d,
      criteria: d.criteria.some((x) => x.id === c.id) ? d.criteria.map((x) => (x.id === c.id ? c : x)) : [...d.criteria, c],
    }))

  const active = data.criteria.filter((c) => c.active)

  return (
    <div className="stack">
      <p className="muted small">
        {active.length} actieve criteria, waarvan {active.filter((c) => c.type === 'eis').length} harde eisen. Tik op een
        criterium om het aan te passen. Wijzigingen werken direct door in de scores van alle huizen.
      </p>

      {CATEGORIES.map((cat) => {
        const items = data.criteria.filter((c) => c.category === cat.id)
        return (
          <section key={cat.id} className="card">
            <div className="card-head">
              <h2>{cat.label}</h2>
              <button
                className="btn-link"
                onClick={() =>
                  setEditing({ id: newId('c'), name: '', category: cat.id, active: true, type: 'wens', weight: 3 })
                }
              >
                + Toevoegen
              </button>
            </div>
            {items.length === 0 && <p className="muted small">Nog geen criteria.</p>}
            <ul className="list">
              {items.map((c) => (
                <li key={c.id} className={'row' + (c.active ? '' : ' inactive')}>
                  <input
                    type="checkbox"
                    className="check"
                    checked={c.active}
                    aria-label={`${c.name} actief`}
                    onChange={(e) => setCriterion({ ...c, active: e.target.checked })}
                  />
                  <button className="row-main" onClick={() => setEditing(c)}>
                    <span className="row-title">{c.name}</span>
                    <span className="row-sub">
                      <span className={'chip ' + (c.type === 'eis' ? 'chip-eis' : 'chip-wens')}>
                        {c.type === 'eis' ? 'Eis' : 'Wens'}
                      </span>
                      <Weight value={c.weight} />
                      {c.auto && <span className="muted">· {describeRule(c.auto)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <button
        className="btn-secondary"
        onClick={() => {
          if (confirm('Alle criteria terugzetten naar de startset? Eigen criteria en aanpassingen gaan verloren.'))
            update((d) => ({ ...d, criteria: defaultCriteria() }))
        }}
      >
        Startset herstellen
      </button>

      {editing && (
        <CriterionSheet
          criterion={editing}
          isNew={!data.criteria.some((c) => c.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            setCriterion(c)
            setEditing(null)
          }}
          onDelete={() => {
            update((d) => ({ ...d, criteria: d.criteria.filter((x) => x.id !== editing.id) }))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

export function Weight({ value }: { value: number }) {
  return (
    <span className="weight" aria-label={`gewicht ${value} van 5`} title={`Gewicht ${value}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= value ? 'dot on' : 'dot'} />
      ))}
    </span>
  )
}

type AutoKind = 'geen' | 'number' | 'energyLabel' | 'houseType'

const NUMERIC_FIELDS: { value: NumericField; label: string; op: 'min' | 'max'; suffix: string }[] = [
  { value: 'price', label: 'Vraagprijs (max.)', op: 'max', suffix: '€' },
  { value: 'area', label: 'Woonoppervlak (min.)', op: 'min', suffix: 'm²' },
  { value: 'bedrooms', label: 'Slaapkamers (min.)', op: 'min', suffix: '' },
  { value: 'buildYear', label: 'Bouwjaar (vanaf)', op: 'min', suffix: '' },
  { value: 'vveFee', label: 'VvE-bijdrage p/m (max.)', op: 'max', suffix: '€' },
]

function CriterionSheet({
  criterion,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  criterion: Criterion
  isNew: boolean
  onClose: () => void
  onSave: (c: Criterion) => void
  onDelete: () => void
}) {
  const [c, setC] = useState<Criterion>(criterion)
  const kind: AutoKind = c.auto?.kind ?? 'geen'
  const setAuto = (auto: AutoRule | undefined) => setC({ ...c, auto })

  return (
    <Sheet title={isNew ? 'Criterium toevoegen' : 'Criterium aanpassen'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (!c.name.trim()) return
          onSave({ ...c, name: c.name.trim() })
        }}
      >
        <Field label="Naam">
          <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} autoFocus={isNew} required />
        </Field>
        <Field label="Categorie">
          <select value={c.category} onChange={(e) => setC({ ...c, category: e.target.value as CategoryId })}>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Soort" hint="Een harde eis geeft een waarschuwing als een huis er niet aan voldoet.">
          <Segmented
            value={c.type}
            onChange={(type) => setC({ ...c, type })}
            options={[
              { value: 'eis', label: 'Harde eis' },
              { value: 'wens', label: 'Wens' },
            ]}
          />
        </Field>
        <Field label={`Gewicht: ${c.weight}`} hint="1 = weinig belangrijk, 5 = heel belangrijk">
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={c.weight}
            onChange={(e) => setC({ ...c, weight: Number(e.target.value) })}
          />
        </Field>
        <label className="toggle">
          <input type="checkbox" checked={c.active} onChange={(e) => setC({ ...c, active: e.target.checked })} />
          Actief (telt mee in de score)
        </label>

        <Field label="Automatisch beoordelen" hint="Op basis van de gegevens die je bij een huis invult.">
          <select
            value={kind}
            onChange={(e) => {
              const k = e.target.value as AutoKind
              if (k === 'geen') setAuto(undefined)
              else if (k === 'number') setAuto({ kind: 'number', field: 'price', op: 'max', threshold: null })
              else if (k === 'energyLabel') setAuto({ kind: 'energyLabel', minLabel: 'C' })
              else setAuto({ kind: 'houseType', allowed: [] })
            }}
          >
            <option value="geen">Nee, zelf beoordelen per huis</option>
            <option value="number">Ja, op een getal (drempelwaarde)</option>
            <option value="energyLabel">Ja, op energielabel</option>
            <option value="houseType">Ja, op woningtype</option>
          </select>
        </Field>

        {c.auto?.kind === 'number' && (
          <div className="row-2">
            <Field label="Gegeven">
              <select
                value={c.auto.field}
                onChange={(e) => {
                  const f = NUMERIC_FIELDS.find((x) => x.value === e.target.value)!
                  setAuto({ kind: 'number', field: f.value, op: f.op, threshold: c.auto?.kind === 'number' ? c.auto.threshold : null })
                }}
              >
                {NUMERIC_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Drempelwaarde">
              <NumberInput
                value={c.auto.threshold}
                suffix={NUMERIC_FIELDS.find((f) => f.value === (c.auto?.kind === 'number' ? c.auto.field : ''))?.suffix}
                onChange={(threshold) => c.auto?.kind === 'number' && setAuto({ ...c.auto, threshold })}
              />
            </Field>
          </div>
        )}
        {c.auto?.kind === 'energyLabel' && (
          <Field label="Minimaal label">
            <select value={c.auto.minLabel} onChange={(e) => setAuto({ kind: 'energyLabel', minLabel: e.target.value as EnergyLabel })}>
              {ENERGY_LABELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
        )}
        {c.auto?.kind === 'houseType' && (
          <fieldset className="field">
            <legend className="field-label">Gewenste woningtypes</legend>
            {HOUSE_TYPES.map((t) => {
              const allowed = c.auto?.kind === 'houseType' ? c.auto.allowed : []
              return (
                <label key={t} className="toggle">
                  <input
                    type="checkbox"
                    checked={allowed.includes(t)}
                    onChange={(e) =>
                      setAuto({
                        kind: 'houseType',
                        allowed: e.target.checked ? [...allowed, t] : allowed.filter((x) => x !== t),
                      })
                    }
                  />
                  {t}
                </label>
              )
            })}
          </fieldset>
        )}

        <Field label="Notitie">
          <textarea rows={2} value={c.note ?? ''} onChange={(e) => setC({ ...c, note: e.target.value })} />
        </Field>

        <div className="actions">
          {!isNew && (
            <button
              type="button"
              className="btn-danger"
              onClick={() => confirm(`"${c.name}" verwijderen?`) && onDelete()}
            >
              Verwijderen
            </button>
          )}
          <button type="submit" className="btn-primary">
            Opslaan
          </button>
        </div>
      </form>
    </Sheet>
  )
}
