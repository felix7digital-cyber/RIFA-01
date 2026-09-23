/* ============================================================
   MOTOR DE RIFAS · pwa/sw.js
   Service Worker · Cache First + Network First híbrido
   Marco: CCG-IA v1.0.0 · Autor: Felix
   ============================================================ */

'use strict';

/* ============================================================
   1. VERSIONADO
   Cambia VERSION cuando hagas cambios importantes en assets.
   Esto fuerza la limpieza de cachés antiguas.
   ============================================================ */
var VERSION       = 'v1.0.0';
var CACHE_NAME    = 'rifa-cache-' + VERSION;
var CACHE_RUNTIME = 'rifa-runtime-' + VERSION;
var CACHE_API     = 'rifa-api-' + VERSION;

/* ============================================================
   2. ASSETS PRECACHEADOS
   Estos archivos se descargan en la instalación del SW para
   que la app funcione offline desde la primera visita.
   ============================================================ */
var ASSETS_PRECACHE = [
    // HTML
    './',
    './index.html',
    './rifas.html',
    './boleto.html',
    './terminos.html',
    './premios.html',
    './motivo.html',
    './admin.html',

    // CSS
    './assets/css/base.css',
    './assets/css/plantillas.css',
    './assets/css/admin.css',

    // JS
    './assets/js/ui.js',
    './assets/js/storage.js',
    './assets/js/md.js',
    './assets/js/theme.js',
    './assets/js/rifas.js',
    './assets/js/boleto.js',
    './assets/js/admin.js',

    // Contenido
    './content/terminos.md',
    './content/motivo.md',
    './content/instrucciones.md',

    // PWA
    './pwa/manifest.json'
];

/* ============================================================
   3. DOMINIOS EXTERNOS QUE SE CACHEAN EN RUNTIME
   ============================================================ */
var CDN_DOMAINS = [
    'cdnjs.cloudflare.com',       // html2canvas
    'api.qrserver.com'            // generador de QR
];

/* ============================================================
   4. INSTALL · Precarga de assets
   ============================================================ */
self.addEventListener('install', function (event) {
    console.log('[SW] Instalando versión', VERSION);

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                console.log('[SW] Precargando', ASSETS_PRECACHE.length, 'assets…');
                // addAll falla si UN solo asset falla.
                // Por eso usamos add() individual con catch para tolerancia.
                return Promise.all(
                    ASSETS_PRECACHE.map(function (url) {
                        return cache.add(url).catch(function (err) {
                            console.warn('[SW] No se pudo precargar:', url, err.message);
                        });
                    })
                );
            })
            .then(function () {
                console.log('[SW] Instalación completa');
                return self.skipWaiting();
            })
    );
});

/* ============================================================
   5. ACTIVATE · Limpieza de cachés viejas
   ============================================================ */
self.addEventListener('activate', function (event) {
    console.log('[SW] Activando versión', VERSION);

    event.waitUntil(
        caches.keys()
            .then(function (keys) {
                return Promise.all(
                    keys.map(function (key) {
                        // Borrar cualquier caché que no sea la actual
                        if (key !== CACHE_NAME &&
                            key !== CACHE_RUNTIME &&
                            key !== CACHE_API) {
                            console.log('[SW] Eliminando caché vieja:', key);
                            return caches.delete(key);
                        }
                    })
                );
            })
            .then(function () {
                console.log('[SW] Activación completa');
                return self.clients.claim();
            })
    );
});

/* ============================================================
   6. FETCH · Router de estrategias
   ============================================================ */
