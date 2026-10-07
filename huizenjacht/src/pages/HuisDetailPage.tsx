import { CATEGORIES, type Rating } from '../domain/types'
import { Disclaimer } from '../components/ui'
import { houseMonthly } from '../logic/costs'
import { euro, formatDate } from '../logic/format'
import { scoreHouse } from '../logic/score'
import { go } from '../state/router'
import { useStore } from '../state/store'
import { ScoreCircle, StatusChips } from './HuizenPage'
import { Weight } from './WensenPage'

const RATING_LABEL: Record<Rating, string> = { ja: 'Voldoet', nee: 'Voldoet niet', onbekend: 'Weet nog niet' }

export function HuisDetailPage({ id }: { id: string }) {
  const { data, update } = useStore()
  const house = data.houses.find((h) => h.id === id)
  if (!house) return <p>Huis niet gevonden.</p>

  const score = scoreHouse(house, data.criteria)
  const monthly = houseMonthly(house, data.mortgage, data.norms)
  const m = data.mortgage

  const setRating = (criterionId: string, rating: Rating) =>
    update((d) => ({
      ...d,
      houses: d.houses.map((h) => (h.id === id ? { ...h, ratings: { ...h.ratings, [criterionId]: rating } } : h)),
    }))

  return (
    <div className="stack">
      <section className="card stack">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <ScoreCircle score={score} large />
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            <h2 style={{ fontSize: '1.15rem' }}>{house.address}</h2>
            <span className="small muted">
              {score.assessed} van {score.total} criteria beoordeeld
              {score.percentage != null && ` · ${score.weightMet} van ${score.weightAssessed} gewichtspunten`}
            </span>
            {house.url && (
              <a href={house.url} target="_blank" rel="noopener noreferrer" className="small">
                Bekijk advertentie ↗
              </a>
            )}
          </div>
        </div>
        {score.failedRequirements.length > 0 && (
          <div className="warning">⚠ Voldoet niet aan eis: {score.failedRequirements.map((c) => c.name).join(', ')}</div>
        )}
        <div className="kv">
          <span>Vraagprijs</span>
          <span>{euro(house.price)}</span>
          <span>Woonoppervlak</span>
          <span>{house.area != null ? `${house.area} m²` : '–'}</span>
          <span>Slaapkamers</span>
          <span>{house.bedrooms ?? '–'}</span>
          <span>Energielabel</span>
          <span>{house.energyLabel ?? '–'}</span>
          {house.houseType && (
            <>
              <span>Woningtype</span>
              <span>{house.houseType}</span>
            </>
          )}
          {house.buildYear != null && (
            <>
              <span>Bouwjaar</span>
              <span>{house.buildYear}</span>
            </>
          )}
          {house.vveFee != null && (
            <>
              <span>VvE-bijdrage</span>
              <span>{euro(house.vveFee)} p/m</span>
            </>
          )}
          <span>Toegevoegd</span>
          <span>{formatDate(house.addedAt)}</span>
        </div>
        <div className="row-sub">
          <StatusChips house={house} />
          {house.viewing.status === 'nee' && <span className="chip">Nog geen bezichtiging</span>}
        </div>
        {house.notes && <p style={{ whiteSpace: 'pre-wrap' }}>{house.notes}</p>}
        <button className="btn-secondary" onClick={() => go(`huizen/${id}/bewerken`)}>
          Gegevens en status bewerken
        </button>
      </section>

      {monthly && (
        <section className="card stack">
          <h2>Verwachte maandlast</h2>
          <div className="row-2">
            <div>
              <div className="small muted">Bruto (1e maand)</div>
              <div className="big-number">{euro(monthly.grossFirstMonth)}</div>
            </div>
            <div>
              <div className="small muted">Netto (gem. 1e jaar)</div>
              <div className="big-number">{euro(monthly.netFirstYear)}</div>
            </div>
          </div>
          <div className="kv small">
            <span>Hypotheek</span>
            <span>{euro(monthly.loan)}</span>
            <span>Rente / aflossing 1e maand</span>
            <span>
              {euro(monthly.interestFirstMonth)} / {euro(monthly.repaymentFirstMonth)}
            </span>
            <span>Kosten koper</span>
            <span>{euro(monthly.costs.total)}</span>
            {house.vveFee != null && (
              <>
                <span>+ VvE-bijdrage (niet in maandlast)</span>
                <span>{euro(house.vveFee)}</span>
              </>
            )}
          </div>
          <p className="small muted">
            Op basis van {house.bid.status !== 'nee' && house.bid.amount ? 'jullie bod' : 'de vraagprijs'}, {m.form === 'annuitair' ? 'annuïtair' : 'lineair'},{' '}
            {m.rate.toLocaleString('nl-NL')}% rente, {m.termYears} jaar en {euro(m.ownFunds ?? 0)} eigen geld (instellingen in de tab
            Hypotheek, onderdeel B).
          </p>
          {monthly.shortfall > 0 && (
            <p className="warning">Eigen geld is € {Math.round(monthly.shortfall).toLocaleString('nl-NL')} te kort voor de kosten koper.</p>
          )}
          <Disclaimer />
        </section>
      )}

      <section className="stack">
        <h2>Beoordeling per criterium</h2>
        <p className="small muted">
          Criteria met een drempelwaarde worden automatisch beoordeeld als het gegeven bij het huis is ingevuld. De rest beoordeel je
          zelf. "Weet nog niet" telt niet mee in het percentage.
        </p>
        {CATEGORIES.map((cat) => {
          const results = score.results.filter((r) => r.criterion.category === cat.id)
          if (!results.length) return null
          return (
            <div key={cat.id} className="card">
              <h3 style={{ marginBottom: 4 }}>{cat.label}</h3>
              <ul className="list">
                {results.map((r) => (
                  <li key={r.criterion.id} className="row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 8 }}>
                      <span className="row-title">
                        {r.criterion.name}{' '}
                        <span className={'chip ' + (r.criterion.type === 'eis' ? 'chip-eis' : 'chip-wens')}>
                          {r.criterion.type === 'eis' ? 'Eis' : 'Wens'}
                        </span>
                      </span>
                      <Weight value={r.criterion.weight} />
                    </div>
                    {r.source === 'auto' ? (
                      <span className="small">
                        <span className={`status-${r.rating}`}>{RATING_LABEL[r.rating]}</span>{' '}
                        <span className="muted">· automatisch: {r.reason}</span>
                      </span>
                    ) : (
                      <>
                        <div className="rating-btns" role="radiogroup" aria-label={r.criterion.name}>
                          {(['ja', 'nee', 'onbekend'] as Rating[]).map((x) => (
                            <button
                              key={x}
                              role="radio"
                              aria-checked={r.rating === x}
                              className={(r.rating === x ? 'on ' : '') + x}
                              onClick={() => setRating(r.criterion.id, x)}
                            >
                              {RATING_LABEL[x]}
                            </button>
                          ))}
                        </div>
                        {r.criterion.auto && <span className="small muted">{r.reason}</span>}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>
    </div>
  )
}
