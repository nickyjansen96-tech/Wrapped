// De enige plek waar data wordt gelezen en geschreven.
// Wil je later een gedeelde database (bv. Supabase/Firebase)? Schrijf dan een
// nieuwe class die `DataStore` implementeert en geef die mee in main.tsx.

import type { AppData } from '../domain/types'
import { migrate } from './migrate'

export interface DataStore {
  load(): Promise<AppData | null>
  save(data: AppData): Promise<void>
}

const KEY = 'huizenjacht:data'

export class LocalStorageStore implements DataStore {
  private readonly key: string
  constructor(key = KEY) {
    this.key = key
  }

  async load(): Promise<AppData | null> {
    try {
      const raw = localStorage.getItem(this.key)
      return raw ? migrate(JSON.parse(raw)) : null
    } catch (e) {
      console.error('Kon data niet laden', e)
      return null
    }
  }

  async save(data: AppData): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(data))
  }
}

/** Voor tests en als fallback. */
export class MemoryStore implements DataStore {
  private data: AppData | null = null
  async load() {
    return this.data ? structuredClone(this.data) : null
  }
  async save(data: AppData) {
    this.data = structuredClone(data)
  }
}
