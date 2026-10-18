import { go } from '../state/router'

export type TabId = 'wensen' | 'regelen' | 'huizen' | 'hypotheek'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'wensen', label: 'Wensen', icon: '☆' },
  { id: 'regelen', label: 'Regelen', icon: '☑' },
  { id: 'huizen', label: 'Huizen', icon: '⌂' },
  { id: 'hypotheek', label: 'Hypotheek', icon: '€' },
]

export function TabBar({ active }: { active: TabId | null }) {
  return (
    <nav className="tabbar" aria-label="Hoofdnavigatie">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={'tab' + (active === t.id ? ' active' : '')}
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => go(t.id)}
        >
          <span className="tab-icon" aria-hidden>
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
