// ETF 管家 Service Worker
// 版本號 — 每次更新 index.html 時改這個數字，舊快取就會自動清除
const CACHE_VERSION = 'etf-v1';

// 要預先快取的靜態資源
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

// ── 安裝：預先快取所有靜態資源 ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // 分開快取，避免外部 CDN 失敗導致整個安裝失敗
      cache.addAll([
        'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
      ]).catch(() => {});
      return cache.addAll(['/', '/index.html', '/manifest.json']);
    })
  );
  self.skipWaiting();
});

// ── 啟動：清除舊版快取 ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── 攔截請求：Cache First，失敗才走網路 ─────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Yahoo Finance API 請求：永遠走網路（不快取，需要即時資料）
  if (url.hostname.includes('yahoo') || url.hostname.includes('finance')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // 其他請求：Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // 只快取成功的 GET 請求
        if (!response || response.status !== 200 || event.request.method !== 'GET') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // 離線且沒有快取：回傳空回應
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
