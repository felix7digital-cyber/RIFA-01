/* ============================================================
   MOTOR DE RIFAS · cloudflare/worker.js
   API REST sobre Cloudflare Workers + D1
   Marco: CCG-IA v1.0.0 · Autor: Felix
   ============================================================
   Rutas:
     GET    /api/health                 → salud del worker
     GET    /api/registros              → todos los registros
     POST   /api/registros              → crear 1+ registros
     GET    /api/registros/:id          → un registro
     PATCH  /api/registros/:id          → actualizar campos
     DELETE /api/registros/:id          → eliminar uno
     DELETE /api/registros              → eliminar todos (⚠️)
     GET    /api/boleto/:cedula         → registros por cédula
     GET    /api/stats                  → stats agregadas
     GET    /api/version                → versión del worker
     GET    /api/config                 → configuración visual
     PUT    /api/config                 → guardar configuración
   ============================================================ */

'use strict';

/* ============================================================
   1. CONSTANTES
   ============================================================ */
var VERSION = 'v1.0.0';
var TOTAL_NUMEROS = 100;

/* ============================================================
   2. UTILIDADES
   ============================================================ */

/** Respuesta JSON con headers CORS. */
function json(data, status, env, extraHeaders) {
    status = status || 200;
    var headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': (env && env.CORS_ORIGIN) || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
    };
    if (extraHeaders) {
        Object.keys(extraHeaders).forEach(function (k) {
            headers[k] = extraHeaders[k];
        });
    }
    return new Response(JSON.stringify(data), { status: status, headers: headers });
}

function error(mensaje, status, env) {
    return json({ ok: false, error: mensaje }, status || 400, env);
}

function ok(data, env, status) {
    var payload = Object.assign({ ok: true }, data || {});
    return json(payload, status || 200, env);
}

function preflight(env) {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': (env && env.CORS_ORIGIN) || '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
}

function soloDigitos(s) {
    return String(s == null ? '' : s).replace(/\D/g, '');
}

