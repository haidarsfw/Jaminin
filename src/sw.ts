/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// Kerangka aplikasi disimpan di perangkat, jadi halaman status pesanan dan kode ambil tetap terbuka tanpa sinyal.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.skipWaiting()
clientsClaim()

type PushData = { title?: string; body?: string; url?: string; tag?: string }

self.addEventListener('push', (event) => {
  let data: PushData
  try {
    data = (event.data?.json() ?? {}) as PushData
  } catch {
    data = { body: event.data?.text() }
  }
  const options: NotificationOptions & { renotify?: boolean } = {
    body: data.body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url ?? '/' },
    lang: 'id',
  }
  if (data.tag) {
    options.tag = data.tag
    options.renotify = true
  }
  event.waitUntil(self.registration.showNotification(data.title ?? 'Jaminin', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data as { url?: string } | null)?.url ?? '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (existing) {
        await existing.focus()
        if (existing.url !== target) await existing.navigate(target).catch(() => null)
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})
