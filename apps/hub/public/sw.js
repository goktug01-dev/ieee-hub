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

self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let data={};try{data=event.data?.json()||{};}catch{}
    const petition=data.kind==='petition';
    await self.registration.showNotification('IEEE Hub',{
      body:petition?'Onayınızı bekleyen bir dilekçe var.':'Size yeni bir görev atandı.',
      icon:'/icons/icon-192.png',tag:typeof data.tag==='string'?data.tag:'ieee-hub',
      data:{path:petition?'/onaylar':'/gorevler'},
    });
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const path=event.notification.data?.path==='/onaylar'?'/onaylar':'/gorevler';
  event.waitUntil(self.clients.openWindow(new URL(path,self.location.origin).href));
});
