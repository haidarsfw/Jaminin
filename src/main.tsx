import './styles.css'
import './lib/i18n'
import * as Sentry from '@sentry/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './lib/auth'
import { initTheme } from './lib/theme'
import { routeTree } from './routeTree.gen'

initTheme()

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
if (dsn && import.meta.env.PROD) {
  Sentry.init({ dsn, environment: import.meta.env.MODE, sendDefaultPii: false, tracesSampleRate: 0 })
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
