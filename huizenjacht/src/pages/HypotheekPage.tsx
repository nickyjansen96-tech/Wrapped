import { useState } from 'react'
import { Disclaimer, Field, NumberInput, Segmented } from '../components/ui'
import { YearChart } from '../components/YearChart'
import { ENERGY_LABELS, type EnergyLabel, type MortgageSettings } from '../domain/types'
import { buyerCosts, highestIncome, maxPurchasePrice, nhgAllowed } from '../logic/costs'
import { euro, formatDate, formatNumber, pct } from '../logic/format'
import { deductionRate, eigenwoningforfait, maxMortgage, monthlyCost } from '../logic/mortgage'
import { go } from '../state/router'
import { useStore } from '../state/store'

const PART_KEY = 'huizenjacht:hypotheek-deel'
const FIXED_OPTIONS = [1, 2, 5, 6, 7, 10, 12, 15, 20, 25, 30]

export function HypotheekPage() {
  const [part, setPart] = useState<'A' | 'B'>(() => {
    try {
      return localStorage.getItem(PART_KEY) === 'B' ? 'B' : 'A'
    } catch {
      return 'A'
    }
  })
  return (
    <div className="stack">
      <Segmented
        value={part}
        onChange={(p) => {
          setPart(p)
          try {
            localStorage.setItem(PART_KEY, p)
          } catch {
            /* niet erg */
          }
        }}
        options={[
          { value: 'A', label: 'A. Maximale hypotheek' },
          { value: 'B', label: 'B. Gewenste hypotheek' },
        ]}
      />
      {part === 'A' ? <MaxPart /> : <WantedPart />}
    </div>
  )
}

function useMortgage() {
  const { data, update } = useStore()
  const set = <K extends keyof MortgageSettings>(k: K, v: MortgageSettings[K]) =>
    update((d) => ({ ...d, mortgage: { ...d.mortgage, [k]: v } }))
  return { m: data.mortgage, norms: data.norms, set }
}

function RateField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { norms } = useMortgage()
  const r = norms.rates.value
  const chips: [string, number][] = [
    ['10j NHG', r.nhg10],
    ['20j NHG', r.nhg20],
    ['10j zonder', r.noNhg10],
    ['20j zonder', r.noNhg20],
  ]
  return (
    <Field
      label="Hypotheekrente"
      hint={
        <>
          Vul de actuele rente in. Startwaarden van {formatDate(norms.rates.checked)}:{' '}
          {chips.map(([l, v], i) => (
            <button key={l} type="button" className="btn-link" style={{ padding: '2px 4px' }} onClick={() => onChange(v)}>
              {l} {pct(v)}
              {i < chips.length - 1 ? ' ·' : ''}
            </button>
          ))}
        </>
      }
    >
      <NumberInput value={value} decimals onChange={(v) => v != null && onChange(v)} suffix="%" />
    </Field>
  )
}

function FixedSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Field label="Rentevaste periode">
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {FIXED_OPTIONS.map((y) => (
          <option key={y} value={y}>
            {y} jaar
          </option>
        ))}
      </select>
    </Field>
  )
}

function AgeFields() {
  const { m, set } = useMortgage()
  return (
    <div className="row-2">
      <Field label="Leeftijd koper 1" hint="Bij overdracht">
        <NumberInput value={m.ageBuyer1} onChange={(v) => set('ageBuyer1', v)} suffix="jr" />
      </Field>
      <Field label="Leeftijd koper 2">
        <NumberInput value={m.ageBuyer2} onChange={(v) => set('ageBuyer2', v)} suffix="jr" />
      </Field>
    </div>
  )
}

function UnverifiedNotice() {
  const { norms } = useMortgage()
  if (norms.financingTable.verified !== false) return null
  return (
    <p className="warning" style={{ background: 'var(--warn-soft)', color: 'inherit' }}>
      ⚠ De financieringslasttabel {norms.year} is nog niet volledig gecontroleerd bij de officiële bron. De maximale hypotheek is
      daardoor minder zeker.{' '}
      <button type="button" className="btn-link" onClick={() => go('instellingen')}>
        Details
      </button>
    </p>
  )
}

// ---------------- A. Maximale hypotheek ----------------

