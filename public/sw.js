/**
 * INVENTRA Driver Delivery Portal - Progressive Web App Service Worker
 * Secure offline app shell, asset caching & push notification handler.
 */

const CACHE_NAME = "inventra-driver-portal-v1";

// Safe public assets to pre-cache for offline app shell
const PRECACHE_ASSETS = [
  "/delivery-portal",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/icons/badge-72x72.png",
  "/assets/inventra-logo.png",
];

// URLs that must NEVER be cached (private financial, auth tokens, signed URLs, audit logs)
const SENSITIVE_URL_PATTERNS = [
  /\/api\/v1\/auth\//,
  /\/api\/v1\/storage\/download/,
  /\/api\/v1\/accounting\//,
  /\/api\/v1\/audit-logs\//,
  /\/api\/v1\/invoices\/.*\/pdf/,
  /\/api\/v1\/delivery-notes\/.*\/pdf/,
  /\/api\/v1\/return-notes\/.*\/pdf/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("[SW] Pre-cache failed:", err))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignore non-GET requests (mutations must go to server or offline queue)
  if (event.request.method !== "GET") {
    return;
  }

  // Strictly NEVER cache sensitive financial/auth/document APIs
  if (SENSITIVE_URL_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    return;
  }

  // Network-first strategy for Portal feed API (stale-while-revalidate / offline fallback)
  if (url.pathname === "/api/v1/portals/delivery") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({
              success: false,
              offline: true,
              error: { message: "Operating in offline mode. Local queue active." },
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 503,
            }
          );
        })
    );
    return;
  }

  // Cache-first strategy for static assets (scripts, styles, images, fonts)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first with app shell fallback for portal navigation
  if (url.pathname.startsWith("/delivery-portal")) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match("/delivery-portal");
        if (cached) return cached;
        return new Response("INVENTRA Driver Portal (Offline)", {
          headers: { "Content-Type": "text/html" },
        });
      })
    );
    return;
  }
});

// PWA Push Notifications Listener
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || "INVENTRA Delivery Alert";
    const options = {
      body: data.body || "New task assigned to your route.",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      vibrate: [100, 50, 100],
      data: {
        url: data.url || "/delivery-portal",
      },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.warn("[SW] Push handling error:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/delivery-portal";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/delivery-portal") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
