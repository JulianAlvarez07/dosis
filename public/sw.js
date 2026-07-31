const CACHE = 'dosis-v1'
const ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/')
    }),
  )
})

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'SHOW_REMINDER') return
  event.waitUntil(
    self.registration.showNotification(data.title || 'Hora de tu pastilla', {
      body: data.body || 'Abrí Dosis para marcarla como tomada',
      icon: '/icon-192.png',
      badge: '/favicon.svg',
      tag: data.tag || 'dosis-reminder',
      renotify: true,
      requireInteraction: true,
      data: data.payload || {},
    }),
  )
})