function MaxPart() {
  const { m, norms, set } = useMortgage()
  const result = maxMortgage(
    {
      income1: m.income1,
      income2: m.income2,
      studentDebtMonthly: m.studentDebtMonthly,
      otherLoansMonthly: m.otherLoansMonthly,
      energyLabel: m.maxEnergyLabel,
      energySavingCosts: m.energySavingCosts,
      ratePct: m.maxRate,
      fixedYears: m.maxFixedYears,
      termYears: m.termYears,
    },
    norms,
  )
  const hasIncome = (m.income1 ?? 0) + (m.income2 ?? 0) > 0
  const purchase = hasIncome ? maxPurchasePrice(result, m, norms) : null
  const nhgMax = Math.min(result.maxMortgage, norms.nhgLimit.value)

  return (
    <>
      <section className="card stack">
        <h2>Jullie gegevens</h2>
        <div className="row-2">
          <Field label="Bruto jaarinkomen 1" hint="Incl. vakantiegeld en vaste 13e maand">
            <NumberInput value={m.income1} onChange={(v) => set('income1', v)} suffix="€" />
          </Field>
          <Field label="Bruto jaarinkomen 2">
            <NumberInput value={m.income2} onChange={(v) => set('income2', v)} suffix="€" />
          </Field>
          <Field label="Eigen geld" hint="Spaargeld, schenking">
            <NumberInput value={m.ownFunds} onChange={(v) => set('ownFunds', v)} suffix="€" />
          </Field>
          <Field label="Studieschuld p/m" hint="Maandbedrag DUO (samen)">
            <NumberInput value={m.studentDebtMonthly} onChange={(v) => set('studentDebtMonthly', v)} suffix="€" />
          </Field>
          <Field label="Andere leningen p/m" hint="Doorlopend krediet: 2% van de limiet">
            <NumberInput value={m.otherLoansMonthly} onChange={(v) => set('otherLoansMonthly', v)} suffix="€" />
          </Field>
          <Field label="Energielabel woning">
            <select value={m.maxEnergyLabel ?? ''} onChange={(e) => set('maxEnergyLabel', (e.target.value || null) as EnergyLabel | null)}>
              <option value="">Onbekend / geen</option>
              {ENERGY_LABELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Kosten energiebesparende maatregelen (optioneel)" hint="Bijv. isolatie, warmtepomp, zonnepanelen die je meefinanciert">
          <NumberInput value={m.energySavingCosts} onChange={(v) => set('energySavingCosts', v)} suffix="€" />
        </Field>
        <RateField value={m.maxRate} onChange={(v) => set('maxRate', v)} />
        <div className="row-2">
          <FixedSelect value={m.maxFixedYears} onChange={(v) => set('maxFixedYears', v)} />
          <Field label="Looptijd">
            <NumberInput value={m.termYears} onChange={(v) => set('termYears', v ?? 30)} suffix="jaar" />
          </Field>
        </div>
        <AgeFields />
      </section>

      <section className="card stack">
        <div className="small muted">Maximale hypotheek</div>
        <div className="big-number">{hasIncome ? euro(result.maxMortgage) : '–'}</div>
        {purchase && (
          <div className="kv">
            <span>Maximale koopsom (incl. eigen geld)</span>
            <span>
              <strong>{euro(purchase.price)}</strong>
            </span>
            <span className="small muted">waarvan hypotheek / kosten koper</span>
            <span className="small muted">
              {euro(purchase.loan)} / {euro(purchase.costs.total)}
            </span>
          </div>
        )}
        {hasIncome && (
          <p className={result.maxMortgage <= norms.nhgLimit.value ? 'chip chip-ok' : 'chip chip-warn'} style={{ alignSelf: 'flex-start' }}>
            {result.maxMortgage <= norms.nhgLimit.value
              ? `NHG mogelijk (hypotheek ≤ ${euro(norms.nhgLimit.value)})`
              : `NHG mogelijk tot ${euro(nhgMax)} hypotheek; daarboven niet`}
          </p>
        )}
        <UnverifiedNotice />
        {result.outsideTable && hasIncome && (
          <p className="warning">
            Toetsinkomen of toetsrente valt buiten het bereik van de ingevoerde financieringslasttabel; de dichtstbijzijnde waarde is
            gebruikt.
          </p>
        )}
        {hasIncome && (
          <details>
            <summary>Zo is het berekend</summary>
            <div className="kv small" style={{ marginTop: 8 }}>
              <span>Toetsinkomen{m.income2 ? ' (beide inkomens volledig)' : ''}</span>
              <span>{euro(result.toetsinkomen)}</span>
              <span>Toetsrente{result.usedTestRate ? ` (rentevast < ${norms.testRateMinFixedYears.value} jaar)` : ''}</span>
              <span>{pct(result.toetsrente)}</span>
              <span>Financieringslastpercentage</span>
              <span>{pct(result.financingPct, 1)}</span>
              <span>Max. woonlast p/m</span>
              <span>{euro(result.maxHousingMonthly)}</span>
              {result.studentDebtCharge > 0 && (
                <>
                  <span>− Studieschuld × {result.studentDebtFactor.toLocaleString('nl-NL')}</span>
                  <span>{euro(result.studentDebtCharge)}</span>
                </>
              )}
              {result.otherLoansCharge > 0 && (
                <>
                  <span>− Andere leningen</span>
                  <span>{euro(result.otherLoansCharge)}</span>
                </>
              )}
              <span>Beschikbaar voor hypotheek p/m</span>
              <span>{euro(result.availableMonthly)}</span>
              <span>Leenruimte (annuïtair, {result.termMonths / 12} jaar)</span>
              <span>{euro(result.incomeBased)}</span>
              <span>+ Energielabel {m.maxEnergyLabel ?? '–'}</span>
              <span>{euro(result.energyLabelExtra)}</span>
              {result.energySavingExtra > 0 && (
                <>
                  <span>+ Energiebesparende maatregelen</span>
                  <span>{euro(result.energySavingExtra)}</span>
                </>
              )}
              <span className="total">Maximale hypotheek</span>
              <span className="total">{euro(result.maxMortgage)}</span>
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>
              Daarnaast geldt: hypotheek max. {norms.maxLtv.value}% van de woningwaarde, dus kosten koper betaal je uit eigen geld. Bij de
              maximale koopsom is daar rekening mee gehouden.
            </p>
          </details>
        )}
        <Disclaimer />
      </section>
    </>
  )
}

// ---------------- B. Gewenste hypotheek ----------------

function WantedPart() {
  const { m, norms, set } = useMortgage()
  const loan = m.loanAmount ?? 0
  const price = m.purchasePrice ?? 0
  const woz = m.wozValue ?? price
  const taxRate = deductionRate(highestIncome(m), norms)
  const cost = loan > 0 ? monthlyCost(loan, m.rate, m.termYears, m.form, woz, taxRate, norms) : null
  const costs = price > 0 ? buyerCosts(price, loan, m, norms) : null
  const ownNeeded = costs ? price + costs.total - loan : 0
  const ewf = eigenwoningforfait(woz, norms)
  const [showAll, setShowAll] = useState(false)

  return (
    <>
      <section className="card stack">
        <h2>Jullie keuze</h2>
        <div className="row-2">
          <Field label="Hypotheekbedrag">
            <NumberInput value={m.loanAmount} onChange={(v) => set('loanAmount', v)} suffix="€" />
          </Field>
          <Field label="Koopsom">
            <NumberInput value={m.purchasePrice} onChange={(v) => set('purchasePrice', v)} suffix="€" />
          </Field>
        </div>
        {price > 0 && costs && (
          <button
            type="button"
            className="btn-link"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => set('loanAmount', Math.max(0, Math.min(price, Math.round(price + costs.total - (m.ownFunds ?? 0)))))}
          >
            Hypotheek berekenen uit koopsom − eigen geld ({euro(m.ownFunds ?? 0)})
          </button>
        )}
        <div className="row-2">
          <Field label="WOZ-waarde" hint="Leeg = koopsom">
            <NumberInput value={m.wozValue} onChange={(v) => set('wozValue', v)} suffix="€" />
          </Field>
          <Field label="Looptijd">
            <NumberInput value={m.termYears} onChange={(v) => set('termYears', v ?? 30)} suffix="jaar" />
          </Field>
        </div>
        <Field label="Hypotheekvorm">
          <Segmented
            value={m.form}
            onChange={(v) => set('form', v)}
            options={[
              { value: 'annuitair', label: 'Annuïtair' },
              { value: 'lineair', label: 'Lineair' },
            ]}
          />
        </Field>
        <RateField value={m.rate} onChange={(v) => set('rate', v)} />
        <div className="row-2">
          <FixedSelect value={m.fixedYears} onChange={(v) => set('fixedYears', v)} />
          <Field label="Met NHG">
            <Segmented
              value={m.withNhg ? 'ja' : 'nee'}
              onChange={(v) => set('withNhg', v === 'ja')}
              options={[
                { value: 'ja', label: 'Ja' },
                { value: 'nee', label: 'Nee' },
              ]}
            />
          </Field>
        </div>
        <div className="row-2">
          <Field label="Bruto jaarinkomen 1" hint="Voor het aftrektarief">
            <NumberInput value={m.income1} onChange={(v) => set('income1', v)} suffix="€" />
          </Field>
          <Field label="Bruto jaarinkomen 2">
            <NumberInput value={m.income2} onChange={(v) => set('income2', v)} suffix="€" />
          </Field>
        </div>
        <AgeFields />
      </section>

      {cost && (
        <section className="card stack">
          <h2>Maandlasten</h2>
          <div className="row-2">
            <div>
              <div className="small muted">Bruto (1e maand)</div>
              <div className="big-number">{euro(cost.grossFirstMonth)}</div>
            </div>
            <div>
              <div className="small muted">Netto (gem. 1e jaar)</div>
              <div className="big-number">{euro(cost.netFirstYear)}</div>
            </div>
          </div>
          <div className="kv small">
            <span>Rente 1e maand</span>
            <span>{euro(cost.interestFirstMonth, true)}</span>
            <span>Aflossing 1e maand</span>
            <span>{euro(cost.repaymentFirstMonth, true)}</span>
            <span>Eigenwoningforfait ({pct(norms.ewfPct.value)} van {euro(woz)})</span>
            <span>{euro(ewf)} /jr</span>
            <span>Aftrektarief</span>
            <span>{pct(taxRate)}</span>
            <span>Belastingvoordeel 1e jaar</span>
            <span>{euro(cost.years[0].taxEffectYear)} /jr</span>
            {m.withNhg && !nhgAllowed(loan, norms) && (
              <>
                <span className="status-nee">NHG niet mogelijk</span>
                <span className="status-nee">&gt; {euro(norms.nhgLimit.value)}</span>
              </>
            )}
            {price > 0 && loan > price * (norms.maxLtv.value / 100) && (
              <>
                <span className="status-nee">Hypotheek &gt; {norms.maxLtv.value}% koopsom</span>
                <span className="status-nee">niet toegestaan</span>
              </>
            )}
          </div>
          <p className="small muted">
            Netto = bruto − (rente − eigenwoningforfait) × aftrektarief. Gerekend met de belastingregels van {norms.year} voor de hele
            looptijd; de werkelijke tarieven veranderen per jaar.{' '}
            {m.fixedYears < m.termYears && `Na ${m.fixedYears} jaar wordt de rente opnieuw vastgesteld; hier is dezelfde rente aangehouden.`}
          </p>
        </section>
      )}

      {cost && (
        <section className="card stack">
          <h2>Verloop per jaar</h2>
          <YearChart years={cost.years} />
          <p className="small muted">Bruto en netto: gemiddeld per maand in dat jaar. Bedragen in euro's.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Jaar</th>
                  <th>Bruto</th>
                  <th>Netto</th>
                  <th>Rente/jr</th>
                  <th>Aflos/jr</th>
                  <th>Schuld ×1000</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? cost.years : cost.years.filter((y) => y.year <= 5 || y.year % 5 === 0)).map((y) => (
                  <tr key={y.year}>
                    <td>{y.year}</td>
                    <td>{formatNumber(y.grossMonthly)}</td>
                    <td>{formatNumber(y.netMonthly)}</td>
                    <td>{formatNumber(y.interest)}</td>
                    <td>{formatNumber(y.repayment)}</td>
                    <td>{formatNumber(y.balanceEnd / 1000)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn-link" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Minder jaren tonen' : 'Alle jaren tonen'}
          </button>
        </section>
      )}

      {costs && (
        <section className="card stack">
          <h2>Eenmalige kosten koper</h2>
          <div className="kv small">
            {costs.lines.map((l) => (
              <CostRow key={l.label} label={l.label} amount={l.amount} note={l.note} />
            ))}
            <span className="total">Totaal kosten koper</span>
            <span className="total">{euro(costs.total)}</span>
            <span>Benodigd eigen geld (koopsom + kosten − hypotheek)</span>
            <span>
              <strong>{euro(Math.max(0, ownNeeded))}</strong>
            </span>
          </div>
          {m.ownFunds != null && ownNeeded > m.ownFunds + 1 && (
            <p className="warning">Jullie eigen geld ({euro(m.ownFunds)}) is {euro(ownNeeded - m.ownFunds)} te weinig.</p>
          )}
          <CostEditor />
        </section>
      )}
      <Disclaimer />
    </>
  )
}

function CostRow({ label, amount, note }: { label: string; amount: number; note?: string }) {
  return (
    <>
      <span>
        {label}
        {note && <span className="muted"> · {note}</span>}
      </span>
      <span>{euro(amount)}</span>
    </>
  )
}

function CostEditor() {
  const { m, set } = useMortgage()
  const fields: [keyof MortgageSettings, string][] = [
    ['costNotary', 'Notaris'],
    ['costValuation', 'Taxatie'],
    ['costAdvice', 'Advies/bemiddeling'],
    ['costInspection', 'Bouwkundige keuring'],
    ['costBuyingAgent', 'Aankoopmakelaar'],
    ['costBankGuarantee', 'Bankgarantie'],
    ['costOther', 'Overig'],
  ]
  return (
    <details>
      <summary>Bedragen aanpassen</summary>
      <p className="small muted" style={{ margin: '6px 0' }}>
        Dit zijn schattingen; vul offertes in zodra je die hebt. Overdrachtsbelasting en NHG-provisie worden berekend.
      </p>
      <div className="row-2">
        {fields.map(([k, label]) => (
          <Field key={k} label={label}>
            <NumberInput value={m[k] as number} onChange={(v) => set(k, (v ?? 0) as never)} suffix="€" />
          </Field>
        ))}
      </div>
    </details>
  )
}
