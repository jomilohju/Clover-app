const VERSION = 'clover-v2';
const SHELL = VERSION + '-shell';
const TILES = VERSION + '-tiles';
const MAX_TILES = 1500;
const TILE_RE = /^https:\/\/(?:[a-d]\.)?basemaps\.cartocdn\.com\//;
// Tiles are cached under one host name so any of a-d finds the same copy
const canon = (u) => u.replace(/^https:\/\/[a-d]\.basemaps/, 'https://basemaps');

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (TILE_RE.test(req.url)) {
    e.respondWith(tile(req));
    return;
  }
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return; // search and routing always use the network
  e.respondWith(shell(e));
});

// App files: network-first for HTML navigation so updates show instantly; cache-first for hashed bundles
async function shell(e) {
  const req = e.request;
  const key = req.mode === 'navigate' ? '/' : req;
  const cache = await caches.open(SHELL);

  if (req.mode === 'navigate') {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        cache.put(key, fresh.clone());
        return fresh;
      }
    } catch {
      // Offline fallback: serve cached index.html
    }
    const hit = await cache.match(key);
    if (hit) return hit;
    return new Response('Offline', { status: 503 });
  }

  const hit = await cache.match(key);
  const net = fetch(req)
    .then((r) => {
      if (r.ok) cache.put(key, r.clone());
      return r;
    })
    .catch(() => null);
  if (hit) {
    e.waitUntil(net);
    return hit;
  }
  return (await net) || new Response('Offline', { status: 503 });
}

// Map tiles: saved copy first, then network. CORS fetch avoids oversized "opaque" cache entries.
let corsBadUntil = 0;
async function tile(req) {
  const key = canon(req.url);
  const cache = await caches.open(TILES);
  const hit = await cache.match(key);
  if (hit) return hit;
  if (Date.now() >= corsBadUntil) {
    try {
      const r = await fetch(key, { mode: 'cors', credentials: 'omit' });
      if (r.ok) {
        cache.put(key, r.clone());
        trim(cache);
      }
      return r;
    } catch (err) {
      corsBadUntil = Date.now() + 5 * 60 * 1000; // if CORS fetches fail, stop retrying for 5 minutes (avoids double downloads)
    }
  }
  try {
    return await fetch(req);
  } catch (err2) {
    return new Response('', { status: 504 });
  }
}

let trimming = false;
let writes = 0;
async function trim(cache) {
  if (trimming || ++writes % 40 !== 0) return; // listing the cache is slow on weak devices, so trim only every 40th write
  trimming = true;
  try {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
  } finally {
    trimming = false;
  }
}

// The app sends the tiles along a new route (capped) so they are ready before signal drops
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'PREFETCH' || !Array.isArray(e.data.urls)) return;
  e.waitUntil(prefetch(e.data.urls.slice(0, 250)));
});

async function prefetch(urls) {
  const cache = await caches.open(TILES);
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const key = canon(urls[i++]);
      if (await cache.match(key)) continue;
      try {
        const r = await fetch(key, { mode: 'cors', credentials: 'omit' });
        if (r.ok) await cache.put(key, r);
      } catch (err) {
        /* skip tile */
      }
    }
  }
  await worker();
  trim(cache);
}
