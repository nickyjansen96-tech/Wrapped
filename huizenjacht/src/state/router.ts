import { useEffect, useState } from 'react'

/** Minimale hash-router: #/huizen/abc → ['huizen', 'abc']. Werkt met de terugknop van de telefoon. */
export function useRoute(): string[] {
  const parse = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => {
      setRoute(parse())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function go(path: string) {
  window.location.hash = '#/' + path.replace(/^\//, '')
}
