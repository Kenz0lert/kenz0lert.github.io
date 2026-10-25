// Pyntx background script (service worker): shows pushes when Pyntx is closed or hidden — a ringing call
// (stays on screen, vibrates) or a new message — and opens the right chat on a tap. No caching: the site
// always loads fresh. While a Pyntx tab is open and visible, the app rings and shows messages itself.
const ICON = '/icons/pyntx-192.png'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const visible = windows.some((w) => w.visibilityState === 'visible')
      const url = data.chatId ? `/app/chat/${data.chatId}` : '/app'

      if (data.type === 'call-ended') {
        // The caller hung up before anyone answered: the ringing notification turns into a missed call
        const ringing = await self.registration.getNotifications({ tag: `call-${data.callId}` })
        ringing.forEach((n) => n.close())
        if (!visible) await self.registration.showNotification('Пропущенный звонок', { body: data.from, tag: `missed-${data.callId}`, icon: ICON, badge: ICON, data: { url } })
        return
      }
      if (visible) return
      if (data.type === 'call') {
        await self.registration.showNotification(`${data.from} звонит`, {
          body: data.video ? 'Видеозвонок в Pyntx. Нажми, чтобы ответить.' : 'Звонок в Pyntx. Нажми, чтобы ответить.',
          tag: `call-${data.callId}`,
          renotify: true,
          requireInteraction: true,
          vibrate: [500, 250, 500, 250, 500, 250, 500, 250, 500],
          icon: ICON,
          badge: ICON,
          data: { url },
        })
        return
      }
      await self.registration.showNotification(data.from || 'Pyntx', { body: data.body || 'Новое сообщение', tag: `chat-${data.chatId}`, renotify: true, icon: ICON, badge: ICON, data: { url } })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/app'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus()
          if ('navigate' in w) await w.navigate(url).catch(() => {})
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
