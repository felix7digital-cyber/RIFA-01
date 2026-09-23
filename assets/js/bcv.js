/* ============================================================
   MOTOR DE RIFAS · assets/js/bcv.js
   Módulo de tasas: BCV (USD→VES) + COP (USD→COP)
   Auto + Manual con caché y fallback
   Expone window.BCV
   Marco: CCG-IA v1.0.0 · Autor: Felix
   ============================================================ */

(function (global) {
    'use strict';

    var U = global.UI;

    /* ============================================================
       1. CONSTANTES
       ============================================================ */
    var CACHE_KEY_BCV = 'rifa_bcv_v1';
    var CACHE_KEY_COP = 'rifa_cop_v1';

    // Si la caché tiene menos de X horas, no se vuelve a consultar.
    var CACHE_MAX_AGE_BCV = 6 * 60 * 60 * 1000;   // 6 horas
    var CACHE_MAX_AGE_COP = 12 * 60 * 60 * 1000;  // 12 horas (COP varía menos)

    // Timeout de cada petición (8 segundos)
    var FETCH_TIMEOUT = 8000;

    /* ============================================================
       2. FUENTES DE LAS APIs
       ============================================================ */

    // --- BCV: tasa oficial USD → VES ---
    var SOURCES_BCV = [
        {
            name: 'dolarapi.com',
            url: 'https://ve.dolarapi.com/v1/dolares/oficial',
            parse: function (d) {
                var price = Number(d && (d.promedio || d.venta || d.compra));
                if (!isFinite(price) || price <= 0) throw new Error('precio inválido');
                var raw = d && d.fechaActualizacion;
                return {
                    rate: price,
                    updated: raw ? new Date(raw) : new Date()
                };
            }
        },
        {
            name: 'pydolarve.org',
            url: 'https://pydolarve.org/api/v1/dollar?page=bcv',
            parse: function (d) {
                var m = (d && d.monitor) || d;
                var price = Number(m && m.price);
                if (!isFinite(price) || price <= 0) throw new Error('precio inválido');
                var raw = m && (m.last_update || m.lastUpdate || m.fechaActualizacion);
                return {
                    rate: price,
                    updated: raw ? new Date(String(raw).replace(' ', 'T')) : new Date()
                };
            }
        }
    ];

    // --- COP: tasa USD → COP ---
    var SOURCES_COP = [
        {
            name: 'open.er-api.com',
            url: 'https://open.er-api.com/v6/latest/USD',
            parse: function (d) {
                var rate = Number(d && d.rates && d.rates.COP);
                if (!isFinite(rate) || rate <= 0) throw new Error('precio inválido');
                var raw = d && d.time_last_update_utc;
                return {
                    rate: rate,
                    updated: raw ? new Date(raw) : new Date()
                };
            }
        },
        {
            name: 'exchangerate-api.com',
            url: 'https://api.exchangerate-api.com/v4/latest/USD',
            parse: function (d) {
                var rate = Number(d && d.rates && d.rates.COP);
                if (!isFinite(rate) || rate <= 0) throw new Error('precio inválido');
                var raw = d && (d.time_last_update_utc || d.date);
                return {
                    rate: rate,
                    updated: raw ? new Date(raw) : new Date()
                };
            }
        }
    ];

    /* ============================================================
       3. ESTADO INTERNO
       ============================================================ */
    var _cacheBcv = null;
    var _cacheCop = null;
    var _loadingBcv = null;
    var _loadingCop = null;
    var _listeners = [];

    /* ============================================================
       4. CACHÉ GENÉRICA EN LOCALSTORAGE
       ============================================================ */
    function leerCache(clave) {
        try {
            var raw = localStorage.getItem(clave);
            if (!raw) return null;
            var d = JSON.parse(raw);
            if (!d || !isFinite(d.rate) || d.rate <= 0) return null;
            return {
                rate: d.rate,
                updated: new Date(d.updated),
                source: d.source || null,
                manual: !!d.manual
            };
        } catch (e) { return null; }
    }

    function guardarCache(clave, rate, updated, source, manual) {
        try {
            localStorage.setItem(clave, JSON.stringify({
                rate: rate,
                updated: (updated instanceof Date ? updated : new Date()).toISOString(),
                source: source || null,
                manual: !!manual
            }));
        } catch (e) { /* silent */ }
    }

    function borrarCache(clave) {
        try { localStorage.removeItem(clave); } catch (e) { /* silent */ }
    }

    /* ============================================================
       5. CONFIGURACIÓN (dentro de Store.leerConfig())
       ============================================================
       cfg.bcv = {
         modo: 'auto' | 'manual',
         tasaManual: null | number,
         modoCop: 'auto' | 'manual',
         tasaManualCop: null | number
       }
       ============================================================ */
    function leerConfigTasas() {
        var Store = global.Store;
        var cfg = Store ? Store.leerConfig() : null;
        var bcv = (cfg && cfg.bcv) || {};

        return {
            modo:          bcv.modo === 'manual' ? 'manual' : 'auto',
            tasaManual:    (typeof bcv.tasaManual === 'number' && bcv.tasaManual > 0)
                ? bcv.tasaManual : null,
            modoCop:       bcv.modoCop === 'manual' ? 'manual' : 'auto',
            tasaManualCop: (typeof bcv.tasaManualCop === 'number' && bcv.tasaManualCop > 0)
                ? bcv.tasaManualCop : null
        };
    }

    function guardarConfigTasas(cambios) {
        var Store = global.Store;
        if (!Store) return false;
        var cfg = Store.leerConfig();
        cfg.bcv = Object.assign({}, cfg.bcv || {}, cambios);
        Store.guardarConfig(cfg);
        return true;
    }

    /* ============================================================
       6. FETCH CON TIMEOUT
       ============================================================ */
    function fetchJSON(url, ms) {
        return new Promise(function (resolve, reject) {
            var controller = typeof AbortController !== 'undefined'
                ? new AbortController()
                : null;

            var timer = setTimeout(function () {
                if (controller) controller.abort();
                reject(new Error('timeout'));
            }, ms || FETCH_TIMEOUT);

            var opts = { cache: 'no-store' };
            if (controller) opts.signal = controller.signal;

            fetch(url, opts)
                .then(function (r) {
                    clearTimeout(timer);
                    if (!r.ok) {
                        reject(new Error('HTTP ' + r.status));
                        return;
                    }
                    return r.json().then(resolve, reject);
                })
                .catch(function (e) {
                    clearTimeout(timer);
                    reject(e);
                });
        });
    }

    /* ============================================================
       7. FETCH CON FALLBACK
       ============================================================ */
    function fetchRemotoBcv() {
        if (_loadingBcv) return _loadingBcv;

        var idx = 0;

        function intentar() {
            if (idx >= SOURCES_BCV.length) {
                return Promise.reject(new Error('Sin fuentes BCV'));
            }
            var src = SOURCES_BCV[idx++];

            return fetchJSON(src.url)
                .then(function (data) {
                    var parsed = src.parse(data);
                    var resultado = {
                        rate: parsed.rate,
                        updated: parsed.updated,
                        source: src.name,
                        manual: false
                    };
                    _cacheBcv = resultado;
                    guardarCache(CACHE_KEY_BCV, parsed.rate, parsed.updated, src.name, false);
                    notificar();
                    return resultado;
                })
                .catch(function (err) {
                    U.warn('BCV: falló ' + src.name + ' · ' + err.message);
                    return intentar();
                });
        }

        _loadingBcv = intentar().then(function (r) {
            _loadingBcv = null;
            return r;
        }, function (e) {
            _loadingBcv = null;
            throw e;
        });

        return _loadingBcv;
    }

    function fetchRemotoCop() {
        if (_loadingCop) return _loadingCop;

        var idx = 0;

        function intentar() {
            if (idx >= SOURCES_COP.length) {
                return Promise.reject(new Error('Sin fuentes COP'));
            }
            var src = SOURCES_COP[idx++];

            return fetchJSON(src.url)
                .then(function (data) {
                    var parsed = src.parse(data);
                    var resultado = {
                        rate: parsed.rate,
                        updated: parsed.updated,
                        source: src.name,
                        manual: false
                    };
                    _cacheCop = resultado;
                    guardarCache(CACHE_KEY_COP, parsed.rate, parsed.updated, src.name, false);
                    notificar();
                    return resultado;
                })
                .catch(function (err) {
                    U.warn('COP: falló ' + src.name + ' · ' + err.message);
                    return intentar();
                });
        }

        _loadingCop = intentar().then(function (r) {
            _loadingCop = null;
            return r;
        }, function (e) {
            _loadingCop = null;
            throw e;
        });

        return _loadingCop;
    }

    /* ============================================================
       8. HELPERS DE FRESCURA
       ============================================================ */
    function estaFresco(c, maxAge) {
        if (!c || !c.updated) return false;
        return (Date.now() - c.updated.getTime()) < maxAge;
    }

    /* ============================================================
       9. API PÚBLICA · getRate() · BCV
       ============================================================ */
    function getRate(force) {
        var cfg = leerConfigTasas();

        if (cfg.modo === 'manual' && cfg.tasaManual > 0) {
            return Promise.resolve({
                rate: Number(cfg.tasaManual),
                updated: new Date(),
                source: 'Manual',
                manual: true
            });
        }

        var cached = getCachedBcv();

        if (!force && cached && estaFresco(cached, CACHE_MAX_AGE_BCV) && !cached.manual) {
            return Promise.resolve(cached);
        }

        return fetchRemotoBcv().catch(function (err) {
            if (cached) {
                U.warn('BCV: usando caché antigua (' + err.message + ')');
                return cached;
            }
            throw err;
        });
    }

    /* ============================================================
       10. API PÚBLICA · getCopRate() · COP
       ============================================================ */
    function getCopRate(force) {
        var cfg = leerConfigTasas();

        if (cfg.modoCop === 'manual' && cfg.tasaManualCop > 0) {
            return Promise.resolve({
                rate: Number(cfg.tasaManualCop),
                updated: new Date(),
                source: 'Manual',
                manual: true
            });
        }

        var cached = getCachedCop();

        if (!force && cached && estaFresco(cached, CACHE_MAX_AGE_COP) && !cached.manual) {
            return Promise.resolve(cached);
        }

        return fetchRemotoCop().catch(function (err) {
            if (cached) {
                U.warn('COP: usando caché antigua (' + err.message + ')');
                return cached;
            }
            throw err;
        });
    }

    /* ============================================================
       11. getCached()
       ============================================================ */
    function getCachedBcv() {
        if (_cacheBcv) return _cacheBcv;
        _cacheBcv = leerCache(CACHE_KEY_BCV);
        return _cacheBcv;
    }

    function getCachedCop() {
        if (_cacheCop) return _cacheCop;
        _cacheCop = leerCache(CACHE_KEY_COP);
        return _cacheCop;
    }

    /* ============================================================
       12. CAMBIAR MODO MANUAL
       ============================================================ */
    function setManual(rate) {
        var n = Number(rate);
        if (!isFinite(n) || n <= 0) return false;

        guardarConfigTasas({ modo: 'manual', tasaManual: n });
        _cacheBcv = {
            rate: n, updated: new Date(), source: 'Manual', manual: true
        };
        guardarCache(CACHE_KEY_BCV, n, new Date(), 'Manual', true);
        notificar();
        return true;
    }

    function setAuto() {
        guardarConfigTasas({ modo: 'auto' });
        borrarCache(CACHE_KEY_BCV);
        _cacheBcv = null;
        notificar();
        return fetchRemotoBcv().catch(function () { return null; });
    }

    function setManualCop(rate) {
        var n = Number(rate);
        if (!isFinite(n) || n <= 0) return false;

        guardarConfigTasas({ modoCop: 'manual', tasaManualCop: n });
        _cacheCop = {
            rate: n, updated: new Date(), source: 'Manual', manual: true
        };
        guardarCache(CACHE_KEY_COP, n, new Date(), 'Manual', true);
        notificar();
        return true;
    }

    function setAutoCop() {
        guardarConfigTasas({ modoCop: 'auto' });
        borrarCache(CACHE_KEY_COP);
        _cacheCop = null;
        notificar();
        return fetchRemotoCop().catch(function () { return null; });
    }

    /* ============================================================
       13. LISTENERS
       ============================================================ */
    function suscribir(callback) {
        if (typeof callback !== 'function') return function () {};
        _listeners.push(callback);
        return function () {
            _listeners = _listeners.filter(function (cb) { return cb !== callback; });
        };
    }

    function notificar() {
        var snapshot = {
            bcv: getCachedBcv(),
            cop: getCachedCop()
        };
        _listeners.forEach(function (cb) {
            try { cb(snapshot); } catch (e) { /* silent */ }
        });
    }

    /* ============================================================
       14. HELPERS PÚBLICOS
       ============================================================ */
    function formatearTasa(rate) {
        var n = Number(rate);
        if (!isFinite(n) || n <= 0) return '—';
        return n.toLocaleString('es-VE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' Bs/$';
    }

    function formatearCop(rate) {
        var n = Number(rate);
        if (!isFinite(n) || n <= 0) return '—';
        return n.toLocaleString('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }) + ' COP/$';
    }

    function usdABS(usd, rate) {
        var n = Number(usd);
        var r = Number(rate);
        if (!isFinite(n) || !isFinite(r) || r <= 0) return null;
        return n * r;
    }

    function bsAUSD(bs, rate) {
        var n = Number(bs);
        var r = Number(rate);
        if (!isFinite(n) || !isFinite(r) || r <= 0) return null;
        return n / r;
    }

    /** Conversión específica USD → COP. */
    function usdACOP(usd, rateCop) {
        return usdABS(usd, rateCop);
    }

    /** Conversión específica COP → USD. */
    function copAUSD(cop, rateCop) {
        return bsAUSD(cop, rateCop);
    }

    function tiempoDesde(updated) {
        if (!updated) return '';
        var t = (updated instanceof Date) ? updated.getTime() : new Date(updated).getTime();
        if (!isFinite(t)) return '';
        var diff = Date.now() - t;
        var seg = Math.floor(diff / 1000);
        if (seg < 60) return 'hace unos segundos';
        var min = Math.floor(seg / 60);
        if (min < 60) return 'hace ' + min + ' min';
        var horas = Math.floor(min / 60);
        if (horas < 24) return 'hace ' + horas + ' h';
        var dias = Math.floor(horas / 24);
        return 'hace ' + dias + ' día' + (dias === 1 ? '' : 's');
    }

    /* ============================================================
       15. LIMPIEZA
       ============================================================ */
    function limpiarTodo() {
        borrarCache(CACHE_KEY_BCV);
        borrarCache(CACHE_KEY_COP);
        _cacheBcv = null;
        _cacheCop = null;
        guardarConfigTasas({
            modo: 'auto', tasaManual: null,
            modoCop: 'auto', tasaManualCop: null
        });
        notificar();
    }

    /* ============================================================
       16. API FINAL
       ============================================================ */
    var BCV = {
        // --- BCV ---
        getRate:       getRate,
        getCached:     getCachedBcv,
        fetchRate:     fetchRemotoBcv,
        setManual:     setManual,
        setAuto:       setAuto,
        formatearTasa: formatearTasa,

        // --- COP ---
        getCopRate:    getCopRate,
        getCachedCop:  getCachedCop,
        fetchCopRate:  fetchRemotoCop,
        setManualCop:  setManualCop,
        setAutoCop:    setAutoCop,
        formatearCop:  formatearCop,

        // --- Conversiones genéricas ---
        usdABS:   usdABS,
        bsAUSD:   bsAUSD,
        usdACOP:  usdACOP,
        copAUSD:  copAUSD,

        // --- Config ---
        leerConfigTasas:  leerConfigTasas,
        guardarConfigTasas: guardarConfigTasas,
        limpiarTodo:      limpiarTodo,

        // --- Utilidades ---
        tiempoDesde: tiempoDesde,
        estaFresco:  estaFresco,
        suscribir:   suscribir,

        // --- Debug ---
        CACHE_KEY:      CACHE_KEY_BCV,
        CACHE_KEY_COP:  CACHE_KEY_COP,
        SOURCES:        SOURCES_BCV.map(function (s) { return s.name; }),
        SOURCES_COP:    SOURCES_COP.map(function (s) { return s.name; })
    };

    global.BCV = BCV;

})(typeof window !== 'undefined' ? window : this);