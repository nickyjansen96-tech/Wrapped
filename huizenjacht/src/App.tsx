import { TabBar, type TabId } from './components/TabBar'
import { go, useRoute } from './state/router'
import { WensenPage } from './pages/WensenPage'
import { RegelenPage } from './pages/RegelenPage'
import { HuizenPage } from './pages/HuizenPage'
import { HuisDetailPage } from './pages/HuisDetailPage'
import { HuisEditPage } from './pages/HuisEditPage'
import { HypotheekPage } from './pages/HypotheekPage'
import { InstellingenPage } from './pages/InstellingenPage'

const TITLES: Record<TabId, string> = {
  wensen: 'Wensen & eisen',
  regelen: 'Regelen',
  huizen: 'Huizen',
  hypotheek: 'Hypotheek',
}

export default function App() {
  const route = useRoute()
  const [section = 'huizen', sub, action] = route
  const tab: TabId | null = section in TITLES ? (section as TabId) : null

  let page
  let title = tab ? TITLES[tab] : 'Instellingen'
  let back: string | null = null
  if (section === 'wensen') page = <WensenPage />
  else if (section === 'regelen') page = <RegelenPage />
  else if (section === 'hypotheek') page = <HypotheekPage />
  else if (section === 'instellingen') {
    page = <InstellingenPage />
    back = 'huizen'
  } else if (section === 'huizen' && sub === 'nieuw') {
    page = <HuisEditPage />
    title = 'Huis toevoegen'
    back = 'huizen'
  } else if (section === 'huizen' && sub && action === 'bewerken') {
    page = <HuisEditPage id={sub} />
    title = 'Huis bewerken'
    back = `huizen/${sub}`
  } else if (section === 'huizen' && sub) {
    page = <HuisDetailPage id={sub} />
    title = 'Huis'
    back = 'huizen'
  } else page = <HuizenPage />

  return (
    <div className="app">
      <header className="topbar">
        {back ? (
          <button className="icon-btn" aria-label="Terug" onClick={() => go(back!)}>
            ‹
          </button>
        ) : (
          <span className="logo" aria-hidden>
            ⌂
          </span>
        )}
        <h1>{title}</h1>
        <button className="icon-btn" aria-label="Instellingen en back-up" onClick={() => go('instellingen')}>
          ⚙
        </button>
      </header>
      <main className="content">{page}</main>
      <TabBar active={tab} />
    </div>
  )
}
