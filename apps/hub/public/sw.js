// Kullanıcı verisi, Firebase yanıtı ve uygulama HTML/JS'i önbelleğe alınmaz.
// Kapalı uygulamada e-posta göndermez veya onay işlemi yapmaz.
const CACHE = 'ieee-hub-offline-v1';
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('ieee-hub-offline-') && key !== CACHE).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate'
    || url.origin !== self.location.origin || url.pathname.startsWith('/__/')) return;
  event.respondWith(fetch(event.request).catch(async () => (
    await caches.match(OFFLINE, { cacheName: CACHE })
    ?? new Response('İnternet bağlantısı yok. Lütfen yeniden deneyin.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  )));
});
