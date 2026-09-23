/* ============================================================
   MOTOR DE RIFAS · assets/js/boleto.js
   Boleto + 3 modos de acceso + QR offline + sección pública
   + cédula opcional en familiar + init robusto (anti-blanco)
   Expone window.Boleto
   Marco: CCG-IA v1.0.0 · Autor: Felix
   ============================================================ */

(function (global) {
    'use strict';

    var U     = global.UI;
    var Store = global.Store;
    var Theme = global.Theme;
    var BCV   = global.BCV;

    /* ============================================================
       1. CONSTANTES
       ============================================================ */
    var KEY_SELECCION = 'rifa_seleccion_actual';
    var KEY_FORM      = 'rifa_form_borrador';
    var KEY_RECARGAR  = 'rifa_recargar';
    var KEY_TOTAL_USD = 'rifa_total_usd';
    var KEY_TOTAL_BS  = 'rifa_total_bs';
    var KEY_TOTAL_COP = 'rifa_total_cop';

    var MOTIVO_DEFAULT = 'Gracias por ser parte de esta historia. 💛';
    var HORAS_RESERVA_DEFAULT = 48;

    var MODOS_ACCESO_VALIDOS = ['cedula', 'clave', 'publico'];

    /* ============================================================
       2. ESTADO
       ============================================================ */
    var state = {
        modo:            null,
        modoAcceso:      'cedula',
        seleccion:       [],
        registros:       [],
        esPostRegistro:  false,
        datosPrecargados:false,
        inicializado:    false,
        panelesListos:   false
    };

    /* ============================================================
       3. DOM
       ============================================================ */
    var el = {};

    function cachearElementos() {
        el.panelLoader     = U.$('#panel-loader');
        el.panelRegistro   = U.$('#panel-registro');
        el.panelAuth       = U.$('#panel-auth');
        el.panelBoletos    = U.$('#panel-boletos');
        el.panelVacio      = U.$('#panel-vacio');

        el.headerTitulo    = U.$('#header-titulo');
        el.headerBadge     = U.$('#header-badge');
        el.progressFill    = U.$('#progress-fill');

        el.registroPreview = U.$('#registro-nums-preview');
        el.registroTotal   = U.$('#registro-total');
        el.filaLimite      = U.$('#fila-limite');
        el.registroLimite  = U.$('#registro-limite');
        el.registroCampos  = U.$('#registro-campos');

        el.btnConfirmar    = U.$('#btn-confirmar');
        el.btnPagarPre     = U.$('#btn-pagar-pre');
        el.btnCancelar     = U.$('#btn-cancelar');

        el.authTitulo      = U.$('#auth-titulo');
        el.authSubtitulo   = U.$('#auth-subtitulo');
        el.authForm        = U.$('#auth-form');
        el.authInfo        = U.$('#auth-info');
        el.authPrivacidad  = U.$('#auth-privacidad');

        el.boletoCardContent = U.$('#boleto-card-content');

        el.boletoSticky    = U.$('#boleto-sticky');
        el.boletoStickyIn  = U.$('#boleto-sticky-inner');

        el.vacioTitulo     = U.$('#vacio-titulo');
        el.vacioSubtitulo  = U.$('#vacio-subtitulo');
        el.btnVacioIntentar= U.$('#btn-vacio-intentar');
    }

    /* ============================================================
       4. HELPERS DE SEGURIDAD
       ============================================================ */
    function safeCall(fn, fallback) {
        try { return fn(); }
        catch (e) {
            if (U && U.warn) U.warn('boleto.js:', e);
            return fallback;
        }
    }

    function ocultarLoader() {
        if (el.panelLoader) el.panelLoader.classList.add('hidden');
    }

    function algunPanelVisible() {
        var ids = ['panel-registro', 'panel-auth', 'panel-boletos', 'panel-vacio'];
        for (var i = 0; i < ids.length; i++) {
            var p = U.$('#' + ids[i]);
            if (p && !p.classList.contains('hidden')) return true;
        }
        return false;
    }

    /* ============================================================
       5. MODO DE ACCESO
       ============================================================ */
    function leerModoAcceso() {
        var cfg = safeCall(function () { return Store.leerConfig(); }, {});
        var m = (cfg.opciones && cfg.opciones.modoAcceso) || 'cedula';
        return MODOS_ACCESO_VALIDOS.indexOf(m) !== -1 ? m : 'cedula';
    }

    /* ============================================================
       6. NAVEGACIÓN
       ============================================================ */
    function mostrarPanel(id) {
        [el.panelLoader, el.panelRegistro, el.panelAuth,
         el.panelBoletos, el.panelVacio].forEach(function (p) {
            if (p) p.classList.add('hidden');
        });
        var target = U.$('#' + id);
        if (target) target.classList.remove('hidden');

        if (id !== 'panel-boletos') ocultarSticky();
        safeCall(function () {
            global.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function ocultarSticky() {
        if (!el.boletoSticky) return;
        el.boletoSticky.hidden = true;
        if (el.boletoStickyIn) el.boletoStickyIn.innerHTML = '';
    }

    /* ============================================================
       7. SESIÓN
       ============================================================ */
    function leerSeleccionGuardada() {
        try {
            var raw = sessionStorage.getItem(KEY_SELECCION);
            var arr = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(arr)) return [];
            return arr.filter(function (n) { return /^\d+$/.test(n); });
        } catch (e) { return []; }
    }

    function leerFormGuardado() {
        try {
            var raw = sessionStorage.getItem(KEY_FORM);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }

    function leerTotalesGuardados() {
        var totalUsd = null, totalBs = null, totalCop = null;
        try {
            var usdRaw = sessionStorage.getItem(KEY_TOTAL_USD);
            if (usdRaw != null && usdRaw !== '') {
                var parsed = parseFloat(usdRaw);
                if (!isNaN(parsed) && parsed >= 0) totalUsd = parsed;
            }
            var bsRaw = sessionStorage.getItem(KEY_TOTAL_BS);
            if (bsRaw != null && bsRaw.trim() !== '') totalBs = bsRaw.trim();
            var copRaw = sessionStorage.getItem(KEY_TOTAL_COP);
            if (copRaw != null && copRaw.trim() !== '') totalCop = copRaw.trim();
        } catch (e) { /* silent */ }
        return { totalUsd: totalUsd, totalBs: totalBs, totalCop: totalCop };
    }

    function limpiarSesionRegistro() {
        try {
            sessionStorage.removeItem(KEY_SELECCION);
            sessionStorage.removeItem(KEY_FORM);
            sessionStorage.removeItem(KEY_TOTAL_USD);
            sessionStorage.removeItem(KEY_TOTAL_BS);
            sessionStorage.removeItem(KEY_TOTAL_COP);
            sessionStorage.setItem(KEY_RECARGAR, '1');
        } catch (e) { /* silent */ }
    }

    function hayDatosPrecargados(form) {
        form = form || {};
        var nombreOK = (form.nombre || '').trim().length >= 3;
        var telOK = (U && U.esTelefonoValido) ? U.esTelefonoValido(form.telefono || '') : true;
        if (!nombreOK || !telOK) return false;

        if (state.modoAcceso === 'cedula') {
            return (U && U.esCedulaValida) ? U.esCedulaValida(form.cedula || '') : true;
        }
        return true;
    }

    /* ============================================================
       8. CONFIG Y CÁLCULOS
       ============================================================ */
    function horasReservaLimite() {
        var cfg = safeCall(function () { return Store.leerConfig(); }, {});
        var op = cfg.opciones || {};
        var h = parseInt(op.reservaHorasLimite, 10);
        return (h > 0) ? h : HORAS_RESERVA_DEFAULT;
    }

    function calcularFechaLimite(fechaISO) {
        var h = horasReservaLimite();
        var t = new Date(fechaISO).getTime() + (h * 60 * 60 * 1000);
        return new Date(t).toISOString();
    }

    function estadoPago(reg) {
        if (reg.estado === 'pagado') return 'pagado';
        if (!reg.fechaLimite) return 'normal';

        var ahora = Date.now();
        var limite = new Date(reg.fechaLimite).getTime();
        var faltan = limite - ahora;

        if (faltan < 0) return 'vencido';
        if (faltan < 12 * 60 * 60 * 1000) return 'proximo';
        return 'normal';
    }

    function montoUnitario() {
        var cfg = safeCall(function () { return Store.leerConfig(); }, {});
        var montoStr = (cfg.identidad && cfg.identidad.monto) || '$5';
        var limpio = String(montoStr).replace(/[^0-9.,]/g, '').replace(',', '.');
        return parseFloat(limpio) || 0;
    }

    function formatearUSD(n) { return '$' + Number(n || 0).toFixed(2); }

    /* ============================================================
       9. URL DE VERIFICACIÓN + QR
       ============================================================ */
    function urlVerificacion(reg) {
        var cedula = U.soloDigitos(reg.cedula || '');
        var base = U.urlHermana('boleto.html');
        var url = base + '?verif=' + encodeURIComponent(reg.numero);
        if (cedula) url += '&cedula=' + encodeURIComponent(cedula);
        return url;
    }

    function generarQrHtml(contenido) {
        if (!global.QR || typeof global.QR.generarSVG !== 'function') {
            return '<div class="bc-qr-fallback">⚠️ QR no disponible</div>';
        }
        try {
            var svg = global.QR.generarSVG(contenido, {
                size: 260, margin: 2,
                bgColor: '#ffffff', fgColor: '#0f172a'
            });
            return '<div class="bc-qr-svg">' + svg + '</div>';
        } catch (e) {
            return '<div class="bc-qr-fallback">⚠️ QR no disponible</div>';
        }
    }

    /* ============================================================
       10. MOTIVO
       ============================================================ */
    function obtenerMotivo() {
        var cfg = safeCall(function () { return Store.leerConfig(); }, {});
        var ident = cfg.identidad || {};
        if (ident.mensajeBoleto && ident.mensajeBoleto.trim()) return ident.mensajeBoleto.trim();
        if (ident.nombreRifa) return 'Gracias por apoyar a ' + ident.nombreRifa + '. 💛';
        return MOTIVO_DEFAULT;
    }

    /* ============================================================
       11. PRIVACIDAD
       ============================================================ */
    function esBoletoPublico(reg) {
        if (!reg) return false;
        return !reg.clave && !reg.cedula;
    }

    /* ============================================================
       12. CONTEXTO DE PAGO
       ============================================================ */
    function getContextoPago() {
        if (state.modo === 'resultado' && state.registros.length > 0) {
            var apartados = state.registros.filter(function (r) {
                return r.estado === 'apartado';
            });
            if (apartados.length === 0) return null;

            var totalPost = 0, totalBsPost = '', totalCopPost = '';
            apartados.forEach(function (r) { totalPost += Number(r.montoUnitUsd || 0); });
            if (totalPost === 0) totalPost = montoUnitario() * apartados.length;
            if (apartados[0]) {
                totalBsPost = apartados[0].totalBs || '';
                totalCopPost = apartados[0].totalCop || '';
            }

            return {
                tipo: 'post', registros: apartados,
                numeros: apartados.map(function (r) { return r.numero; }),
                total: totalPost, totalBs: totalBsPost, totalCop: totalCopPost,
                nombre: apartados[0].nombre || '',
                cedula: apartados[0].cedula || '',
                telefono: apartados[0].telefono || '',
                clave: apartados[0].clave || ''
            };
        }

        var totales = leerTotalesGuardados();
        return {
            tipo: 'pre', registros: null,
            numeros: state.seleccion.slice(),
            total: montoUnitario() * state.seleccion.length,
            totalBs: totales.totalBs || '', totalCop: totales.totalCop || '',
            nombre: el.fNombre ? el.fNombre.value.trim() : '',
            cedula: el.fCedula ? el.fCedula.value.trim() : '',
            telefono: el.fTelefono ? el.fTelefono.value.trim() : '',
            clave: el.fClave ? el.fClave.value.trim() : ''
        };
    }

    /* ============================================================
       13. MODO REGISTRO
       ============================================================ */
    function iniciarModoRegistro() {
        state.modo = 'registro';
        state.seleccion = leerSeleccionGuardada();

        if (state.seleccion.length === 0) {
            U.toast('No hay números seleccionados.', 'warn');
            setTimeout(function () { location.href = 'rifas.html'; }, 800);
            return;
        }

        var formGuardado = leerFormGuardado();
        state.datosPrecargados = hayDatosPrecargados(formGuardado);

        if (el.headerTitulo) el.headerTitulo.textContent = 'Confirmar Reserva';
        if (el.headerBadge)  el.headerBadge.textContent  = 'Paso final';
        if (el.progressFill) el.progressFill.style.width = '80%';

        renderizarChipsRegistro();
        renderizarPanelRegistro();
        bindBotonesRegistro();
        mostrarPanel('panel-registro');
        state.panelesListos = true;
    }

    function renderizarChipsRegistro() {
        if (!el.registroPreview) return;

        el.registroPreview.innerHTML = state.seleccion.map(function (num) {
            return '<span style="' +
                'background: var(--accent);' +
                'color: var(--accent-text);' +
                'font-weight: 900;' +
                'font-size: 0.82rem;' +
                'padding: 5px 11px;' +
                'border-radius: 8px;' +
                'box-shadow: 0 0 10px var(--accent-glow);' +
                'font-variant-numeric: tabular-nums;' +
                'letter-spacing: 0.3px;' +
            '">' + U.escapeHtml(num) + '</span>';
        }).join('');

        var cfg = safeCall(function () { return Store.leerConfig(); }, {});
        var monto = (cfg.identidad && cfg.identidad.monto) || '$5';
        var unit = montoUnitario();
        var total = unit * state.seleccion.length;

        if (el.registroTotal) {
            el.registroTotal.textContent =
                state.seleccion.length + ' × ' + monto + ' = ' +
                (total > 0 ? formatearUSD(total) : monto);
        }

        var fechaLimite = calcularFechaLimite(new Date().toISOString());
        if (el.filaLimite) el.filaLimite.style.display = 'flex';
        if (el.registroLimite) el.registroLimite.textContent = U.fechaHumana(fechaLimite);
    }

    function renderizarPanelRegistro() {
        if (!el.registroCampos) return;

        var modo = state.modoAcceso;
        var guardado = leerFormGuardado();

        var valNombre   = U.escapeHtml(guardado.nombre || '');
        var valCedula   = U.escapeHtml(guardado.cedula || '');
        var valClave    = U.escapeHtml(guardado.clave || '');
        var valTelefono = U.escapeHtml(guardado.telefono || '');

        var html = '';

        if (modo === 'cedula') {
            html =
                '<div class="input-group-sm full">' +
                    '<label for="f-nombre">Nombre y apellido</label>' +
                    '<input type="text" id="f-nombre" placeholder="Ej: Felix Arrieche" autocomplete="name" maxlength="80" value="' + valNombre + '">' +
                '</div>' +
                '<div class="input-group-sm">' +
                    '<label for="f-cedula">Cédula</label>' +
                    '<input type="tel" id="f-cedula" placeholder="V-12345678" inputmode="numeric" maxlength="12" value="' + valCedula + '">' +
                '</div>' +
                '<div class="input-group-sm">' +
                    '<label for="f-telefono">Teléfono</label>' +
                    '<input type="tel" id="f-telefono" placeholder="+58 412-..." inputmode="tel" maxlength="16" value="' + valTelefono + '">' +
                '</div>';

        } else if (modo === 'clave') {
            html =
                '<div class="input-group-sm full">' +
                    '<label for="f-nombre">Nombre y apellido</label>' +
                    '<input type="text" id="f-nombre" placeholder="Ej: Felix Arrieche" autocomplete="name" maxlength="80" value="' + valNombre + '">' +
                '</div>' +
                '<div class="input-group-sm full">' +
                    '<label for="f-telefono">Teléfono / WhatsApp</label>' +
                    '<input type="tel" id="f-telefono" placeholder="+58 412-..." inputmode="tel" maxlength="16" value="' + valTelefono + '">' +
                '</div>' +
                '<div class="input-group-sm full">' +
                    '<label for="f-cedula">Cédula (opcional)</label>' +
                    '<input type="tel" id="f-cedula" placeholder="V-12345678 (opcional)" inputmode="numeric" maxlength="12" value="' + valCedula + '">' +
                '</div>' +
                '<div class="input-group-sm full">' +
                    '<label for="f-clave">Clave de 4 dígitos (opcional)</label>' +
                    '<div class="input-con-accion">' +
                        '<input type="tel" id="f-clave" placeholder="••••" inputmode="numeric" maxlength="4" value="' + valClave + '">' +
                        '<button type="button" class="btn-inline" id="btn-clave-random" title="Generar clave al azar">🎲</button>' +
                    '</div>' +
                '</div>';

        } else {
            html =
                '<div class="input-group-sm full">' +
                    '<label for="f-nombre">Nombre y apellido</label>' +
                    '<input type="text" id="f-nombre" placeholder="Ej: Felix Arrieche" autocomplete="name" maxlength="80" value="' + valNombre + '">' +
                '</div>' +
                '<div class="input-group-sm full">' +
                    '<label for="f-telefono">Teléfono / WhatsApp</label>' +
                    '<input type="tel" id="f-telefono" placeholder="+58 412-..." inputmode="tel" maxlength="16" value="' + valTelefono + '">' +
                '</div>';
        }

        html += '<div id="aviso-precargado" class="full"></div>';
        html += '<div id="aviso-privacidad" class="full"></div>';

        el.registroCampos.innerHTML = html;

        cachearCamposRegistro();
        bindCamposRegistro();
        actualizarAvisoPrecargado();
        actualizarAvisoPrivacidad();
        actualizarBotonConfirmar();
    }

    function cachearCamposRegistro() {
        el.fNombre      = U.$('#f-nombre');
        el.fCedula      = U.$('#f-cedula');
        el.fClave       = U.$('#f-clave');
        el.fTelefono    = U.$('#f-telefono');
        el.btnClaveRandom = U.$('#btn-clave-random');
    }

    function bindCamposRegistro() {
        [el.fNombre, el.fCedula, el.fClave, el.fTelefono].forEach(function (input) {
            if (!input) return;
            input.addEventListener('input', function () {
                U.marcarInvalido(input, false);
                guardarFormTemporal();
                actualizarBotonConfirmar();
                if (input === el.fClave || input === el.fCedula) actualizarAvisoPrivacidad();
            });
        });

        if (el.fCedula) {
            el.fCedula.addEventListener('blur', function () {
                var v = el.fCedula.value.trim();
                if (v && U.esCedulaValida(v)) {
                    el.fCedula.value = U.formatearCedula(v);
                    guardarFormTemporal();
                    actualizarBotonConfirmar();
                    actualizarAvisoPrivacidad();
                }
            });
        }

        if (el.fClave) {
            el.fClave.addEventListener('blur', function () {
                var v = el.fClave.value.replace(/\D/g, '');
                el.fClave.value = v;
                guardarFormTemporal();
                actualizarBotonConfirmar();
                actualizarAvisoPrivacidad();
            });
        }

        if (el.btnClaveRandom && el.fClave) {
            el.btnClaveRandom.addEventListener('click', function () {
                el.fClave.value = U.generarClave4();
                guardarFormTemporal();
                actualizarBotonConfirmar();
                actualizarAvisoPrivacidad();
                U.toast('🎲 Clave generada: ' + el.fClave.value, 'info', 1800);
            });
        }
    }

    function actualizarAvisoPrecargado() {
        var cont = U.$('#aviso-precargado');
        if (!cont) return;

        if (state.datosPrecargados) {
            cont.innerHTML =
                '<div class="aviso-privacidad aviso-precargado">' +
                    '✅ <strong>Datos ya capturados.</strong> Revísalos y confirma la reserva.' +
                '</div>';
        } else {
            cont.innerHTML = '';
        }
    }

    function actualizarAvisoPrivacidad() {
        var cont = U.$('#aviso-privacidad');
        if (!cont) return;

        var modo = state.modoAcceso;
        var html = '';

        if (modo === 'cedula') {
            html =
                '<div class="aviso-privacidad aviso-privado">' +
                    '🔒 <strong>Boleto privado:</strong> tu cédula protege este boleto. ' +
                    'Solo tú podrás consultarlo.' +
                '</div>';

        } else if (modo === 'clave') {
            var claveRaw = el.fClave ? el.fClave.value.replace(/\D/g, '') : '';
            var cedulaRaw = el.fCedula ? el.fCedula.value.trim() : '';
            var tieneClave = claveRaw.length === 4;
            var tieneCedula = cedulaRaw && U.esCedulaValida && U.esCedulaValida(cedulaRaw);

            if (claveRaw.length > 0 && claveRaw.length < 4) {
                html =
                    '<div class="aviso-privacidad aviso-publico">' +
                        '⚠️ La clave debe tener <strong>4 dígitos</strong>. ' +
                        'Si la dejas así, no se guardará y el boleto quedará ' +
                        (tieneCedula ? 'protegido solo por cédula.' : 'público.') +
                    '</div>';
            } else if (tieneCedula && tieneClave) {
                html =
                    '<div class="aviso-privacidad aviso-privado">' +
                        '🔒 <strong>Boleto privado (doble protección):</strong> ' +
                        'podrás consultarlo con tu cédula o con tu clave.' +
                    '</div>';
            } else if (tieneCedula) {
                html =
                    '<div class="aviso-privacidad aviso-privado">' +
                        '🔒 <strong>Boleto privado:</strong> tu cédula lo protege. ' +
                        'Solo tú podrás consultarlo.' +
                    '</div>';
            } else if (tieneClave) {
                html =
                    '<div class="aviso-privacidad aviso-privado">' +
                        '🔒 <strong>Boleto privado:</strong> tu clave lo protege. ' +
                        'Solo quien la sepa podrá consultarlo.' +
                    '</div>';
            } else {
                html =
                    '<div class="aviso-privacidad aviso-publico">' +
                        '⚠️ <strong>Boleto público:</strong> sin clave ni cédula, ' +
                        'aparecerá en la sección pública y cualquiera podrá ver tu nombre ' +
                        'y número. Agrega una cédula o pulsa 🎲 para una clave y hacerlo privado.' +
                    '</div>';
            }

        } else if (modo === 'publico') {
            html =
                '<div class="aviso-privacidad aviso-publico">' +
                    '⚠️ <strong>Modo público:</strong> tus boletos aparecerán en la sección ' +
                    'pública visibles para todos. Guarda tu código para consultarlos después.' +
                '</div>';
        }

        cont.innerHTML = html;
    }

    function guardarFormTemporal() {
        try {
            sessionStorage.setItem(KEY_FORM, JSON.stringify({
                nombre:   el.fNombre   ? el.fNombre.value.trim()   : '',
                cedula:   el.fCedula   ? el.fCedula.value.trim()   : '',
                clave:    el.fClave    ? el.fClave.value.trim()    : '',
                telefono: el.fTelefono ? el.fTelefono.value.trim() : ''
            }));
        } catch (e) { /* silent */ }
    }

    function validarRegistro(silencioso) {
        var nombre   = el.fNombre   ? el.fNombre.value.trim()   : '';
        var cedula   = el.fCedula   ? el.fCedula.value.trim()   : '';
        var clave    = el.fClave    ? el.fClave.value.trim()    : '';
        var telefono = el.fTelefono ? el.fTelefono.value.trim() : '';

        var okNombre   = nombre.length >= 3;
        var okTelefono = U.esTelefonoValido(telefono);
        var okCedula   = true;
        var okClave    = true;

        if (state.modoAcceso === 'cedula') {
            okCedula = U.esCedulaValida(cedula);
        } else if (state.modoAcceso === 'clave') {
            if (cedula && !U.esCedulaValida(cedula)) okCedula = false;
            if (clave && !U.validarClave4(clave)) okClave = false;
        }

        if (!silencioso) {
            U.marcarInvalido(el.fNombre,   !okNombre);
            U.marcarInvalido(el.fTelefono, !okTelefono);
            if (state.modoAcceso === 'cedula') U.marcarInvalido(el.fCedula, !okCedula);
            if (state.modoAcceso === 'clave') {
                if (cedula) U.marcarInvalido(el.fCedula, !okCedula);
                if (clave)  U.marcarInvalido(el.fClave,  !okClave);
            }
        }

        var ok = okNombre && okTelefono && okCedula && okClave;
        var motivo = null;
        if (!okNombre)        motivo = 'nombre';
        else if (!okTelefono) motivo = 'telefono';
        else if (!okCedula)   motivo = 'cedula';
        else if (!okClave)    motivo = 'clave';

        return { ok: ok, nombre: nombre, cedula: cedula, clave: clave,
                 telefono: telefono, motivo: motivo };
    }

    function actualizarBotonConfirmar() {
        if (!el.btnConfirmar) return;
        var v = validarRegistro(true);
        el.btnConfirmar.disabled = !v.ok;
    }

    function bindBotonesRegistro() {
        if (el.btnConfirmar) {
            el.btnConfirmar.removeEventListener('click', confirmarReserva);
            el.btnConfirmar.addEventListener('click', confirmarReserva);
        }
        if (el.btnPagarPre) {
            el.btnPagarPre.removeEventListener('click', onPagarPre);
            el.btnPagarPre.addEventListener('click', onPagarPre);
        }
        if (el.btnCancelar) {
            el.btnCancelar.removeEventListener('click', onCancelarRegistro);
            el.btnCancelar.addEventListener('click', onCancelarRegistro);
        }
    }

    function onPagarPre() {
        var ctx = getContextoPago();
        if (!ctx || ctx.numeros.length === 0) {
            U.toast('Selecciona al menos un número.', 'warn');
            return;
        }
        abrirModalMetodos(ctx);
    }

    function onCancelarRegistro() { location.href = 'rifas.html'; }

    function confirmarReserva() {
        var v = validarRegistro(false);

        if (!v.ok) {
            if (v.motivo === 'nombre'   && el.fNombre)   el.fNombre.focus();
            if (v.motivo === 'cedula'   && el.fCedula)   el.fCedula.focus();
            if (v.motivo === 'telefono' && el.fTelefono) el.fTelefono.focus();
            if (v.motivo === 'clave'    && el.fClave)    el.fClave.focus();
            U.toast('Revisa los campos marcados.', 'warn');
            return;
        }

        if (el.btnConfirmar) {
            el.btnConfirmar.disabled = true;
            el.btnConfirmar.textContent = '⏳ Procesando…';
        }

        var nombre = v.nombre;
        var cedulaFinal = null;
        var claveFinal = null;

        if (state.modoAcceso === 'cedula') {
            cedulaFinal = v.cedula ? U.formatearCedula(v.cedula) : null;
        } else if (state.modoAcceso === 'clave') {
            cedulaFinal = v.cedula ? U.formatearCedula(v.cedula) : null;
            claveFinal  = v.clave  ? v.clave : null;
        }

        var telefono = v.telefono;
        var totales = leerTotalesGuardados();
        var montoUnit = montoUnitario();
        var totalUsdFinal = (totales.totalUsd != null)
            ? totales.totalUsd
            : (montoUnit * state.seleccion.length);

        Store.cargarRegistros(true).then(function (actuales) {
            var ocupados = Store.numerosOcupados(actuales);
            var conflicto = state.seleccion.filter(function (num) {
                return ocupados.has(num);
            });

            if (conflicto.length > 0) {
                U.toast('Estos números ya fueron apartados: ' + conflicto.join(', '), 'danger', 5000);
                restaurarBotonConfirmar();
                state.seleccion = state.seleccion.filter(function (num) {
                    return !ocupados.has(num);
                });
                if (state.seleccion.length === 0) {
                    setTimeout(function () { location.href = 'rifas.html'; }, 1500);
                    return;
                }
                renderizarChipsRegistro();
                return;
            }

            var cfg = safeCall(function () { return Store.leerConfig(); }, {});
            var fecha = new Date().toISOString();
            var fechaLimite = calcularFechaLimite(fecha);
            var loteria = (cfg.identidad && cfg.identidad.loteria) || 'Chance A';

            var nuevos = state.seleccion.map(function (num) {
                return {
                    id:               U.generarId(),
                    numero:           num,
                    nombre:           nombre,
                    cedula:           cedulaFinal,
                    telefono:         telefono,
                    clave:            claveFinal,
                    sinClave:         !claveFinal && !!cedulaFinal,
                    estado:           'apartado',
                    metodoPago:       null,
                    boleto:           Store.generarCodigoBoleto(nombre, num, cedulaFinal || '', fecha, loteria),
                    aceptoTerminos:   true,
                    versionTerminos:  cfg.terminosVersion || 'v1',
                    notas:            '',
                    fecha:            fecha,
                    fechaLimite:      fechaLimite,
                    recordatorioActivo: false,
                    autorizaRecordatorio: false,
                    totalUsd:         totalUsdFinal,
                    totalBs:          totales.totalBs || null,
                    totalCop:         totales.totalCop || null,
                    montoUnitUsd:     montoUnit
                };
            });

            return Store.crearRegistros(nuevos).then(function (res) {
                if (!res.ok) {
                    U.toast('Error al guardar. Intenta de nuevo.', 'danger');
                    restaurarBotonConfirmar();
                    return;
                }

                if (cedulaFinal) Store.guardarMiCedula(cedulaFinal);
                if (claveFinal)  Store.guardarMiClave(claveFinal);

                limpiarSesionRegistro();
                U.toast('✅ Reserva registrada con éxito.', 'ok', 2200);

                state.registros = nuevos;
                state.esPostRegistro = true;

                mostrarBoletos(nuevos, { postRegistro: true });
            });
        }).catch(function (err) {
            U.warn('Error confirmando reserva:', err);
            U.toast('Error de conexión. Intenta de nuevo.', 'danger');
            restaurarBotonConfirmar();
        });
    }

    function restaurarBotonConfirmar() {
        if (el.btnConfirmar) {
            el.btnConfirmar.disabled = false;
            el.btnConfirmar.textContent = '✅ Confirmar Reserva';
        }
    }

    /* ============================================================
       14. MODO CONSULTA
       ============================================================ */
    function iniciarModoConsulta(cedulaInicial) {
        state.modo = 'consulta';

        if (el.headerTitulo) el.headerTitulo.textContent = 'Consultar Boletos';
        if (el.headerBadge)  el.headerBadge.textContent  = 'Consulta';
        if (el.progressFill) el.progressFill.style.width = '60%';

        renderizarPanelAuth();

        if (cedulaInicial) {
            var input = U.$('#acceso-input');
            if (input) input.value = U.formatearCedula(cedulaInicial);
            buscarBoletos(cedulaInicial);
            return;
        }

        var input2 = U.$('#acceso-input');
        if (input2) {
            if (state.modoAcceso === 'cedula') {
                var mi = Store.leerMiCedula();
                if (mi) input2.value = mi;
            } else if (state.modoAcceso === 'clave') {
                var miClave = Store.leerMiClave();
                if (miClave) input2.value = miClave;
            }
        }

        mostrarPanel('panel-auth');
        state.panelesListos = true;
    }

    function renderizarPanelAuth() {
        if (!el.authForm) return;

        var modo = state.modoAcceso;
        var searchHTML = '';

        if (modo === 'cedula') {
            if (el.authTitulo)    el.authTitulo.textContent    = 'Consultar mis boletos';
            if (el.authSubtitulo) el.authSubtitulo.textContent = 'Ingresa tu cédula para ver tus números y su estado.';
            if (el.authPrivacidad) el.authPrivacidad.textContent =
                'Tu cédula es tu clave de acceso. Solo tú puedes ver los boletos asociados a ella. ' +
                'Los boletos sin cédula ni clave aparecen en la sección pública.';

            searchHTML =
                '<div class="input-group">' +
                    '<label for="acceso-input">Cédula de identidad</label>' +
                    '<input type="tel" class="input-field" id="acceso-input" placeholder="V-12345678" inputmode="numeric" maxlength="12">' +
                '</div>' +
                '<button type="button" class="btn-accion" id="btn-validar">🔎 Ver mis boletos</button>' +
                '<button type="button" class="btn-accion btn-ghost" id="btn-limpiar-acceso">Limpiar</button>';

        } else if (modo === 'clave') {
            if (el.authTitulo)    el.authTitulo.textContent    = 'Consultar mis boletos';
            if (el.authSubtitulo) el.authSubtitulo.textContent = 'Escribe tu clave, cédula o código del boleto.';
            if (el.authPrivacidad) el.authPrivacidad.textContent =
                'Puedes consultar con tu clave de 4 dígitos, tu cédula o el código del boleto. ' +
                'Los boletos sin clave ni cédula aparecen en la sección pública.';

            searchHTML =
                '<div class="input-group">' +
                    '<label for="acceso-input">Clave, cédula o código</label>' +
                    '<input type="text" class="input-field" id="acceso-input" placeholder="Ej: 1234  ·  V-12345678  ·  OK-XXXX..." autocomplete="off" maxlength="40">' +
                '</div>' +
                '<button type="button" class="btn-accion" id="btn-validar">🔎 Ver mis boletos</button>' +
                '<button type="button" class="btn-accion btn-ghost" id="btn-limpiar-acceso">Limpiar</button>';

        } else {
            if (el.authTitulo)    el.authTitulo.textContent    = 'Boletos de la rifa';
            if (el.authSubtitulo) el.authSubtitulo.textContent = 'Consulta pública. Mira los boletos o busca por código.';
            if (el.authPrivacidad) el.authPrivacidad.textContent =
                'Modo público: no se pide cédula. Busca tu boleto por código o revísalo en la lista.';

            searchHTML =
                '<div class="input-group">' +
                    '<label for="acceso-input">Buscar por código de boleto</label>' +
                    '<input type="text" class="input-field" id="acceso-input" placeholder="OK-XXXXXXXX-CHANCE-A" autocomplete="off" maxlength="40">' +
                '</div>' +
                '<button type="button" class="btn-accion" id="btn-validar">🔎 Ver mi boleto</button>';
        }

        var publicosHTML =
            '<div class="publicos-section">' +
                '<button type="button" class="publicos-toggle" id="publicos-toggle">' +
                    '<span>📋 Boletos públicos (sin clave ni cédula)</span>' +
                    '<span class="publicos-toggle-arrow" id="publicos-arrow">▾</span>' +
                '</button>' +
                '<div class="publicos-container hidden" id="publicos-container">' +
                    '<div id="lista-publica"></div>' +
                '</div>' +
            '</div>';

        el.authForm.innerHTML = searchHTML + publicosHTML;

        bindPanelAuth();
        bindPublicosToggle(modo === 'publico');
        cargarListaPublica();
    }

    function bindPanelAuth() {
        var input = U.$('#acceso-input');
        var btnValidar = U.$('#btn-validar');
        var btnLimpiar = U.$('#btn-limpiar-acceso');

        if (input) {
            input.addEventListener('input', function () {
                U.marcarInvalido(input, false);
            });
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && btnValidar) btnValidar.click();
            });
            input.addEventListener('blur', function () {
                var v = input.value.trim();
                if (state.modoAcceso === 'cedula' && v && U.esCedulaValida(v)) {
                    input.value = U.formatearCedula(v);
                }
            });
        }

        if (btnValidar) {
            btnValidar.addEventListener('click', function () {
                var v = input ? input.value.trim() : '';
                if (!v) { U.toast('Escribe algo para buscar.', 'warn'); return; }
                buscarBoletos(v);
            });
        }

        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', function () {
                if (input) input.value = '';
                U.marcarInvalido(input, false);
                if (input) input.focus();
            });
        }
    }

    function bindPublicosToggle(expandidoPorDefecto) {
        var toggle = U.$('#publicos-toggle');
        var cont   = U.$('#publicos-container');
        var arrow  = U.$('#publicos-arrow');
        if (!toggle || !cont) return;

        if (expandidoPorDefecto) {
            cont.classList.remove('hidden');
            if (arrow) arrow.textContent = '▴';
        }

        toggle.addEventListener('click', function () {
            var hidden = cont.classList.toggle('hidden');
            if (arrow) arrow.textContent = hidden ? '▾' : '▴';
        });
    }

    function cargarListaPublica() {
        var cont = U.$('#lista-publica');
        if (!cont) return;

        cont.innerHTML = '<p class="empty-msg" style="padding: 14px 0;">Cargando…</p>';

        Store.cargarRegistros(true).then(function (todos) {
            var publicos = (todos || []).filter(esBoletoPublico);

            if (publicos.length === 0) {
                cont.innerHTML =
                    '<p class="empty-msg" style="padding: 14px 0;">' +
                    'Aún no hay boletos públicos. ' +
                    'Los boletos sin clave ni cédula aparecerán aquí.' +
                    '</p>';
                return;
            }

            var ordenados = publicos.slice().sort(function (a, b) {
                return parseInt(a.numero, 10) - parseInt(b.numero, 10);
            });

            if (state.modoAcceso === 'publico') {
                renderizarTarjetasPublicas(cont, ordenados);
            } else {
                renderizarListaSimple(cont, ordenados);
            }
        }).catch(function (err) {
            U.warn('Error cargando lista pública:', err);
            cont.innerHTML =
                '<p class="empty-msg" style="padding: 14px 0;">' +
                'No se pudo cargar la lista. Intenta de nuevo.' +
                '</p>';
        });
    }

    function renderizarListaSimple(cont, ordenados) {
        var html = '<div class="lista-publica-header">📋 ' +
            ordenados.length + ' boleto' + (ordenados.length === 1 ? '' : 's') +
            ' público' + (ordenados.length === 1 ? '' : 's') + '</div>';

        html += '<div class="lista-publica">';
        ordenados.forEach(function (r) {
            var clase = r.estado === 'pagado' ? 'pagado' : 'apartado';
            html += '<div class="lista-publica-item ' + clase + '">' +
                '<span class="lista-publica-num ' + clase + '">' + U.escapeHtml(r.numero) + '</span>' +
                '<span class="lista-publica-nombre">' + U.escapeHtml(r.nombre) + '</span>' +
                '<span class="lista-publica-badge ' + clase + '">' +
                    (r.estado === 'pagado' ? '✓ Pagado' : '⏳') +
                '</span>' +
            '</div>';
        });
        html += '</div>';

        cont.innerHTML = html;
    }

    function renderizarTarjetasPublicas(cont, ordenados) {
        var html = '<div class="publicos-cards-header">🎟️ ' +
            ordenados.length + ' boleto' + (ordenados.length === 1 ? '' : 's') +
            ' público' + (ordenados.length === 1 ? '' : 's') + '</div>';
        html += '<div class="publicos-cards"></div>';

        cont.innerHTML = html;

        var wrap = U.$('.publicos-cards', cont);
        if (!wrap) return;

        ordenados.forEach(function (reg) {
            wrap.appendChild(construirBoletoCard(reg, true));
        });
    }

    /* ---------- DETECCIÓN Y BÚSQUEDA ---------- */
    function detectarTipoConsulta(valor) {
        var v = String(valor || '').trim();
        if (!v) return null;

        if (/^OK-[0-9A-F]{8}-/i.test(v)) return 'codigo';

        var solo = U.soloDigitos(v);
        if (solo.length >= 5 && solo.length <= 10) {
            if (state.modoAcceso === 'clave' && /^\d{4}$/.test(v)) return 'clave';
            return 'cedula';
        }
        if (/^\d{4}$/.test(v)) return 'clave';

        return null;
    }

    function buscarBoletos(valor) {
        var tipo = detectarTipoConsulta(valor);
        var modo = state.modoAcceso;

        if (!tipo) {
            U.toast('Formato no reconocido. Revisa el dato.', 'warn');
            U.marcarInvalido(U.$('#acceso-input'), true);
            return;
        }

        if (modo === 'cedula' && tipo !== 'cedula') {
            U.toast('En este modo solo se consulta con cédula.', 'warn');
            U.marcarInvalido(U.$('#acceso-input'), true);
            return;
        }

        var btn = U.$('#btn-validar');
        if (btn) { btn.disabled = true; btn.textContent = '🔎 Buscando…'; }

        var promesa;
        if (tipo === 'cedula') {
            promesa = Store.buscarPorCedula(valor);
        } else if (tipo === 'clave') {
            promesa = Store.buscarPorClave(valor);
        } else if (tipo === 'codigo') {
            promesa = Store.buscarPorCodigo(valor).then(function (r) {
                return r ? [r] : [];
            });
        } else {
            promesa = Promise.resolve([]);
        }

        promesa.then(function (registros) {
            if (btn) {
                btn.disabled = false;
                btn.textContent = modo === 'publico' ? '🔎 Ver mi boleto' : '🔎 Ver mis boletos';
            }

            if (!registros || registros.length === 0) {
                mostrarPanel('panel-vacio');
                bindVacio();
                return;
            }

            if (tipo === 'cedula') Store.guardarMiCedula(valor);
            if (tipo === 'clave')  Store.guardarMiClave(valor);

            state.registros = registros;
            state.esPostRegistro = false;
            mostrarBoletos(registros, { postRegistro: false });
        }).catch(function (err) {
            U.warn('Error buscando boletos:', err);
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔎 Ver mis boletos';
            }
            U.toast('Error al buscar. Intenta de nuevo.', 'danger');
        });
    }

    function bindVacio() {
        if (el.vacioTitulo) {
            el.vacioTitulo.textContent = state.modoAcceso === 'publico'
                ? 'Código no encontrado'
                : 'Sin boletos registrados';
        }
        if (el.vacioSubtitulo) {
            if (state.modoAcceso === 'publico') {
                el.vacioSubtitulo.textContent = 'No encontramos un boleto con ese código.';
            } else if (state.modoAcceso === 'clave') {
                el.vacioSubtitulo.textContent = 'No encontramos boletos con esa clave, cédula o código.';
            } else {
                el.vacioSubtitulo.textContent = 'No encontramos boletos asociados a esa cédula.';
            }
        }
        if (el.btnVacioIntentar) {
            el.btnVacioIntentar.removeEventListener('click', onVacioIntentar);
            el.btnVacioIntentar.addEventListener('click', onVacioIntentar);
        }
    }

    function onVacioIntentar() {
        state.modo = 'consulta';
        renderizarPanelAuth();
        var input = U.$('#acceso-input');
        if (input) input.value = '';
        mostrarPanel('panel-auth');
    }

    /* ============================================================
       15. MOSTRAR BOLETOS
       ============================================================ */
    function mostrarBoletos(registros, opciones) {
        opciones = opciones || {};
        var postRegistro = !!opciones.postRegistro;

        state.modo = 'resultado';

        if (el.headerTitulo) el.headerTitulo.textContent = 'Mis Boletos';
        if (el.headerBadge)  el.headerBadge.textContent  =
            registros.length + (registros.length === 1 ? ' boleto' : ' boletos');
        if (el.progressFill) el.progressFill.style.width = '100%';

        renderizarBoletos(registros);
        construirStickyDinamica(registros, { postRegistro: postRegistro });
        mostrarPanel('panel-boletos');
    }

    function renderizarBoletos(registros) {
        if (!el.boletoCardContent) return;
        el.boletoCardContent.innerHTML = '';

        var ordenados = registros.slice().sort(function (a, b) {
            return parseInt(a.numero, 10) - parseInt(b.numero, 10);
        });

        ordenados.forEach(function (reg) {
            el.boletoCardContent.appendChild(construirBoletoCard(reg, false));
        });

        U.$$('.bc-clave-copiar', el.boletoCardContent).forEach(function (btn) {
            btn.addEventListener('click', function () {
                var clave = btn.dataset.clave || '';
                U.copiar(clave).then(function (ok) {
                    if (ok) U.toast('✅ Clave copiada', 'ok', 1500);
                    else    U.toast('No se pudo copiar', 'warn');
                });
            });
        });
    }

    function construirBoletoCard(reg, esPublica) {
        var cfg = safeCall(function () { return Store.leerConfig(); }, {});
        var loteria = (cfg.identidad && cfg.identidad.loteria) || 'Chance A';
        var monto   = (cfg.identidad && cfg.identidad.monto)   || '$5';
        var nombre  = (cfg.identidad && cfg.identidad.nombreRifa) || 'Gran Rifa';

        var esPagado = reg.estado === 'pagado';
        var claseEstado = esPagado ? 'pagado' : 'apartado';
        var textoEstado = esPagado ? 'PAGADO' : 'APARTADO';

        var card = document.createElement('div');
        card.className = 'boleto-card' + (esPublica ? ' boleto-card-publico' : '');
        card.dataset.numero = reg.numero;
        card.dataset.id = reg.id;

        var estPago = estadoPago(reg);
        var avisoHTML = '';

        if (!esPublica) {
            if (estPago === 'vencido') {
                avisoHTML = '<div class="bc-aviso vencido"><span class="bc-aviso-icon">🚨</span><p class="bc-aviso-text">Esta reserva venció el ' + U.escapeHtml(U.fechaHumana(reg.fechaLimite)) + '. Contacta al organizador.</p></div>';
            } else if (estPago === 'proximo') {
                avisoHTML = '<div class="bc-aviso"><span class="bc-aviso-icon">⏳</span><p class="bc-aviso-text">Pago pendiente. Paga antes del ' + U.escapeHtml(U.fechaHumana(reg.fechaLimite)) + '.</p></div>';
            } else if (estPago === 'normal' && reg.fechaLimite && !esPagado) {
                avisoHTML = '<div class="bc-aviso"><span class="bc-aviso-icon">📅</span><p class="bc-aviso-text">Pagar antes del ' + U.escapeHtml(U.fechaHumana(reg.fechaLimite)) + '.</p></div>';
            }
        }

        var infoExtra = '';
        if (reg.totalBs) infoExtra += '<div class="bc-info-row"><span>Bs</span><span>' + U.escapeHtml(reg.totalBs) + ' Bs</span></div>';
        if (reg.totalCop) infoExtra += '<div class="bc-info-row"><span>COP</span><span>' + U.escapeHtml(reg.totalCop) + ' COP</span></div>';

        var cedulaRow = reg.cedula
            ? '<div class="bc-info-row"><span>Cédula</span><span>' + U.escapeHtml(reg.cedula) + '</span></div>'
            : '';

        var claveHTML = '';
        if (!esPublica && reg.clave) {
            claveHTML =
                '<div class="bc-clave-box">' +
                    '<div class="bc-clave-info">' +
                        '<span class="bc-clave-lbl">Tu clave</span>' +
                        '<span class="bc-clave-val">' + U.escapeHtml(reg.clave) + '</span>' +
                    '</div>' +
                    '<button type="button" class="bc-clave-copiar" data-clave="' + U.escapeHtml(reg.clave) + '">📋</button>' +
                '</div>';
        }

        var qrHTML = esPublica ? '' : generarQrHtml(urlVerificacion(reg));
        var motivo = obtenerMotivo();
        var motivoHTML = esPublica ? '' :
            '<div class="bc-motivo"><span class="bc-motivo-icon">💛</span><p class="bc-motivo-text">' + U.escapeHtml(motivo) + '</p></div>';
        var codigoRow = esPublica ? '' :
            '<div class="bc-info-row"><span>Código</span><span class="mono">' + U.escapeHtml(reg.boleto || '') + '</span></div>';
        var qrBlock = esPublica ? '' :
            '<div class="bc-qr">' + qrHTML + '<span class="bc-qr-lbl">Escanea para verificar</span></div>';
        var footBlock = esPublica ? '' :
            '<div class="bc-foot">AUTENTICACIÓN · ' + U.escapeHtml(reg.boleto || '') + '</div>';

        card.innerHTML =
            '<div class="bc-head">' +
                '<div class="bc-brand">🎟️ BOLETO DE LA SUERTE</div>' +
                '<div class="bc-sub">' + U.escapeHtml(nombre) + ' · ' + U.escapeHtml(loteria) + '</div>' +
            '</div>' +
            '<div class="bc-num-row">' +
                '<div class="bc-num-side">' +
                    '<span class="bc-num-lbl">Nº jugado</span>' +
                    '<span class="bc-num">' + U.escapeHtml(reg.numero) + '</span>' +
                '</div>' +
                '<span class="bc-estado ' + claseEstado + '">' + textoEstado + '</span>' +
            '</div>' +
            '<div class="bc-info">' +
                '<div class="bc-info-row"><span>Titular</span><span>' + U.escapeHtml(reg.nombre) + '</span></div>' +
                cedulaRow +
                '<div class="bc-info-row"><span>Monto</span><span>' + U.escapeHtml(monto) + '</span></div>' +
                infoExtra +
                '<div class="bc-info-row"><span>Fecha</span><span>' + U.escapeHtml(U.fechaHumana(reg.fecha)) + '</span></div>' +
                codigoRow +
            '</div>' +
            claveHTML + avisoHTML + qrBlock + motivoHTML + footBlock;

        return card;
    }

    /* ============================================================
       16. STICKY
       ============================================================ */
    function construirStickyDinamica(registros, opciones) {
        if (!el.boletoSticky || !el.boletoStickyIn) return;
        if (!registros || registros.length === 0) { ocultarSticky(); return; }

        var totalPagados = registros.filter(function (r) { return r.estado === 'pagado'; }).length;
        var totalApartados = registros.length - totalPagados;
        var totalVencidos = registros.filter(function (r) { return estadoPago(r) === 'vencido'; }).length;

        var html = [];

        if (totalApartados > 0) {
            var claseAviso = totalVencidos > 0 ? 'vencido' : '';
            var icono = totalVencidos > 0 ? '🚨' : '⏳';
            var texto;
            if (totalVencidos > 0) {
                texto = totalVencidos + ' boleto' + (totalVencidos === 1 ? '' : 's') + ' vencido' + (totalVencidos === 1 ? '' : 's') + '. ¡Paga cuanto antes!';
            } else {
                texto = totalApartados + ' boleto' + (totalApartados === 1 ? '' : 's') + ' por pagar.';
            }
            html.push('<div class="sticky-aviso ' + claseAviso + '"><span class="sticky-aviso-icon">' + icono + '</span><span>' + texto + '</span></div>');
        }

        if (totalApartados > 0) {
            html.push(
                '<div class="sticky-row">' +
                    '<button type="button" class="btn-accion btn-ok" id="btn-avisar">💬 Avisar</button>' +
                    '<button type="button" class="btn-accion btn-pagar" id="btn-metodos">💳 Métodos de pago</button>' +
                '</div>'
            );
        }

        html.push('<div class="sticky-row full"><button type="button" class="btn-accion btn-blue" id="btn-descargar-todos">📥 Descargar boleto</button></div>');

        if (totalApartados === 0) {
            html.push('<div class="sticky-row full"><button type="button" class="btn-accion btn-ghost" id="btn-consultar-otra">🔎 Consultar otra</button></div>');
        }

        el.boletoStickyIn.innerHTML = html.join('');
        el.boletoSticky.hidden = false;

        var btnAvisar = U.$('#btn-avisar');
        if (btnAvisar) btnAvisar.addEventListener('click', function () {
            var ctx = getContextoPago();
            if (ctx) enviarWhatsAppAvisar(ctx);
        });

        var btnMetodos = U.$('#btn-metodos');
        if (btnMetodos) btnMetodos.addEventListener('click', function () {
            var ctx = getContextoPago();
            if (ctx) abrirModalMetodos(ctx);
        });

        var btnDescargar = U.$('#btn-descargar-todos');
        if (btnDescargar) btnDescargar.addEventListener('click', function () { descargarTodos(registros); });

        var btnConsultar = U.$('#btn-consultar-otra');
        if (btnConsultar) btnConsultar.addEventListener('click', function () {
            state.registros = [];
            state.modo = 'consulta';
            renderizarPanelAuth();
            mostrarPanel('panel-auth');
            var input = U.$('#acceso-input');
            if (input) { input.value = ''; input.focus(); }
        });
    }

    /* ============================================================
       17. MODAL MÉTODOS DE PAGO
       ============================================================ */
    function abrirModalMetodos(contexto) {
        if (!contexto || !contexto.numeros || contexto.numeros.length === 0) {
            U.toast('No hay números pendientes.', 'warn');
            return;
        }

        var cfg = safeCall(function () { return Store.leerConfig(); }, {});
        var ident = cfg.identidad || {};
        var pm    = ident.pagoMovil || {};
        var nequi = ident.nequi     || {};
        var otro  = ident.otroPago  || {};

        var tienePM    = !!(pm.banco || pm.telefono || pm.cedula);
        var tieneNequi = !!(nequi.telefono);
        var tieneOtro  = !!(otro.titulo && otro.contenido);

        var total = contexto.total;
        var totalBs = contexto.totalBs || '';
        var totalCop = contexto.totalCop || '';

        var contextoLabel = contexto.tipo === 'pre' ? 'Antes de confirmar' : 'Boletos pendientes';

        var html = [
            '<div class="modal-grabber"></div>',
            '<div class="modal-title">💳 Métodos de pago</div>',
            '<div class="modal-subtitle">' + U.escapeHtml(contextoLabel) + '</div>',
            '<div class="pago-total-box">',
                '<span class="pago-total-label">' + contexto.numeros.length + ' número' + (contexto.numeros.length === 1 ? '' : 's') + ' · Total</span>',
                '<span class="pago-total-valor">' + formatearUSD(total) + '</span>',
                (totalBs ? '<span class="pago-total-secundario">' + U.escapeHtml(totalBs) + ' Bs</span>' : ''),
                (totalCop ? '<span class="pago-total-secundario">' + U.escapeHtml(totalCop) + ' COP</span>' : ''),
            '</div>'
        ];

        if (tienePM) {
            var descPm = [];
            if (pm.banco) descPm.push(pm.banco);
            if (pm.telefono) descPm.push(pm.telefono);
            html.push(
                '<button type="button" class="pago-metodo" id="metodo-pm">' +
                    '<span class="pago-metodo-icon">🏦</span>' +
                    '<div class="pago-metodo-info"><div class="pago-metodo-title">Pago Móvil</div><div class="pago-metodo-desc">' + U.escapeHtml(descPm.join(' · ') || 'Datos bancarios') + '</div></div>' +
                    '<span class="pago-metodo-arrow">›</span>' +
                '</button>'
            );
        }
        if (tieneNequi) {
            html.push(
                '<button type="button" class="pago-metodo" id="metodo-nequi">' +
                    '<span class="pago-metodo-icon">🇨🇴</span>' +
                    '<div class="pago-metodo-info"><div class="pago-metodo-title">Nequi (Colombia)</div><div class="pago-metodo-desc">' + U.escapeHtml(nequi.telefono || 'Datos Nequi') + '</div></div>' +
                    '<span class="pago-metodo-arrow">›</span>' +
                '</button>'
            );
        }
        if (tieneOtro) {
            html.push(
                '<button type="button" class="pago-metodo" id="metodo-otro">' +
                    '<span class="pago-metodo-icon">💠</span>' +
                    '<div class="pago-metodo-info"><div class="pago-metodo-title">' + U.escapeHtml(otro.titulo) + '</div><div class="pago-metodo-desc">Otro método de pago</div></div>' +
                    '<span class="pago-metodo-arrow">›</span>' +
                '</button>'
            );
        }
        if (!tienePM && !tieneNequi && !tieneOtro) {
            html.push('<p class="empty-msg" style="padding: 12px; text-align: center;">El organizador aún no ha configurado métodos de pago.</p>');
        }

        U.abrirModal(html.join(''));

        var btnPM = U.$('#metodo-pm');
        if (btnPM) btnPM.addEventListener('click', function () { abrirSubModalPagoMovil(contexto, pm); });
        var btnNequi = U.$('#metodo-nequi');
        if (btnNequi) btnNequi.addEventListener('click', function () { abrirSubModalNequi(contexto, nequi); });
        var btnOtro = U.$('#metodo-otro');
        if (btnOtro) btnOtro.addEventListener('click', function () { abrirSubModalOtro(contexto, otro); });
    }

    function abrirSubModalPagoMovil(contexto, pm) {
        var total = contexto.total, totalBs = contexto.totalBs || '', totalCop = contexto.totalCop || '';
        var filas = [];
        if (pm.banco)    filas.push({ label: 'Banco',        valor: pm.banco });
        if (pm.telefono) filas.push({ label: 'Teléfono',     valor: pm.telefono });
        if (pm.cedula)   filas.push({ label: 'Cédula / RIF', valor: pm.cedula });
        if (pm.titular)  filas.push({ label: 'Titular',      valor: pm.titular });
        filas.push({ label: 'Monto USD', valor: formatearUSD(total) });
        if (totalBs)  filas.push({ label: 'Monto Bs',  valor: totalBs + ' Bs' });
        if (totalCop) filas.push({ label: 'Monto COP', valor: totalCop + ' COP' });

        var html = ['<div class="modal-grabber"></div>', '<div class="modal-title">🏦 Pago Móvil</div>',
            '<div class="modal-subtitle">Copia los datos y envía el comprobante.</div>', '<div class="pago-detalle-lista">'];

        filas.forEach(function (f) {
            html.push(
                '<div class="pago-detalle-fila">' +
                    '<div class="pago-detalle-info"><span class="pago-detalle-label">' + U.escapeHtml(f.label) + '</span><span class="pago-detalle-valor">' + U.escapeHtml(f.valor) + '</span></div>' +
                    '<button type="button" class="pago-detalle-copiar" data-copiar="' + U.escapeHtml(f.valor) + '">📋</button>' +
                '</div>'
            );
        });
        html.push('</div>');
        html.push('<p class="pago-detalle-nota">Realiza el pago por el monto exacto y luego avísale al organizador.</p>');
        html.push('<button type="button" class="btn-accion" id="pm-avisar">💬 Avisar por WhatsApp</button>');

        U.abrirModal(html.join(''));
        bindCopiarModal();
        var btn = U.$('#pm-avisar');
        if (btn) btn.addEventListener('click', function () { enviarWhatsAppAvisar(contexto); });
    }

    function abrirSubModalNequi(contexto, nequi) {
        var total = contexto.total, totalCop = contexto.totalCop || '', totalBs = contexto.totalBs || '';
        var filas = [];
        if (nequi.telefono) filas.push({ label: 'Teléfono Nequi', valor: nequi.telefono });
        if (nequi.titular)  filas.push({ label: 'Titular',        valor: nequi.titular });
        filas.push({ label: 'Monto USD', valor: formatearUSD(total) });
        if (totalCop) filas.push({ label: 'Monto COP', valor: totalCop + ' COP' });
        if (totalBs)  filas.push({ label: 'Monto Bs',  valor: totalBs + ' Bs' });

        var html = ['<div class="modal-grabber"></div>', '<div class="modal-title">🇨🇴 Nequi</div>',
            '<div class="modal-subtitle">Envía el pago y avísale al organizador.</div>', '<div class="pago-detalle-lista">'];

        filas.forEach(function (f) {
            html.push(
                '<div class="pago-detalle-fila">' +
                    '<div class="pago-detalle-info"><span class="pago-detalle-label">' + U.escapeHtml(f.label) + '</span><span class="pago-detalle-valor">' + U.escapeHtml(f.valor) + '</span></div>' +
                    '<button type="button" class="pago-detalle-copiar" data-copiar="' + U.escapeHtml(f.valor) + '">📋</button>' +
                '</div>'
            );
        });
        html.push('</div>');
        html.push('<p class="pago-detalle-nota">Pago por Nequi a nombre del titular indicado.</p>');
        html.push('<button type="button" class="btn-accion" id="nequi-avisar">💬 Avisar por WhatsApp</button>');

        U.abrirModal(html.join(''));
        bindCopiarModal();
        var btn = U.$('#nequi-avisar');
        if (btn) btn.addEventListener('click', function () { enviarWhatsAppAvisar(contexto); });
    }

    function abrirSubModalOtro(contexto, otro) {
        var html = [
            '<div class="modal-grabber"></div>',
            '<div class="modal-title">' + U.escapeHtml(otro.titulo || 'Otro método') + '</div>',
            '<div class="modal-subtitle">Sigue las instrucciones del organizador.</div>',
            '<div class="pago-detalle-texto">' + U.escapeHtml(otro.contenido || '') + '</div>',
            '<button type="button" class="btn-accion" id="otro-avisar" style="margin-top: 8px;">💬 Avisar por WhatsApp</button>'
        ];

        U.abrirModal(html.join(''));
        var btn = U.$('#otro-avisar');
        if (btn) btn.addEventListener('click', function () { enviarWhatsAppAvisar(contexto); });
    }

    function bindCopiarModal() {
        U.$$('.pago-detalle-copiar').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var txt = btn.dataset.copiar || '';
                if (!txt) return;
                U.copiar(txt).then(function (ok) {
                    if (ok) U.toast('✅ Copiado', 'ok', 1200);
                    else    U.toast('No se pudo copiar', 'warn');
                });
            });
        });
    }

    /* ============================================================
       18. AVISAR WHATSAPP
       ============================================================ */
    function enviarWhatsAppAvisar(contexto) {
        var cfg = safeCall(function () { return Store.leerConfig(); }, {});
        var ident = cfg.identidad || {};
        var numOrg = U.soloDigitos(ident.whatsappOrg || '');

        if (!numOrg) { U.toast('El organizador no tiene WhatsApp configurado.', 'warn'); return; }

        if (numOrg.length === 10) numOrg = '58' + numOrg;
        else if (numOrg.length === 11 && numOrg.charAt(0) === '0') numOrg = '58' + numOrg.slice(1);

        var nombre = contexto.nombre || '—';
        var cedula = contexto.cedula || '';
        var numeros = (contexto.numeros || []).join(', ');
        var total = formatearUSD(contexto.total);

        var lineas = ['¡Hola! Quiero avisar mi pago 🎟️', '', '👤 ' + nombre];
        if (cedula) lineas.push('🪪 ' + cedula);
        if (numeros) lineas.push('🎯 Números: ' + numeros);
        lineas.push('💵 Total: ' + total);
        if (contexto.totalBs) lineas.push('💴 ' + contexto.totalBs + ' Bs');
        if (contexto.totalCop) lineas.push('💶 ' + contexto.totalCop + ' COP');
        if (contexto.clave) lineas.push('🔑 Clave: ' + contexto.clave);

        var texto = encodeURIComponent(lineas.join('\n'));
        var url = 'https://wa.me/' + numOrg + '?text=' + texto;

        var html = [
            '<div class="modal-grabber"></div>',
            '<div class="modal-title">💬 Avisar por WhatsApp</div>',
            '<div class="modal-subtitle">Se abrirá tu app con el mensaje listo.</div>',
            '<button type="button" class="avisar-opcion" id="avisar-wa">' +
                '<span class="avisar-opcion-icon">📱</span>' +
                '<div class="avisar-opcion-info"><div class="avisar-opcion-title">Abrir WhatsApp</div><div class="avisar-opcion-desc">Enviar mis ' + (contexto.numeros ? contexto.numeros.length : 0) + ' número' + ((contexto.numeros && contexto.numeros.length === 1) ? '' : 's') + ' al organizador.</div></div>' +
            '</button>',
            '<div class="avisar-opcion" id="avisar-copiar">' +
                '<span class="avisar-opcion-icon">📋</span>' +
                '<div class="avisar-opcion-info"><div class="avisar-opcion-title">Copiar mensaje</div><div class="avisar-opcion-desc">Pégalo manualmente en WhatsApp.</div></div>' +
            '</div>'
        ];

        U.abrirModal(html.join(''));

        var opWA = U.$('#avisar-wa');
        if (opWA) opWA.addEventListener('click', function () {
            try {
                global.open(url, '_blank', 'noopener,noreferrer');
                if (U.cerrarModal) U.cerrarModal();
            } catch (e) { U.warn('Error abriendo WhatsApp:', e); }
        });

        var opCopiar = U.$('#avisar-copiar');
        if (opCopiar) opCopiar.addEventListener('click', function () {
            U.copiar(decodeURIComponent(texto)).then(function (ok) {
                if (ok) { U.toast('✅ Mensaje copiado', 'ok', 1800); if (U.cerrarModal) U.cerrarModal(); }
                else { U.toast('No se pudo copiar', 'warn'); }
            });
        });
    }

    /* ============================================================
       19. DESCARGA
       ============================================================ */
    function descargarTodos(registros) {
        if (!global.html2canvas) { U.toast('El generador de imágenes no está disponible.', 'warn'); return; }

        var cards = U.$$('.boleto-card', el.boletoCardContent);
        if (!cards || cards.length === 0) { U.toast('No hay boletos para descargar.', 'warn'); return; }

        U.toast('📸 Generando ' + cards.length + ' imagen' + (cards.length === 1 ? '' : 'es') + '…', 'info', 2000);

        var promesas = [];
        cards.forEach(function (card, i) {
            promesas.push(
                global.html2canvas(card, { backgroundColor: null, scale: 2, useCORS: true, logging: false })
                    .then(function (canvas) {
                        return { canvas: canvas, numero: card.dataset.numero || String(i + 1) };
                    })
                    .catch(function (e) { U.warn('Error capturando:', e); return null; })
            );
        });

        Promise.all(promesas).then(function (resultados) {
            var ok = resultados.filter(function (r) { return r && r.canvas; });
            if (ok.length === 0) { U.toast('No se pudo generar ninguna imagen.', 'danger'); return; }
            ok.forEach(function (r, i) {
                setTimeout(function () { descargarCanvas(r.canvas, 'boleto-' + r.numero + '.png'); }, i * 350);
            });
            U.toast('✅ ' + ok.length + ' boleto' + (ok.length === 1 ? '' : 's') + ' descargado' + (ok.length === 1 ? '' : 's'), 'ok', 2400);
        });
    }

    function descargarCanvas(canvas, nombre) {
        try {
            var link = document.createElement('a');
            link.download = nombre;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) { U.warn('Error descargando:', e); }
    }

    /* ============================================================
       20. URL PARAMS
       ============================================================ */
    function leerParametrosURL() {
        var params = {};
        try {
            var search = String(global.location.search || '').replace(/^\?/, '');
            if (!search) return params;
            search.split('&').forEach(function (par) {
                if (!par) return;
                var idx = par.indexOf('=');
                var k = idx >= 0 ? par.slice(0, idx) : par;
                var v = idx >= 0 ? par.slice(idx + 1) : '';
                k = decodeURIComponent(k || '');
                v = decodeURIComponent(v || '');
                if (k) params[k] = v;
            });
        } catch (e) { /* silent */ }
        return params;
    }

    /* ============================================================
       21. INIT (robusto)
       ============================================================ */
    function init() {
        if (state.inicializado) return;
        state.inicializado = true;

        try {
            cachearElementos();

            if (Theme && typeof Theme.aplicar === 'function') {
                try { Theme.aplicar(); } catch (e) { /* silent */ }
            }

            state.modoAcceso = leerModoAcceso();

            var params = leerParametrosURL();
            var verif  = params.verif;
            var cedula = params.cedula;

            var seleccion = leerSeleccionGuardada();
            if (seleccion.length > 0) {
                iniciarModoRegistro();
            } else if (cedula) {
                iniciarModoConsulta(cedula);
            } else if (verif) {
                iniciarModoConsulta(null);
                var input = U.$('#acceso-input');
                if (input) {
                    if (state.modoAcceso === 'cedula') input.value = '';
                    else input.value = verif;
                    input.focus();
                }
            } else {
                iniciarModoConsulta(null);
            }
        } catch (e) {
            if (U && U.warn) U.warn('Error en init:', e);
            // Fallback de seguridad: mostrar panel de consulta
            try {
                ocultarLoader();
                iniciarModoConsulta(null);
            } catch (e2) {
                ocultarLoader();
            }
        }

        // Guardia final: si tras 1.2s no hay ningún panel visible, forzar panel-auth
        setTimeout(function () {
            if (!algunPanelVisible()) {
                try {
                    ocultarLoader();
                    iniciarModoConsulta(null);
                } catch (e) {
                    ocultarLoader();
                }
            }
        }, 1200);
    }

    /* ============================================================
       22. API PÚBLICA
       ============================================================ */
    global.Boleto = {
        init:                 init,
        iniciarModoRegistro:  iniciarModoRegistro,
        iniciarModoConsulta:  iniciarModoConsulta,
        buscarBoletos:        buscarBoletos,
        mostrarBoletos:       mostrarBoletos,
        abrirModalMetodos:    abrirModalMetodos,
        descargarTodos:       descargarTodos,
        _state: function () { return state; }
    };

    /* ============================================================
       23. AUTO-INIT
       ============================================================ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);