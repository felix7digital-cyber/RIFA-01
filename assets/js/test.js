/* ============================================================
   MOTOR DE RIFAS · assets/js/test.js
   Diagnóstico completo v2 · 27 tests + informe + feedback
   Marco: CCG-IA v1.0.0 · Autor: Felix
   ============================================================ */

(function (global) {
    'use strict';

    var VERSION = 'v1.0.0';
    var KEY_FEEDBACK = 'rifa_feedback_v1';

    /* ============================================================
       1. INVENTARIO DE ARCHIVOS
       ============================================================ */
    var ARCHIVOS_REQUERIDOS = [
        // HTML
        { ruta: 'index.html',         tipo: 'html', pesoMin: 2000, obligatorio: true },
        { ruta: 'rifas.html',         tipo: 'html', pesoMin: 4000, obligatorio: true },
        { ruta: 'boleto.html',        tipo: 'html', pesoMin: 5000, obligatorio: true },
        { ruta: 'terminos.html',      tipo: 'html', pesoMin: 4000, obligatorio: true },
        { ruta: 'premios.html',       tipo: 'html', pesoMin: 3000, obligatorio: true },
        { ruta: 'motivo.html',        tipo: 'html', pesoMin: 3000, obligatorio: true },
        { ruta: 'instrucciones.html', tipo: 'html', pesoMin: 2000, obligatorio: true },
        { ruta: 'admin.html',         tipo: 'html', pesoMin: 8000, obligatorio: true },
        { ruta: 'test.html',          tipo: 'html', pesoMin: 3000, obligatorio: true },
        { ruta: 'cartel.html',        tipo: 'html', pesoMin: 5000, obligatorio: true },

        // CSS
        { ruta: 'assets/css/base.css',       tipo: 'css', pesoMin: 8000,  obligatorio: true },
        { ruta: 'assets/css/plantillas.css', tipo: 'css', pesoMin: 5000,  obligatorio: true },
        { ruta: 'assets/css/admin.css',      tipo: 'css', pesoMin: 8000,  obligatorio: true },

        // JS
        { ruta: 'assets/js/ui.js',      tipo: 'js', pesoMin: 8000,  obligatorio: true },
        { ruta: 'assets/js/storage.js', tipo: 'js', pesoMin: 15000, obligatorio: true },
        { ruta: 'assets/js/md.js',      tipo: 'js', pesoMin: 8000,  obligatorio: true },
        { ruta: 'assets/js/theme.js',   tipo: 'js', pesoMin: 10000, obligatorio: true },
        { ruta: 'assets/js/rifas.js',   tipo: 'js', pesoMin: 10000, obligatorio: true },
        { ruta: 'assets/js/boleto.js',  tipo: 'js', pesoMin: 15000, obligatorio: true },
        { ruta: 'assets/js/admin.js',   tipo: 'js', pesoMin: 20000, obligatorio: true },
        { ruta: 'assets/js/test.js',    tipo: 'js', pesoMin: 5000,  obligatorio: true },

        // MD
        { ruta: 'content/terminos.md',      tipo: 'md', pesoMin: 3000, obligatorio: true },
        { ruta: 'content/motivo.md',        tipo: 'md', pesoMin: 1000, obligatorio: true },
        { ruta: 'content/instrucciones.md', tipo: 'md', pesoMin: 1000, obligatorio: true },

        // PWA
        { ruta: 'pwa/manifest.json', tipo: 'json', pesoMin: 1500, obligatorio: true },
        { ruta: 'pwa/sw.js',         tipo: 'js',   pesoMin: 5000, obligatorio: true },

        // Cloudflare (opcional)
        { ruta: 'cloudflare/worker.js',     tipo: 'js',   pesoMin: 5000, obligatorio: false },
        { ruta: 'cloudflare/schema.sql',    tipo: 'sql',  pesoMin: 1000, obligatorio: false },
        { ruta: 'cloudflare/wrangler.toml', tipo: 'toml', pesoMin: 500,  obligatorio: false }
    ];

    var CARPETAS_REQUERIDAS = [
        'assets',
        'assets/css',
        'assets/js',
        'content',
        'pwa'
    ];

    /* ============================================================
       2. ESTADO
       ============================================================ */
    var resultados = [];
    var archivosEstado = {};
    var ejecutando = false;
    var ratingSeleccionado = 0;

    /* ============================================================
       3. LOG
       ============================================================ */
    function logLinea(texto, tipo) {
        var log = document.getElementById('log');
        if (!log) return;
        var seccion = document.getElementById('seccion-log');
        if (seccion) seccion.style.display = 'block';

        var linea = document.createElement('div');
        linea.className = 'linea-' + (tipo || 'info');
        var hora = new Date().toLocaleTimeString('es-VE', { hour12: false });
        linea.textContent = '[' + hora + '] ' + texto;
        log.appendChild(linea);
        log.scrollTop = log.scrollHeight;
    }

    function limpiarLog() {
        var log = document.getElementById('log');
        if (log) log.innerHTML = '';
        var seccion = document.getElementById('seccion-log');
        if (seccion) seccion.style.display = 'none';
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /* ============================================================
       4. FETCH HELPERS
       ============================================================ */
    function fetchConTimeout(url, ms, method) {
        ms = ms || 6000;
        method = method || 'GET';
        return new Promise(function (resolve) {
            var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            var timer = setTimeout(function () {
                if (controller) controller.abort();
                resolve({ ok: false, status: 0, timeout: true, size: 0, type: '' });
            }, ms);

            var opts = { method: method, cache: 'no-store' };
            if (controller) opts.signal = controller.signal;

            fetch(url, opts)
                .then(function (res) {
                    clearTimeout(timer);
                    if (method === 'GET' && res.ok) {
                        return res.clone().blob().then(function (blob) {
                            return {
                                ok: res.ok,
                                status: res.status,
                                size: blob.size,
                                type: res.headers.get('content-type') || ''
                            };
                        });
                    }
                    return {
                        ok: res.ok,
                        status: res.status,
                        size: 0,
                        type: res.headers.get('content-type') || ''
                    };
                })
                .catch(function (err) {
                    clearTimeout(timer);
                    resolve({ ok: false, status: 0, error: true, mensaje: err.message, size: 0, type: '' });
                })
                .then(function (r) {
                    resolve(r || { ok: false, status: 0, size: 0, type: '' });
                });
        });
    }

    function fetchTexto(url, ms) {
        ms = ms || 6000;
        return new Promise(function (resolve) {
            var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            var timer = setTimeout(function () {
                if (controller) controller.abort();
                resolve(null);
            }, ms);

            var opts = { cache: 'no-store' };
            if (controller) opts.signal = controller.signal;

            fetch(url, opts)
                .then(function (res) {
                    clearTimeout(timer);
                    if (!res.ok) return null;
                    return res.text();
                })
                .then(resolve)
                .catch(function () {
                    clearTimeout(timer);
                    resolve(null);
                });
        });
    }

    /* ============================================================
       5. TEST WRAPPER
       ============================================================ */
    function test(nombre, fn) {
        return function () {
            logLinea('▶️ ' + nombre, 'info');
            return Promise.resolve()
                .then(fn)
                .then(function (res) {
                    var r = res || { estado: 'ok', mensaje: 'OK' };
                    resultados.push({
                        nombre: nombre,
                        estado: r.estado || 'ok',
                        mensaje: r.mensaje || '',
                        detalle: r.detalle || null
                    });
                    var icono = r.estado === 'fail' ? '❌' : r.estado === 'warn' ? '⚠️' : '✅';
                    logLinea(icono + ' ' + nombre + ' · ' + (r.mensaje || ''),
                        r.estado === 'fail' ? 'fail' : (r.estado === 'warn' ? 'info' : 'ok'));
                })
                .catch(function (err) {
                    resultados.push({
                        nombre: nombre,
                        estado: 'fail',
                        mensaje: 'Error inesperado: ' + (err && err.message ? err.message : 'desconocido')
                    });
                    logLinea('❌ ' + nombre + ' · ' + err, 'fail');
                });
        };
    }

    /* ============================================================
       6. TESTS
       ============================================================ */

    /* ---------- GRUPO 1 · Contexto ---------- */
    var testContexto = test('🌐 Contexto del navegador', function () {
        var ctx = {
            url: location.href,
            protocolo: location.protocol,
            host: location.host || '(vacío)',
            userAgent: navigator.userAgent,
            viewport: window.innerWidth + 'x' + window.innerHeight,
            idioma: navigator.language,
            fecha: new Date().toISOString()
        };
        return {
            estado: 'ok',
            mensaje: ctx.protocolo + ' · ' + ctx.viewport + ' · ' + ctx.idioma,
            detalle: ctx
        };
    });

    /* ---------- GRUPO 2 · Estructura de carpetas ---------- */
    var testCarpetas = test('📂 Estructura de carpetas', function () {
        if (location.protocol === 'file:') {
            return { estado: 'warn', mensaje: 'file:// no permite verificar carpetas.' };
        }

        var mapa = {
            'assets':       'assets/css/base.css',
            'assets/css':   'assets/css/base.css',
            'assets/js':    'assets/js/ui.js',
            'content':      'content/terminos.md',
            'pwa':          'pwa/manifest.json'
        };

        return Promise.all(Object.keys(mapa).map(function (carpeta) {
            return fetchConTimeout(mapa[carpeta], 4000, 'HEAD').then(function (r) {
                return { carpeta: carpeta, ok: r.ok };
            });
        })).then(function (res) {
            var faltantes = res.filter(function (r) { return !r.ok; });
            if (faltantes.length > 0) {
                return {
                    estado: 'fail',
                    mensaje: 'Carpetas sin archivos accesibles: ' +
                             faltantes.map(function (f) { return f.carpeta; }).join(', ')
                };
            }
            return { estado: 'ok', mensaje: 'Todas las carpetas principales verificadas.' };
        });
    });

    /* ---------- GRUPO 3 · Archivos (GET real) ---------- */
    var testArchivos = test('📁 Inventario de archivos', function () {
        if (location.protocol === 'file:') {
            return {
                estado: 'warn',
                mensaje: 'Estás en file:// · las verificaciones HTTP no funcionan. Sube a un servidor.'
            };
        }

        archivosEstado = {};

        return Promise.all(ARCHIVOS_REQUERIDOS.map(function (a) {
            return fetchConTimeout(a.ruta, 5000, 'GET').then(function (r) {
                archivosEstado[a.ruta] = {
                    ok: r.ok,
                    status: r.status || 0,
                    size: r.size || 0,
                    tipoMime: r.type || '',
                    obligatorio: a.obligatorio,
                    pesoMin: a.pesoMin,
                    tipoEsperado: a.tipo,
                    pesoMinOk: !r.ok ? false : (r.size >= a.pesoMin)
                };
            });
        })).then(function () {
            var obligatoriosFaltantes = [];
            var opcionalesFaltantes = [];
            var muyPequenos = [];

            Object.keys(archivosEstado).forEach(function (ruta) {
                var e = archivosEstado[ruta];
                if (!e.ok) {
                    if (e.obligatorio) obligatoriosFaltantes.push(ruta);
                    else opcionalesFaltantes.push(ruta);
                } else if (!e.pesoMinOk) {
                    muyPequenos.push(ruta + ' (' + e.size + 'B, esperado ≥' + e.pesoMin + 'B)');
                }
            });

            renderizarListaArchivos();

            if (obligatoriosFaltantes.length > 0) {
                return {
                    estado: 'fail',
                    mensaje: 'Faltan ' + obligatoriosFaltantes.length + ' archivo(s) obligatorio(s): ' +
                             obligatoriosFaltantes.join(', ') +
                             (opcionalesFaltantes.length ? ' · Opcionales faltantes: ' + opcionalesFaltantes.join(', ') : '') +
                             (muyPequenos.length ? ' · Muy pequeños: ' + muyPequenos.join(', ') : '')
                };
            }
            if (muyPequenos.length > 0) {
                return {
                    estado: 'warn',
                    mensaje: 'Todos existen pero algunos son sospechosamente pequeños: ' +
                             muyPequenos.join(', ')
                };
            }
            return {
                estado: 'ok',
                mensaje: 'Los ' + ARCHIVOS_REQUERIDOS.length + ' archivos existen con tamaño adecuado.'
            };
        });
    });

    /* ---------- GRUPO 4 · Namespaces ---------- */
    var testUI = test('🧩 window.UI definido', function () {
        if (global.__uiError) return { estado: 'fail', mensaje: 'ui.js no cargó.' };
        if (!global.UI) return { estado: 'fail', mensaje: 'window.UI no existe.' };
        var faltantes = ['$', '$$', 'escapeHtml', 'toast', 'abrirModal', 'cerrarModal',
                         'copiar', 'getParam', 'urlHermana', 'generarId', 'formatearCedula',
                         'soloDigitos', 'fechaHumana', 'descargarArchivo', 'normalizarNumero']
                        .filter(function (k) { return typeof global.UI[k] !== 'function'; });
        if (faltantes.length > 0) {
            return { estado: 'fail', mensaje: 'Faltan: ' + faltantes.join(', ') };
        }
        return { estado: 'ok', mensaje: 'Todas las 15 funciones presentes.' };
    });

    var testStore = test('💾 window.Store definido', function () {
        if (global.__storageError) return { estado: 'fail', mensaje: 'storage.js no cargó.' };
        if (!global.Store) return { estado: 'fail', mensaje: 'window.Store no existe.' };
        var faltantes = ['leerConfig', 'guardarConfig', 'cargarRegistros', 'crearRegistros',
                         'actualizarRegistro', 'eliminarRegistro', 'buscarPorCedula',
                         'stats', 'exportarJSON', 'exportarMarkdown', 'exportarCSV',
                         'importarJSON', 'generarCodigoBoleto', 'numerosOcupados',
                         'mapaPorNumero']
                        .filter(function (k) { return typeof global.Store[k] !== 'function'; });
        if (faltantes.length > 0) {
            return { estado: 'fail', mensaje: 'Faltan: ' + faltantes.join(', ') };
        }
        return { estado: 'ok', mensaje: 'Todas las 15 funciones presentes.' };
    });

    var testMD = test('📖 window.MD definido', function () {
        if (global.__mdError) return { estado: 'fail', mensaje: 'md.js no cargó.' };
        if (!global.MD) return { estado: 'fail', mensaje: 'window.MD no existe.' };
        var faltantes = ['parsear', 'cargar', 'cargarEnDOM']
                        .filter(function (k) { return typeof global.MD[k] !== 'function'; });
        if (faltantes.length > 0) return { estado: 'fail', mensaje: 'Faltan: ' + faltantes.join(', ') };
        return { estado: 'ok', mensaje: 'Todas las funciones presentes.' };
    });

    var testTheme = test('🎨 window.Theme definido', function () {
        if (global.__themeError) return { estado: 'fail', mensaje: 'theme.js no cargó.' };
        if (!global.Theme) return { estado: 'fail', mensaje: 'window.Theme no existe.' };
        var faltantes = ['aplicarTodo', 'aplicarColores', 'aplicarPlantilla',
                         'previsualizar', 'nombreRifa', 'whatsappOrganizador']
                        .filter(function (k) { return typeof global.Theme[k] !== 'function'; });
        if (faltantes.length > 0) return { estado: 'fail', mensaje: 'Faltan: ' + faltantes.join(', ') };
        return { estado: 'ok', mensaje: 'Todas las funciones presentes.' };
    });

    /* ---------- GRUPO 5 · Almacenamiento ---------- */
    var testLocalStorage = test('💽 localStorage operativo', function () {
        try {
            var clave = '__test_rifa_' + Date.now();
            localStorage.setItem(clave, 'test-value');
            var v = localStorage.getItem(clave);
            localStorage.removeItem(clave);
            if (v !== 'test-value') return { estado: 'fail', mensaje: 'No lee correctamente.' };
            var usado = 0;
            for (var k in localStorage) if (localStorage.hasOwnProperty(k)) usado++;
            return { estado: 'ok', mensaje: 'Funcional · ' + usado + ' claves en uso.' };
        } catch (e) {
            return { estado: 'fail', mensaje: 'Error: ' + (e.message || 'desconocido') };
        }
    });

    var testSessionStorage = test('🗂️ sessionStorage operativo', function () {
        try {
            var clave = '__test_rifa_s_' + Date.now();
            sessionStorage.setItem(clave, 'test-value');
            var v = sessionStorage.getItem(clave);
            sessionStorage.removeItem(clave);
            if (v !== 'test-value') return { estado: 'fail', mensaje: 'No lee.' };
            return { estado: 'ok', mensaje: 'Funcional.' };
        } catch (e) {
            return { estado: 'fail', mensaje: 'Error: ' + (e.message || 'desconocido') };
        }
    });

    var testConfig = test('⚙️ Store.leerConfig() devuelve config válida', function () {
        if (!global.Store) return { estado: 'fail', mensaje: 'Store no definido.' };
        var cfg = global.Store.leerConfig();
        if (!cfg) return { estado: 'fail', mensaje: 'Devuelve null.' };
        if (!cfg.identidad) return { estado: 'fail', mensaje: 'Falta .identidad.' };
        if (!cfg.marca) return { estado: 'fail', mensaje: 'Falta .marca.' };
        if (!cfg.plantilla) return { estado: 'warn', mensaje: 'Falta .plantilla.' };
        return {
            estado: 'ok',
            mensaje: '"' + (cfg.identidad.nombreRifa || '?') + '" · plantilla ' + cfg.plantilla + ' · ' + cfg.marca.colorAcento
        };
    });

    var testRegistros = test('📋 Store.cargarRegistros() funciona', function () {
        if (!global.Store) return { estado: 'fail', mensaje: 'Store no definido.' };
        return global.Store.cargarRegistros(true).then(function (regs) {
            if (!Array.isArray(regs)) return { estado: 'fail', mensaje: 'No devuelve array.' };
            return { estado: 'ok', mensaje: 'Cargados ' + regs.length + ' registros.' };
        });
    });

    var testRegistrosLocal = test('💾 Registros en localStorage', function () {
        try {
            var raw = localStorage.getItem('rifa_registros_v2');
            if (!raw) return { estado: 'warn', mensaje: 'No hay clave rifa_registros_v2.' };
            var arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return { estado: 'fail', mensaje: 'No es un array.' };
            return { estado: 'ok', mensaje: arr.length + ' registros en localStorage.' };
        } catch (e) {
            return { estado: 'fail', mensaje: 'Error: ' + e.message };
        }
    });

    /* ---------- GRUPO 6 · Validaciones ---------- */
    var testValidaciones = test('✅ Validaciones funcionan', function () {
        if (!global.UI) return { estado: 'fail', mensaje: 'UI no definido.' };
        var casos = [
            ['cedula válida',   global.UI.esCedulaValida('V-12.345.678'), true],
            ['cedula corta',    global.UI.esCedulaValida('123'), false],
            ['tel válido',      global.UI.esTelefonoValido('+584141234567'), true],
            ['tel corto',       global.UI.esTelefonoValido('123'), false],
            ['num válido 07',   global.UI.esNumeroRifaValido('07'), true],
            ['num inválido 123',global.UI.esNumeroRifaValido('123'), false],
            ['normalizar 7→07', global.UI.normalizarNumero('7') === '07', true],
            ['formatear cedula',global.UI.formatearCedula('12345678') === 'V-12.345.678', true]
        ];
        var fallos = casos.filter(function (c) { return c[1] !== c[2]; });
        if (fallos.length > 0) {
            return { estado: 'fail', mensaje: 'Fallan: ' + fallos.map(function (f) { return f[0]; }).join(', ') };
        }
        return { estado: 'ok', mensaje: casos.length + ' validaciones correctas.' };
    });

    var testCodigo = test('🔐 Generar código boleto', function () {
        if (!global.Store) return { estado: 'fail', mensaje: 'Store no definido.' };
        var c1 = global.Store.generarCodigoBoleto('Test', '07', '12345678', '2026-01-01T00:00:00Z', 'Chance A');
        var c2 = global.Store.generarCodigoBoleto('Test', '07', '12345678', '2026-01-01T00:00:00Z', 'Chance A');
        var c3 = global.Store.generarCodigoBoleto('Otro', '07', '12345678', '2026-01-01T00:00:00Z', 'Chance A');
        if (c1 !== c2) return { estado: 'fail', mensaje: 'No determinista.' };
        if (c1 === c3) return { estado: 'warn', mensaje: 'Inputs distintos → mismo código.' };
        return { estado: 'ok', mensaje: 'Código: ' + c1 };
    });

    /* ---------- GRUPO 7 · DOM de páginas ---------- */
    var testIndexDOM = test('🏠 index.html estructura', function () {
        return fetchTexto('index.html').then(function (html) {
            if (!html) return { estado: 'warn', mensaje: 'No se pudo leer.' };
            var req = ['data-page="index"', 'assets/js/ui.js', 'assets/js/storage.js', 'assets/js/theme.js'];
            var faltan = req.filter(function (s) { return html.indexOf(s) === -1; });
            if (faltan.length) return { estado: 'fail', mensaje: 'Falta: ' + faltan.join(', ') };
            return { estado: 'ok', mensaje: 'Estructura correcta.' };
        });
    });

    /* ---------- ACTUALIZADO: rifas.html con nuevo diseño ---------- */
    var testRifasDOM = test('🎟️ rifas.html estructura', function () {
        return fetchTexto('rifas.html').then(function (html) {
            if (!html) return { estado: 'warn', mensaje: 'No se pudo leer.' };

            // IDs reales del nuevo diseño (mini barra + modal dinámico)
            var req = [
                'id="grid"',
                'id="mini-bar"',
                'id="mini-resumen"',
                'id="mini-comprar"',
                'data-page="rifas"',
                'assets/js/rifas.js'
            ];
            var faltan = req.filter(function (s) { return html.indexOf(s) === -1; });
            if (faltan.length) return { estado: 'fail', mensaje: 'Falta: ' + faltan.join(', ') };
            return { estado: 'ok', mensaje: 'Estructura correcta (mini barra + grid).' };
        });
    });

    var testBoletoDOM = test('🎫 boleto.html estructura', function () {
        return fetchTexto('boleto.html').then(function (html) {
            if (!html) return { estado: 'warn', mensaje: 'No se pudo leer.' };
            var req = ['id="panel-registro"', 'id="panel-auth"', 'id="panel-boletos"',
                       'id="f-nombre"', 'id="f-cedula"', 'id="f-telefono"',
                       'data-page="boleto"', 'assets/js/boleto.js'];
            var faltan = req.filter(function (s) { return html.indexOf(s) === -1; });
            if (faltan.length) return { estado: 'fail', mensaje: 'Falta: ' + faltan.join(', ') };
            return { estado: 'ok', mensaje: 'Estructura correcta.' };
        });
    });

    var testAdminDOM = test('⚙️ admin.html estructura', function () {
        return fetchTexto('admin.html').then(function (html) {
            if (!html) return { estado: 'warn', mensaje: 'No se pudo leer.' };
            var req = ['id="admin-tabs"', 'id="lista-reservas"', 'id="stat-libres"',
                       'id="color-acento"', 'id="ident-nombre"', 'id="pin-overlay"',
                       'id="fab-venta"', 'data-page="admin"', 'assets/js/admin.js',
                       'assets/css/admin.css'];
            var faltan = req.filter(function (s) { return html.indexOf(s) === -1; });
            if (faltan.length) return { estado: 'fail', mensaje: 'Falta: ' + faltan.join(', ') };
            return { estado: 'ok', mensaje: 'Estructura correcta.' };
        });
    });

    var testCartelDOM = test('🖼️ cartel.html estructura', function () {
        return fetchTexto('cartel.html').then(function (html) {
            if (!html) return { estado: 'warn', mensaje: 'No se pudo leer.' };
            var req = ['id="cartel-flyer"', 'id="cf-grid"', 'id="cf-btn-descargar"',
                       'data-page="cartel"'];
            var faltan = req.filter(function (s) { return html.indexOf(s) === -1; });
            if (faltan.length) return { estado: 'fail', mensaje: 'Falta: ' + faltan.join(', ') };
            return { estado: 'ok', mensaje: 'Estructura correcta.' };
        });
    });

    /* ---------- GRUPO 8 · Enlaces cruzados ---------- */
    var testEnlaces = test('🔗 Todos los enlaces HTML existen', function () {
        var paginas = ['index.html', 'rifas.html', 'boleto.html', 'terminos.html',
                       'premios.html', 'motivo.html', 'admin.html', 'instrucciones.html',
                       'cartel.html'];

        return Promise.all(paginas.map(function (p) {
            return fetchTexto(p).then(function (html) {
                if (!html) return { pagina: p, enlaces: [] };
                var regex = /href=["']([^"'#][^"']*\.html)["']/g;
                var enlaces = [];
                var m;
                while ((m = regex.exec(html)) !== null) {
                    var limpio = m[1].replace(/^\.\//, '').split('?')[0];
                    if (enlaces.indexOf(limpio) === -1) enlaces.push(limpio);
                }
                return { pagina: p, enlaces: enlaces };
            });
        })).then(function (resultadosPag) {
            var rotos = [];
            resultadosPag.forEach(function (r) {
                r.enlaces.forEach(function (e) {
                    if (paginas.indexOf(e) === -1) {
                        rotos.push(r.pagina + ' → ' + e);
                    }
                });
            });
            if (rotos.length > 0) {
                return {
                    estado: 'fail',
                    mensaje: 'Enlaces rotos: ' + rotos.join(' · ')
                };
            }
            return { estado: 'ok', mensaje: 'Todos los enlaces apuntan a páginas existentes.' };
        });
    });

    var testInstrucciones = test('📘 instrucciones.html existe', function () {
        if (location.protocol === 'file:') return { estado: 'warn', mensaje: 'file://.' };
        return fetchConTimeout('instrucciones.html', 4000, 'GET').then(function (r) {
            if (!r.ok) {
                return {
                    estado: 'fail',
                    mensaje: 'Falta instrucciones.html · el enlace desde rifas.html da 404.'
                };
            }
            return { estado: 'ok', mensaje: 'Existe (' + r.size + ' B).' };
        });
    });

    /* ---------- GRUPO 9 · PWA ---------- */
    var testManifest = test('📱 manifest.json válido', function () {
        return fetchTexto('pwa/manifest.json').then(function (txt) {
            if (!txt) return { estado: 'warn', mensaje: 'No se pudo leer.' };
            try {
                var m = JSON.parse(txt);
                var errs = [];
                if (!m.name) errs.push('sin name');
                if (!m.short_name) errs.push('sin short_name');
                if (!m.start_url) errs.push('sin start_url');
                if (!Array.isArray(m.icons) || m.icons.length === 0) errs.push('sin icons');
                if (errs.length) return { estado: 'fail', mensaje: errs.join(', ') };
                return { estado: 'ok', mensaje: 'Manifest válido · ' + m.name };
            } catch (e) {
                return { estado: 'fail', mensaje: 'JSON inválido: ' + e.message };
            }
        });
    });

    var testSW = test('⚙️ Service Worker soportado', function () {
        if (!('serviceWorker' in navigator)) return { estado: 'warn', mensaje: 'No soportado.' };
        if (location.protocol === 'file:') return { estado: 'warn', mensaje: 'file:// no permite SW.' };
        var activo = !!navigator.serviceWorker.controller;
        return {
            estado: 'ok',
            mensaje: activo ? 'SW activo.' : 'Soportado pero no registrado aún.'
        };
    });

    /* ---------- GRUPO 10 · MD ---------- */
    var testMDTerminos = test('📜 Cargar content/terminos.md', function () {
        if (!global.MD) return { estado: 'fail', mensaje: 'MD no definido.' };
        return global.MD.cargar('content/terminos.md', 'terminos').then(function (html) {
            if (!html || html.length < 100) {
                return { estado: 'warn', mensaje: 'Contenido corto (' + (html ? html.length : 0) + ').' };
            }
            return { estado: 'ok', mensaje: html.length + ' caracteres.' };
        });
    });

    var testMDMotivo = test('💡 Cargar content/motivo.md', function () {
        if (!global.MD) return { estado: 'fail', mensaje: 'MD no definido.' };
        return global.MD.cargar('content/motivo.md', 'motivo').then(function (html) {
            if (!html || html.length < 100) {
                return { estado: 'warn', mensaje: 'Contenido corto.' };
            }
            return { estado: 'ok', mensaje: html.length + ' caracteres.' };
        });
    });

    var testMDParser = test('🔤 Parser Markdown', function () {
        if (!global.MD) return { estado: 'fail', mensaje: 'MD no definido.' };
        var html = global.MD.parsear('# Hola\n\n**negrita** y *cursiva*');
        if (html.indexOf('<h1>') === -1) return { estado: 'fail', mensaje: 'No detecta H1' };
        if (html.indexOf('<strong>') === -1) return { estado: 'fail', mensaje: 'No detecta negrita' };
        if (html.indexOf('<em>') === -1) return { estado: 'fail', mensaje: 'No detecta cursiva' };
        return { estado: 'ok', mensaje: 'Parser OK.' };
    });

    /* ---------- GRUPO 11 · Tema ---------- */
    var testTema = test('🎨 Variables CSS del tema', function () {
        var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        if (!accent) return { estado: 'fail', mensaje: '--accent no definida.' };
        var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
        return { estado: 'ok', mensaje: '--accent=' + accent + ' · --bg=' + (bg || 'n/a') };
    });

    var testTemaHTML = test('🎨 Atributos data-theme aplicados', function () {
        var els = document.querySelectorAll('[data-theme]');
        return { estado: 'ok', mensaje: els.length + ' elementos con data-theme en este test.' };
    });

    /* ============================================================
       7. SUITE
       ============================================================ */
    var SUITE = [
        testContexto,
        testCarpetas,
        testArchivos,
        testUI, testStore, testMD, testTheme,
        testLocalStorage, testSessionStorage,
        testConfig, testRegistros, testRegistrosLocal,
        testValidaciones, testCodigo,
        testIndexDOM, testRifasDOM, testBoletoDOM, testAdminDOM, testCartelDOM,
        testEnlaces, testInstrucciones,
        testManifest, testSW,
        testMDTerminos, testMDMotivo, testMDParser,
        testTema, testTemaHTML
    ];

    function ejecutarSuite() {
        if (ejecutando) return;
        ejecutando = true;
        resultados = [];
        archivosEstado = {};
        limpiarLog();
        logLinea('=== DIAGNÓSTICO v2 INICIADO ===', 'info');

        var btn = document.getElementById('btn-ejecutar');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Ejecutando…'; }

        var promesas = SUITE.map(function (t) { return t(); });

        Promise.all(promesas).then(function () {
            logLinea('=== DIAGNÓSTICO COMPLETADO ===', 'info');
            renderizarResultados();
            if (btn) { btn.disabled = false; btn.textContent = '▶️ Ejecutar de nuevo'; }
            ['btn-copiar-informe', 'btn-copiar-fallos', 'btn-limpiar', 'btn-registro-prueba']
                .forEach(function (id) {
                    var b = document.getElementById(id);
                    if (b) b.disabled = false;
                });
            ejecutando = false;
        }).catch(function (err) {
            logLinea('❌ Error: ' + err, 'fail');
            ejecutando = false;
            if (btn) { btn.disabled = false; btn.textContent = '▶️ Ejecutar'; }
        });
    }

    /* ============================================================
       8. RENDER
       ============================================================ */
    function renderizarResultados() {
        var cont = document.getElementById('resultados');
        if (!cont) return;

        var ok = resultados.filter(function (r) { return r.estado === 'ok'; }).length;
        var fail = resultados.filter(function (r) { return r.estado === 'fail'; }).length;
        var warn = resultados.filter(function (r) { return r.estado === 'warn'; }).length;

        document.getElementById('cont-ok').textContent    = ok;
        document.getElementById('cont-fail').textContent  = fail;
        document.getElementById('cont-total').textContent = resultados.length;
        document.getElementById('cont-resultados').textContent = resultados.length + ' tests';

        var html = ['<div class="seccion">',
            '<h3>Resultados<span class="contador">' + resultados.length + ' tests</span></h3>'];

        resultados.forEach(function (r) {
            var icono = r.estado === 'ok' ? '✅' : r.estado === 'warn' ? '⚠️' : '❌';
            html.push(
                '<div class="test-item ' + r.estado + '">',
                    '<span class="icono">' + icono + '</span>',
                    '<div class="contenido">',
                        '<div class="nombre">' + escapeHtml(r.nombre) + '</div>',
                        '<div class="mensaje">' + escapeHtml(r.mensaje) + '</div>',
                    '</div>',
                '</div>'
            );
        });
        html.push('</div>');

        if (fail === 0) {
            html.push('<div class="seccion" style="border-color:rgba(52,211,153,.5)">',
                '<h3 style="color:#34d399">🎉 Sin errores críticos</h3>',
                '<p style="color:#94a3b8;font-size:.85rem">' +
                (warn > 0 ? 'Hay ' + warn + ' advertencia(s) menores.' : 'Todo verde.') +
                '</p></div>');
        } else {
            html.push('<div class="seccion" style="border-color:rgba(248,113,113,.5)">',
                '<h3 style="color:#f87171">🚨 ' + fail + ' problema(s)</h3>',
                '<p style="color:#94a3b8;font-size:.85rem">Revisa los tests marcados en rojo.</p></div>');
        }

        cont.innerHTML = html.join('');
    }

    function renderizarListaArchivos() {
        var cont = document.getElementById('lista-archivos');
        var sec = document.getElementById('seccion-archivos');
        var contador = document.getElementById('cont-archivos');
        if (!cont || !sec) return;

        var rutas = Object.keys(archivosEstado);
        if (rutas.length === 0) return;

        sec.style.display = 'block';
        if (contador) contador.textContent = rutas.length;

        var html = rutas.map(function (ruta) {
            var e = archivosEstado[ruta];
            var icono = e.ok ? '✓' : '✗';
            var color = e.ok ? (e.pesoMinOk ? '#34d399' : '#fbbf24') : '#f87171';
            var tam = e.ok ? (e.size + ' B') : 'FALTA (' + e.status + ')';
            var tipo = e.tipoMime ? ' · ' + e.tipoMime.split(';')[0] : '';
            var opc = e.obligatorio ? '' : ' (opcional)';
            return '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 10px;background:#0f172a;border:1px solid #334155;border-radius:6px;margin-bottom:4px;font-size:.78rem">' +
                '<span style="color:' + color + ';font-weight:800">' + icono + ' ' +
                    escapeHtml(ruta) + opc + '</span>' +
                '<span style="color:#94a3b8;font-family:monospace;font-size:.72rem">' +
                    escapeHtml(tam + tipo) + '</span>' +
            '</div>';
        }).join('');

        cont.innerHTML = html;
    }

    /* ============================================================
       9. GENERADOR DE INFORME
       ============================================================ */
    function generarInforme(soloFallos) {
        var fecha = new Date();
        var fechaHumana = fecha.toLocaleString('es-VE');

        var ok = resultados.filter(function (r) { return r.estado === 'ok'; }).length;
        var fail = resultados.filter(function (r) { return r.estado === 'fail'; }).length;
        var warn = resultados.filter(function (r) { return r.estado === 'warn'; }).length;

        var L = [];
        var sep = '════════════════════════════════════════════════════════════';
        var sep2 = '────────────────────────────────────────────────────────────';

        L.push(sep);
        L.push('  INFORME DE DIAGNÓSTICO · MOTOR DE RIFAS');
        L.push(sep);
        L.push('');
        L.push('📅 Generado:  ' + fechaHumana);
        L.push('🔢 Versión:   ' + VERSION);
        L.push('🌐 URL:       ' + location.href);
        L.push('📡 Protocolo: ' + location.protocol);
        L.push('📱 Viewport:  ' + window.innerWidth + 'x' + window.innerHeight);
        L.push('🌍 Idioma:    ' + navigator.language);
        L.push('🖥️  UA:        ' + navigator.userAgent);
        L.push('');

        L.push('📊 RESUMEN');
        L.push(sep2);
        L.push('Total de tests:    ' + resultados.length);
        L.push('✅ Pasaron:        ' + ok);
        L.push('⚠️  Advertencias:   ' + warn);
        L.push('❌ Fallaron:       ' + fail);
        L.push('');

        if (Object.keys(archivosEstado).length > 0) {
            L.push('📁 INVENTARIO DE ARCHIVOS');
            L.push(sep2);
            Object.keys(archivosEstado).forEach(function (ruta) {
                var e = archivosEstado[ruta];
                var icono = e.ok ? (e.pesoMinOk ? '✓' : '⚠') : '✗';
                var tam = e.ok ? (e.size + 'B') : 'FALTA';
                var tipo = e.tipoMime ? e.tipoMime.split(';')[0] : '';
                var opc = e.obligatorio ? '' : ' [opcional]';
                var pad = ruta + opc;
                while (pad.length < 42) pad += ' ';
                L.push(icono + ' ' + pad + tam + (tipo ? ' · ' + tipo : ''));
            });
            L.push('');
        }

        L.push('📋 DETALLE DE TESTS');
        L.push(sep2);
        resultados.forEach(function (r, i) {
            if (soloFallos && r.estado === 'ok') return;
            var icono = r.estado === 'ok' ? '[✅]' : r.estado === 'warn' ? '[⚠️]' : '[❌]';
            L.push(icono + ' ' + (i + 1) + '. ' + r.nombre);
            if (r.mensaje) L.push('        → ' + r.mensaje);
            L.push('');
        });

        L.push('🔍 NAMESPACES CARGADOS');
        L.push(sep2);
        ['UI', 'Store', 'MD', 'Theme'].forEach(function (ns) {
            var obj = global[ns];
            if (!obj) {
                L.push('window.' + ns + '  ❌ NO DEFINIDO');
            } else {
                var numFunc = 0;
                Object.keys(obj).forEach(function (k) {
                    if (typeof obj[k] === 'function') numFunc++;
                });
                L.push('window.' + ns + '  ✅ ' + numFunc + ' funciones');
            }
        });
        L.push('');

        L.push('💾 ALMACENAMIENTO');
        L.push(sep2);
        try {
            var claves = [];
            for (var k in localStorage) {
                if (localStorage.hasOwnProperty(k)) claves.push(k);
            }
            L.push('localStorage:    ' + claves.length + ' claves');
            claves.forEach(function (c) {
                try {
                    var v = localStorage.getItem(c);
                    var tam = (v || '').length;
                    L.push('  · ' + c + '  (' + tam + ' chars)');
                } catch (e) {
                    L.push('  · ' + c + '  (error leyendo)');
                }
            });
        } catch (e) {
            L.push('localStorage:    ERROR ' + e.message);
        }
        L.push('');

        L.push(sep);
        L.push('  FIN DEL INFORME');
        L.push(sep);

        return L.join('\n');
    }

    function copiarInforme(soloFallos) {
        if (resultados.length === 0) {
            alert('Ejecuta el diagnóstico primero.');
            return;
        }

        var informe = generarInforme(soloFallos);

        if (global.UI && global.UI.copiar) {
            global.UI.copiar(informe).then(function (ok) {
                if (ok) {
                    alert('✅ Informe copiado.\n\nLongitud: ' + informe.length + ' caracteres.');
                } else {
                    mostrarTextoParaCopiar(informe);
                }
            });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(informe).then(function () {
                alert('✅ Informe copiado (' + informe.length + ' caracteres).');
            }, function () {
                mostrarTextoParaCopiar(informe);
            });
        } else {
            mostrarTextoParaCopiar(informe);
        }
    }

    function mostrarTextoParaCopiar(informe) {
        var ta = document.createElement('textarea');
        ta.value = informe;
        ta.style.position = 'fixed';
        ta.style.left = '10px'; ta.style.top = '10px';
        ta.style.right = '10px'; ta.style.bottom = '10px';
        ta.style.zIndex = '9999';
        ta.style.background = '#0f172a';
        ta.style.color = '#f8fafc';
        ta.style.border = '2px solid #fbbf24';
        ta.style.borderRadius = '10px';
        ta.style.padding = '12px';
        ta.style.fontFamily = 'monospace';
        ta.style.fontSize = '12px';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);

        var btn = document.createElement('button');
        btn.textContent = '✕ Cerrar';
        btn.style.cssText = 'position:fixed;bottom:20px;left:20px;right:20px;padding:12px;background:#f87171;color:#fff;border:none;border-radius:8px;font-weight:bold;z-index:10000;';
        btn.onclick = function () {
            document.body.removeChild(ta);
            document.body.removeChild(btn);
        };
        document.body.appendChild(btn);
    }

    /* ============================================================
       10. SISTEMA DE FEEDBACK
       ============================================================ */
    function initFeedback() {
        var stars = document.querySelectorAll('#stars button');
        var txt = document.getElementById('feedback-comentario');
        var btnEnviar = document.getElementById('btn-enviar-feedback');
        var btnOmitir = document.getElementById('btn-omitir-feedback');
        var msg = document.getElementById('feedback-msg');
        var contador = document.getElementById('feedback-contador');
        var box = document.getElementById('feedback-box');

        if (!stars.length || !btnEnviar) return;

        var historial = [];
        try {
            var raw = localStorage.getItem(KEY_FEEDBACK);
            historial = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(historial)) historial = [];
        } catch (e) { historial = []; }

        if (contador && historial.length > 0) {
            contador.textContent = '📊 Ya has enviado ' + historial.length + ' opinión(es).';
        }

        stars.forEach(function (star) {
            star.addEventListener('click', function () {
                ratingSeleccionado = parseInt(star.dataset.rating, 10);
                stars.forEach(function (s) {
                    s.classList.toggle('activa',
                        parseInt(s.dataset.rating, 10) <= ratingSeleccionado);
                });
                if (msg) msg.textContent = '';
            });
        });

        btnEnviar.addEventListener('click', function () {
            if (ratingSeleccionado === 0) {
                if (msg) {
                    msg.style.color = '#f87171';
                    msg.textContent = 'Selecciona al menos 1 estrella.';
                }
                return;
            }

            var feedback = {
                id: global.UI ? global.UI.generarId() : String(Date.now()),
                rating: ratingSeleccionado,
                comentario: txt ? txt.value.trim() : '',
                fecha: new Date().toISOString(),
                version: VERSION,
                contexto: {
                    url: location.href,
                    protocolo: location.protocol,
                    viewport: window.innerWidth + 'x' + window.innerHeight,
                    idioma: navigator.language,
                    ua: navigator.userAgent
                },
                resultadosResumen: {
                    total: resultados.length,
                    ok: resultados.filter(function (r) { return r.estado === 'ok'; }).length,
                    fail: resultados.filter(function (r) { return r.estado === 'fail'; }).length,
                    warn: resultados.filter(function (r) { return r.estado === 'warn'; }).length
                }
            };

            historial.push(feedback);
            try {
                localStorage.setItem(KEY_FEEDBACK, JSON.stringify(historial));
            } catch (e) {
                if (msg) { msg.style.color = '#f87171'; msg.textContent = 'Error al guardar.'; }
                return;
            }

            if (msg) {
                msg.style.color = '#34d399';
                msg.textContent = '✅ ¡Gracias! Tu opinión se guardó (' + ratingSeleccionado + ' ⭐)';
            }
            if (contador) {
                contador.textContent = '📊 Ya has enviado ' + historial.length + ' opinión(es).';
            }

            btnEnviar.disabled = true;
            btnOmitir.disabled = true;
            stars.forEach(function (s) { s.disabled = true; });
            if (txt) txt.disabled = true;
        });

        btnOmitir.addEventListener('click', function () {
            if (box) box.style.display = 'none';
            try {
                localStorage.setItem('rifa_feedback_omitido_v1', new Date().toISOString());
            } catch (e) { /* silent */ }
        });

        try {
            var omitido = localStorage.getItem('rifa_feedback_omitido_v1');
            if (omitido) {
                var dias = (Date.now() - new Date(omitido).getTime()) / 86400000;
                if (dias < 7) box.style.display = 'none';
            }
        } catch (e) { /* silent */ }
    }

    /* ============================================================
       11. SIMULAR REGISTRO
       ============================================================ */
    function simularRegistro() {
        if (!global.Store || !global.UI) {
            alert('Los módulos no están cargados.');
            return;
        }
        var numero = String(Math.floor(Math.random() * 100)).padStart(2, '0');
        var fecha = new Date().toISOString();
        var reg = {
            id: global.UI.generarId(),
            numero: numero,
            nombre: 'Test Diagnóstico',
            cedula: 'V-99.999.999',
            telefono: '+584140000000',
            estado: 'apartado',
            metodoPago: null,
            boleto: global.Store.generarCodigoBoleto('Test Diagnóstico', numero, '99999999', fecha, 'Chance A'),
            aceptoTerminos: true,
            versionTerminos: 'v1',
            notas: 'Test desde test.html',
            fecha: fecha
        };
        logLinea('🧪 Creando registro del número ' + numero + '…', 'info');
        global.Store.crearRegistros([reg]).then(function (res) {
            if (res && res.ok) {
                logLinea('✅ Registro creado · origen: ' + res.origen, 'ok');
                alert('🧪 Registro de prueba creado.\n\nNúmero: ' + numero + '\nOrigen: ' + res.origen);
            } else {
                logLinea('❌ Falló', 'fail');
                alert('❌ No se pudo crear. Revisa el log.');
            }
        }).catch(function (err) {
            logLinea('❌ ' + err.message, 'fail');
            alert('Error: ' + err.message);
        });
    }

    /* ============================================================
       12. LIMPIAR Y RECARGAR
       ============================================================ */
    function limpiarYRecargar() {
        if (!confirm('¿Borrar todas las cachés y recargar?')) return;
        var promesas = [];
        if ('serviceWorker' in navigator) {
            promesas.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
                return Promise.all(regs.map(function (r) { return r.unregister(); }));
            }).catch(function () { return null; }));
        }
        if ('caches' in global) {
            promesas.push(caches.keys().then(function (keys) {
                return Promise.all(keys.map(function (k) { return caches.delete(k); }));
            }).catch(function () { return null; }));
        }
        Promise.all(promesas).then(function () {
            logLinea('🧹 Cachés limpias. Recargando…', 'info');
            setTimeout(function () { location.reload(); }, 500);
        });
    }

    /* ============================================================
       13. BIND
       ============================================================ */
    function bind() {
        var b;
        b = document.getElementById('btn-ejecutar');
        if (b) b.addEventListener('click', ejecutarSuite);

        b = document.getElementById('btn-copiar-informe');
        if (b) b.addEventListener('click', function () { copiarInforme(false); });

        b = document.getElementById('btn-copiar-fallos');
        if (b) b.addEventListener('click', function () { copiarInforme(true); });

        b = document.getElementById('btn-limpiar');
        if (b) b.addEventListener('click', limpiarYRecargar);

        b = document.getElementById('btn-registro-prueba');
        if (b) b.addEventListener('click', simularRegistro);

        initFeedback();
    }

    /* ============================================================
       14. ARRANQUE
       ============================================================ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            bind();
            setTimeout(ejecutarSuite, 500);
        });
    } else {
        bind();
        setTimeout(ejecutarSuite, 500);
    }

})(typeof window !== 'undefined' ? window : this);