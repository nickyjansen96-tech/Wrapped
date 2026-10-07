import { useEffect, useState, type ReactNode } from 'react'
import { parseDutchNumber } from '../logic/format'

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

/** Getalinvoer die Nederlandse notatie accepteert; leeg = null. */
export function NumberInput({
  value,
  onChange,
  placeholder,
  suffix,
  decimals = false,
}: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  placeholder?: string
  suffix?: string
  decimals?: boolean
}) {
  const toText = (v: number | null | undefined) =>
    v == null ? '' : v.toLocaleString('nl-NL', { maximumFractionDigits: decimals ? 3 : 0, useGrouping: !decimals && Math.abs(v) >= 10000 })
  const [text, setText] = useState(toText(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(toText(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused])
  return (
    <span className="input-wrap">
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseDutchNumber(e.target.value))
        }}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  small,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  small?: boolean
}) {
  return (
    <div className={'segmented' + (small ? ' small' : '')} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Sluiten" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  )
}

export function Disclaimer() {
  return (
    <p className="disclaimer">
      Indicatie, geen hypotheekadvies. Werkelijke uitkomsten hangen af van je persoonlijke situatie en de geldverstrekker.
    </p>
  )
}
