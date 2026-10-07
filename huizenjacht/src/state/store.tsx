import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { defaultData } from '../data/defaults'
import type { AppData } from '../domain/types'
import type { DataStore } from '../storage/storage'

interface StoreValue {
  data: AppData
  update: (fn: (d: AppData) => AppData) => void
  replace: (d: AppData) => void
}

const Ctx = createContext<StoreValue | null>(null)

export function StoreProvider({ store, children }: { store: DataStore; children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    store.load().then((d) => {
      loaded.current = true
      setData(d ?? defaultData())
    })
  }, [store])

  // Automatisch opslaan na elke wijziging.
  useEffect(() => {
    if (!data || !loaded.current) return
    const t = setTimeout(() => {
      store.save(data).catch((e) => alert('Opslaan mislukt: ' + e))
    }, 150)
    return () => clearTimeout(t)
  }, [data, store])

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setData((d) => (d ? { ...fn(d), updatedAt: new Date().toISOString() } : d))
  }, [])
  const replace = useCallback((d: AppData) => setData(d), [])

  if (!data) return <div className="loading">Laden…</div>
  return <Ctx.Provider value={{ data, update, replace }}>{children}</Ctx.Provider>
}

export function useStore(): StoreValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore buiten StoreProvider')
  return v
}

export function newId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
