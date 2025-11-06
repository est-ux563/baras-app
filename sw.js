// sw.js
const VERSION = 'baras-v8'; // ← キャッシュ更新時に上げる

// このSWがインストールされたスコープ（末尾は必ず `/`）
const BASE = new URL('./', self.registration.scope).pathname;

// 先読みキャッシュ（*ディレクトリ*は入れない）
const ASSETS = [
  `${BASE}index.html`,
  `${BASE}style.css`,
  `${BASE}app.js`,
  `${BASE}manifest.webmanifest`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
  // data.json は network-first（下で個別処理）
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 任意：ページ側から skipWaiting を送れるようにしておく
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // 同一オリジンのみ対象
  if (url.origin !== location.origin) return;

  // 1) data.json はネット優先（成功時はキャッシュへ）
  if (url.pathname.endsWith('/data.json')) {
    e.respondWith(networkFirst(req));
    return;
  }

  // 2) ナビゲーションは index.html を返す（SPA向けオフライン対応）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() =>
        caches.match(`${BASE}index.html`, { ignoreSearch: true })
      )
    );
    return;
  }

  // 3) それ以外はキャッシュ優先（クエリ違い無視）
  e.respondWith(
    caches.match(req, { ignoreSearch: true })
      .then((hit) => hit || fetch(req))
  );
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    // 最低限のフォールバック（空配列）
    return new Response('[]', {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  }
}
