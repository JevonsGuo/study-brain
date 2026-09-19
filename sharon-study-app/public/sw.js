/**
 * 智学大脑 (Study Brain) - 现代化轻量 Service Worker 离线缓存引擎
 * 遵循原则：
 * 1. 同步接口 (/api/sync/*) 与版本探测 (/app-version.json) 坚决走 Network Only，绝不缓存；
 * 2. 静态哈希资源 (/assets/*) 走 Cache First，极速秒开；
 * 3. 入口文档 (index.html) 走 Network First (离线时降级为缓存)；
 * 4. 学科数据 (/content/*.json) 走 Stale-While-Revalidate，离线秒开同时后台无感更新。
 */

const CACHE_VERSION = 'study-brain-v1.0.5'
const CACHE_NAME = `study-brain-cache-${CACHE_VERSION}`

// 核心预缓存列表（应用基础外壳）
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './favicon.svg',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './apple-touch-icon.png',
  './manifest.webmanifest'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 使用相对路径预缓存，兼容任意子路径部署
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] 核心资源预缓存非致命跳过:', err)
      })
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('study-brain-cache-') && key !== CACHE_NAME) {
            console.log('[SW] 清理废弃版本旧缓存:', key)
            return caches.delete(key)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // 仅拦截 http 和 https 请求，忽略 chrome-extension 等
  if (!url.protocol.startsWith('http')) return

  // 1. 云端数据同步接口：绝对禁止缓存 (Network Only)
  if (url.pathname.includes('/api/sync/')) {
    return
  }

  // 2. 前端新版本探活文件：强制网络拉取，确保第一时间感知升级
  if (url.pathname.endsWith('app-version.json')) {
    event.respondWith(fetch(request, { cache: 'no-store' }))
    return
  }

  // 3. 入口 HTML 页面：Network First（优先拉取最新，断网或超时 2.5s 时回退缓存）
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      new Promise((resolve) => {
        let isTimedOut = false
        const timer = setTimeout(() => {
          isTimedOut = true
          caches.match(request).then((cached) => {
            if (cached) resolve(cached)
          })
        }, 2500)

        fetch(request)
          .then((networkRes) => {
            clearTimeout(timer)
            if (networkRes && networkRes.ok) {
              const resClone = networkRes.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone))
            }
            if (!isTimedOut) resolve(networkRes)
          })
          .catch(() => {
            clearTimeout(timer)
            caches.match(request).then((cached) => {
              if (cached) resolve(cached)
              else caches.match('./index.html').then((fallback) => resolve(fallback))
            })
          })
      })
    )
    return
  }

  // 4. 学科数据 (/content/*.json)：Stale-While-Revalidate（有缓存先给，后台同时拉取最新覆盖）
  if (url.pathname.includes('/content/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const resClone = networkRes.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone))
          }
          return networkRes
        }).catch(() => null)

        return cachedResponse || fetchPromise
      })
    )
    return
  }

  // 5. 带有内容哈希的静态前端资源 (/assets/*, 字体, 静态图片)：Cache First（极速秒开）
  if (url.pathname.includes('/assets/') || /\.(?:woff2?|ttf|png|jpg|jpeg|svg|mp3|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }
        return fetch(request).then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const resClone = networkRes.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone))
          }
          return networkRes
        })
      })
    )
    return
  }
})