self.addEventListener('fetch', function (event) {
    var req = event.request;

    // Solo GET (POST/PATCH/DELETE van directo a la red)
    if (req.method !== 'GET') {
        // Para métodos de escritura, intentamos red y, si falla,
        // devolvemos un error controlado.
        event.respondWith(
            fetch(req).catch(function () {
                return new Response(
                    JSON.stringify({ ok: false, offline: true, error: 'Sin conexión' }),
                    {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            })
        );
        return;
    }

    var url = new URL(req.url);

    // Ignorar esquemas que no manejamos
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // 1) API de Cloudflare (mismo origen + /api/) → Network First
    if (url.pathname.indexOf('/api/') === 0) {
        event.respondWith(networkFirst(req, CACHE_API));
        return;
    }

    // 2) CDN externos (html2canvas, qrserver) → Cache First
    if (CDN_DOMAINS.some(function (d) { return url.hostname.indexOf(d) !== -1; })) {
        event.respondWith(cacheFirst(req, CACHE_RUNTIME));
        return;
    }

    // 3) Navegación (HTML) → Cache First con fallback offline
    if (req.mode === 'navigate') {
        event.respondWith(navegarConFallback(req));
        return;
    }

    // 4) Assets del mismo origen (CSS, JS, MD, etc.) → Cache First
    if (url.origin === self.location.origin) {
        event.respondWith(cacheFirst(req, CACHE_NAME));
        return;
    }

    // 5) Cualquier otra cosa → Network First
    event.respondWith(networkFirst(req, CACHE_RUNTIME));
});

/* ============================================================
   7. ESTRATEGIA · Cache First
   Devuelve del caché si existe; si no, baja de la red y cachea.
   ============================================================ */
function cacheFirst(req, cacheName) {
    return caches.match(req).then(function (cached) {
        if (cached) {
            // Refrescar en background (stale-while-revalidate silencioso)
            actualizarEnBackground(req, cacheName);
            return cached;
        }
        return fetch(req).then(function (res) {
            // No cachear respuestas que no sean OK o que sean opaque
            if (!res || res.status !== 200 || res.type === 'opaqueredirect') {
                return res;
            }
            var copia = res.clone();
            caches.open(cacheName).then(function (cache) {
                cache.put(req, copia).catch(function (err) {
                    console.warn('[SW] No se pudo cachear:', req.url, err.message);
                });
            });
            return res;
        }).catch(function (err) {
            console.warn('[SW] Fallo de red:', req.url, err.message);
            // Si es una navegación sin caché, mostrar fallback
            if (req.mode === 'navigate') {
                return caches.match('./index.html').then(function (fallback) {
                    return fallback || new Response(
                        paginaOffline(),
                        { headers: { 'Content-Type': 'text/html;charset=utf-8' } }
                    );
                });
            }
            // Assets sin caché: error controlado
            return new Response('', { status: 504, statusText: 'Offline' });
        });
    });
}

/* ============================================================
   8. ESTRATEGIA · Network First
   Intenta red primero; si falla, devuelve del caché.
   ============================================================ */
function networkFirst(req, cacheName) {
    return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type !== 'opaqueredirect') {
            var copia = res.clone();
            caches.open(cacheName).then(function (cache) {
                cache.put(req, copia).catch(function () {
                    // Ignorar errores de quota
                });
            });
        }
        return res;
    }).catch(function () {
        return caches.match(req).then(function (cached) {
            if (cached) return cached;

            // Si es una petición JSON y no hay caché, devolver
            // una respuesta vacía manejable por el cliente
            var accept = req.headers.get('Accept') || '';
            if (accept.indexOf('application/json') !== -1) {
                return new Response(
                    JSON.stringify({ offline: true, data: [] }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }
            return new Response('', { status: 504, statusText: 'Offline' });
        });
    });
}

/* ============================================================
   9. NAVEGACIÓN · Fallback a index.html offline
   ============================================================ */
function navegarConFallback(req) {
    return fetch(req).then(function (res) {
        if (res && res.status === 200) {
            var copia = res.clone();
            caches.open(CACHE_NAME).then(function (cache) {
                cache.put(req, copia).catch(function () { /* silent */ });
            });
        }
        return res;
    }).catch(function () {
        // Buscar la página exacta en caché
        return caches.match(req).then(function (cached) {
            if (cached) return cached;
            // Buscar la raíz
            return caches.match('./index.html').then(function (home) {
                return home || new Response(
                    paginaOffline(),
                    { headers: { 'Content-Type': 'text/html;charset=utf-8' } }
                );
            });
        });
    });
}

/* ============================================================
   10. ACTUALIZACIÓN EN BACKGROUND (stale-while-revalidate)
   ============================================================ */
function actualizarEnBackground(req, cacheName) {
    fetch(req).then(function (res) {
        if (!res || res.status !== 200 || res.type === 'opaqueredirect') return;
        caches.open(cacheName).then(function (cache) {
            cache.put(req, res.clone()).catch(function () { /* silent */ });
        });
    }).catch(function () {
        // Sin conexión: no pasa nada, seguimos sirviendo del caché
    });
}

/* ============================================================
   11. PÁGINA OFFLINE EMBEBIDA
   Se muestra solo cuando NO hay caché ni red (raro).
   ============================================================ */
function paginaOffline() {
    return [
        '<!DOCTYPE html>',
        '<html lang="es">',
        '<head>',
            '<meta charset="UTF-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '<title>Sin conexión · Motor de Rifas</title>',
            '<style>',
                'body{background:#0f172a;color:#f8fafc;font-family:system-ui,sans-serif;',
                'display:flex;align-items:center;justify-content:center;min-height:100vh;',
                'margin:0;padding:20px;text-align:center;}',
                '.box{max-width:420px;}',
                '.icon{font-size:3rem;margin-bottom:10px;}',
                'h1{color:#fbbf24;font-size:1.3rem;margin-bottom:10px;}',
                'p{color:#94a3b8;font-size:0.9rem;line-height:1.5;}',
                'button{margin-top:20px;background:#fbbf24;color:#000;border:none;',
                'padding:12px 24px;border-radius:9px;font-weight:bold;font-size:0.9rem;',
                'cursor:pointer;font-family:inherit;}',
            '</style>',
        '</head>',
        '<body>',
            '<div class="box">',
                '<div class="icon">📡</div>',
                '<h1>Sin conexión</h1>',
                '<p>No pudimos cargar esta página y no hay una copia en caché. ',
                'Conéctate a internet e intenta de nuevo.</p>',
                '<button onclick="location.reload()">🔄 Reintentar</button>',
            '</div>',
        '</body>',
        '</html>'
    ].join('');
}

/* ============================================================
   12. MENSAJES DESDE EL CLIENTE
   Permite forzar la actualización del SW desde el cliente.
   ============================================================ */
self.addEventListener('message', function (event) {
    var data = event.data || {};

    if (data.tipo === 'skip-waiting') {
        self.skipWaiting();
        return;
    }

    if (data.tipo === 'limpiar-cache') {
        event.waitUntil(
            caches.keys().then(function (keys) {
                return Promise.all(keys.map(function (k) {
                    return caches.delete(k);
                }));
            }).then(function () {
                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage({ ok: true });
                }
            })
        );
        return;
    }

    if (data.tipo === 'version') {
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ version: VERSION });
        }
    }
});

/* ============================================================
   13. SYNC EN BACKGROUND (soporte futuro)
   Si el navegador soporta Background Sync, podremos reintentar
   envíos fallidos a la API cuando vuelva la conexión.
   ============================================================ */
self.addEventListener('sync', function (event) {
    if (event.tag === 'rifa-sync') {
        event.waitUntil(
            // Placeholder: aquí iría la lógica de reintento de POSTs
            Promise.resolve()
        );
    }
});

console.log('[SW] Cargado versión', VERSION);