function formatearCedula(s) {
    var d = soloDigitos(s);
    if (!d) return '';
    if (d.length <= 1) return d;
    return 'V-' + d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function esCedulaValida(s) {
    var d = soloDigitos(s);
    return d.length >= 5 && d.length <= 10;
}

function esTelefonoValido(s) {
    var d = soloDigitos(s);
    return d.length >= 10 && d.length <= 13;
}

function esNumeroRifaValido(s) {
    var d = soloDigitos(s);
    if (d.length === 1) d = '0' + d;
    if (d.length !== 2) return false;
    var n = parseInt(d, 10);
    return n >= 0 && n <= 99;
}

function normalizarNumero(s) {
    var d = soloDigitos(s);
    if (d.length === 1) d = '0' + d;
    if (d.length > 2) d = d.slice(-2);
    return d;
}

function ahoraISO() {
    return new Date().toISOString();
}

/* ============================================================
   3. AUTENTICACIÓN (opcional)
   ============================================================ */
function tieneAccesoEscritura(req, env) {
    if (!env || !env.API_TOKEN || env.API_TOKEN === '') return true;

    var auth = req.headers.get('Authorization') || '';
    var token = auth.replace(/^Bearer\s+/i, '').trim();
    return token === env.API_TOKEN;
}

/* ============================================================
   4. HELPERS DE D1
   ============================================================ */

async function dbListarRegistros(env) {
    var result = await env.DB.prepare(
        'SELECT * FROM registros ORDER BY numero ASC'
    ).all();
    return (result.results || []).map(normalizarSalida);
}

async function dbContarRegistros(env) {
    var row = await env.DB.prepare(
        'SELECT COUNT(*) AS total FROM registros'
    ).first();
    return row ? row.total : 0;
}

async function dbObtenerRegistro(id, env) {
    var row = await env.DB.prepare(
        'SELECT * FROM registros WHERE id = ?'
    ).bind(id).first();
    return row ? normalizarSalida(row) : null;
}

async function dbObtenerPorNumero(numero, env) {
    var row = await env.DB.prepare(
        'SELECT * FROM registros WHERE numero = ?'
    ).bind(numero).first();
    return row ? normalizarSalida(row) : null;
}

async function dbInsertarRegistro(reg, env) {
    await env.DB.prepare(
        'INSERT INTO registros (' +
        'id, numero, nombre, cedula, telefono, estado, metodo_pago,' +
        'boleto, acepto_terminos, version_terminos, notas, fecha, updated_at' +
        ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
        reg.id,
        reg.numero,
        reg.nombre,
        reg.cedula,
        reg.telefono,
        reg.estado,
        reg.metodoPago,
        reg.boleto,
        reg.aceptoTerminos ? 1 : 0,
        reg.versionTerminos,
        reg.notas,
        reg.fecha,
        ahoraISO()
    ).run();
}

/** Actualiza un registro con un objeto de cambios. */
async function dbActualizarRegistro(id, cambios, env) {
    var camposPermitidos = [
        'nombre', 'cedula', 'telefono', 'estado', 'metodo_pago',
        'boleto', 'acepto_terminos', 'version_terminos', 'notas'
    ];
    var sets = [];
    var valores = [];

    var mapa = {
        nombre: 'nombre',
        cedula: 'cedula',
        telefono: 'telefono',
        estado: 'estado',
        metodoPago: 'metodo_pago',
        boleto: 'boleto',
        aceptoTerminos: 'acepto_terminos',
        versionTerminos: 'version_terminos',
        notas: 'notas'
    };

    Object.keys(cambios).forEach(function (k) {
        if (!mapa[k]) return;
        var col = mapa[k];
        if (camposPermitidos.indexOf(col) === -1) return;

        var v = cambios[k];
        if (k === 'aceptoTerminos') v = v ? 1 : 0;
        if (k === 'cedula') v = formatearCedula(v);
        if (k === 'estado' && ['apartado', 'pagado'].indexOf(v) === -1) return;

        sets.push(col + ' = ?');
        valores.push(v);
    });

    if (sets.length === 0) return false;

    sets.push('updated_at = ?');
    valores.push(ahoraISO());
    valores.push(id);

    var sql = 'UPDATE registros SET ' + sets.join(', ') + ' WHERE id = ?';

    // ✅ FIX: preparar UNA sola vez y bindear con spread.
    var stmt = env.DB.prepare(sql);
    await stmt.bind.apply(stmt, valores).run();

    return true;
}

async function dbEliminarRegistro(id, env) {
    await env.DB.prepare('DELETE FROM registros WHERE id = ?').bind(id).run();
}

async function dbEliminarTodos(env) {
    await env.DB.prepare('DELETE FROM registros').run();
}

async function dbBuscarPorCedula(cedula, env) {
    var limpio = soloDigitos(cedula);
    var result = await env.DB.prepare(
        'SELECT * FROM registros WHERE cedula LIKE ? ORDER BY numero ASC'
    ).bind('%' + limpio + '%').all();

    return (result.results || [])
        .map(normalizarSalida)
        .filter(function (r) {
            return soloDigitos(r.cedula) === limpio;
        });
}

async function dbStats(env) {
    var row = await env.DB.prepare(
        'SELECT ' +
        '  COUNT(*) AS ocupados, ' +
        '  SUM(CASE WHEN estado = \'pagado\' THEN 1 ELSE 0 END) AS pagados, ' +
        '  SUM(CASE WHEN estado = \'apartado\' THEN 1 ELSE 0 END) AS apartados, ' +
        '  COUNT(DISTINCT cedula) AS clientes ' +
        'FROM registros'
    ).first();

    var ocupados  = row ? (row.ocupados  || 0) : 0;
    var pagados   = row ? (row.pagados   || 0) : 0;
    var apartados = row ? (row.apartados || 0) : 0;
    var clientes  = row ? (row.clientes  || 0) : 0;

    return {
        total:      TOTAL_NUMEROS,
        libres:     TOTAL_NUMEROS - ocupados,
        ocupados:   ocupados,
        pagados:    pagados,
        apartados:  apartados,
        clientes:   clientes,
        porcentaje: Math.round((ocupados / TOTAL_NUMEROS) * 100)
    };
}

async function dbLeerConfig(env) {
    var row = await env.DB.prepare(
        'SELECT valor FROM config WHERE clave = ?'
    ).bind('visual').first();
    if (!row || !row.valor) return null;
    try { return JSON.parse(row.valor); }
    catch (e) { return null; }
}

async function dbGuardarConfig(cfg, env) {
    var valor = JSON.stringify(cfg);
    await env.DB.prepare(
        'INSERT INTO config (clave, valor, updated_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, updated_at = excluded.updated_at'
    ).bind('visual', valor, ahoraISO()).run();
}

function normalizarSalida(row) {
    return {
        id:              row.id,
        numero:          row.numero,
        nombre:          row.nombre,
        cedula:          row.cedula,
        telefono:        row.telefono,
        estado:          row.estado,
        metodoPago:      row.metodo_pago,
        boleto:          row.boleto,
        aceptoTerminos:  row.acepto_terminos === 1,
        versionTerminos: row.version_terminos,
        notas:           row.notas,
        fecha:           row.fecha,
        updatedAt:       row.updated_at
    };
}

/* ============================================================
   5. VALIDACIÓN DE REGISTROS ENTRANTES
   ============================================================ */
function validarRegistro(reg) {
    var errores = [];
    if (!reg) return { ok: false, errores: ['registro vacío'] };

    if (!reg.numero || !esNumeroRifaValido(reg.numero)) {
        errores.push('numero inválido');
    }
    if (!reg.nombre || String(reg.nombre).trim().length < 3) {
        errores.push('nombre inválido');
    }
    if (!reg.cedula || !esCedulaValida(reg.cedula)) {
        errores.push('cedula inválida');
    }
    if (reg.telefono && !esTelefonoValido(reg.telefono)) {
        errores.push('telefono inválido');
    }
    if (reg.estado && ['apartado', 'pagado'].indexOf(reg.estado) === -1) {
        errores.push('estado inválido');
    }

    return { ok: errores.length === 0, errores: errores };
}

/* ============================================================
   6. ROUTER PRINCIPAL
   ============================================================ */
async function manejar(req, env) {
    var url    = new URL(req.url);
    var metodo = req.method.toUpperCase();
    var path   = url.pathname;

    if (metodo === 'OPTIONS') {
        return preflight(env);
    }

    if (path === '/api/health' && metodo === 'GET') {
        return ok({ version: VERSION, timestamp: ahoraISO() }, env);
    }

    if (path === '/api/version' && metodo === 'GET') {
        return ok({ version: VERSION }, env);
    }

    if (path === '/api/registros') {

        if (metodo === 'GET') {
            var regs = await dbListarRegistros(env);
            return json(regs, 200, env);
        }

        if (metodo === 'POST') {
            if (!tieneAccesoEscritura(req, env)) {
                return error('No autorizado', 401, env);
            }

            var body;
            try { body = await req.json(); }
            catch (e) { return error('JSON inválido', 400, env); }

            var nuevos = body && body.registros ? body.registros : [body];
            if (!Array.isArray(nuevos) || nuevos.length === 0) {
                return error('Se esperaba un array de registros', 400, env);
            }

            var guardados = 0;
            var conflictos = [];
            var invalidos  = [];

            for (var i = 0; i < nuevos.length; i++) {
                var reg = nuevos[i];
                var v = validarRegistro(reg);
                if (!v.ok) {
                    invalidos.push({ numero: reg.numero, errores: v.errores });
                    continue;
                }

                reg.numero = normalizarNumero(reg.numero);
                reg.cedula = formatearCedula(reg.cedula);
                reg.id = reg.id || (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
                reg.fecha = reg.fecha || ahoraISO();
                reg.estado = reg.estado || 'apartado';

                var existente = await dbObtenerPorNumero(reg.numero, env);
                if (existente) {
                    conflictos.push(reg.numero);
                    continue;
                }

                try {
                    await dbInsertarRegistro(reg, env);
                    guardados++;
                } catch (e) {
                    console.warn('Error insertando:', e.message);
                    conflictos.push(reg.numero);
                }
            }

            return ok({
                guardados: guardados,
                conflictos: conflictos,
                invalidos: invalidos
            }, env);
        }

        if (metodo === 'DELETE') {
            if (!tieneAccesoEscritura(req, env)) {
                return error('No autorizado', 401, env);
            }
            await dbEliminarTodos(env);
            return ok({ mensaje: 'Todos los registros eliminados' }, env);
        }

        return error('Método no permitido en /api/registros', 405, env);
    }

    var matchId = path.match(/^\/api\/registros\/([^\/]+)$/);
    if (matchId) {
        var id = decodeURIComponent(matchId[1]);

        if (metodo === 'GET') {
            var r = await dbObtenerRegistro(id, env);
            if (!r) return error('Registro no encontrado', 404, env);
            return json(r, 200, env);
        }

        if (metodo === 'PATCH' || metodo === 'PUT') {
            if (!tieneAccesoEscritura(req, env)) {
                return error('No autorizado', 401, env);
            }
            var cambios;
            try { cambios = await req.json(); }
            catch (e) { return error('JSON inválido', 400, env); }

            var exito = await dbActualizarRegistro(id, cambios, env);
            if (!exito) return error('Sin cambios válidos', 400, env);
            return ok({ id: id }, env);
        }

        if (metodo === 'DELETE') {
            if (!tieneAccesoEscritura(req, env)) {
                return error('No autorizado', 401, env);
            }
            await dbEliminarRegistro(id, env);
            return ok({ id: id }, env);
        }

        return error('Método no permitido', 405, env);
    }

    var matchCed = path.match(/^\/api\/boleto\/([^\/]+)$/);
    if (matchCed && metodo === 'GET') {
        var cedula = decodeURIComponent(matchCed[1]);
        var regs2 = await dbBuscarPorCedula(cedula, env);
        return json({ registros: regs2 }, 200, env);
    }

    if (path === '/api/stats' && metodo === 'GET') {
        var stats = await dbStats(env);
        return json(stats, 200, env);
    }

    if (path === '/api/config') {
        if (metodo === 'GET') {
            var cfg = await dbLeerConfig(env);
            return json({ config: cfg }, 200, env);
        }
        if (metodo === 'PUT' || metodo === 'POST') {
            if (!tieneAccesoEscritura(req, env)) {
                return error('No autorizado', 401, env);
            }
            var bodyCfg;
            try { bodyCfg = await req.json(); }
            catch (e) { return error('JSON inválido', 400, env); }
            await dbGuardarConfig(bodyCfg, env);
            return ok({ mensaje: 'Configuración guardada' }, env);
        }
        return error('Método no permitido', 405, env);
    }

    return error('Ruta no encontrada: ' + path, 404, env);
}

/* ============================================================
   7. ENTRYPOINT DEL WORKER
   ============================================================ */
export default {
    async fetch(request, env, ctx) {
        try {
            return await manejar(request, env);
        } catch (err) {
            console.error('Error en worker:', err);
            return new Response(
                JSON.stringify({
                    ok: false,
                    error: 'Error interno del servidor',
                    detalle: err && err.message ? err.message : 'desconocido'
                }),
                {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': (env && env.CORS_ORIGIN) || '*'
                    }
                }
            );
        }
    }
};