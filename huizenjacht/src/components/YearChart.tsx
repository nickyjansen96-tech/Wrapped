import { useState } from 'react'
import { euro } from '../logic/format'
import type { YearRow } from '../logic/mortgage'

const W = 340
const H = 170
const PAD = { l: 44, r: 12, t: 10, b: 22 }

/** Lijngrafiek bruto en netto maandlast per jaar, met crosshair en tooltip. */
export function YearChart({ years }: { years: YearRow[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (years.length < 2) return null
  const max = Math.max(...years.map((y) => Math.max(y.grossMonthly, y.netMonthly)))
  const lo = Math.min(...years.map((y) => Math.min(y.grossMonthly, y.netMonthly)))
  // Geen nul-basislijn: bij een lijngrafiek gaat het om het verloop.
  const min = Math.max(0, Math.floor((lo - (max - lo) * 0.15) / 100) * 100)
  const niceMax = Math.ceil((max + (max - lo) * 0.1 + 1) / 100) * 100
  const x = (i: number) => PAD.l + (i / (years.length - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - min) / (niceMax - min)) * (H - PAD.t - PAD.b)
  const path = (key: 'grossMonthly' | 'netMonthly') => years.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join('')
  const ticks = [0, 0.5, 1].map((f) => min + f * (niceMax - min))
  const h = hover != null ? years[hover] : null

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (years.length - 1))
    setHover(Math.max(0, Math.min(years.length - 1, i)))
  }

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span style={{ ['--c' as string]: 'var(--series-bruto)' }}>Bruto p/m</span>
        <span style={{ ['--c' as string]: 'var(--series-netto)' }}>Netto p/m</span>
      </div>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Bruto en netto maandlast per jaar"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ touchAction: 'pan-y' }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
            <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end">
              {Math.round(t).toLocaleString('nl-NL')}
            </text>
          </g>
        ))}
        {[0, Math.floor((years.length - 1) / 2), years.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle">
            jr {years[i].year}
          </text>
        ))}
        <path d={path('grossMonthly')} fill="none" stroke="var(--series-bruto)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path('netMonthly')} fill="none" stroke="var(--series-netto)" strokeWidth={2} strokeLinejoin="round" />
        <text x={x(0) + 4} y={y(years[0].grossMonthly) + (years[0].grossMonthly >= years[0].netMonthly ? -6 : 12)}>bruto</text>
        <text x={x(0) + 4} y={y(years[0].netMonthly) + (years[0].netMonthly > years[0].grossMonthly ? -6 : 12)}>netto</text>
        {h && hover != null && (
          <g>
            <line className="grid" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} />
            <circle cx={x(hover)} cy={y(h.grossMonthly)} r={4} fill="var(--series-bruto)" stroke="var(--surface)" strokeWidth={2} />
            <circle cx={x(hover)} cy={y(h.netMonthly)} r={4} fill="var(--series-netto)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && hover != null && (
        <div className="chart-tip" style={{ left: `${Math.min(62, Math.max(0, (x(hover) / W) * 100 - 15))}%` }}>
          <strong>Jaar {h.year}</strong>
          <div>
            <span className="sw" style={{ ['--c' as string]: 'var(--series-bruto)' }} />
            Bruto {euro(h.grossMonthly)}
          </div>
          <div>
            <span className="sw" style={{ ['--c' as string]: 'var(--series-netto)' }} />
            Netto {euro(h.netMonthly)}
          </div>
        </div>
      )}
    </div>
  )
}
