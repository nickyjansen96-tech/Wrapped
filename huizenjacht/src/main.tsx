import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { StoreProvider } from './state/store'
import { LocalStorageStore } from './storage/storage'

// Wissel hier van opslag (bv. een gedeelde database) zonder de rest te wijzigen.
const store = new LocalStorageStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <App />
    </StoreProvider>
  </StrictMode>,
)
