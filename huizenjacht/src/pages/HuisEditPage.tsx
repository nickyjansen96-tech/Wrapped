import { useState } from 'react'
import { Field, NumberInput, Segmented } from '../components/ui'
import { ENERGY_LABELS, HOUSE_TYPES, type BidStatus, type EnergyLabel, type House, type HouseType, type ViewingStatus } from '../domain/types'
import { go } from '../state/router'
import { newId, useStore } from '../state/store'

function emptyHouse(): House {
  return {
    id: newId('h'),
    address: '',
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
    viewing: { status: 'nee' },
    bid: { status: 'nee' },
    ratings: {},
    addedAt: new Date().toISOString(),
  }
}

const today = () => new Date().toISOString().slice(0, 10)

export function HuisEditPage({ id }: { id?: string }) {
  const { data, update } = useStore()
  const existing = id ? data.houses.find((h) => h.id === id) : undefined
  const [h, setH] = useState<House>(() => existing ?? emptyHouse())
  if (id && !existing) return <p>Huis niet gevonden.</p>

  const set = <K extends keyof House>(k: K, v: House[K]) => setH((x) => ({ ...x, [k]: v }))

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    let url = h.url.trim()
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url
    const house = { ...h, address: h.address.trim(), url }
    update((d) => ({
      ...d,
      houses: existing ? d.houses.map((x) => (x.id === house.id ? house : x)) : [...d.houses, house],
    }))
    go(`huizen/${house.id}`)
  }

  const v = h.viewing
  const b = h.bid
  const bidAmount = b.status === 'nee' ? null : (b.amount ?? null)
  const bidDate = b.status === 'nee' ? '' : (b.date ?? '')

  return (
    <form className="stack" onSubmit={save}>
      <section className="card stack">
        <Field label="Adres">
          <input value={h.address} onChange={(e) => set('address', e.target.value)} placeholder="Straat 1, Plaats" required autoFocus={!existing} />
        </Field>
        <Field label="Link naar advertentie">
          <input type="url" inputMode="url" value={h.url} onChange={(e) => set('url', e.target.value)} placeholder="https://www.funda.nl/…" />
        </Field>
        <div className="row-2">
          <Field label="Vraagprijs">
            <NumberInput value={h.price} onChange={(x) => set('price', x)} suffix="€" />
          </Field>
          <Field label="Woonoppervlak">
            <NumberInput value={h.area} onChange={(x) => set('area', x)} suffix="m²" />
          </Field>
          <Field label="Slaapkamers">
            <NumberInput value={h.bedrooms} onChange={(x) => set('bedrooms', x)} />
          </Field>
          <Field label="Energielabel">
            <select value={h.energyLabel ?? ''} onChange={(e) => set('energyLabel', (e.target.value || null) as EnergyLabel | null)}>
              <option value="">Onbekend</option>
              {ENERGY_LABELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Woningtype">
            <select value={h.houseType ?? ''} onChange={(e) => set('houseType', (e.target.value || null) as HouseType | null)}>
              <option value="">Onbekend</option>
              {HOUSE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Bouwjaar">
            <NumberInput value={h.buildYear} onChange={(x) => set('buildYear', x)} />
          </Field>
          <Field label="VvE-bijdrage p/m">
            <NumberInput value={h.vveFee} onChange={(x) => set('vveFee', x)} suffix="€" />
          </Field>
          <Field label="WOZ-waarde" hint="Optioneel, anders vraagprijs">
            <NumberInput value={h.wozValue} onChange={(x) => set('wozValue', x)} suffix="€" />
          </Field>
        </div>
        <Field label="Omschrijving / notities">
          <textarea rows={4} value={h.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Indruk, plus- en minpunten, vragen voor de makelaar…" />
        </Field>
      </section>

      <section className="card stack">
        <h2>Bezichtiging</h2>
        <Segmented<ViewingStatus['status']>
          value={v.status}
          onChange={(status) =>
            set(
              'viewing',
              status === 'nee'
                ? { status }
                : status === 'gepland'
                  ? { status, date: v.status !== 'nee' && v.date ? v.date : today() }
                  : { status, date: v.status !== 'nee' ? v.date : undefined },
            )
          }
          options={[
            { value: 'nee', label: 'Nee' },
            { value: 'gepland', label: 'Gepland' },
            { value: 'geweest', label: 'Geweest' },
          ]}
        />
        {v.status !== 'nee' && (
          <Field label={v.status === 'gepland' ? 'Datum bezichtiging' : 'Datum (optioneel)'}>
            <input
              type="date"
              value={v.date ?? ''}
              required={v.status === 'gepland'}
              onChange={(e) => set('viewing', { ...v, date: e.target.value } as ViewingStatus)}
            />
          </Field>
        )}
      </section>

      <section className="card stack">
        <h2>Bod</h2>
        <Segmented<BidStatus['status']>
          small
          value={b.status}
          onChange={(status) =>
            set('bid', status === 'nee' ? { status } : ({ status, amount: bidAmount ?? h.price, date: bidDate || today() } as BidStatus))
          }
          options={[
            { value: 'nee', label: 'Nee' },
            { value: 'uitgebracht', label: 'Uitgebracht' },
            { value: 'geaccepteerd', label: 'Geaccepteerd' },
            { value: 'afgewezen', label: 'Afgewezen' },
          ]}
        />
        {b.status !== 'nee' && (
          <div className="row-2">
            <Field label="Bedrag bod">
              <NumberInput value={bidAmount} onChange={(amount) => set('bid', { ...b, amount } as BidStatus)} suffix="€" />
            </Field>
            <Field label="Datum bod">
              <input type="date" value={bidDate} onChange={(e) => set('bid', { ...b, date: e.target.value } as BidStatus)} />
            </Field>
          </div>
        )}
      </section>

      <div className="actions">
        {existing && (
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              if (!confirm(`"${existing.address}" verwijderen?`)) return
              update((d) => ({ ...d, houses: d.houses.filter((x) => x.id !== existing.id) }))
              go('huizen')
            }}
          >
            Verwijderen
          </button>
        )}
        <button type="submit" className="btn-primary">
          Opslaan
        </button>
      </div>
    </form>
  )
}
