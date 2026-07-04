const CACHE_NAME = 'rentz-v162';
const ASSETS = [
  './index.html',
  './manifest.json',
  './cards/7_of_clubs.png',
  './cards/7_of_diamonds.png',
  './cards/7_of_hearts.png',
  './cards/7_of_spades.png',
  './cards/8_of_clubs.png',
  './cards/8_of_diamonds.png',
  './cards/8_of_hearts.png',
  './cards/8_of_spades.png',
  './cards/9_of_clubs.png',
  './cards/9_of_diamonds.png',
  './cards/9_of_hearts.png',
  './cards/9_of_spades.png',
  './cards/10_of_clubs.png',
  './cards/10_of_diamonds.png',
  './cards/10_of_hearts.png',
  './cards/10_of_spades.png',
  './cards/ace_of_clubs.png',
  './cards/ace_of_diamonds.png',
  './cards/ace_of_hearts.png',
  './cards/ace_of_spades2.png',
  './cards/jack_of_clubs2.png',
  './cards/jack_of_diamonds2.png',
  './cards/jack_of_hearts2.png',
  './cards/jack_of_spades2.png',
  './cards/queen_of_clubs2.png',
  './cards/queen_of_diamonds2.png',
  './cards/queen_of_hearts2.png',
  './cards/queen_of_spades2.png',
  './cards/king_of_clubs2.png',
  './cards/king_of_diamonds2.png',
  './cards/king_of_hearts2.png',
  './cards/king_of_spades2.png',
];

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cardurile + manifest: normal (atomic).
      await cache.addAll(ASSETS.filter(a => !a.endsWith('.html')));
      // index.html: îl luăm PROASPĂT de pe server (ocolește cache-ul HTTP/CDN), ca până și
      // fallback-ul offline să fie versiunea nouă. Dacă pică (offline la instalare), nu blocăm.
      try { await cache.add(new Request('./index.html', { cache: 'no-store' })); } catch (err) {}
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => {
      return self.clients.claim();
    }).then(() => {
      // Anunță toate filele deschise să se reîncarce cu versiunea nouă
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
      });
    })
  );
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co') || e.request.url.includes('googleapis.com') || e.request.url.includes('jsdelivr.net')) {
    return;
  }

  // Network-first pentru index.html — ia întotdeauna versiunea nouă de pe server
  const url = new URL(e.request.url);
  const isHTML = url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname === '';

  if (isHTML) {
    e.respondWith(
      // { cache: 'no-store' } e cheia: fără el, fetch-ul putea fi servit din cache-ul HTTP al
      // browserului sau de pe CDN-ul Vercel cu o versiune VECHE de index.html — chiar dacă SW-ul
      // s-a actualizat. Așa lovim mereu serverul, proaspăt.
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        // Offline: cererea navigării e către „/", dar la install cheia e „./index.html" — încercăm
        // ambele ca să nu rămânem fără pagină.
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first pentru carduri și alte assets statice
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
