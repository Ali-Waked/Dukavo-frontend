import '@fontsource-variable/inter/index.css'
import '@fontsource/ibm-plex-sans-arabic/latin.css'
import '@fontsource/ibm-plex-sans-arabic/arabic.css'

import './assets/styles/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { ensureCsrfToken } from '@/lib/axiosClient'

declare global {
  interface Window {
    eruda?: { init: () => void }
  }
}

// Prime Sanctum's XSRF cookie before anything else — Laravel's stateful API
// rejects every request without it. It is idempotent and fire-and-forget; the
// interceptor re-primes automatically if the token ever rotates (419).
ensureCsrfToken()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

if (import.meta.env.DEV) {
  const eruda = document.createElement('script')
  eruda.src = 'https://cdn.jsdelivr.net/npm/eruda'
  eruda.onload = () => window.eruda?.init()
  document.body.appendChild(eruda)
}