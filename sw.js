// sw.js
const VERSION = 'baras-v6'; // 
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
  // data.json は network-first なので敢えて殻には入れない運用でもOK
];

// install: 殻キャッシュ
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// activate: 古いバージョン削除
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// fetch
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // 同一オリジンだけ扱う
  if (url.origin !== location.origin) return;

  // 1) data.json はネット優先（失敗時キャッシュ）
  if (url.pathname.endsWith('/data.json')) {
    e.respondWith(networkFirst(req));
    return;
  }

  // 2) ナビゲーションは index.html を返す（オフライン初回でも開ける）
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html', { ignoreSearch: true })
        .then(hit => hit || fetch(req))
        .catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  // 3) それ以外はキャッシュ優先（クエリ差無視）
  e.respondWith(
    caches.match(req, { ignoreSearch: true })
      .then(hit => hit || fetch(req))
  );
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    // 初回オフラインで data.json がまだ無い場合の最小フォールバック
    return new Response('[]', { headers: { 'Content-Type': 'application/json' }, status: 200 });
  }
}
