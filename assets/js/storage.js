/* ============================================================
   MOTOR DE RIFAS · assets/js/storage.js
   Persistencia: localStorage + Cloudflare Worker (opcional)
   Config sync bidireccional con la nube.
   Muestra de grilla persistida (opción C2).
   Expone window.Store
   Marco: CCG-IA v1.0.0 · Autor: Felix
   ============================================================ */

(function (global) {
    'use strict';

    var U = global.UI;

    /* ============================================================
       1. CONSTANTES
       ============================================================ */
    var KEYS = {
        REGISTROS:  'rifa_registros_v2',
        CONFIG:     'rifa_config_v2',
        TERMINOS_OK:'rifa_terminos_v1',
        MI_CEDULA:  'rifa_mi_cedula_v1',
        MI_CLAVE:   'rifa_mi_clave_v1',
        PIN_SESION: 'rifa_pin_sesion_v1'
    };

    var API_BASE = '';

    var TOTAL_NUMEROS_DEFAULT = 100;
    var RANGO_MAX             = 100;   // el rango de números disponibles (00-99)

    var MODOS_ACCESO = ['cedula', 'clave', 'publico'];

    var CANTIDADES_VALIDAS = [10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100];

    /* ============================================================
       2. CONFIG POR DEFECTO
       ============================================================ */
    var CONFIG_DEFAULT = {
        version: 'v2',

        identidad: {
            nombreRifa: 'Gran Rifa Familiar',
            loteria:    'Chance A',
            monto:      '$5',
            whatsappOrg:'',
            fechaSorteo:'',
            horaSorteo: '19:00',
            nombreOrg:  'Familia Organizadora',
            horarioAtencion: '8:00 AM a 8:00 PM',
            mensajePredeterminado:
                '¡Hola! Confirmo la reserva de mi número para la Gran Rifa. ' +
                'Adjunto comprobante de pago por este medio.'
        },

        marca: {
            tipoLogo:       'emoji',
            logoValor:      '🎟️',
            colorAcento:    '#fbbf24',
            colorSecundario:'#38bdf8',
            tipografia:     'system'
        },

        plantilla: 'boleto',

        premios: [
            {
                puesto: 1,
                titulo: 'Premio principal',
                descripcion: 'Describe aquí el premio principal de la rifa.',
                imagen: null
            }
        ],

        terminosVersion: 'v1',

        opciones: {
            pinActivo:           false,
            pinValor:            '',
            backupAuto:          false,
            reservaHorasLimite:  48,
            sorteoVerificable:   true,
            mostrarInstrucciones:true,
            modoTerminos:        'auto',

            modoAcceso:          'cedula',
            totalNumeros:        100,
            aleatorioActivo:     false,
            grillaMezclada:      false,
            muestraGrilla:       []      // NUEVO · array de strings ordenados
        }
    };

    /* ============================================================
       3. HELPERS INTERNOS
       ============================================================ */

    function clonar(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function mergeDefaults(defaults, guardado) {
        if (!guardado || typeof guardado !== 'object') return clonar(defaults);
        var out = clonar(defaults);
        Object.keys(guardado).forEach(function (k) {
            var gv = guardado[k];
            var dv = out[k];
            if (gv && typeof gv === 'object' && !Array.isArray(gv) &&
                dv && typeof dv === 'object' && !Array.isArray(dv)) {
                out[k] = mergeDefaults(dv, gv);
            } else {
                out[k] = gv;
            }
        });
        return out;
    }

    function apiDisponible() {
        if (U.esFileProtocol()) return false;
        return typeof fetch === 'function';
    }

    function normalizarModoAcceso(m) {
        m = String(m || '').toLowerCase();
        return MODOS_ACCESO.indexOf(m) !== -1 ? m : 'cedula';
    }

    function normalizarTotalNumeros(n) {
        n = parseInt(n, 10);
        if (CANTIDADES_VALIDAS.indexOf(n) === -1) return TOTAL_NUMEROS_DEFAULT;
        return n;
    }

    function numSort(a, b) {
        return parseInt(a, 10) - parseInt(b, 10);
    }

    function shuffleArray(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return arr;
    }

    /* ============================================================
       4. LOCALSTORAGE · Wrappers seguros
       ============================================================ */
    function leerLocalClave(clave, fallback) {
        try {
            var raw = localStorage.getItem(clave);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            U.warn('Error leyendo localStorage:', clave, e);
            return fallback;
        }
    }

    function guardarLocalClave(clave, valor) {
        try {
            localStorage.setItem(clave, JSON.stringify(valor));
            return true;
        } catch (e) {
            U.warn('Error guardando localStorage:', clave, e);
            if (e && e.name === 'QuotaExceededError') {
                U.toast('Almacenamiento lleno. Libera espacio.', 'danger', 5000);
            }
            return false;
        }
    }

    function eliminarLocalClave(clave) {
        try { localStorage.removeItem(clave); return true; }
        catch (e) { return false; }
    }

    /* ============================================================
       5. API · Cloudflare Worker (opcional)
       ============================================================ */
    function apiGet(path) {
        if (!apiDisponible()) return Promise.resolve(null);
        return fetch(API_BASE + path, {
            headers: { 'Accept': 'application/json' }
        }).then(function (r) {
            if (!r.ok) return null;
            return r.json();
        }).catch(function () { return null; });
    }

    function apiSend(method, path, body) {
        if (!apiDisponible()) return Promise.resolve(null);
        var opts = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
        if (body !== undefined) opts.body = JSON.stringify(body);
        return fetch(API_BASE + path, opts).then(function (r) {
            if (!r.ok) return null;
            return r.json();
        }).catch(function () { return null; });
    }

    /* ============================================================
       6. REGISTROS · Caché y CRUD
       ============================================================ */
    var _cacheRegistros = null;

    function leerRegistrosLocal() {
        var a = leerLocalClave(KEYS.REGISTROS, []);
        return Array.isArray(a) ? a : [];
    }

    function guardarRegistrosLocal(lista) {
        return guardarLocalClave(KEYS.REGISTROS, lista);
    }

    function cargarRegistros(force) {
        if (_cacheRegistros && !force) {
            return Promise.resolve(_cacheRegistros);
        }
        return apiGet('/api/registros').then(function (remotos) {
            if (Array.isArray(remotos)) {
                _cacheRegistros = remotos;
                guardarRegistrosLocal(remotos);
                return remotos;
            }
            _cacheRegistros = leerRegistrosLocal();
            return _cacheRegistros;
        });
    }

    function crearRegistros(nuevos) {
        if (!Array.isArray(nuevos) || nuevos.length === 0) {
            return Promise.resolve({ ok: false, origen: null, guardados: [] });
        }

        return apiSend('POST', '/api/registros', { registros: nuevos })
            .then(function (res) {
                if (res && res.ok) {
                    _cacheRegistros = null;
                    return cargarRegistros(true).then(function () {
                        return { ok: true, origen: 'remoto', guardados: nuevos };
                    });
                }
                var actuales = leerRegistrosLocal();
                var mapa = {};
                actuales.forEach(function (r) { mapa[r.numero] = r; });
                nuevos.forEach(function (r) { mapa[r.numero] = r; });
                var fusion = Object.keys(mapa).map(function (k) { return mapa[k]; });
                guardarRegistrosLocal(fusion);
                _cacheRegistros = fusion;
                return { ok: true, origen: 'local', guardados: nuevos };
            });
    }

    function actualizarRegistro(id, cambios) {
        return apiSend('PATCH', '/api/registros/' + encodeURIComponent(id), cambios)
            .then(function (res) {
                if (res && res.ok) {
                    _cacheRegistros = null;
                    return true;
                }
                var lista = leerRegistrosLocal();
                for (var i = 0; i < lista.length; i++) {
                    if (lista[i].id === id) {
                        lista[i] = Object.assign({}, lista[i], cambios);
                        break;
                    }
                }
                guardarRegistrosLocal(lista);
                _cacheRegistros = lista;
                return true;
            });
    }

    function eliminarRegistro(id) {
        return apiSend('DELETE', '/api/registros/' + encodeURIComponent(id))
            .then(function (res) {
                if (res && res.ok) {
                    _cacheRegistros = null;
                    return true;
                }
                var lista = leerRegistrosLocal().filter(function (r) {
                    return r.id !== id;
                });
                guardarRegistrosLocal(lista);
                _cacheRegistros = lista;
                return true;
            });
    }

    function eliminarVarios(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return Promise.resolve(true);
        }
        var set = {};
        ids.forEach(function (id) { set[id] = true; });
        var lista = leerRegistrosLocal().filter(function (r) {
            return !set[r.id];
        });
        guardarRegistrosLocal(lista);
        _cacheRegistros = lista;
        return Promise.resolve(true);
    }

    function buscarPorCedula(cedula) {
        var limpio = U.soloDigitos(cedula);
        if (!limpio) return Promise.resolve([]);

        return apiGet('/api/boleto/' + encodeURIComponent(limpio))
            .then(function (res) {
                if (res && Array.isArray(res.registros)) return res.registros;
                return leerRegistrosLocal().filter(function (r) {
                    return U.soloDigitos(r.cedula) === limpio;
                });
            });
    }

    function buscarPorClave(clave) {
        var k = String(clave || '').trim();
        if (!U.validarClave4(k)) return Promise.resolve([]);
        return Promise.resolve(
            leerRegistrosLocal().filter(function (r) {
                return String(r.clave || '') === k;
            })
        );
    }

    function buscarPorCodigo(codigo) {
        var c = String(codigo || '').trim().toUpperCase();
        if (!c) return Promise.resolve(null);
        var arr = leerRegistrosLocal();
        for (var i = 0; i < arr.length; i++) {
            if (String(arr[i].boleto || '').toUpperCase() === c) {
                return Promise.resolve(arr[i]);
            }
        }
        return Promise.resolve(null);
    }

    function listarPublico() {
        return Promise.resolve(
            leerRegistrosLocal().map(function (r) {
                return {
                    numero: r.numero,
                    nombre: r.nombre,
                    estado: r.estado,
                    fecha:  r.fecha
                };
            })
        );
    }

    function numerosOcupados(lista) {
        var arr = lista || _cacheRegistros || leerRegistrosLocal();
        var set = new Set();
        arr.forEach(function (r) { set.add(r.numero); });
        return set;
    }

    function mapaPorNumero(lista) {
        var arr = lista || _cacheRegistros || leerRegistrosLocal();
        var m = new Map();
        arr.forEach(function (r) { m.set(r.numero, r); });
        return m;
    }

    function stats(lista, totalOverride) {
        var cfg = leerConfig();
        var total = totalOverride || (cfg.opciones && cfg.opciones.totalNumeros) || TOTAL_NUMEROS_DEFAULT;

        var arr = lista || _cacheRegistros || leerRegistrosLocal();
        var ocupados = 0, pagados = 0, apartados = 0;
        var clientesSet = new Set();
        arr.forEach(function (r) {
            ocupados++;
            if (r.estado === 'pagado')   pagados++;
            if (r.estado === 'apartado') apartados++;
            if (r.cedula) clientesSet.add(U.soloDigitos(r.cedula));
        });
        return {
            total:        total,
            libres:       Math.max(0, total - ocupados),
            ocupados:     ocupados,
            pagados:      pagados,
            apartados:    apartados,
            clientes:     clientesSet.size,
            porcentaje:   U.porcentaje(ocupados, total)
        };
    }

    function ultimosRegistros(n) {
        n = n || 5;
        var arr = leerRegistrosLocal().slice();
        arr.sort(function (a, b) {
            return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });
        return arr.slice(0, n);
    }

    function borrarTodo() {
        eliminarLocalClave(KEYS.REGISTROS);
        _cacheRegistros = null;
    }

    /* ============================================================
       7. MUESTRA DE GRILLA (opción C2)
       ============================================================
       Genera un array de N números del rango [0, RANGO_MAX-1],
       ordenados ascendentes.

       Reglas:
       - Los vendidos (apartados + pagados) SIEMPRE están incluidos.
       - Se rellena hasta N con aleatorios libres del rango.
       - Se ordena ascendente.
       - Si hay más vendidos que N → se muestran solo los primeros.
       ============================================================ */
    function generarMuestraGrilla(total, ocupadosSet) {
        total = Math.max(1, Math.min(RANGO_MAX, parseInt(total, 10) || 30));

        var ocupados = ocupadosSet;
        if (!(ocupados instanceof Set)) {
            ocupados = numerosOcupados();
        }

        // Vendidos dentro del rango [0, RANGO_MAX-1]
        var vendidos = [];
        ocupados.forEach(function (n) {
            if (U.esNumeroRifaValidoSegunTotal(n, RANGO_MAX)) {
                var s = String(n);
                if (vendidos.indexOf(s) === -1) vendidos.push(s);
            }
        });
        vendidos.sort(numSort);

        // Si hay más vendidos que celdas, mostrar solo los primeros
        if (vendidos.length >= total) {
            return vendidos.slice(0, total);
        }

        // Empezar con vendidos
        var muestra = vendidos.slice();
        var setMuestra = {};
        muestra.forEach(function (n) { setMuestra[n] = true; });

        // Libres = todos los del rango menos los que ya están en muestra
        var libres = [];
        for (var i = 0; i < RANGO_MAX; i++) {
            var numStr = U.formatearNumeroSegunTotal(i, RANGO_MAX);
            if (!setMuestra[numStr]) libres.push(numStr);
        }

        // Barajar libres
        shuffleArray(libres);

        // Rellenar hasta total
        var faltan = total - muestra.length;
        for (var m = 0; m < faltan && m < libres.length; m++) {
            muestra.push(libres[m]);
        }

        // Orden ascendente
        muestra.sort(numSort);

        return muestra;
    }

    /**
     * Sincroniza la muestra guardada con el estado actual.
     * - Si no hay muestra y grillaMezclada está ON → genera
     * - Si hay muestra pero falta algún vendido → reemplaza un libre por el vendido
     * - Si el tamaño no coincide con totalNumeros → regenera
     * Devuelve true si la config fue modificada.
     */
    function sincronizarMuestraGrilla() {
        var cfg = leerConfig();

        if (!cfg.opciones.grillaMezclada) {
            // Si la grilla no es mezclada, limpiar la muestra
            if (cfg.opciones.muestraGrilla && cfg.opciones.muestraGrilla.length > 0) {
                cfg.opciones.muestraGrilla = [];
                guardarConfig(cfg);
                return true;
            }
            return false;
        }

        var total = cfg.opciones.totalNumeros || 30;
        var muestra = cfg.opciones.muestraGrilla || [];
        var ocupados = numerosOcupados();

        // Caso 1: muestra vacía o tamaño incorrecto → regenerar completa
        if (!Array.isArray(muestra) || muestra.length !== total) {
            cfg.opciones.muestraGrilla = generarMuestraGrilla(total, ocupados);
            guardarConfig(cfg);
            return true;
        }

        // Caso 2: verificar que todos los vendidos estén en la muestra
        var setMuestra = {};
        muestra.forEach(function (n) { setMuestra[n] = true; });

        var faltantes = [];
        ocupados.forEach(function (n) {
            var s = String(n);
            if (!setMuestra[s]) faltantes.push(s);
        });

        if (faltantes.length === 0) return false;

        // Caso 3: sustituir un número "libre" de la muestra por el vendido faltante
        var setVendidos = {};
        ocupados.forEach(function (n) { setVendidos[String(n)] = true; });

        var nueva = muestra.slice();

        faltantes.forEach(function (vendido) {
            // Buscar el primer índice de un número NO vendido
            for (var i = 0; i < nueva.length; i++) {
                if (!setVendidos[nueva[i]]) {
                    nueva[i] = vendido;
                    break;
                }
            }
        });

        nueva.sort(numSort);
        cfg.opciones.muestraGrilla = nueva;
        guardarConfig(cfg);
        return true;
    }

    /** Fuerza regeneración completa de la muestra. */
    function regenerarMuestraGrilla() {
        var cfg = leerConfig();
        var total = cfg.opciones.totalNumeros || 30;
        var ocupados = numerosOcupados();

        cfg.opciones.muestraGrilla = generarMuestraGrilla(total, ocupados);
        guardarConfig(cfg);
        return cfg.opciones.muestraGrilla;
    }

    /* ============================================================
       8. CONFIGURACIÓN
       ============================================================ */
    var _syncConfigEnProgreso = null;

    function leerConfig() {
        var guardada = leerLocalClave(KEYS.CONFIG, null);
        var cfg = mergeDefaults(CONFIG_DEFAULT, guardada);
        cfg.opciones.modoAcceso = normalizarModoAcceso(cfg.opciones.modoAcceso);
        cfg.opciones.totalNumeros = normalizarTotalNumeros(cfg.opciones.totalNumeros);
        if (!Array.isArray(cfg.opciones.muestraGrilla)) {
            cfg.opciones.muestraGrilla = [];
        }
        return cfg;
    }

    function guardarConfig(cfg) {
        var fusion = mergeDefaults(CONFIG_DEFAULT, cfg);
        fusion._syncTimestamp = Date.now();

        fusion.opciones.modoAcceso = normalizarModoAcceso(fusion.opciones.modoAcceso);
        fusion.opciones.totalNumeros = normalizarTotalNumeros(fusion.opciones.totalNumeros);
        if (!Array.isArray(fusion.opciones.muestraGrilla)) {
            fusion.opciones.muestraGrilla = [];
        }

        var ok = guardarLocalClave(KEYS.CONFIG, fusion);

        if (apiDisponible()) {
            apiSend('PUT', '/api/config', fusion).catch(function () {
                U.warn('No se pudo sincronizar la config con la nube.');
            });
        }

        return ok;
    }

    function actualizarConfigSeccion(seccion, cambios) {
        var cfg = leerConfig();
        cfg[seccion] = Object.assign({}, cfg[seccion], cambios);
        return guardarConfig(cfg);
    }

    function resetearConfig() {
        eliminarLocalClave(KEYS.CONFIG);
        var limpia = leerConfig();
        limpia._syncTimestamp = Date.now();

        if (apiDisponible()) {
            apiSend('PUT', '/api/config', limpia).catch(function () {});
        }

        return limpia;
    }

    function sincronizarConfigRemota() {
        if (!apiDisponible()) return Promise.resolve(null);

        return apiGet('/api/config').then(function (res) {
            var remota = res && res.config ? res.config : null;
            var local  = leerLocalClave(KEYS.CONFIG, null);

            if (!remota || typeof remota !== 'object' || !remota._syncTimestamp) {
                if (local) {
                    apiSend('PUT', '/api/config', local).catch(function () {});
                }
                return null;
            }

            var localTs  = (local && local._syncTimestamp) || 0;
            var remotaTs = remota._syncTimestamp || 0;

            if (remotaTs > localTs) {
                var fusion = mergeDefaults(CONFIG_DEFAULT, remota);
                guardarLocalClave(KEYS.CONFIG, fusion);
                U.log('Config sincronizada desde la nube.');
                return fusion;
            }

            if (localTs > remotaTs && local) {
                apiSend('PUT', '/api/config', local).catch(function () {});
            }

            return null;
        });
    }

    function inicializarSyncConfig() {
        if (_syncConfigEnProgreso) return _syncConfigEnProgreso;

        _syncConfigEnProgreso = sincronizarConfigRemota()
            .then(function (cambios) {
                if (cambios && global.Theme && global.Theme.aplicarTodo) {
                    global.Theme.aplicarTodo(cambios);
                }
                return cambios;
            })
            .catch(function (err) {
                U.warn('Sync config falló:', err);
                return null;
            })
            .then(function (r) {
                _syncConfigEnProgreso = null;
                return r;
            });

        return _syncConfigEnProgreso;
    }

    /* ============================================================
       9. TÉRMINOS ACEPTADOS
       ============================================================ */
    function leerTerminosAceptados() {
        return leerLocalClave(KEYS.TERMINOS_OK, null);
    }

    function guardarTerminosAceptados(version) {
        return guardarLocalClave(KEYS.TERMINOS_OK, {
            version: version || 'v1',
            fecha: new Date().toISOString()
        });
    }

    function borrarTerminosAceptados() {
        return eliminarLocalClave(KEYS.TERMINOS_OK);
    }

    /* ============================================================
       10. MI CÉDULA / MI CLAVE
       ============================================================ */
    function leerMiCedula() {
        return leerLocalClave(KEYS.MI_CEDULA, '');
    }

    function guardarMiCedula(cedula) {
        return guardarLocalClave(KEYS.MI_CEDULA, U.formatearCedula(cedula));
    }

    function borrarMiCedula() {
        return eliminarLocalClave(KEYS.MI_CEDULA);
    }

    function leerMiClave() {
        return leerLocalClave(KEYS.MI_CLAVE, '');
    }

    function guardarMiClave(clave) {
        return guardarLocalClave(KEYS.MI_CLAVE, String(clave || ''));
    }

    function borrarMiClave() {
        return eliminarLocalClave(KEYS.MI_CLAVE);
    }

    /* ============================================================
       11. PIN DE ADMIN
       ============================================================ */
    function pinDesbloqueadoEnEstaSesion() {
        try {
            return sessionStorage.getItem(KEYS.PIN_SESION) === '1';
        } catch (e) { return false; }
    }

    function marcarPinDesbloqueado() {
        try { sessionStorage.setItem(KEYS.PIN_SESION, '1'); return true; }
        catch (e) { return false; }
    }

    function borrarPinDesbloqueado() {
        try { sessionStorage.removeItem(KEYS.PIN_SESION); return true; }
        catch (e) { return false; }
    }

    /* ============================================================
       12. BACKUP · Exportar JSON
       ============================================================ */
    function exportarJSON() {
        var regs = leerRegistrosLocal();
        var cfg  = leerConfig();
        var st   = stats(regs);

        var meta = {
            app:               'Motor de Rifas',
            version:           'v3',
            fechaExportacion:  new Date().toISOString(),
            nombreRifa:        cfg.identidad.nombreRifa,
            totalRegistros:    regs.length,
            totalPagados:      st.pagados,
            totalApartados:    st.apartados,
            totalClientes:     st.clientes,
            monto:             cfg.identidad.monto,
            modoAcceso:        cfg.opciones.modoAcceso,
            totalNumeros:      cfg.opciones.totalNumeros,
            grillaMezclada:    cfg.opciones.grillaMezclada
        };

        var paquete = {
            meta:       meta,
            config:     cfg,
            registros:  regs
        };

        var json = JSON.stringify(paquete, null, 2);
        var nombre = 'respaldo_rifa_' + U.timestampArchivo() + '.json';
        return { nombre: nombre, contenido: json, meta: meta };
    }

    /* ============================================================
       13. BACKUP · Exportar Markdown
       ============================================================ */
    function exportarMarkdown() {
        var regs = leerRegistrosLocal();
        var cfg  = leerConfig();
        var st   = stats(regs);

        regs.sort(function (a, b) {
            return String(a.numero).localeCompare(String(b.numero));
        });

        var lineas = [];
        lineas.push('# RESPALDO DE RIFA · ' + cfg.identidad.nombreRifa);
        lineas.push('');
        lineas.push('**Fecha de exportación:** ' + U.fechaHumana(new Date().toISOString()));
        lineas.push('**Lotería:** ' + cfg.identidad.loteria);
        lineas.push('**Monto por número:** ' + cfg.identidad.monto);
        lineas.push('**Modo de acceso:** ' + cfg.opciones.modoAcceso);
        lineas.push('**Total números:** ' + cfg.opciones.totalNumeros);
        lineas.push('');
        lineas.push('## Resumen');
        lineas.push('');
        lineas.push('| Métrica | Valor |');
        lineas.push('|---|---|');
        lineas.push('| Total números | ' + st.total + ' |');
        lineas.push('| Libres | ' + st.libres + ' |');
        lineas.push('| Apartados | ' + st.apartados + ' |');
        lineas.push('| Pagados | ' + st.pagados + ' |');
        lineas.push('| Clientes únicos | ' + st.clientes + ' |');
        lineas.push('| Progreso | ' + st.porcentaje + '% |');
        lineas.push('');
        lineas.push('## Registros');
        lineas.push('');
        lineas.push('| Nº | Nombre | Cédula | Teléfono | Clave | Estado | Fecha | Código |');
        lineas.push('|---|---|---|---|---|---|---|---|');

        if (regs.length === 0) {
            lineas.push('| — | — | — | — | — | — | — | — |');
        } else {
            regs.forEach(function (r) {
                lineas.push('| ' +
                    escaparPipe(r.numero) + ' | ' +
                    escaparPipe(r.nombre) + ' | ' +
                    escaparPipe(r.cedula || '—') + ' | ' +
                    escaparPipe(r.telefono) + ' | ' +
                    escaparPipe(r.clave || '—') + ' | ' +
                    escaparPipe((r.estado || '').toUpperCase()) + ' | ' +
                    escaparPipe(U.fechaHumana(r.fecha)) + ' | ' +
                    escaparPipe(r.boleto || '') + ' |'
                );
            });
        }

        lineas.push('');
        lineas.push('---');
        lineas.push('');
        lineas.push('_Generado automáticamente por el Motor de Rifas._');

        var contenido = lineas.join('\n');
        var nombre = 'respaldo_rifa_' + U.timestampArchivo() + '.md';
        return { nombre: nombre, contenido: contenido };
    }

    function escaparPipe(s) {
        return String(s == null ? '' : s).replace(/\|/g, '\\|');
    }

    /* ============================================================
       14. BACKUP · Exportar CSV
       ============================================================ */
    function exportarCSV() {
        var regs = leerRegistrosLocal();
        var cabecera = ['numero', 'nombre', 'cedula', 'telefono', 'clave',
                        'estado', 'metodoPago', 'boleto', 'fecha', 'notas'];
        var lineas = [cabecera.join(',')];

        regs.sort(function (a, b) {
            return String(a.numero).localeCompare(String(b.numero));
        });

        regs.forEach(function (r) {
            var fila = cabecera.map(function (k) {
                var v = r[k] == null ? '' : String(r[k]);
                if (v.indexOf(',') !== -1 || v.indexOf('"') !== -1 ||
                    v.indexOf('\n') !== -1) {
                    v = '"' + v.replace(/"/g, '""') + '"';
                }
                return v;
            });
            lineas.push(fila.join(','));
        });

        var contenido = '\uFEFF' + lineas.join('\n');
        var nombre = 'respaldo_rifa_' + U.timestampArchivo() + '.csv';
        return { nombre: nombre, contenido: contenido };
    }

    /* ============================================================
       15. BACKUP · Importar JSON
       ============================================================ */
    function importarJSON(texto, opciones) {
        opciones = opciones || {};
        var modo = opciones.modo || 'reemplazar';

        var data;
        try {
            data = JSON.parse(texto);
        } catch (e) {
            return { ok: false, error: 'JSON inválido o corrupto.' };
        }

        if (!data || typeof data !== 'object') {
            return { ok: false, error: 'El archivo no contiene datos válidos.' };
        }

        var regs = Array.isArray(data.registros) ? data.registros :
                   (Array.isArray(data) ? data : null);

        if (!regs) {
            return { ok: false, error: 'No se encontró el campo "registros".' };
        }

        var validos = regs.filter(function (r) {
            return r && r.numero && r.nombre;
        });

        if (validos.length === 0) {
            return { ok: false, error: 'Los registros del archivo están incompletos.' };
        }

        var actuales = leerRegistrosLocal();
        var finales;

        if (modo === 'fusionar') {
            var mapa = {};
            actuales.forEach(function (r) { mapa[r.numero] = r; });
            validos.forEach(function (r) { mapa[r.numero] = r; });
            finales = Object.keys(mapa).map(function (k) { return mapa[k]; });
        } else {
            finales = validos;
        }

        guardarRegistrosLocal(finales);
        _cacheRegistros = finales;

        if (data.config && opciones.restaurarConfig !== false) {
            guardarConfig(data.config);
        }

        return {
            ok: true,
            importados: validos.length,
            total:      finales.length,
            modo:       modo
        };
    }

    function importarDesdeArchivo(file, opciones) {
        return U.leerArchivoTexto(file).then(function (texto) {
            return importarJSON(texto, opciones);
        });
    }

    /* ============================================================
       16. BOLETO · Código de autenticación (FNV-1a 32 bits)
       ============================================================ */
    function generarCodigoBoleto(nombre, numero, cedula, fecha, loteria) {
        var s = [nombre, numero, U.soloDigitos(cedula || ''), fecha, loteria || 'CHANCE-A'].join('|');
        var h = 2166136261;
        for (var i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return 'OK-' + h.toString(16).toUpperCase().padStart(8, '0') + '-CHANCE-A';
    }

    /* ============================================================
       17. WHATSAPP
       ============================================================ */
    function linkWhatsAppComprador(reg, cfg) {
        cfg = cfg || leerConfig();
        var mensaje =
            (cfg.identidad.mensajePredeterminado || '¡Hola! Confirmo mi reserva.') +
            '\n\n' +
            '🎟️ Número: *' + reg.numero + '*\n' +
            '👤 Nombre: ' + reg.nombre + '\n' +
            (reg.cedula ? '🆔 Cédula: ' + reg.cedula + '\n' : '') +
            '💰 Monto: ' + cfg.identidad.monto + '\n\n' +
            'Adjunto comprobante de pago.';

        var tel = U.soloDigitos(reg.telefono);
        var pref = tel.length > 10 ? tel : ('58' + tel.replace(/^0/, ''));
        return 'https://wa.me/' + pref + '?text=' + encodeURIComponent(mensaje);
    }

    function linkWhatsAppOrganizador(regs, cfg) {
        cfg = cfg || leerConfig();
        var lista = regs.map(function (r) {
            return '• Nº ' + r.numero + ' — ' + r.nombre +
                   (r.cedula ? ' (' + r.cedula + ')' : '');
        }).join('\n');

        var mensaje =
            '🎟️ *Nueva reserva en ' + cfg.identidad.nombreRifa + '*\n\n' +
            lista + '\n\n' +
            '🎲 Lotería: ' + cfg.identidad.loteria + '\n' +
            '💰 Monto: ' + cfg.identidad.monto + ' c/u\n\n' +
            'Por favor confirmar pago. 🙏';

        var tel = U.soloDigitos(cfg.identidad.whatsappOrg);
        return 'https://wa.me/' + tel + '?text=' + encodeURIComponent(mensaje);
    }

    function linkWhatsAppAdmin(reg, cfg) {
        cfg = cfg || leerConfig();
        var tel = U.soloDigitos(reg.telefono);
        var pref = tel.length > 10 ? tel : ('58' + tel.replace(/^0/, ''));
        var mensaje =
            'Hola ' + reg.nombre + ', te escribo de ' + cfg.identidad.nombreRifa + '. ' +
            'Tu número *' + reg.numero + '* está en estado *' +
            (reg.estado || '').toUpperCase() + '*.';

        if (reg.estado === 'apartado') {
            mensaje += '\n\nRecuerda completar el pago para confirmar tu participación. 🙏';
        }
        return 'https://wa.me/' + pref + '?text=' + encodeURIComponent(mensaje);
    }

    /* ============================================================
       18. MIGRACIÓN
       ============================================================ */
    function migrarSiEsNecesario() {
        var v1 = leerLocalClave('rifa_reservas_v1', null);
        if (Array.isArray(v1) && v1.length > 0 && leerRegistrosLocal().length === 0) {
            var migrados = [];
            v1.forEach(function (grupo) {
                (grupo.numeros || []).forEach(function (num) {
                    migrados.push({
                        id: U.generarId(),
                        numero: U.normalizarNumero(num),
                        nombre: grupo.nombre || 'Sin nombre',
                        cedula: U.formatearCedula(grupo.cedula || '0000000'),
                        telefono: grupo.telefono || '',
                        clave: null,
                        sinClave: false,
                        estado: 'apartado',
                        metodoPago: null,
                        boleto: generarCodigoBoleto(
                            grupo.nombre || '',
                            num,
                            grupo.cedula || '',
                            grupo.fecha || new Date().toISOString(),
                            'CHANCE-A'
                        ),
                        aceptoTerminos: true,
                        versionTerminos: 'v1',
                        notas: 'Migrado de v1',
                        fecha: grupo.fecha || new Date().toISOString()
                    });
                });
            });
            guardarRegistrosLocal(migrados);
            _cacheRegistros = migrados;
            U.log('Migrados ' + migrados.length + ' registros de v1 → v2');
        }

        var arr = leerRegistrosLocal();
        var cambio = false;
        arr.forEach(function (r) {
            if (r.clave === undefined) { r.clave = null; cambio = true; }
            if (r.sinClave === undefined) { r.sinClave = false; cambio = true; }
        });
        if (cambio) {
            guardarRegistrosLocal(arr);
            _cacheRegistros = arr;
        }
    }

    /* ============================================================
       19. API PÚBLICA
       ============================================================ */
    var Store = {
        KEYS:         KEYS,
        TOTAL_NUMEROS:TOTAL_NUMEROS_DEFAULT,
        RANGO_MAX:    RANGO_MAX,
        MODOS_ACCESO: MODOS_ACCESO,
        CANTIDADES_VALIDAS: CANTIDADES_VALIDAS,

        CONFIG_DEFAULT:          CONFIG_DEFAULT,
        leerConfig:              leerConfig,
        guardarConfig:           guardarConfig,
        actualizarConfigSeccion: actualizarConfigSeccion,
        resetearConfig:          resetearConfig,
        sincronizarConfigRemota: sincronizarConfigRemota,
        inicializarSyncConfig:   inicializarSyncConfig,

        cargarRegistros:    cargarRegistros,
        crearRegistros:     crearRegistros,
        actualizarRegistro: actualizarRegistro,
        eliminarRegistro:   eliminarRegistro,
        eliminarVarios:     eliminarVarios,
        buscarPorCedula:    buscarPorCedula,
        buscarPorClave:     buscarPorClave,
        buscarPorCodigo:    buscarPorCodigo,
        listarPublico:      listarPublico,
        numerosOcupados:    numerosOcupados,
        mapaPorNumero:      mapaPorNumero,
        stats:              stats,
        ultimosRegistros:   ultimosRegistros,
        borrarTodo:         borrarTodo,

        // Muestra de grilla (C2)
        generarMuestraGrilla:    generarMuestraGrilla,
        sincronizarMuestraGrilla:sincronizarMuestraGrilla,
        regenerarMuestraGrilla:  regenerarMuestraGrilla,

        leerRegistrosLocal:    leerRegistrosLocal,
        guardarRegistrosLocal: guardarRegistrosLocal,

        leerTerminosAceptados:   leerTerminosAceptados,
        guardarTerminosAceptados:guardarTerminosAceptados,
        borrarTerminosAceptados: borrarTerminosAceptados,

        leerMiCedula:    leerMiCedula,
        guardarMiCedula: guardarMiCedula,
        borrarMiCedula:  borrarMiCedula,

        leerMiClave:     leerMiClave,
        guardarMiClave:  guardarMiClave,
        borrarMiClave:   borrarMiClave,

        pinDesbloqueadoEnEstaSesion: pinDesbloqueadoEnEstaSesion,
        marcarPinDesbloqueado:       marcarPinDesbloqueado,
        borrarPinDesbloqueado:       borrarPinDesbloqueado,

        exportarJSON:         exportarJSON,
        exportarMarkdown:     exportarMarkdown,
        exportarCSV:          exportarCSV,
        importarJSON:         importarJSON,
        importarDesdeArchivo: importarDesdeArchivo,

        generarCodigoBoleto: generarCodigoBoleto,

        linkWhatsAppComprador:   linkWhatsAppComprador,
        linkWhatsAppOrganizador: linkWhatsAppOrganizador,
        linkWhatsAppAdmin:       linkWhatsAppAdmin,

        migrarSiEsNecesario: migrarSiEsNecesario,

        normalizarModoAcceso:  normalizarModoAcceso,
        normalizarTotalNumeros:normalizarTotalNumeros
    };

    global.Store = Store;

})(typeof window !== 'undefined' ? window : this);