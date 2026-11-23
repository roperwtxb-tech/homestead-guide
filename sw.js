/* Field Guide offline support.
   Bump VERSION whenever homestead-guide.html (or any file below) changes, then push.
   How it works: the guide opens from the phone's saved copy right away, even with no signal,
   and quietly fetches the newest version in the background for next time. */
const VERSION = 'fg-v5-2026-11-23';
const FILES = ['homestead-guide.html', 'index.html', 'manifest.webmanifest',
               'icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png'];
const PAGE = 'homestead-guide.html';

// Never keep a redirected response (Chrome refuses to use one for a page load). Store a clean copy.
async function clean(res){
  if (!res.redirected) return res;
  return new Response(await res.blob(), {status: res.status, statusText: res.statusText, headers: res.headers});
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    for (const f of FILES) {
      const res = await fetch(f, {cache: 'reload'});
      if (res.ok) await cache.put(f, await clean(res));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;          // PDFs and outside links go straight to the web
  const isPage = req.mode === 'navigate';
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = isPage ? PAGE : url.pathname.split('/').pop() || PAGE;
    const cached = await cache.match(key, {ignoreSearch: true});
    const fresh = fetch(isPage ? PAGE : req, {cache: 'no-cache'})
      .then(async r => { if (r.ok) await cache.put(key, await clean(r.clone())); return r; })
      .catch(() => null);
    if (cached) { e.waitUntil(fresh); return cached; }
    return (await fresh) || new Response('Offline and this page was never saved.', {status: 503});
  })());
});
