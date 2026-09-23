/* ============================================================
   MOTOR DE RIFAS · assets/js/admin.js
   Panel admin · Dashboard + Registros + Recordatorios + Landing
   + Apariencia + Plantillas + Premios + Identidad + Contenido
   + Respaldos + Enlaces + PIN
   Expone window.Admin
   Marco: CCG-IA v1.0.0 · Autor: Felix
   ============================================================ */

(function (global) {
    'use strict';

    var U     = global.UI;
    var Store = global.Store;
    var MD    = global.MD;
    var Theme = global.Theme;
    var BCV   = global.BCV;

    /* ============================================================
       1. CONSTANTES
       ============================================================ */
    var KEY_TAB = 'rifa_admin_ultima_pestana';

    var PIN_LS_KEY       = 'rifa_pin_intentos_v1';
    var PIN_MAX_INTENTOS = 5;
    var PIN_BLOQUEO_MS   = 60 * 1000;

    var COLORES_PRESET = [
        '#fbbf24', '#f59e0b', '#10b981', '#34d399',
        '#3b82f6', '#38bdf8', '#8b5cf6', '#ec4899',
        '#ef4444', '#f87171', '#94a3b8', '#111827'
    ];

    var MEDALLAS = { 1: '🥇', 2: '🥈', 3: '🥉' };

    var LANDING_DEFAULT = {
        imagen: null,
        emoji: '🎟️',
        titulo: 'Una Bendición que Merece lo Mejor',
        subtitulo: 'Tener a nuestra abuela con nosotros es un regalo incalculable. Hoy nos unimos para regalarle un motivo gigante de alegría.',
        ctaPrincipal: '🎟️ Quiero jugar un número',
        ctaSecundario: '📖 Leer el motivo',
        ctaSecundarioUrl: 'motivo.html'
    };

    /* ============================================================
       2. ESTADO
       ============================================================ */
    var state = {
        registros:      [],
        filtro:         'todos',
        busqueda:       '',
        plantillaTemp:  null,
        pinBuffer:      '',
        pinValorConfig: '',
        pinBloqueadoTiempo: 0,
        pinTimer:       null,
        premioImagenTemp: null,
        landingImagenTemp: null,
        mdActual:       'terminos',
        bcvModo:        'auto',
        bcvInfo:        null,
        copModo:        'auto',
        copInfo:        null,
        bcvUnsub:       null,
        recFiltro:      'autorizados',
        recBusqueda:    '',
        inicializado:   false,
        tabActual:      'dashboard'
    };

    /* ============================================================
       3. CACHE DE ELEMENTOS
       ============================================================ */
    var el = {};

    function cachearElementos() {
        // PIN
        el.pinOverlay   = U.$('#pin-overlay');
        el.pinDots      = U.$('#pin-dots');
        el.pinError     = U.$('#pin-error');
        el.pinBorrar    = U.$('#pin-borrar');
        el.pinKeypad    = U.$('#pin-keypad');

        // Tabs
        el.tabs         = U.$$('.admin-tab');
        el.paneles      = U.$$('.admin-panel');

        // Dashboard
        el.statLibres   = U.$('#stat-libres');
        el.statApartados= U.$('#stat-apartados');
        el.statPagados  = U.$('#stat-pagados');
        el.statClientes = U.$('#stat-clientes');
        el.progressTxt  = U.$('#progress-txt');
        el.progressFill = U.$('#progress-dash-fill');
        el.movimientos  = U.$('#movimientos-list');
        el.dashBcvTasa  = U.$('#dash-bcv-tasa');
        el.dashBcvInfo  = U.$('#dash-bcv-info');
        el.dashCopTasa  = U.$('#dash-cop-tasa');
        el.dashCopInfo  = U.$('#dash-cop-info');

        // Registros
        el.buscar       = U.$('#admin-buscar');
        el.filterChips  = U.$('#filter-chips');
        el.listaReservas= U.$('#lista-reservas');
        el.contadorReg  = U.$('#contador-registros');

        // Recordatorios
        el.recStatAutorizaron = U.$('#rec-stat-autorizaron');
        el.recStatPendientes  = U.$('#rec-stat-pendientes');
        el.recStatVencidos    = U.$('#rec-stat-vencidos');
        el.recStatNoPagados   = U.$('#rec-stat-nopagados');
        el.recBtnTodos        = U.$('#rec-btn-recordar-todos');
        el.recBtnVencidos     = U.$('#rec-btn-recordar-vencidos');
        el.recBtnRefrescar    = U.$('#rec-btn-refrescar');
        el.recFilterChips     = U.$('#rec-filter-chips');
        el.recBuscar          = U.$('#rec-buscar');
        el.recContador        = U.$('#rec-contador');
        el.listaRecordatorios = U.$('#lista-recordatorios');

        // Landing
        el.landingImgInput    = U.$('#landing-imagen-input');
        el.landingImgBtn      = U.$('#landing-imagen-btn');
        el.landingImgVacia    = U.$('#landing-imagen-vacia');
        el.landingImgPreview  = U.$('#landing-imagen-preview');
        el.landingImgThumb    = U.$('#landing-imagen-thumb');
        el.landingImgThumb2   = U.$('#landing-imagen-thumb-2');
        el.landingImgName     = U.$('#landing-imagen-name');
        el.landingImgSize     = U.$('#landing-imagen-size');
        el.landingImgEliminar = U.$('#landing-imagen-eliminar');
        el.landingTitulo      = U.$('#landing-titulo');
        el.landingSubtitulo   = U.$('#landing-subtitulo');
        el.landingCtaPrincipal= U.$('#landing-cta-principal');
        el.landingCtaSecundario = U.$('#landing-cta-secundario');
        el.landingCtaSecundarioUrl = U.$('#landing-cta-secundario-url');
        el.landingPreviewFrame = U.$('#landing-preview-frame');
        el.btnRefrescarLanding = U.$('#btn-refrescar-landing');
        el.btnGuardarLanding   = U.$('#btn-guardar-landing');
        el.btnResetLanding     = U.$('#btn-reset-landing');

        // Apariencia
        el.colorAcento  = U.$('#color-acento');
        el.colorAcentoHex = U.$('#color-acento-hex');
        el.colorSecun   = U.$('#color-secundario');
        el.colorSecunHex= U.$('#color-secundario-hex');
        el.colorPresets = U.$('#color-presets');
        el.tipoSelect   = U.$('#tipografia-select');
        el.logoTipo     = U.$('#logo-tipo');
        el.logoEmoji    = U.$('#logo-emoji');
        el.logoTexto    = U.$('#logo-texto');
        el.logoArchivo  = U.$('#logo-archivo');
        el.logoUploadBtn= U.$('#logo-upload-btn');
        el.logoPreview  = U.$('#logo-preview');
        el.grupoLogoEmoji = U.$('#grupo-logo-emoji');
        el.grupoLogoTexto = U.$('#grupo-logo-texto');
        el.grupoLogoImagen= U.$('#grupo-logo-imagen');
        el.btnGuardarApariencia = U.$('#btn-guardar-apariencia');
        el.btnPreviewApariencia = U.$('#btn-preview-apariencia');

        // Plantillas
        el.plantillasGrid = U.$('#plantillas-grid');
        el.previewFrame   = U.$('#preview-frame');
        el.btnGuardarPlantilla = U.$('#btn-guardar-plantilla');

        // Premios
        el.premiosList    = U.$('#premios-admin-list');
        el.premioPuesto   = U.$('#premio-puesto');
        el.premioTitulo   = U.$('#premio-titulo');
        el.premioDesc     = U.$('#premio-descripcion');
        el.premioImgInput = U.$('#premio-imagen-input');
        el.premioImgBtn   = U.$('#premio-imagen-btn');
        el.premioImgPrev  = U.$('#premio-imagen-preview');
        el.premioImgThumb = U.$('#premio-imagen-thumb');
        el.premioImgName  = U.$('#premio-imagen-name');
        el.premioImgSize  = U.$('#premio-imagen-size');
        el.premioImgElim  = U.$('#premio-imagen-eliminar');
        el.btnAgregarPremio = U.$('#btn-agregar-premio');

        // Identidad
        el.identNombre   = U.$('#ident-nombre');
        el.identLoteria  = U.$('#ident-loteria');
        el.identMonto    = U.$('#ident-monto');
        el.identWhatsApp = U.$('#ident-whatsapp');
        el.identNombreOrg= U.$('#ident-nombre-org');
        el.identHorario  = U.$('#ident-horario');
        el.identFecha    = U.$('#ident-fecha');
        el.identHora     = U.$('#ident-hora');
        el.identMensaje  = U.$('#ident-mensaje');
        el.btnGuardarIdentidad = U.$('#btn-guardar-identidad');
        el.switchPin     = U.$('#switch-pin');
        el.grupoPin      = U.$('#grupo-pin');
        el.pinValor      = U.$('#pin-valor');
        el.switchSorteo  = U.$('#switch-sorteo');
        el.switchInstruc = U.$('#switch-instrucciones');

        el.grillaColumnas     = U.$('#grilla-columnas');
        el.identMensajeBoleto = U.$('#ident-mensaje-boleto');
        el.identHorasReserva  = U.$('#ident-horas-reserva');

        // Modo de términos
        el.modoTermRadios = U.$$('input[name="modo-terminos"]');
        el.modoTermCards  = U.$$('.modo-term-card[data-modo]');

        // Modo de acceso + grilla dinámica + aleatorio + mezclada
        el.modoAccesoRadios  = U.$$('input[name="modo-acceso"]');
        el.modoAccesoCards   = U.$$('.modo-term-card[data-modo-acceso]');
        el.opcionesTotalNumeros = U.$('#opciones-total-numeros');
        el.switchAleatorio   = U.$('#switch-aleatorio');
        el.switchGrillaMezclada = U.$('#switch-grilla-mezclada');
        el.btnRebarajarMuestra  = U.$('#btn-rebarajar-muestra');
        el.grillaPreviewFrame   = U.$('#grilla-preview-frame');
        el.btnRefrescarGrillaPreview = U.$('#btn-refrescar-grilla-preview');

        // Pago Móvil
        el.identBanco        = U.$('#ident-banco');
        el.identPagoTelefono = U.$('#ident-pago-telefono');
        el.identPagoCedula   = U.$('#ident-pago-cedula');
        el.identPagoTitular  = U.$('#ident-pago-titular');

        // Nequi
        el.identNequiTelefono = U.$('#ident-nequi-telefono');

        // Otro método
        el.identOtroTitulo    = U.$('#ident-otro-titulo');
        el.identOtroContenido = U.$('#ident-otro-contenido');

        // BCV
        el.bcvModoChips     = U.$('#bcv-modo-chips');
        el.bcvGrupoAuto     = U.$('#bcv-grupo-auto');
        el.bcvGrupoManual   = U.$('#bcv-grupo-manual');
        el.bcvTasaTxt       = U.$('#bcv-tasa-txt');
        el.bcvTasaInfo      = U.$('#bcv-tasa-info');
        el.bcvRefreshBtn    = U.$('#bcv-refresh-btn');
        el.bcvTasaInput     = U.$('#bcv-tasa-input');
        el.bcvGuardarManual = U.$('#bcv-guardar-manual-btn');

        // COP
        el.copModoChips     = U.$('#cop-modo-chips');
        el.copGrupoAuto     = U.$('#cop-grupo-auto');
        el.copGrupoManual   = U.$('#cop-grupo-manual');
        el.copTasaTxt       = U.$('#cop-tasa-txt');
        el.copTasaInfo      = U.$('#cop-tasa-info');
        el.copRefreshBtn    = U.$('#cop-refresh-btn');
        el.copTasaInput     = U.$('#cop-tasa-input');
        el.copGuardarManual = U.$('#cop-guardar-manual-btn');

        // Contenido MD
        el.mdSelector    = U.$('#md-selector');
        el.mdTextarea    = U.$('#md-textarea');
        el.mdPreview     = U.$('#md-preview');
        el.btnMdDescargar= U.$('#btn-md-descargar');
        el.btnMdRecargar = U.$('#btn-md-recargar');
        el.mdTools       = U.$$('.md-tool');

        // Respaldos
        el.restoreFile   = U.$('#restore-file');
        el.btnRestoreUp  = U.$('#btn-restore-upload');
        el.restoreModo   = U.$('#restore-modo');
        el.btnResetReg   = U.$('#btn-reset-registros');
        el.btnResetConf  = U.$('#btn-reset-config');

        // Enlaces
        el.urlIndex      = U.$('#url-index');
        el.urlRifa       = U.$('#url-rifa');
        el.urlPremios    = U.$('#url-premios');
        el.urlBoleto     = U.$('#url-boleto');
        el.urlTerminos   = U.$('#url-terminos');
        el.urlMotivo     = U.$('#url-motivo');
        el.urlCartel     = U.$('#url-cartel');
        el.btnCompartirWa= U.$('#btn-compartir-wa');
        el.btnVerLanding = U.$('#btn-ver-landing');
        el.btnVerRifa    = U.$('#btn-ver-rifa');
        el.btnVerPremios = U.$('#btn-ver-premios');
        el.btnVerBoleto  = U.$('#btn-ver-boleto');
        el.btnVerTerminos= U.$('#btn-ver-terminos');
        el.btnVerCartel  = U.$('#btn-ver-cartel');
        el.btnAbrirCartel= U.$('#btn-abrir-cartel');

        // FAB
        el.fabVenta      = U.$('#fab-venta');

        // Overlay iframe
        el.iframeOverlay = U.$('#iframe-overlay');
        el.iframeTitulo  = U.$('#iframe-titulo');
        el.iframeView    = U.$('#iframe-view');
        el.btnCerrarIframe = U.$('#btn-cerrar-iframe');
    }

    /* ============================================================
       4. PIN
       ============================================================ */
    function leerEstadoIntentos() {
        try {
            var raw = localStorage.getItem(PIN_LS_KEY);
            if (!raw) return { intentos: 0, bloqueadoHasta: 0 };
            var d = JSON.parse(raw);
            if (!d || typeof d !== 'object') return { intentos: 0, bloqueadoHasta: 0 };
            return {
                intentos: Math.max(0, parseInt(d.intentos, 10) || 0),
                bloqueadoHasta: Math.max(0, parseInt(d.bloqueadoHasta, 10) || 0)
            };
        } catch (e) {
            return { intentos: 0, bloqueadoHasta: 0 };
        }
    }

    function guardarEstadoIntentos(data) {
        try {
            localStorage.setItem(PIN_LS_KEY, JSON.stringify({
                intentos: data.intentos || 0,
                bloqueadoHasta: data.bloqueadoHasta || 0
            }));
        } catch (e) { /* silent */ }
    }

    function resetearIntentos() {
        guardarEstadoIntentos({ intentos: 0, bloqueadoHasta: 0 });
        state.pinBloqueadoTiempo = 0;
        if (state.pinTimer) {
            clearInterval(state.pinTimer);
            state.pinTimer = null;
        }
    }

    function estaBloqueado() {
        var d = leerEstadoIntentos();
        return d.bloqueadoHasta > Date.now();
    }

    function formatearCountdown(ms) {
        var total = Math.max(0, Math.ceil(ms / 1000));
        var m = Math.floor(total / 60);
        var s = total % 60;
        return m + ':' + String(s).padStart(2, '0');
    }

    function asegurarElementoIntentos() {
        var existing = document.getElementById('pin-intentos');
        if (existing) return existing;

        var padre = document.getElementById('pin-dots');
        if (!padre || !padre.parentNode) return null;

        var p = document.createElement('p');
        p.id = 'pin-intentos';
        p.style.cssText =
            'font-size:0.72rem;color:var(--muted);text-align:center;font-weight:600;' +
            'letter-spacing:0.2px;min-height:16px;margin-top:-4px;line-height:1.4;';
        padre.parentNode.insertBefore(p, padre.nextSibling);
        return p;
    }

    function actualizarEstadoPIN() {
        var intentosEl = asegurarElementoIntentos();
        var d = leerEstadoIntentos();

        if (d.bloqueadoHasta > Date.now()) {
            var restante = d.bloqueadoHasta - Date.now();
            if (intentosEl) {
                intentosEl.style.color = 'var(--danger)';
                intentosEl.innerHTML =
                    '🔒 <strong>Bloqueado</strong> · Reintenta en ' +
                    formatearCountdown(restante);
            }
            deshabilitarKeypad(true);
            return;
        }

        if (d.bloqueadoHasta > 0 && d.bloqueadoHasta <= Date.now()) {
            resetearIntentos();
            d = { intentos: 0, bloqueadoHasta: 0 };
        }

        var restantes = PIN_MAX_INTENTOS - d.intentos;

        if (intentosEl) {
            if (d.intentos === 0) {
                intentosEl.innerHTML = '';
                intentosEl.style.color = 'var(--muted)';
            } else if (restantes <= 2) {
                intentosEl.style.color = 'var(--warn)';
                intentosEl.innerHTML =
                    '⚠️ Te quedan <strong>' + restantes + '</strong> intento' +
                    (restantes === 1 ? '' : 's') + '.';
            } else {
                intentosEl.style.color = 'var(--muted)';
                intentosEl.innerHTML =
                    'Intentos restantes: <strong>' + restantes + '</strong>';
            }
        }
        deshabilitarKeypad(false);
    }

    function deshabilitarKeypad(bloqueado) {
        if (!el.pinKeypad) return;
        var keys = U.$$('.pin-key', el.pinKeypad);
        keys.forEach(function (k) {
            if (bloqueado) {
                k.setAttribute('disabled', 'disabled');
                k.style.opacity = '0.35';
                k.style.pointerEvents = 'none';
            } else {
                k.removeAttribute('disabled');
                k.style.opacity = '';
                k.style.pointerEvents = '';
            }
        });
        if (el.pinBorrar) {
            if (bloqueado) {
                el.pinBorrar.setAttribute('disabled', 'disabled');
                el.pinBorrar.style.opacity = '0.35';
                el.pinBorrar.style.pointerEvents = 'none';
            } else {
                el.pinBorrar.removeAttribute('disabled');
                el.pinBorrar.style.opacity = '';
                el.pinBorrar.style.pointerEvents = '';
            }
        }
    }

    function iniciarCountdown() {
        if (state.pinTimer) clearInterval(state.pinTimer);

        state.pinTimer = setInterval(function () {
            var intentosEl = document.getElementById('pin-intentos');
            var d = leerEstadoIntentos();
            var restante = d.bloqueadoHasta - Date.now();

            if (restante <= 0) {
                clearInterval(state.pinTimer);
                state.pinTimer = null;
                resetearIntentos();
                actualizarEstadoPIN();
                if (el.pinError) el.pinError.textContent = '';
                U.toast('🔓 Puedes intentarlo de nuevo', 'info', 1800);
                return;
            }

            if (intentosEl) {
                intentosEl.innerHTML =
                    '🔒 <strong>Bloqueado</strong> · Reintenta en ' +
                    formatearCountdown(restante);
            }
        }, 1000);
    }

    function inicializarPIN() {
        var cfg = Store.leerConfig();
        var opciones = cfg.opciones || {};

        if (!opciones.pinActivo || !opciones.pinValor) {
            if (el.pinOverlay) el.pinOverlay.hidden = true;
            return;
        }

        if (Store.pinDesbloqueadoEnEstaSesion()) {
            if (el.pinOverlay) el.pinOverlay.hidden = true;
            return;
        }

        state.pinValorConfig = String(opciones.pinValor);
        state.pinBuffer = '';
        if (el.pinOverlay) el.pinOverlay.hidden = false;
        if (el.pinError) el.pinError.textContent = '';

        asegurarElementoIntentos();
        actualizarDotsPin();

        if (el.pinKeypad) {
            U.$$('.pin-key[data-num]', el.pinKeypad).forEach(function (btn) {
                btn.addEventListener('click', function () {
                    if (estaBloqueado()) return;
                    var num = btn.dataset.num;
                    if (state.pinBuffer.length < 4) {
                        state.pinBuffer += num;
                        actualizarDotsPin();
                        if (state.pinBuffer.length === 4) {
                            setTimeout(verificarPin, 120);
                        }
                    }
                });
            });
        }

        if (el.pinBorrar) {
            el.pinBorrar.addEventListener('click', function () {
                if (estaBloqueado()) return;
                state.pinBuffer = state.pinBuffer.slice(0, -1);
                actualizarDotsPin();
                if (el.pinError) el.pinError.textContent = '';
            });
        }

        if (estaBloqueado()) iniciarCountdown();
        actualizarEstadoPIN();
    }

    function actualizarDotsPin() {
        if (!el.pinDots) return;
        var dots = U.$$('.pin-dot', el.pinDots);
        dots.forEach(function (dot, i) {
            if (i < state.pinBuffer.length) dot.classList.add('lleno');
            else dot.classList.remove('lleno');
        });
    }

    function verificarPin() {
        if (estaBloqueado()) {
            state.pinBuffer = '';
            actualizarDotsPin();
            actualizarEstadoPIN();
            return;
        }

        if (state.pinBuffer === state.pinValorConfig) {
            resetearIntentos();
            Store.marcarPinDesbloqueado();
            if (el.pinOverlay) el.pinOverlay.hidden = true;
            U.toast('🔓 Acceso concedido', 'ok', 1800);
            return;
        }

        var d = leerEstadoIntentos();
        d.intentos = (d.intentos || 0) + 1;

        var esUltimoIntentoFallido = d.intentos >= PIN_MAX_INTENTOS;

        if (esUltimoIntentoFallido) {
            d.bloqueadoHasta = Date.now() + PIN_BLOQUEO_MS;
        }

        guardarEstadoIntentos(d);
        state.pinBuffer = '';
        actualizarDotsPin();

        if (el.pinError) {
            if (esUltimoIntentoFallido) {
                el.pinError.textContent =
                    '🚫 Demasiados intentos. Bloqueado por 1 minuto.';
            } else {
                var restantes = PIN_MAX_INTENTOS - d.intentos;
                el.pinError.textContent =
                    'PIN incorrecto. ' + restantes + ' intento' +
                    (restantes === 1 ? '' : 's') + ' restante' + (restantes === 1 ? '' : 's') + '.';
            }
            el.pinError.style.animation = 'none';
            void el.pinError.offsetWidth;
            el.pinError.style.animation = '';
        }

        if (navigator.vibrate) {
            navigator.vibrate(esUltimoIntentoFallido ? [50, 30, 50] : 40);
        }

        actualizarEstadoPIN();
        if (esUltimoIntentoFallido) iniciarCountdown();
    }

    /* ============================================================
       5. TABS
       ============================================================ */
    function inicializarTabs() {
        var ultima = 'dashboard';
        try {
            ultima = sessionStorage.getItem(KEY_TAB) || 'dashboard';
        } catch (e) { /* silent */ }

        activarTab(ultima);

        el.tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                activarTab(tab.dataset.tab);
            });
        });
    }

    function activarTab(nombre) {
        state.tabActual = nombre;

        el.tabs.forEach(function (t) {
            t.classList.toggle('active', t.dataset.tab === nombre);
        });

        el.paneles.forEach(function (p) {
            p.classList.toggle('active', p.dataset.panel === nombre);
        });

        try { sessionStorage.setItem(KEY_TAB, nombre); } catch (e) { /* silent */ }
        global.scrollTo({ top: 0, behavior: 'smooth' });

        if (nombre === 'dashboard') refrescarDashboard();
        if (nombre === 'registros') renderizarRegistros();
        if (nombre === 'recordatorios') renderizarRecordatorios();
        if (nombre === 'plantillas') recargarPreviewPlantilla();
        if (nombre === 'landing') refrescarPreviewLanding();
    }

    /* ============================================================
       6. DASHBOARD
       ============================================================ */
    function refrescarDashboard() {
        Store.cargarRegistros(true).then(function (registros) {
            state.registros = registros;
            var st = Store.stats(registros);

            if (el.statLibres)    el.statLibres.textContent    = st.libres;
            if (el.statApartados) el.statApartados.textContent = st.apartados;
            if (el.statPagados)   el.statPagados.textContent   = st.pagados;
            if (el.statClientes)  el.statClientes.textContent  = st.clientes;
            if (el.progressTxt)   el.progressTxt.textContent   = st.porcentaje + '%';
            if (el.progressFill)  el.progressFill.style.width  = st.porcentaje + '%';

            renderizarMovimientos(registros);
        });
    }

    function renderizarMovimientos(registros) {
        if (!el.movimientos) return;

        var ultimos = registros.slice().sort(function (a, b) {
            return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        }).slice(0, 6);

        if (ultimos.length === 0) {
            el.movimientos.innerHTML = '<p class="empty-msg">Aún no hay movimientos registrados.</p>';
            return;
        }

        el.movimientos.innerHTML = ultimos.map(function (r) {
            var esPagado = r.estado === 'pagado';
            return [
                '<div class="movimiento-item">',
                    '<div>',
                        '<strong>Nº ' + U.escapeHtml(r.numero) + '</strong> · ',
                        U.escapeHtml(primerNombre(r.nombre)),
                        ' <span style="color:' +
                            (esPagado ? 'var(--ok)' : 'var(--warn)') + '">',
                            esPagado ? '✓' : '⏳',
                        '</span>',
                    '</div>',
                    '<div class="mov-fecha">' + U.escapeHtml(U.fechaCorta(r.fecha)) + '</div>',
                '</div>'
            ].join('');
        }).join('');
    }

    function primerNombre(nombre) {
        if (!nombre) return '—';
        return String(nombre).trim().split(/\s+/)[0] || '—';
    }

    /* ============================================================
       7. REGISTROS
       ============================================================ */
    function inicializarRegistros() {
        if (el.buscar) {
            el.buscar.addEventListener('input', U.debounce(function () {
                state.busqueda = el.buscar.value.trim().toLowerCase();
                renderizarRegistros();
            }, 220));
        }

        if (el.filterChips) {
            U.$$('.chip', el.filterChips).forEach(function (chip) {
                chip.addEventListener('click', function () {
                    U.$$('.chip', el.filterChips).forEach(function (c) {
                        c.classList.remove('active');
                    });
                    chip.classList.add('active');
                    state.filtro = chip.dataset.filtro;
                    renderizarRegistros();
                });
            });
        }
    }

    function renderizarRegistros() {
        if (!el.listaReservas) return;

        Store.cargarRegistros(true).then(function (registros) {
            state.registros = registros;
            var filtrados = filtrarRegistros(registros);

            if (el.contadorReg) el.contadorReg.textContent = filtrados.length;

            if (filtrados.length === 0) {
                el.listaReservas.innerHTML = '<p class="empty-msg">' +
                    (registros.length === 0
                        ? 'Aún no hay reservas registradas.'
                        : 'No hay registros que coincidan con el filtro.') +
                    '</p>';
                return;
            }

            el.listaReservas.innerHTML = filtrados.map(renderItemRegistro).join('');
            bindAccionesRegistros();
        });
    }

    function filtrarRegistros(registros) {
        return registros.filter(function (r) {
            if (state.filtro !== 'todos' && r.estado !== state.filtro) return false;

            if (state.busqueda) {
                var s = state.busqueda;
                var enNumero = String(r.numero).indexOf(s) !== -1;
                var enNombre = String(r.nombre || '').toLowerCase().indexOf(s) !== -1;
                var enCedula = U.soloDigitos(r.cedula || '').indexOf(U.soloDigitos(s)) !== -1;
                if (!enNumero && !enNombre && !enCedula) return false;
            }
            return true;
        }).sort(function (a, b) {
            return String(a.numero).localeCompare(String(b.numero));
        });
    }

    function renderItemRegistro(r) {
        var esPagado = r.estado === 'pagado';
        var cedulaTxt = r.cedula ? U.escapeHtml(r.cedula) : '—';
        var claveTxt = r.clave ? '🔑 ' + U.escapeHtml(r.clave) : (r.sinClave ? '🔓 Abierto' : '—');

        return [
            '<div class="reserva-item ' + r.estado + '" data-id="' + U.escapeHtml(r.id) + '">',
                '<div class="reserva-header">',
                    '<span class="reserva-num">' + U.escapeHtml(r.numero) + '</span>',
                    '<span class="reserva-estado ' + r.estado + '">',
                        esPagado ? 'PAGADO' : 'APARTADO',
                    '</span>',
                '</div>',
                '<div class="reserva-nombre">' + U.escapeHtml(r.nombre) + '</div>',
                '<div class="reserva-meta"><strong>Cédula:</strong> ' + cedulaTxt + '</div>',
                '<div class="reserva-meta"><strong>Clave:</strong> ' + claveTxt + '</div>',
                '<div class="reserva-meta"><strong>Tel:</strong> ' +
                    U.escapeHtml(r.telefono) + '</div>',
                '<div class="reserva-meta"><strong>Fecha:</strong> ' +
                    U.escapeHtml(U.fechaHumana(r.fecha)) + '</div>',
                '<div class="reserva-acciones">',
                    '<button class="mini-btn wa" data-act="wa">💬 WhatsApp</button>',
                    esPagado
                        ? '<button class="mini-btn warn" data-act="apartar">↩︎ Apartar</button>'
                        : '<button class="mini-btn ok" data-act="pagar">✅ Pagado</button>',
                    '<button class="mini-btn sky" data-act="editar">✏️ Editar</button>',
                    '<button class="mini-btn danger" data-act="descartar">🗑 Descartar</button>',
                '</div>',
            '</div>'
        ].join('');
    }

    function bindAccionesRegistros() {
        if (!el.listaReservas) return;
        U.$$('.reserva-item', el.listaReservas).forEach(function (item) {
            var id = item.dataset.id;
            U.$$('.mini-btn', item).forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var act = btn.dataset.act;
                    var reg = state.registros.find(function (r) { return r.id === id; });
                    if (!reg) return;
                    ejecutarAccionRegistro(act, reg);
                });
            });
        });
    }

    function ejecutarAccionRegistro(act, reg) {
        if (act === 'wa') {
            global.open(Store.linkWhatsAppAdmin(reg), '_blank', 'noopener');
            return;
        }
        if (act === 'pagar') {
            Store.actualizarRegistro(reg.id, { estado: 'pagado', metodoPago: 'manual' })
                .then(function () {
                    U.toast('Marcado como pagado', 'ok');
                    renderizarRegistros();
                    refrescarDashboard();
                    sincronizarMuestraDespuesDeCambio();
                });
            return;
        }
        if (act === 'apartar') {
            Store.actualizarRegistro(reg.id, { estado: 'apartado' })
                .then(function () {
                    U.toast('Marcado como apartado', 'info');
                    renderizarRegistros();
                    refrescarDashboard();
                });
            return;
        }
        if (act === 'descartar') {
            U.confirmar('¿Eliminar el número ' + reg.numero + ' de ' + reg.nombre + '?', {
                titulo: '🗑 Descartar registro', okText: 'Sí, eliminar', peligro: true
            }).then(function (ok) {
                if (!ok) return;
                Store.eliminarRegistro(reg.id).then(function () {
                    U.toast('Registro eliminado', 'ok');
                    renderizarRegistros();
                    refrescarDashboard();
                });
            });
            return;
        }
        if (act === 'editar') {
            abrirModalEditarRegistro(reg);
            return;
        }
    }

    function sincronizarMuestraDespuesDeCambio() {
        if (typeof Store.sincronizarMuestraGrilla !== 'function') return;
        var cambio = Store.sincronizarMuestraGrilla();
        if (cambio) {
            setTimeout(refrescarPreviewGrilla, 200);
        }
    }

    function abrirModalEditarRegistro(reg) {
        var html = [
            '<div class="modal-grabber"></div>',
            '<div class="modal-title">Editar Nº ' + U.escapeHtml(reg.numero) + '</div>',
            '<div class="admin-edit-grid">',
                '<div class="input-group full">',
                    '<label>Nombre</label>',
                    '<input type="text" class="input-field" id="edit-nombre" value="' +
                        U.escapeHtml(reg.nombre) + '">',
                '</div>',
                '<div class="input-group">',
                    '<label>Cédula</label>',
                    '<input type="text" class="input-field" id="edit-cedula" value="' +
                        U.escapeHtml(reg.cedula || '') + '">',
                '</div>',
                '<div class="input-group">',
                    '<label>Teléfono</label>',
                    '<input type="text" class="input-field" id="edit-telefono" value="' +
                        U.escapeHtml(reg.telefono) + '">',
                '</div>',
                '<div class="input-group">',
                    '<label>Clave (4 dígitos, opcional)</label>',
                    '<input type="tel" class="input-field" id="edit-clave" maxlength="4" ' +
                        'value="' + U.escapeHtml(reg.clave || '') + '">',
                '</div>',
                '<div class="input-group">',
                    '<label>Estado</label>',
                    '<select class="select-field" id="edit-estado">',
                        '<option value="apartado"' + (reg.estado === 'apartado' ? ' selected' : '') + '>Apartado</option>',
                        '<option value="pagado"' + (reg.estado === 'pagado' ? ' selected' : '') + '>Pagado</option>',
                    '</select>',
                '</div>',
                '<div class="input-group">',
                    '<label>Método de pago</label>',
                    '<select class="select-field" id="edit-metodo">',
                        '<option value="">— Sin definir —</option>',
                        '<option value="manual"' + (reg.metodoPago === 'manual' ? ' selected' : '') + '>Manual</option>',
                        '<option value="whatsapp"' + (reg.metodoPago === 'whatsapp' ? ' selected' : '') + '>WhatsApp</option>',
                        '<option value="efectivo"' + (reg.metodoPago === 'efectivo' ? ' selected' : '') + '>Efectivo</option>',
                    '</select>',
                '</div>',
                '<div class="input-group full">',
                    '<label>Notas internas</label>',
                    '<textarea class="input-field" id="edit-notas" rows="2">' +
                        U.escapeHtml(reg.notas || '') + '</textarea>',
                '</div>',
            '</div>',
            '<button type="button" class="btn-accion" id="edit-guardar">✅ Guardar cambios</button>',
            '<button type="button" class="btn-accion btn-ghost" id="edit-cancelar">Cancelar</button>'
        ].join('');

        U.abrirModal(html);

        U.$('#edit-cancelar').addEventListener('click', U.cerrarModal);
        U.$('#edit-guardar').addEventListener('click', function () {
            var cedulaRaw = U.$('#edit-cedula').value.trim();
            var claveRaw  = U.$('#edit-clave').value.trim();

            var cambios = {
                nombre:    U.$('#edit-nombre').value.trim(),
                cedula:    cedulaRaw ? U.formatearCedula(cedulaRaw) : null,
                telefono:  U.$('#edit-telefono').value.trim(),
                clave:     claveRaw && U.validarClave4(claveRaw) ? claveRaw : null,
                estado:    U.$('#edit-estado').value,
                metodoPago:U.$('#edit-metodo').value || null,
                notas:     U.$('#edit-notas').value.trim()
            };

            if (cambios.nombre.length < 3) { U.toast('Nombre inválido', 'warn'); return; }
            if (cedulaRaw && !U.esCedulaValida(cedulaRaw)) {
                U.toast('Cédula inválida', 'warn');
                return;
            }
            if (claveRaw && !U.validarClave4(claveRaw)) {
                U.toast('La clave debe ser de 4 dígitos', 'warn');
                return;
            }

            Store.actualizarRegistro(reg.id, cambios).then(function () {
                U.cerrarModal();
                U.toast('Cambios guardados', 'ok');
                renderizarRegistros();
                refrescarDashboard();
                sincronizarMuestraDespuesDeCambio();
            });
        });
    }

    /* ============================================================
       8. RECORDATORIOS
       ============================================================ */
    function estaVencido(reg) {
        if (reg.estado === 'pagado') return false;
        if (!reg.fechaLimite) return false;
        return new Date(reg.fechaLimite).getTime() < Date.now();
    }

    function filtrarRecordatorios(registros) {
        var f = state.recFiltro;
        var b = state.recBusqueda;

        return registros.filter(function (r) {
            if (f === 'autorizados') {
                if (r.autorizaRecordatorio !== true) return false;
            } else if (f === 'pendientes') {
                if (r.estado === 'pagado') return false;
                if (r.autorizaRecordatorio !== true) return false;
            } else if (f === 'vencidos') {
                if (!estaVencido(r)) return false;
                if (r.autorizaRecordatorio !== true) return false;
            } else if (f === 'sin-autorizar') {
                if (r.autorizaRecordatorio === true) return false;
            }

            if (b) {
                var enNumero = String(r.numero).indexOf(b) !== -1;
                var enNombre = String(r.nombre || '').toLowerCase().indexOf(b) !== -1;
                var enCedula = U.soloDigitos(r.cedula || '').indexOf(U.soloDigitos(b)) !== -1;
                if (!enNumero && !enNombre && !enCedula) return false;
            }

            return true;
        }).sort(function (a, b2) {
            var aVenc = estaVencido(a);
            var bVenc = estaVencido(b2);
            if (aVenc && !bVenc) return -1;
            if (!aVenc && bVenc) return 1;
            var aT = a.fechaLimite ? new Date(a.fechaLimite).getTime() : Infinity;
            var bT = b2.fechaLimite ? new Date(b2.fechaLimite).getTime() : Infinity;
            return aT - bT;
        });
    }

    function renderizarRecordatorios() {
        if (!el.listaRecordatorios) return;

        Store.cargarRegistros(true).then(function (registros) {
            state.registros = registros;

            var autorizaron   = registros.filter(function (r) { return r.autorizaRecordatorio === true; }).length;
            var pendientes    = registros.filter(function (r) {
                return r.autorizaRecordatorio === true && r.estado !== 'pagado';
            }).length;
            var vencidos      = registros.filter(estaVencido).length;
            var sinAutorizar  = registros.filter(function (r) {
                return r.estado !== 'pagado' && r.autorizaRecordatorio !== true;
            }).length;

            if (el.recStatAutorizaron) el.recStatAutorizaron.textContent = autorizaron;
            if (el.recStatPendientes)  el.recStatPendientes.textContent  = pendientes;
            if (el.recStatVencidos)    el.recStatVencidos.textContent    = vencidos;
            if (el.recStatNoPagados)   el.recStatNoPagados.textContent   = sinAutorizar;

            var filtrados = filtrarRecordatorios(registros);
            if (el.recContador) el.recContador.textContent = filtrados.length;

            if (filtrados.length === 0) {
                el.listaRecordatorios.innerHTML =
                    '<p class="empty-msg">' +
                    (registros.length === 0
                        ? 'Aún no hay registros.'
                        : 'No hay resultados para el filtro seleccionado.') +
                    '</p>';
                return;
            }

            el.listaRecordatorios.innerHTML = filtrados.map(renderItemRecordatorio).join('');
            bindAccionesRecordatorios();
        });
    }

    function renderItemRecordatorio(r) {
        var esPagado = r.estado === 'pagado';
        var esVencido = estaVencido(r);

        var claseItem = esPagado ? 'pagado' : (esVencido ? 'vencido' : 'apartado');
        var autoriza = r.autorizaRecordatorio === true;

        var badgeTxt = '';
        var badgeClase = '';
        if (esPagado) {
            badgeTxt = '✓ PAGADO';
            badgeClase = 'pagado';
        } else if (esVencido) {
            badgeTxt = '🚨 VENCIDO';
            badgeClase = 'vencido';
        } else {
            badgeTxt = '⏳ PENDIENTE';
            badgeClase = 'apartado';
        }

        var autorizaBadge = autoriza
            ? '<span class="rec-badge-rec si">✅ Autoriza</span>'
            : '<span class="rec-badge-rec no">🚫 No autoriza</span>';

        var fechaLimite = '';
        if (r.fechaLimite && !esPagado) {
            fechaLimite = esVencido
                ? 'Venció el ' + U.fechaHumana(r.fechaLimite)
                : 'Vence el ' + U.fechaHumana(r.fechaLimite);
        }

        return [
            '<div class="rec-item ' + claseItem + '" data-id="' + U.escapeHtml(r.id) + '">',
                '<div class="rec-item-head">',
                    '<span class="rec-item-num ' + claseItem + '">' +
                        U.escapeHtml(r.numero) +
                    '</span>',
                    '<span class="rec-item-badge ' + badgeClase + '">' + badgeTxt + '</span>',
                '</div>',
                '<div class="rec-item-nombre">' + U.escapeHtml(r.nombre) + '</div>',
                '<div class="rec-item-meta">',
                    (r.cedula ? '<span>🆔 ' + U.escapeHtml(r.cedula) + '</span>' : '<span>🆔 —</span>'),
                    '<span>📞 ' + U.escapeHtml(r.telefono) + '</span>',
                '</div>',
                (fechaLimite ? '<div class="rec-item-fecha ' + (esVencido ? 'vencido' : '') + '">📅 ' + U.escapeHtml(fechaLimite) + '</div>' : ''),
                '<div class="rec-item-autoriza">',
                    autorizaBadge,
                    (autoriza ? '<span class="rec-item-fecha-min">Autorizó al reservar</span>' : ''),
                '</div>',
                '<div class="rec-item-acciones">',
                    (autoriza && !esPagado ? '<button class="mini-btn wa" data-act="recordar">📲 Recordar</button>' : ''),
                    '<button class="mini-btn sky" data-act="ver">👁️ Detalles</button>',
                    (!esPagado ? '<button class="mini-btn ok" data-act="pagar">✅ Pagado</button>' : ''),
                '</div>',
            '</div>'
        ].join('');
    }

    function bindAccionesRecordatorios() {
        if (!el.listaRecordatorios) return;
        U.$$('.rec-item', el.listaRecordatorios).forEach(function (item) {
            var id = item.dataset.id;
            U.$$('.mini-btn', item).forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var act = btn.dataset.act;
                    var reg = state.registros.find(function (r) { return r.id === id; });
                    if (!reg) return;

                    if (act === 'recordar') {
                        enviarRecordatorio(reg);
                        return;
                    }
                    if (act === 'ver') {
                        abrirModalVerRegistro(reg);
                        return;
                    }
                    if (act === 'pagar') {
                        Store.actualizarRegistro(reg.id, { estado: 'pagado', metodoPago: 'manual' })
                            .then(function () {
                                U.toast('Marcado como pagado', 'ok');
                                renderizarRecordatorios();
                                refrescarDashboard();
                                sincronizarMuestraDespuesDeCambio();
                            });
                    }
                });
            });
        });
    }

    function enviarRecordatorio(reg) {
        var cfg = Store.leerConfig();
        var ident = cfg.identidad || {};

        var telCliente = U.soloDigitos(reg.telefono || '');
        if (!telCliente) {
            U.toast('Sin teléfono registrado', 'warn');
            return;
        }
        var pref = telCliente.length > 10 ? telCliente : ('58' + telCliente.replace(/^0/, ''));

        var monto = ident.monto || '$5';
        var rifaNombre = ident.nombreRifa || 'la rifa';
        var fechaLimTxt = reg.fechaLimite
            ? U.fechaHumana(reg.fechaLimite)
            : 'la fecha indicada';

        var esVencido = estaVencido(reg);

        var saludo = '¡Hola ' + (reg.nombre.split(/\s+/)[0] || '') + '! 👋\n\n';

        var cuerpo = 'Te escribo de *' + rifaNombre + '* para recordarte que tienes ' +
            'pendiente el pago del número *' + reg.numero + '*.';

        if (esVencido) {
            cuerpo += '\n\n🚨 *Esta reserva ya venció* el ' + fechaLimTxt +
                '. Por favor contáctanos lo antes posible para regularizar tu situación.';
        } else {
            cuerpo += '\n\n📅 Recuerda pagar antes del ' + fechalimTxt + '.';
        }

        cuerpo += '\n\n💰 Monto: ' + monto +
            '\n🎟️ Número: ' + reg.numero;

        if (ident.pagoMovil && ident.pagoMovil.banco) {
            cuerpo += '\n\n💳 *Datos de Pago Móvil:*';
            if (ident.pagoMovil.banco)    cuerpo += '\n· Banco: ' + ident.pagoMovil.banco;
            if (ident.pagoMovil.telefono) cuerpo += '\n· Teléfono: ' + ident.pagoMovil.telefono;
            if (ident.pagoMovil.cedula)   cuerpo += '\n· Cédula: ' + ident.pagoMovil.cedula;
            if (ident.pagoMovil.titular)  cuerpo += '\n· Titular: ' + ident.pagoMovil.titular;
        }

        cuerpo += '\n\nCuando realices el pago, envíame el comprobante. ¡Gracias! 🙏';

        var url = 'https://wa.me/' + pref + '?text=' + encodeURIComponent(saludo + cuerpo);
        global.open(url, '_blank', 'noopener');
    }

    function abrirModalVerRegistro(reg) {
        var esPagado = reg.estado === 'pagado';
        var esVencido = estaVencido(reg);
        var autoriza = reg.autorizaRecordatorio === true;

        var html = [
            '<div class="modal-grabber"></div>',
            '<div class="modal-title">Nº ' + U.escapeHtml(reg.numero) + '</div>',
            '<div class="modal-subtitle">' +
                (esPagado ? '✅ Pagado' : (esVencido ? '🚨 Vencido' : '⏳ Pendiente')) +
            '</div>',
            '<div class="info-line"><span>Nombre</span><span>' +
                U.escapeHtml(reg.nombre) + '</span></div>',
            '<div class="info-line"><span>Cédula</span><span>' +
                U.escapeHtml(reg.cedula || '—') + '</span></div>',
            '<div class="info-line"><span>Clave</span><span>' +
                (reg.clave ? '🔑 ' + U.escapeHtml(reg.clave) : (reg.sinClave ? '🔓 Abierto' : '—')) +
            '</span></div>',
            '<div class="info-line"><span>Teléfono</span><span>' +
                U.escapeHtml(reg.telefono) + '</span></div>',
            '<div class="info-line"><span>Reserva</span><span>' +
                U.escapeHtml(U.fechaHumana(reg.fecha)) + '</span></div>',
        ];

        if (reg.fechaLimite) {
            html.push('<div class="info-line"><span>Vence</span><span class="' +
                (esVencido ? 'text-danger' : 'text-warn') + '">' +
                U.escapeHtml(U.fechaHumana(reg.fechaLimite)) + '</span></div>');
        }

        if (reg.totalUsd) {
            html.push('<div class="info-line"><span>Total USD</span><span>$' +
                Number(reg.totalUsd).toFixed(2) + '</span></div>');
        }

        if (reg.totalBs) {
            html.push('<div class="info-line"><span>Total Bs</span><span>' +
                U.escapeHtml(reg.totalBs) + '</span></div>');
        }

        html.push('<div class="info-line"><span>Autoriza</span><span class="' +
            (autoriza ? 'text-ok' : 'text-danger') + '">' +
            (autoriza ? '✅ Sí' : '🚫 No') + '</span></div>');

        if (reg.boleto) {
            html.push('<div class="info-line"><span>Código</span><span style="font-family:monospace;font-size:0.7rem;">' +
                U.escapeHtml(reg.boleto) + '</span></div>');
        }

        html.push('<button type="button" class="btn-accion btn-ghost" id="ver-cerrar">Cerrar</button>');

        U.abrirModal(html.join(''));
        U.$('#ver-cerrar').addEventListener('click', U.cerrarModal);
    }

    function recordarATodos(vencidosSolamente) {
        Store.cargarRegistros(true).then(function (registros) {
            var pendientes = registros.filter(function (r) {
                if (r.estado === 'pagado') return false;
                if (r.autorizaRecordatorio !== true) return false;
                if (vencidosSolamente) return estaVencido(r);
                return true;
            });

            if (pendientes.length === 0) {
                U.toast(vencidosSolamente
                    ? 'No hay vencidos que autorizaron recordatorios.'
                    : 'No hay pendientes que autorizaron recordatorios.',
                    'info');
                return;
            }

            var cfg = Store.leerConfig();
            var ident = cfg.identidad || {};
            var telOrg = U.soloDigitos(ident.whatsappOrg || '');

            if (!telOrg) {
                U.toast('El organizador no configuró WhatsApp', 'warn');
                return;
            }

            var lineas = pendientes.map(function (r) {
                var vencido = estaVencido(r);
                var cuando = r.fechaLimite ? U.fechaHumana(r.fechaLimite) : '—';
                return '• Nº ' + r.numero + ' — ' + r.nombre + ' (' + r.telefono + ')' +
                    (vencido ? ' 🚨 VENCIDO ' + cuando : ' (vence ' + cuando + ')');
            }).join('\n');

            var titulo = vencidosSolamente
                ? '🚨 *Recordatorios URGENTES · Vencidos*'
                : '🔔 *Recordatorios pendientes*';

            var mensaje =
                titulo + '\n\n' +
                'Total: *' + pendientes.length + '* persona' +
                (pendientes.length === 1 ? '' : 's') + '.\n\n' +
                lineas + '\n\n' +
                'Estas personas autorizaron recibir recordatorios al reservar. ' +
                'Por favor contáctalas una a una por WhatsApp. 🙏';

            var url = 'https://wa.me/' + telOrg + '?text=' + encodeURIComponent(mensaje);
            global.open(url, '_blank', 'noopener');

            U.toast('📲 WhatsApp abierto con la lista', 'ok');
        });
    }

    function inicializarRecordatorios() {
        if (el.recFilterChips) {
            U.$$('.chip', el.recFilterChips).forEach(function (chip) {
                chip.addEventListener('click', function () {
                    U.$$('.chip', el.recFilterChips).forEach(function (c) {
                        c.classList.remove('active');
                    });
                    chip.classList.add('active');
                    state.recFiltro = chip.dataset.recFiltro;
                    renderizarRecordatorios();
                });
            });
        }

        if (el.recBuscar) {
            el.recBuscar.addEventListener('input', U.debounce(function () {
                state.recBusqueda = el.recBuscar.value.trim().toLowerCase();
                renderizarRecordatorios();
            }, 220));
        }

        if (el.recBtnTodos) {
            el.recBtnTodos.addEventListener('click', function () {
                U.confirmar(
                    'Se abrirá WhatsApp con la lista completa de personas pendientes que autorizaron recordatorios.',
                    { titulo: '📲 Recordar a todos', okText: 'Continuar' }
                ).then(function (ok) {
                    if (ok) recordarATodos(false);
                });
            });
        }

        if (el.recBtnVencidos) {
            el.recBtnVencidos.addEventListener('click', function () {
                U.confirmar(
                    'Se abrirá WhatsApp con la lista de personas vencidas que autorizaron recordatorios.',
                    { titulo: '🚨 Recordar a vencidos', okText: 'Continuar', peligro: true }
                ).then(function (ok) {
                    if (ok) recordarATodos(true);
                });
            });
        }

        if (el.recBtnRefrescar) {
            el.recBtnRefrescar.addEventListener('click', function () {
                U.toast('🔄 Actualizando lista…', 'info', 1000);
                renderizarRecordatorios();
            });
        }

        renderizarRecordatorios();
    }

    /* ============================================================
       9. LANDING
       ============================================================ */
    function inicializarLanding() {
        var cfg = Store.leerConfig();
        var l = Object.assign({}, LANDING_DEFAULT, cfg.landing || {});
        state.landingImagenTemp = null;

        if (el.landingTitulo) el.landingTitulo.value = l.titulo || '';
        if (el.landingSubtitulo) el.landingSubtitulo.value = l.subtitulo || '';
        if (el.landingCtaPrincipal) el.landingCtaPrincipal.value = l.ctaPrincipal || '';
        if (el.landingCtaSecundario) el.landingCtaSecundario.value = l.ctaSecundario || '';
        if (el.landingCtaSecundarioUrl) el.landingCtaSecundarioUrl.value = l.ctaSecundarioUrl || '';

        actualizarPreviewImagenLanding(l.imagen, l.emoji);

        if (el.landingImgBtn && el.landingImgInput) {
            el.landingImgBtn.addEventListener('click', function () {
                el.landingImgInput.click();
            });
            el.landingImgInput.addEventListener('change', function () {
                var file = el.landingImgInput.files && el.landingImgInput.files[0];
                if (!file) return;
                U.comprimirImagen(file, 800).then(function (dataUrl) {
                    state.landingImagenTemp = dataUrl;
                    actualizarPreviewImagenLanding(dataUrl, null);
                    mostrarDatosImagenLanding(file.name, file.size);
                    U.toast('✅ Imagen cargada', 'ok');
                }).catch(function () {
                    U.toast('No se pudo procesar la imagen', 'danger');
                });
            });
        }

        if (el.landingImgEliminar) {
            el.landingImgEliminar.addEventListener('click', function () {
                state.landingImagenTemp = null;
                if (el.landingImgInput) el.landingImgInput.value = '';
                actualizarPreviewImagenLanding(null, '🎟️');
                U.toast('🗑 Imagen quitada', 'info', 1500);
            });
        }

        if (el.btnRefrescarLanding) {
            el.btnRefrescarLanding.addEventListener('click', function () {
                refrescarPreviewLanding();
                U.toast('🔄 Vista previa actualizada', 'info', 1200);
            });
        }

        if (el.btnGuardarLanding) {
            el.btnGuardarLanding.addEventListener('click', guardarLanding);
        }

        if (el.btnResetLanding) {
            el.btnResetLanding.addEventListener('click', function () {
                U.confirmar(
                    'Se restaurarán los textos y la imagen por defecto. ¿Continuar?',
                    { titulo: '♻️ Restaurar landing', okText: 'Sí, restaurar', peligro: true }
                ).then(function (ok) {
                    if (!ok) return;
                    if (el.landingTitulo) el.landingTitulo.value = LANDING_DEFAULT.titulo;
                    if (el.landingSubtitulo) el.landingSubtitulo.value = LANDING_DEFAULT.subtitulo;
                    if (el.landingCtaPrincipal) el.landingCtaPrincipal.value = LANDING_DEFAULT.ctaPrincipal;
                    if (el.landingCtaSecundario) el.landingCtaSecundario.value = LANDING_DEFAULT.ctaSecundario;
                    if (el.landingCtaSecundarioUrl) el.landingCtaSecundarioUrl.value = LANDING_DEFAULT.ctaSecundarioUrl;
                    state.landingImagenTemp = null;
                    if (el.landingImgInput) el.landingImgInput.value = '';
                    actualizarPreviewImagenLanding(null, '🎟️');
                    U.toast('✅ Textos restaurados', 'ok');
                });
            });
        }

        setTimeout(refrescarPreviewLanding, 500);
    }

    function actualizarPreviewImagenLanding(imagenBase64, emojiFallback) {
        var tieneImagen = !!(imagenBase64 && String(imagenBase64).indexOf('data:image') === 0);

        if (el.landingImgVacia) {
            el.landingImgVacia.classList.toggle('hidden', tieneImagen);
        }
        if (el.landingImgPreview) {
            el.landingImgPreview.classList.toggle('hidden', !tieneImagen);
        }
        if (el.landingImgThumb && tieneImagen) {
            el.landingImgThumb.src = imagenBase64;
        }
        if (el.landingImgThumb2) {
            el.landingImgThumb2.innerHTML = '';
            if (tieneImagen) {
                var img = document.createElement('img');
                img.src = imagenBase64;
                img.alt = 'Preview';
                el.landingImgThumb2.appendChild(img);
            } else {
                el.landingImgThumb2.textContent = emojiFallback || '🎟️';
            }
        }
    }

    function mostrarDatosImagenLanding(nombre, peso) {
        if (el.landingImgName) el.landingImgName.textContent = nombre;
        if (el.landingImgSize) el.landingImgSize.textContent = (peso / 1024).toFixed(1) + ' KB';
    }

    function leerLandingActual() {
        var cfg = Store.leerConfig();
        var lActual = cfg.landing || {};

        var imagen = state.landingImagenTemp;
        if (imagen === null) {
            imagen = lActual.imagen || null;
        }

        return {
            imagen: imagen,
            emoji: LANDING_DEFAULT.emoji,
            titulo: el.landingTitulo ? el.landingTitulo.value.trim() : LANDING_DEFAULT.titulo,
            subtitulo: el.landingSubtitulo ? el.landingSubtitulo.value.trim() : LANDING_DEFAULT.subtitulo,
            ctaPrincipal: el.landingCtaPrincipal ? el.landingCtaPrincipal.value.trim() : LANDING_DEFAULT.ctaPrincipal,
            ctaSecundario: el.landingCtaSecundario ? el.landingCtaSecundario.value.trim() : LANDING_DEFAULT.ctaSecundario,
            ctaSecundarioUrl: el.landingCtaSecundarioUrl ? el.landingCtaSecundarioUrl.value.trim() : LANDING_DEFAULT.ctaSecundarioUrl
        };
    }

    function guardarLanding() {
        var nueva = leerLandingActual();
        var cfg = Store.leerConfig();
        cfg.landing = nueva;
        Store.guardarConfig(cfg);

        refrescarPreviewLanding();

        U.toast('✅ Landing guardada', 'ok');
    }

    function refrescarPreviewLanding() {
        if (!el.landingPreviewFrame) return;
        el.landingPreviewFrame.src = 'index.html?preview=1&t=' + Date.now();
    }

    /* ============================================================
       10. APARIENCIA
       ============================================================ */
    function inicializarApariencia() {
        var cfg = Store.leerConfig();
        var marca = cfg.marca || {};

        if (el.colorAcento) el.colorAcento.value = marca.colorAcento || '#fbbf24';
        if (el.colorSecun)  el.colorSecun.value  = marca.colorSecundario || '#38bdf8';
        if (el.tipoSelect)  el.tipoSelect.value  = marca.tipografia || 'system';
        if (el.logoTipo)    el.logoTipo.value    = marca.tipoLogo || 'emoji';
        if (el.logoEmoji)   el.logoEmoji.value   = (marca.tipoLogo === 'emoji' ? marca.logoValor : '') || '🎟️';
        if (el.logoTexto)   el.logoTexto.value   = (marca.tipoLogo === 'texto' ? marca.logoValor : '') || '';

        actualizarHexLabels();
        actualizarLogoGrupos();
        actualizarLogoPreview();
        renderizarPresets();

        if (el.colorAcento) {
            el.colorAcento.addEventListener('input', function () {
                if (el.colorAcentoHex) el.colorAcentoHex.textContent = el.colorAcento.value;
                previsualizarApariencia();
            });
        }
        if (el.colorSecun) {
            el.colorSecun.addEventListener('input', function () {
                if (el.colorSecunHex) el.colorSecunHex.textContent = el.colorSecun.value;
                previsualizarApariencia();
            });
        }
        if (el.tipoSelect) el.tipoSelect.addEventListener('change', previsualizarApariencia);
        if (el.logoTipo) {
            el.logoTipo.addEventListener('change', function () {
                actualizarLogoGrupos();
                previsualizarApariencia();
            });
        }
        if (el.logoEmoji) {
            el.logoEmoji.addEventListener('input', function () {
                actualizarLogoPreview();
                previsualizarApariencia();
            });
        }
        if (el.logoTexto) {
            el.logoTexto.addEventListener('input', function () {
                actualizarLogoPreview();
                previsualizarApariencia();
            });
        }
        if (el.logoUploadBtn && el.logoArchivo) {
            el.logoUploadBtn.addEventListener('click', function () {
                el.logoArchivo.click();
            });
            el.logoArchivo.addEventListener('change', function () {
                var file = el.logoArchivo.files && el.logoArchivo.files[0];
                if (!file) return;
                U.comprimirImagen(file, 400).then(function (dataUrl) {
                    state.logoImagenTemp = dataUrl;
                    actualizarLogoPreview();
                    previsualizarApariencia();
                    U.toast('Logo cargado', 'ok');
                }).catch(function () {
                    U.toast('No se pudo procesar la imagen', 'danger');
                });
            });
        }

        if (el.btnGuardarApariencia) el.btnGuardarApariencia.addEventListener('click', guardarApariencia);
        if (el.btnPreviewApariencia) {
            el.btnPreviewApariencia.addEventListener('click', function () {
                abrirIframe('rifas.html?embed=1&preview=1', '🎟️ Vista previa · Rifas');
            });
        }
    }

    function actualizarHexLabels() {
        if (el.colorAcento && el.colorAcentoHex) el.colorAcentoHex.textContent = el.colorAcento.value;
        if (el.colorSecun && el.colorSecunHex)   el.colorSecunHex.textContent  = el.colorSecun.value;
    }

    function actualizarLogoGrupos() {
        var tipo = el.logoTipo ? el.logoTipo.value : 'emoji';
        if (el.grupoLogoEmoji) el.grupoLogoEmoji.classList.toggle('hidden', tipo !== 'emoji');
        if (el.grupoLogoTexto) el.grupoLogoTexto.classList.toggle('hidden', tipo !== 'texto');
        if (el.grupoLogoImagen) el.grupoLogoImagen.classList.toggle('hidden', tipo !== 'imagen');
    }

    function actualizarLogoPreview() {
        if (!el.logoPreview) return;
        var tipo = el.logoTipo ? el.logoTipo.value : 'emoji';
        el.logoPreview.innerHTML = '';

        if (tipo === 'imagen') {
            var src = state.logoImagenTemp;
            if (!src) {
                var cfg = Store.leerConfig();
                if (cfg.marca && cfg.marca.tipoLogo === 'imagen') src = cfg.marca.logoValor;
            }
            if (src) {
                var img = document.createElement('img');
                img.src = src;
                img.alt = 'Logo';
                el.logoPreview.appendChild(img);
            } else {
                el.logoPreview.textContent = '📷';
            }
        } else if (tipo === 'texto') {
            el.logoPreview.textContent = el.logoTexto ? (el.logoTexto.value || 'RIFA') : 'RIFA';
            el.logoPreview.style.fontSize = '0.7rem';
            el.logoPreview.style.fontWeight = '900';
        } else {
            el.logoPreview.textContent = el.logoEmoji ? (el.logoEmoji.value || '🎟️') : '🎟️';
            el.logoPreview.style.fontSize = '';
        }
    }

    function renderizarPresets() {
        if (!el.colorPresets) return;
        el.colorPresets.innerHTML = COLORES_PRESET.map(function (c) {
            return '<button type="button" class="color-preset" data-color="' + c +
                   '" style="background:' + c + '"></button>';
        }).join('');

        U.$$('.color-preset', el.colorPresets).forEach(function (btn) {
            btn.addEventListener('click', function () {
                var c = btn.dataset.color;
                if (el.colorAcento) el.colorAcento.value = c;
                U.$$('.color-preset', el.colorPresets).forEach(function (b) {
                    b.classList.toggle('activo', b.dataset.color === c);
                });
                actualizarHexLabels();
                previsualizarApariencia();
            });
        });
    }

    function leerAparienciaActual() {
        var tipo = el.logoTipo ? el.logoTipo.value : 'emoji';
        var logoValor = '';
        if (tipo === 'imagen') {
            logoValor = state.logoImagenTemp || null;
            if (!logoValor) {
                var cfg = Store.leerConfig();
                if (cfg.marca && cfg.marca.tipoLogo === 'imagen') logoValor = cfg.marca.logoValor;
            }
        } else if (tipo === 'texto') {
            logoValor = el.logoTexto ? el.logoTexto.value.trim() : '';
        } else {
            logoValor = el.logoEmoji ? el.logoEmoji.value.trim() : '🎟️';
        }

        return {
            marca: {
                colorAcento:     el.colorAcento ? el.colorAcento.value : '#fbbf24',
                colorSecundario: el.colorSecun  ? el.colorSecun.value  : '#38bdf8',
                tipografia:      el.tipoSelect  ? el.tipoSelect.value  : 'system',
                tipoLogo:        tipo,
                logoValor:       logoValor || (tipo === 'emoji' ? '🎟️' : '')
            }
        };
    }

    function previsualizarApariencia() {
        var cambios = leerAparienciaActual();
        Theme.previsualizar(cambios);
    }

    function guardarApariencia() {
        var cambios = leerAparienciaActual();
        var cfg = Store.leerConfig();
        cfg.marca = Object.assign({}, cfg.marca, cambios.marca);
        Store.guardarConfig(cfg);
        Theme.aplicarTodo(cfg);
        state.logoImagenTemp = null;
        U.toast('✅ Apariencia guardada', 'ok');
    }

    /* ============================================================
       11. PLANTILLAS
       ============================================================ */
    function inicializarPlantillas() {
        var cfg = Store.leerConfig();
        state.plantillaTemp = cfg.plantilla || 'boleto';

        marcarPlantillaActiva(state.plantillaTemp);

        if (el.plantillasGrid) {
            U.$$('.plantilla-card', el.plantillasGrid).forEach(function (card) {
                card.addEventListener('click', function () {
                    var p = card.dataset.plantilla;
                    state.plantillaTemp = p;
                    marcarPlantillaActiva(p);
                    Theme.previsualizar({ plantilla: p });
                    recargarPreviewPlantilla();
                });
            });
        }

        if (el.btnGuardarPlantilla) {
            el.btnGuardarPlantilla.addEventListener('click', function () {
                if (!state.plantillaTemp) {
                    U.toast('Selecciona una plantilla', 'warn');
                    return;
                }
                var cfg = Store.leerConfig();
                cfg.plantilla = state.plantillaTemp;
                Store.guardarConfig(cfg);
                Theme.aplicarTodo(cfg);
                U.toast('✅ Plantilla aplicada', 'ok');
            });
        }
    }

    function marcarPlantillaActiva(nombre) {
        if (!el.plantillasGrid) return;
        U.$$('.plantilla-card', el.plantillasGrid).forEach(function (card) {
            card.classList.toggle('activa', card.dataset.plantilla === nombre);
        });
    }

    function recargarPreviewPlantilla() {
        if (!el.previewFrame) return;
        var p = state.plantillaTemp || 'boleto';
        el.previewFrame.src = 'rifas.html?embed=1&preview=1&t=' + Date.now() + '&p=' + p;
    }

    /* ============================================================
       12. PREMIOS
       ============================================================ */
    function inicializarPremios() {
        renderizarPremiosAdmin();

        if (el.premioImgBtn && el.premioImgInput) {
            el.premioImgBtn.addEventListener('click', function () {
                el.premioImgInput.click();
            });
            el.premioImgInput.addEventListener('change', function () {
                var file = el.premioImgInput.files && el.premioImgInput.files[0];
                if (!file) return;
                U.comprimirImagen(file, 600).then(function (dataUrl) {
                    state.premioImagenTemp = dataUrl;
                    mostrarPreviewImagenPremio(file.name, file.size, dataUrl);
                }).catch(function () {
                    U.toast('No se pudo procesar la imagen', 'danger');
                });
            });
        }

        if (el.premioImgElim) {
            el.premioImgElim.addEventListener('click', function () {
                state.premioImagenTemp = null;
                if (el.premioImgPrev) el.premioImgPrev.classList.add('hidden');
                if (el.premioImgInput) el.premioImgInput.value = '';
            });
        }

        if (el.btnAgregarPremio) el.btnAgregarPremio.addEventListener('click', agregarPremio);
    }

    function mostrarPreviewImagenPremio(nombre, peso, dataUrl) {
        if (el.premioImgPrev) el.premioImgPrev.classList.remove('hidden');
        if (el.premioImgThumb) el.premioImgThumb.src = dataUrl;
        if (el.premioImgName) el.premioImgName.textContent = nombre;
        if (el.premioImgSize) el.premioImgSize.textContent = (peso / 1024).toFixed(1) + ' KB';
    }

    function renderizarPremiosAdmin() {
        if (!el.premiosList) return;
        var cfg = Store.leerConfig();
        var premios = (cfg.premios || []).slice().sort(function (a, b) {
            return (a.puesto || 99) - (b.puesto || 99);
        });

        if (premios.length === 0) {
            el.premiosList.innerHTML = '<p class="empty-msg">Sin premios configurados.</p>';
            return;
        }

        el.premiosList.innerHTML = premios.map(function (p, i) {
            var icono = MEDALLAS[p.puesto] || '🏆';
            var imgContent = (p.imagen && String(p.imagen).indexOf('data:image') === 0)
                ? '<img src="' + p.imagen + '" alt="">'
                : icono;

            return [
                '<div class="premio-admin-item" data-puesto="' + p.puesto + '">',
                    '<div class="premio-admin-pos">' + U.escapeHtml(String(p.puesto)) + '</div>',
                    '<div class="premio-admin-img">' + imgContent + '</div>',
                    '<div class="premio-admin-info">',
                        '<strong>' + U.escapeHtml(p.titulo || 'Premio') + '</strong>',
                        '<span>' + U.escapeHtml(p.descripcion || '') + '</span>',
                    '</div>',
                    '<div class="premio-admin-actions">',
                        '<button type="button" class="icon-btn danger" data-del="' + i + '">🗑</button>',
                    '</div>',
                '</div>'
            ].join('');
        }).join('');

        U.$$('[data-del]', el.premiosList).forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(btn.dataset.del, 10);
                U.confirmar('¿Eliminar este premio?', {
                    titulo: '🗑 Eliminar premio', okText: 'Sí, eliminar', peligro: true
                }).then(function (ok) {
                    if (!ok) return;
                    var cfg = Store.leerConfig();
                    cfg.premios.splice(idx, 1);
                    Store.guardarConfig(cfg);
                    renderizarPremiosAdmin();
                    U.toast('Premio eliminado', 'ok');
                });
            });
        });
    }

    function agregarPremio() {
        var puesto = parseInt(el.premioPuesto ? el.premioPuesto.value : 1, 10) || 1;
        var titulo = el.premioTitulo ? el.premioTitulo.value.trim() : '';
        var desc   = el.premioDesc ? el.premioDesc.value.trim() : '';

        if (!titulo) { U.toast('Escribe un título para el premio', 'warn'); return; }
        if (puesto < 1 || puesto > 20) { U.toast('Puesto inválido (1-20)', 'warn'); return; }

        var cfg = Store.leerConfig();
        var yaExiste = (cfg.premios || []).some(function (p) {
            return parseInt(p.puesto, 10) === puesto;
        });
        if (yaExiste) { U.toast('Ya existe un premio en ese puesto', 'warn'); return; }

        cfg.premios = cfg.premios || [];
        cfg.premios.push({
            puesto: puesto,
            titulo: titulo,
            descripcion: desc,
            imagen: state.premioImagenTemp || null
        });

        Store.guardarConfig(cfg);

        if (el.premioTitulo) el.premioTitulo.value = '';
        if (el.premioDesc)   el.premioDesc.value = '';
        if (el.premioPuesto) el.premioPuesto.value = (cfg.premios.length + 1);
        if (el.premioImgPrev) el.premioImgPrev.classList.add('hidden');
        if (el.premioImgInput) el.premioImgInput.value = '';
        state.premioImagenTemp = null;

        renderizarPremiosAdmin();
        U.toast('✅ Premio añadido', 'ok');
    }

    /* ============================================================
       13. BCV + COP
       ============================================================ */
    function inicializarBCV() {
        if (!BCV) {
            U.warn('Admin: BCV no disponible.');
            return;
        }

        var conf = BCV.leerConfigTasas();
        state.bcvModo = conf.modo;
        state.copModo = conf.modoCop;

        aplicarModoBCVUI(state.bcvModo);
        aplicarModoCOPUI(state.copModo);

        if (el.bcvModoChips) {
            U.$$('.chip', el.bcvModoChips).forEach(function (chip) {
                chip.addEventListener('click', function () {
                    cambiarModoBCV(chip.dataset.bcvModo);
                });
            });
        }

        if (el.copModoChips) {
            U.$$('.chip', el.copModoChips).forEach(function (chip) {
                chip.addEventListener('click', function () {
                    cambiarModoCOP(chip.dataset.copModo);
                });
            });
        }

        if (el.bcvRefreshBtn) {
            el.bcvRefreshBtn.addEventListener('click', function () {
                U.toast('🔄 Consultando BCV…', 'info', 1200);
                BCV.fetchRate().then(function (info) {
                    state.bcvInfo = info;
                    renderBCVTasa();
                    renderDashboardBCV();
                    U.toast('✅ Tasa BCV actualizada', 'ok');
                }).catch(function () {
                    U.toast('⚠️ No se pudo consultar el BCV', 'warn');
                    renderBCVTasa();
                });
            });
        }

        if (el.copRefreshBtn) {
            el.copRefreshBtn.addEventListener('click', function () {
                U.toast('🔄 Consultando COP…', 'info', 1200);
                BCV.fetchCopRate().then(function (info) {
                    state.copInfo = info;
                    renderCOPTasa();
                    renderDashboardCOP();
                    U.toast('✅ Tasa COP actualizada', 'ok');
                }).catch(function () {
                    U.toast('⚠️ No se pudo consultar COP', 'warn');
                    renderCOPTasa();
                });
            });
        }

        if (el.bcvGuardarManual) {
            el.bcvGuardarManual.addEventListener('click', function () {
                var raw = el.bcvTasaInput ? el.bcvTasaInput.value.trim() : '';
                var n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
                if (!isFinite(n) || n <= 0) {
                    U.toast('Introduce una tasa BCV válida', 'warn');
                    return;
                }
                if (BCV.setManual(n)) {
                    state.bcvInfo = BCV.getCached();
                    renderBCVTasa();
                    renderDashboardBCV();
                    U.toast('✅ Tasa BCV manual guardada', 'ok');
                } else {
                    U.toast('No se pudo guardar la tasa BCV', 'danger');
                }
            });
        }

        if (el.copGuardarManual) {
            el.copGuardarManual.addEventListener('click', function () {
                var raw = el.copTasaInput ? el.copTasaInput.value.trim() : '';
                var n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
                if (!isFinite(n) || n <= 0) {
                    U.toast('Introduce una tasa COP válida', 'warn');
                    return;
                }
                if (BCV.setManualCop(n)) {
                    state.copInfo = BCV.getCachedCop();
                    renderCOPTasa();
                    renderDashboardCOP();
                    U.toast('✅ Tasa COP manual guardada', 'ok');
                } else {
                    U.toast('No se pudo guardar la tasa COP', 'danger');
                }
            });
        }

        var cachedBcv = BCV.getCached();
        if (cachedBcv && !cachedBcv.manual) {
            state.bcvInfo = cachedBcv;
            renderBCVTasa();
            renderDashboardBCV();
        }
        BCV.getRate().then(function (info) {
            state.bcvInfo = info;
            renderBCVTasa();
            renderDashboardBCV();
        }).catch(function () {
            renderBCVTasa();
            renderDashboardBCV();
        });

        var cachedCop = BCV.getCachedCop();
        if (cachedCop && !cachedCop.manual) {
            state.copInfo = cachedCop;
            renderCOPTasa();
            renderDashboardCOP();
        }
        BCV.getCopRate().then(function (info) {
            state.copInfo = info;
            renderCOPTasa();
            renderDashboardCOP();
        }).catch(function () {
            renderCOPTasa();
            renderDashboardCOP();
        });

        state.bcvUnsub = BCV.suscribir(function (snapshot) {
            if (snapshot && snapshot.bcv) {
                state.bcvInfo = snapshot.bcv;
                renderBCVTasa();
                renderDashboardBCV();
            }
            if (snapshot && snapshot.cop) {
                state.copInfo = snapshot.cop;
                renderCOPTasa();
                renderDashboardCOP();
            }
        });
    }

    function aplicarModoBCVUI(modo) {
        state.bcvModo = modo;

        if (el.bcvModoChips) {
            U.$$('.chip', el.bcvModoChips).forEach(function (c) {
                c.classList.toggle('active', c.dataset.bcvModo === modo);
            });
        }

        if (el.bcvGrupoAuto)   el.bcvGrupoAuto.classList.toggle('hidden', modo !== 'auto');
        if (el.bcvGrupoManual) el.bcvGrupoManual.classList.toggle('hidden', modo !== 'manual');

        if (modo === 'manual' && el.bcvTasaInput) {
            var conf = BCV.leerConfigTasas();
            if (conf.tasaManual && conf.tasaManual > 0) {
                el.bcvTasaInput.value = BCV.formatearTasa(conf.tasaManual).replace(' Bs/$', '');
            } else if (state.bcvInfo && state.bcvInfo.rate) {
                el.bcvTasaInput.value = state.bcvInfo.rate.toFixed(2);
            }
        }
    }

    function cambiarModoBCV(nuevoModo) {
        if (nuevoModo === state.bcvModo) return;

        if (nuevoModo === 'manual') {
            var conf = BCV.leerConfigTasas();
            var tasaInicial = (state.bcvInfo && state.bcvInfo.rate)
                ? state.bcvInfo.rate
                : (conf.tasaManual || 0);

            if (tasaInicial > 0) {
                BCV.setManual(tasaInicial);
                if (el.bcvTasaInput) el.bcvTasaInput.value = tasaInicial.toFixed(2);
                state.bcvInfo = BCV.getCached();
                U.toast('Modo BCV manual activado', 'info');
            } else {
                BCV.guardarConfigTasas({ modo: 'manual' });
                U.toast('Introduce la tasa BCV manualmente', 'warn');
            }
        } else {
            BCV.setAuto().then(function (info) {
                if (info) {
                    state.bcvInfo = info;
                    renderBCVTasa();
                    renderDashboardBCV();
                    U.toast('Modo BCV automático activado', 'ok');
                } else {
                    U.toast('Sin conexión al BCV', 'warn');
                    renderBCVTasa();
                }
            });
        }

        aplicarModoBCVUI(nuevoModo);
        renderBCVTasa();
    }

    function renderBCVTasa() {
        if (!el.bcvTasaTxt || !el.bcvTasaInfo) return;

        var info = state.bcvInfo;

        if (!info || !info.rate) {
            el.bcvTasaTxt.textContent = '— Bs/$';
            el.bcvTasaInfo.textContent = 'Sin tasa BCV disponible.';
            return;
        }

        el.bcvTasaTxt.textContent = BCV.formatearTasa(info.rate);

        if (info.manual) {
            el.bcvTasaInfo.innerHTML = '✏️ <strong>Tasa manual</strong> · Guardada por ti';
        } else {
            var fuenteMap = {
                'dolarapi.com': 'dolarapi',
                'pydolarve.org': 'pydolarve'
            };
            var fuente = fuenteMap[info.source] || info.source || '';
            var tiempo = BCV.tiempoDesde ? BCV.tiempoDesde(info.updated) : '';
            el.bcvTasaInfo.innerHTML =
                '🌐 <strong>Auto · BCV</strong>' +
                (fuente ? ' · ' + U.escapeHtml(fuente) : '') +
                (tiempo ? ' · ' + U.escapeHtml(tiempo) : '');
        }
    }

    function aplicarModoCOPUI(modo) {
        state.copModo = modo;

        if (el.copModoChips) {
            U.$$('.chip', el.copModoChips).forEach(function (c) {
                c.classList.toggle('active', c.dataset.copModo === modo);
            });
        }

        if (el.copGrupoAuto)   el.copGrupoAuto.classList.toggle('hidden', modo !== 'auto');
        if (el.copGrupoManual) el.copGrupoManual.classList.toggle('hidden', modo !== 'manual');

        if (modo === 'manual' && el.copTasaInput) {
            var conf = BCV.leerConfigTasas();
            if (conf.tasaManualCop && conf.tasaManualCop > 0) {
                el.copTasaInput.value = conf.tasaManualCop.toFixed(0);
            } else if (state.copInfo && state.copInfo.rate) {
                el.copTasaInput.value = state.copInfo.rate.toFixed(0);
            }
        }
    }

    function cambiarModoCOP(nuevoModo) {
        if (nuevoModo === state.copModo) return;

        if (nuevoModo === 'manual') {
            var conf = BCV.leerConfigTasas();
            var tasaInicial = (state.copInfo && state.copInfo.rate)
                ? state.copInfo.rate
                : (conf.tasaManualCop || 0);

            if (tasaInicial > 0) {
                BCV.setManualCop(tasaInicial);
                if (el.copTasaInput) el.copTasaInput.value = tasaInicial.toFixed(0);
                state.copInfo = BCV.getCachedCop();
                U.toast('Modo COP manual activado', 'info');
            } else {
                BCV.guardarConfigTasas({ modoCop: 'manual' });
                U.toast('Introduce la tasa COP manualmente', 'warn');
            }
        } else {
            BCV.setAutoCop().then(function (info) {
                if (info) {
                    state.copInfo = info;
                    renderCOPTasa();
                    renderDashboardCOP();
                    U.toast('Modo COP automático activado', 'ok');
                } else {
                    U.toast('Sin conexión al COP', 'warn');
                    renderCOPTasa();
                }
            });
        }

        aplicarModoCOPUI(nuevoModo);
        renderCOPTasa();
    }

    function renderCOPTasa() {
        if (!el.copTasaTxt || !el.copTasaInfo) return;

        var info = state.copInfo;

        if (!info || !info.rate) {
            el.copTasaTxt.textContent = '— COP/$';
            el.copTasaInfo.textContent = 'Sin tasa COP disponible.';
            return;
        }

        el.copTasaTxt.textContent = BCV.formatearCop(info.rate);

        if (info.manual) {
            el.copTasaInfo.innerHTML = '✏️ <strong>Tasa manual</strong> · Guardada por ti';
        } else {
            var tiempo = BCV.tiempoDesde ? BCV.tiempoDesde(info.updated) : '';
            el.copTasaInfo.innerHTML =
                '🌐 <strong>Auto · COP</strong>' +
                (info.source ? ' · ' + U.escapeHtml(info.source) : '') +
                (tiempo ? ' · ' + U.escapeHtml(tiempo) : '');
        }
    }

    function renderDashboardBCV() {
        if (!el.dashBcvTasa) return;
        var info = state.bcvInfo;

        if (!info || !info.rate) {
            el.dashBcvTasa.textContent = '— Bs';
            if (el.dashBcvInfo) el.dashBcvInfo.textContent = 'Sin conexión al BCV.';
            return;
        }

        el.dashBcvTasa.textContent = info.rate.toLocaleString('es-VE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' Bs';

        if (el.dashBcvInfo) {
            if (info.manual) {
                el.dashBcvInfo.textContent = 'Tasa fijada manualmente.';
            } else {
                var tiempo = BCV.tiempoDesde ? BCV.tiempoDesde(info.updated) : '';
                el.dashBcvInfo.textContent = 'Actualizada ' + tiempo +
                    (info.source ? ' · ' + info.source : '');
            }
        }
    }

    function renderDashboardCOP() {
        if (!el.dashCopTasa) return;
        var info = state.copInfo;

        if (!info || !info.rate) {
            el.dashCopTasa.textContent = '— COP';
            if (el.dashCopInfo) el.dashCopInfo.textContent = 'Sin conexión al COP.';
            return;
        }

        el.dashCopTasa.textContent = info.rate.toLocaleString('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }) + ' COP';

        if (el.dashCopInfo) {
            if (info.manual) {
                el.dashCopInfo.textContent = 'Tasa fijada manualmente.';
            } else {
                var tiempo = BCV.tiempoDesde ? BCV.tiempoDesde(info.updated) : '';
                el.dashCopInfo.textContent = 'Actualizada ' + tiempo +
                    (info.source ? ' · ' + info.source : '');
            }
        }
    }

    /* ============================================================
       14. IDENTIDAD
       ============================================================ */
    function inicializarIdentidad() {
        var cfg = Store.leerConfig();
        var id  = cfg.identidad || {};
        var op  = cfg.opciones || {};
        var grilla = cfg.grilla || {};

        if (el.identNombre)    el.identNombre.value    = id.nombreRifa || '';
        if (el.identLoteria)   el.identLoteria.value   = id.loteria || '';
        if (el.identMonto)     el.identMonto.value     = id.monto || '';
        if (el.identWhatsApp)  el.identWhatsApp.value  = id.whatsappOrg || '';
        if (el.identNombreOrg) el.identNombreOrg.value = id.nombreOrg || '';
        if (el.identHorario)   el.identHorario.value   = id.horarioAtencion || '';
        if (el.identFecha)     el.identFecha.value     = id.fechaSorteo || '';
        if (el.identHora)      el.identHora.value      = id.horaSorteo || '';
        if (el.identMensaje)   el.identMensaje.value   = id.mensajePredeterminado || '';

        if (el.grillaColumnas) {
            var cols = parseInt(grilla.columnas, 10) || 7;
            el.grillaColumnas.value = String(cols);
        }
        if (el.identMensajeBoleto) {
            el.identMensajeBoleto.value = id.mensajeBoleto || '';
        }
        if (el.identHorasReserva) {
            el.identHorasReserva.value = op.reservaHorasLimite || 48;
        }

        var pm = id.pagoMovil || {};
        if (el.identBanco)        el.identBanco.value        = pm.banco || '';
        if (el.identPagoTelefono) el.identPagoTelefono.value = pm.telefono || '';
        if (el.identPagoCedula)   el.identPagoCedula.value   = pm.cedula || '';
        if (el.identPagoTitular)  el.identPagoTitular.value  = pm.titular || '';

        var nequi = id.nequi || {};
        if (el.identNequiTelefono) el.identNequiTelefono.value = nequi.telefono || '';

        var otro = id.otroPago || {};
        if (el.identOtroTitulo)    el.identOtroTitulo.value    = otro.titulo || '';
        if (el.identOtroContenido) el.identOtroContenido.value = otro.contenido || '';

        if (el.switchPin)      el.switchPin.checked     = !!op.pinActivo;
        if (el.pinValor)       el.pinValor.value        = op.pinValor || '';
        if (el.switchSorteo)   el.switchSorteo.checked  = op.sorteoVerificable !== false;
        if (el.switchInstruc)  el.switchInstruc.checked = op.mostrarInstrucciones !== false;

        // Modo de términos
        var modoTerm = op.modoTerminos || 'auto';
        el.modoTermRadios.forEach(function (r) {
            r.checked = (r.value === modoTerm);
        });
        actualizarModoTermUI();

        el.modoTermRadios.forEach(function (r) {
            r.addEventListener('change', actualizarModoTermUI);
        });

        // Modo de acceso
        var modoAcceso = op.modoAcceso || 'cedula';
        el.modoAccesoRadios.forEach(function (r) {
            r.checked = (r.value === modoAcceso);
        });
        actualizarModoAccesoUI();

        el.modoAccesoRadios.forEach(function (r) {
            r.addEventListener('change', actualizarModoAccesoUI);
        });

        // Cantidad + aleatorio + mezclada
        if (el.opcionesTotalNumeros) {
            el.opcionesTotalNumeros.value = String(op.totalNumeros || 100);
        }
        if (el.switchAleatorio) {
            el.switchAleatorio.checked = !!op.aleatorioActivo;
        }
        if (el.switchGrillaMezclada) {
            el.switchGrillaMezclada.checked = !!op.grillaMezclada;
        }

        actualizarVisibilidadBotonRebarajar();
        if (el.switchGrillaMezclada) {
            el.switchGrillaMezclada.addEventListener('change', actualizarVisibilidadBotonRebarajar);
        }

        // Botón rebarajar
        if (el.btnRebarajarMuestra) {
            el.btnRebarajarMuestra.addEventListener('click', function () {
                if (typeof Store.regenerarMuestraGrilla !== 'function') return;
                var muestra = Store.regenerarMuestraGrilla();
                refrescarPreviewGrilla();
                U.toast('🔀 Muestra regenerada (' + muestra.length + ' números)', 'ok', 2200);
            });
        }

        // Preview grilla
        if (el.btnRefrescarGrillaPreview) {
            el.btnRefrescarGrillaPreview.addEventListener('click', function () {
                refrescarPreviewGrilla();
                U.toast('🔄 Vista previa actualizada', 'info', 1200);
            });
        }
        if (el.grillaPreviewFrame) {
            setTimeout(refrescarPreviewGrilla, 400);
        }

        actualizarGrupoPin();
        if (el.switchPin) el.switchPin.addEventListener('change', actualizarGrupoPin);

        if (el.btnGuardarIdentidad) {
            el.btnGuardarIdentidad.addEventListener('click', guardarIdentidad);
        }
    }

    function actualizarGrupoPin() {
        if (!el.grupoPin || !el.switchPin) return;
        el.grupoPin.classList.toggle('hidden', !el.switchPin.checked);
    }

    function actualizarModoTermUI() {
        el.modoTermCards.forEach(function (card) {
            var radio = card.querySelector('input[type="radio"]');
            card.classList.toggle('activo', radio && radio.checked);
        });
    }

    function actualizarModoAccesoUI() {
        el.modoAccesoCards.forEach(function (card) {
            var radio = card.querySelector('input[type="radio"]');
            card.classList.toggle('activo', radio && radio.checked);
        });
    }

    function actualizarVisibilidadBotonRebarajar() {
        if (!el.btnRebarajarMuestra || !el.switchGrillaMezclada) return;
        if (el.switchGrillaMezclada.checked) {
            el.btnRebarajarMuestra.classList.remove('hidden');
        } else {
            el.btnRebarajarMuestra.classList.add('hidden');
        }
    }

    function refrescarPreviewGrilla() {
        if (!el.grillaPreviewFrame) return;
        el.grillaPreviewFrame.src = 'rifas.html?embed=1&preview=1&t=' + Date.now();
    }

    function guardarIdentidad() {
        var cfg = Store.leerConfig();

        var pinActivo = el.switchPin ? el.switchPin.checked : false;
        var pinValor  = el.pinValor  ? el.pinValor.value.trim() : '';

        if (pinActivo && !/^\d{4}$/.test(pinValor)) {
            U.toast('El PIN debe ser de 4 dígitos', 'warn');
            return;
        }

        var pinAnterior = (cfg.opciones && cfg.opciones.pinValor) || '';
        if (pinValor && pinValor !== pinAnterior) {
            resetearIntentos();
        }

        cfg.identidad = Object.assign({}, cfg.identidad, {
            nombreRifa:      el.identNombre    ? el.identNombre.value.trim()    : '',
            loteria:         el.identLoteria   ? el.identLoteria.value.trim()   : '',
            monto:           el.identMonto     ? el.identMonto.value.trim()     : '',
            whatsappOrg:     el.identWhatsApp  ? el.identWhatsApp.value.trim()  : '',
            nombreOrg:       el.identNombreOrg ? el.identNombreOrg.value.trim() : '',
            horarioAtencion: el.identHorario   ? el.identHorario.value.trim()   : '',
            fechaSorteo:     el.identFecha     ? el.identFecha.value            : '',
            horaSorteo:      el.identHora      ? el.identHora.value             : '',
            mensajePredeterminado: el.identMensaje ? el.identMensaje.value.trim() : '',
            mensajeBoleto:   el.identMensajeBoleto ? el.identMensajeBoleto.value.trim() : '',

            pagoMovil: {
                banco:    el.identBanco        ? el.identBanco.value.trim()        : '',
                telefono: el.identPagoTelefono ? el.identPagoTelefono.value.trim() : '',
                cedula:   el.identPagoCedula   ? el.identPagoCedula.value.trim()   : '',
                titular:  el.identPagoTitular  ? el.identPagoTitular.value.trim()  : ''
            },

            nequi: {
                telefono: el.identNequiTelefono ? el.identNequiTelefono.value.trim() : ''
            },

            otroPago: {
                titulo:    el.identOtroTitulo    ? el.identOtroTitulo.value.trim()    : '',
                contenido: el.identOtroContenido ? el.identOtroContenido.value.trim() : ''
            }
        });

        cfg.grilla = cfg.grilla || {};
        cfg.grilla.columnas = el.grillaColumnas
            ? parseInt(el.grillaColumnas.value, 10) || 7
            : 7;

        var modoTermSeleccionado = 'auto';
        el.modoTermRadios.forEach(function (r) {
            if (r.checked) modoTermSeleccionado = r.value;
        });

        var modoAccesoSeleccionado = 'cedula';
        el.modoAccesoRadios.forEach(function (r) {
            if (r.checked) modoAccesoSeleccionado = r.value;
        });

        var totalNumerosNuevo = el.opcionesTotalNumeros
            ? Store.normalizarTotalNumeros(el.opcionesTotalNumeros.value)
            : 100;

        var totalNumerosAnterior = (cfg.opciones && cfg.opciones.totalNumeros) || 100;
        var cambioTotal = (totalNumerosNuevo !== totalNumerosAnterior);

        var mezcladaNueva = el.switchGrillaMezclada ? !!el.switchGrillaMezclada.checked : false;
        var mezcladaAnterior = !!(cfg.opciones && cfg.opciones.grillaMezclada);
        var cambioMezclada = (mezcladaNueva !== mezcladaAnterior);

        // Actualizar opciones
        cfg.opciones = Object.assign({}, cfg.opciones, {
            pinActivo:           pinActivo,
            pinValor:            pinValor,
            sorteoVerificable:   el.switchSorteo  ? el.switchSorteo.checked  : true,
            mostrarInstrucciones:el.switchInstruc ? el.switchInstruc.checked : true,
            reservaHorasLimite:  el.identHorasReserva
                ? parseInt(el.identHorasReserva.value, 10) || 48
                : 48,
            modoTerminos:        modoTermSeleccionado,
            modoAcceso:          modoAccesoSeleccionado,
            totalNumeros:        totalNumerosNuevo,
            aleatorioActivo:     el.switchAleatorio ? !!el.switchAleatorio.checked : false,
            grillaMezclada:      mezcladaNueva
        });

        // Regenerar muestra si:
        // - Se activó la mezcla
        // - Cambió el total
        // - Cambió el estado de mezclada (on/off)
        if (mezcladaNueva && (cambioMezclada || cambioTotal ||
            !Array.isArray(cfg.opciones.muestraGrilla) ||
            cfg.opciones.muestraGrilla.length !== totalNumerosNuevo)) {
            var ocupados = Store.numerosOcupados(state.registros);
            cfg.opciones.muestraGrilla = Store.generarMuestraGrilla(totalNumerosNuevo, ocupados);
        }

        // Si se desactivó la mezcla, limpiar la muestra
        if (!mezcladaNueva && Array.isArray(cfg.opciones.muestraGrilla) && cfg.opciones.muestraGrilla.length > 0) {
            cfg.opciones.muestraGrilla = [];
        }

        Store.guardarConfig(cfg);
        Theme.aplicarTodo(cfg);

        var msg = '✅ Identidad y configuración guardadas';
        if (cambioTotal) {
            msg += ' · Números: ' + totalNumerosNuevo;
        }
        if (cambioMezclada && mezcladaNueva) {
            msg += ' · Grilla mezclada ON';
        }
        if (cambioMezclada && !mezcladaNueva) {
            msg += ' · Grilla mezclada OFF';
        }

        setTimeout(refrescarPreviewGrilla, 300);
        U.toast(msg, 'ok');
    }

    /* ============================================================
       15. CONTENIDO MD
       ============================================================ */
    function inicializarContenido() {
        if (el.mdSelector) {
            el.mdSelector.addEventListener('change', function () {
                state.mdActual = el.mdSelector.value;
                cargarMdEnEditor();
            });
        }

        U.$$('.md-tool').forEach(function (tool) {
            tool.addEventListener('click', function () {
                insertarMarcadorMd(tool.dataset.md);
            });
        });

        if (el.mdTextarea) {
            el.mdTextarea.addEventListener('input', U.debounce(actualizarPreviewMd, 300));
        }

        if (el.btnMdDescargar) el.btnMdDescargar.addEventListener('click', descargarMdActual);
        if (el.btnMdRecargar)  el.btnMdRecargar.addEventListener('click', cargarMdEnEditor);

        cargarMdEnEditor();
    }

    function cargarMdEnEditor() {
        var archivo = state.mdActual || 'terminos';
        var ruta = 'content/' + archivo + '.md';

        if (el.mdTextarea) el.mdTextarea.value = '';
        if (el.mdPreview) el.mdPreview.innerHTML = '<p class="empty-msg">Cargando…</p>';

        if (U.esFileProtocol()) {
            var fallback = MD.FALLBACKS[archivo] || '';
            if (el.mdTextarea) el.mdTextarea.value = fallback;
            actualizarPreviewMd();
            U.toast('Modo file:// · usando fallback', 'info', 2500);
            return;
        }

        fetch(ruta + '?t=' + Date.now(), { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function (texto) {
                if (el.mdTextarea) el.mdTextarea.value = texto;
                actualizarPreviewMd();
            })
            .catch(function () {
                var fallback = MD.FALLBACKS[archivo] || '';
                if (el.mdTextarea) el.mdTextarea.value = fallback;
                actualizarPreviewMd();
                U.toast('No se pudo cargar el archivo. Usando fallback.', 'warn');
            });
    }

    function actualizarPreviewMd() {
        if (!el.mdPreview || !el.mdTextarea) return;
        var md = el.mdTextarea.value;
        if (!md.trim()) {
            el.mdPreview.innerHTML = '<p class="empty-msg">La vista previa aparecerá aquí.</p>';
            return;
        }
        el.mdPreview.innerHTML = MD.parsear(md);
    }

    function insertarMarcadorMd(tipo) {
        if (!el.mdTextarea) return;
        var ta = el.mdTextarea;
        var start = ta.selectionStart;
        var end   = ta.selectionEnd;
        var sel   = ta.value.substring(start, end);

        var marcador = '';
        if (tipo === 'h1')     marcador = '\n# ' + (sel || 'Título 1') + '\n';
        if (tipo === 'h2')     marcador = '\n## ' + (sel || 'Título 2') + '\n';
        if (tipo === 'h3')     marcador = '\n### ' + (sel || 'Título 3') + '\n';
        if (tipo === 'bold')   marcador = '**' + (sel || 'negrita') + '**';
        if (tipo === 'italic') marcador = '*' + (sel || 'cursiva') + '*';
        if (tipo === 'list')   marcador = '\n- ' + (sel || 'elemento') + '\n';
        if (tipo === 'olist')  marcador = '\n1. ' + (sel || 'elemento') + '\n';
        if (tipo === 'hr')     marcador = '\n---\n';

        ta.value = ta.value.substring(0, start) + marcador + ta.value.substring(end);
        var nuevo = start + marcador.length;
        ta.setSelectionRange(nuevo, nuevo);
        ta.focus();
        actualizarPreviewMd();
    }

    function descargarMdActual() {
        if (!el.mdTextarea) return;
        var contenido = el.mdTextarea.value;
        var archivo = state.mdActual || 'terminos';
        var nombre = archivo + '.md';

        var ok = U.descargarArchivo(nombre, contenido, 'text/markdown;charset=utf-8');
        if (ok) U.toast('Archivo descargado. Reemplaza el original.', 'ok', 4000);
        else U.toast('No se pudo descargar', 'danger');
    }

    /* ============================================================
       16. RESPALDOS
       ============================================================ */
    function inicializarRespaldos() {
        U.$$('[data-accion]').forEach(function (btn) {
            var accion = btn.dataset.accion;
            if (accion === 'backup-json' || accion === 'backup-md' || accion === 'backup-csv') {
                btn.addEventListener('click', function () {
                    ejecutarBackup(accion);
                });
            }
            if (accion === 'venta-manual') {
                btn.addEventListener('click', abrirVentaManual);
            }
            if (accion === 'ir-registros') {
                btn.addEventListener('click', function () {
                    activarTab('registros');
                });
            }
            if (accion === 'ir-recordatorios') {
                btn.addEventListener('click', function () {
                    activarTab('recordatorios');
                });
            }
        });

        if (el.btnRestoreUp && el.restoreFile) {
            el.btnRestoreUp.addEventListener('click', function () {
                el.restoreFile.click();
            });
            el.restoreFile.addEventListener('change', function () {
                var file = el.restoreFile.files && el.restoreFile.files[0];
                if (!file) return;
                procesarRestore(file);
                el.restoreFile.value = '';
            });
        }

        if (el.btnResetReg) {
            el.btnResetReg.addEventListener('click', function () {
                U.confirmar(
                    'Se eliminarán TODOS los registros de números. Esta acción no se puede deshacer.',
                    { titulo: '⚠️ Borrar registros', okText: 'Sí, borrar todo', peligro: true }
                ).then(function (ok) {
                    if (!ok) return;
                    Store.borrarTodo();
                    U.toast('Registros eliminados', 'ok');
                    renderizarRegistros();
                    refrescarDashboard();
                });
            });
        }

        if (el.btnResetConf) {
            el.btnResetConf.addEventListener('click', function () {
                U.confirmar(
                    'Se restaurará la configuración visual a los valores por defecto. Los registros no se tocan.',
                    { titulo: '♻️ Restaurar configuración', okText: 'Sí, restaurar', peligro: true }
                ).then(function (ok) {
                    if (!ok) return;
                    Store.resetearConfig();
                    var cfg = Store.leerConfig();
                    Theme.aplicarTodo(cfg);
                    inicializarApariencia();
                    inicializarIdentidad();
                    inicializarBCV();
                    inicializarLanding();
                    U.toast('Configuración restaurada', 'ok');
                });
            });
        }
    }

    function ejecutarBackup(tipo) {
        var resultado = null;
        if (tipo === 'backup-json') resultado = Store.exportarJSON();
        if (tipo === 'backup-md')   resultado = Store.exportarMarkdown();
        if (tipo === 'backup-csv')  resultado = Store.exportarCSV();
        if (!resultado) return;

        var mime = 'text/plain;charset=utf-8';
        if (tipo === 'backup-json') mime = 'application/json;charset=utf-8';
        if (tipo === 'backup-csv')  mime = 'text/csv;charset=utf-8';

        var ok = U.descargarArchivo(resultado.nombre, resultado.contenido, mime);
        if (ok) U.toast('📥 Respaldo descargado', 'ok', 3000);
        else    U.toast('No se pudo descargar el respaldo', 'danger');
    }

    function procesarRestore(file) {
        var modo = el.restoreModo ? el.restoreModo.value : 'reemplazar';

        U.confirmar(
            'Modo: ' + (modo === 'reemplazar' ? 'reemplazar todo' : 'fusionar') + '. ¿Continuar?',
            { titulo: '📥 Restaurar respaldo', okText: 'Sí, restaurar' }
        ).then(function (ok) {
            if (!ok) return;

            Store.importarDesdeArchivo(file, { modo: modo })
                .then(function (res) {
                    if (!res.ok) {
                        U.toast(res.error || 'Error al importar', 'danger', 5000);
                        return;
                    }
                    U.toast('✅ Importados ' + res.importados + ' registros. Total: ' + res.total,
                        'ok', 4000);
                    renderizarRegistros();
                    refrescarDashboard();
                    inicializarIdentidad();
                    inicializarApariencia();
                    inicializarLanding();
                })
                .catch(function (err) {
                    U.warn('Error restore:', err);
                    U.toast('Error al procesar el archivo', 'danger');
                });
        });
    }

    /* ============================================================
       17. ENLACES
       ============================================================ */
    function inicializarEnlaces() {
        if (el.urlIndex)    el.urlIndex.value    = U.urlHermana('index.html');
        if (el.urlRifa)     el.urlRifa.value     = U.urlHermana('rifas.html');
        if (el.urlPremios)  el.urlPremios.value  = U.urlHermana('premios.html');
        if (el.urlBoleto)   el.urlBoleto.value   = U.urlHermana('boleto.html');
        if (el.urlTerminos) el.urlTerminos.value = U.urlHermana('terminos.html');
        if (el.urlMotivo)   el.urlMotivo.value   = U.urlHermana('motivo.html');
        if (el.urlCartel)   el.urlCartel.value   = U.urlHermana('cartel.html');

        U.$$('[data-copy]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var inputId = btn.dataset.copy;
                var input = U.$('#' + inputId);
                if (!input) return;
                U.copiar(input.value).then(function (ok) {
                    U.toast(ok ? '✅ Enlace copiado' : 'Copia manualmente', ok ? 'ok' : 'warn');
                });
            });
        });

        if (el.btnCompartirWa) {
            el.btnCompartirWa.addEventListener('click', function () {
                var cfg = Store.leerConfig();
                var url = el.urlIndex ? el.urlIndex.value : (el.urlRifa ? el.urlRifa.value : '');
                var msg = '🎟️ *' + (cfg.identidad.nombreRifa || 'Rifa') + '*\n\n' +
                          'Te invito a participar. Cada número vale ' +
                          (cfg.identidad.monto || '$5') + '.\n\n' +
                          '🎲 Lotería: ' + (cfg.identidad.loteria || 'Chance A') + '\n\n' +
                          '👉 ' + url;

                global.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
            });
        }

        if (el.btnVerLanding) {
            el.btnVerLanding.addEventListener('click', function () {
                abrirIframe('index.html', '🏠 Landing');
            });
        }
        if (el.btnVerRifa) {
            el.btnVerRifa.addEventListener('click', function () {
                abrirIframe('rifas.html?embed=1', '🎟️ Rifas');
            });
        }
        if (el.btnVerPremios) {
            el.btnVerPremios.addEventListener('click', function () {
                abrirIframe('premios.html?embed=1', '🏆 Premios');
            });
        }
        if (el.btnVerBoleto) {
            el.btnVerBoleto.addEventListener('click', function () {
                abrirIframe('boleto.html?embed=1', '🔎 Boleto');
            });
        }
        if (el.btnVerTerminos) {
            el.btnVerTerminos.addEventListener('click', function () {
                abrirIframe('terminos.html?embed=1', '📜 Términos');
            });
        }
        if (el.btnVerCartel) {
            el.btnVerCartel.addEventListener('click', function () {
                abrirIframe('cartel.html', '🖼️ Cartel');
            });
        }
        if (el.btnAbrirCartel) {
            el.btnAbrirCartel.addEventListener('click', function () {
                global.open(U.urlHermana('cartel.html'), '_blank', 'noopener');
            });
        }

        if (el.btnCerrarIframe) el.btnCerrarIframe.addEventListener('click', cerrarIframe);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') cerrarIframe();
        });
        global.addEventListener('message', function (e) {
            if (e && e.data && e.data.tipo === 'cerrar-embed') cerrarIframe();
        });
    }

    function abrirIframe(src, titulo) {
        if (!el.iframeOverlay || !el.iframeView) return;
        if (el.iframeTitulo) el.iframeTitulo.textContent = titulo || 'Vista integrada';
        el.iframeView.src = src;
        el.iframeOverlay.hidden = false;
        document.body.classList.add('no-scroll');
    }

    function cerrarIframe() {
        if (!el.iframeOverlay || !el.iframeView) return;
        el.iframeOverlay.hidden = true;
        el.iframeView.src = 'about:blank';
        document.body.classList.remove('no-scroll');
    }

    /* ============================================================
       18. FAB Venta Manual
       ============================================================ */
    function inicializarFab() {
        if (el.fabVenta) el.fabVenta.addEventListener('click', abrirVentaManual);
    }

    function abrirVentaManual() {
        var html = [
            '<div class="modal-grabber"></div>',
            '<div class="modal-title">➕ Venta Manual</div>',
            '<div class="modal-subtitle">Registrar un número vendido en persona</div>',
            '<div class="input-group">',
                '<label>Número</label>',
                '<input type="tel" class="input-field" id="manual-num" maxlength="3" inputmode="numeric">',
            '</div>',
            '<div class="input-group">',
                '<label>Nombre</label>',
                '<input type="text" class="input-field" id="manual-nombre" maxlength="80">',
            '</div>',
            '<div class="input-group">',
                '<label>Cédula (opcional)</label>',
                '<input type="text" class="input-field" id="manual-cedula" maxlength="12">',
            '</div>',
            '<div class="input-group">',
                '<label>Clave de 4 dígitos (opcional)</label>',
                '<input type="tel" class="input-field" id="manual-clave" maxlength="4" inputmode="numeric">',
            '</div>',
            '<div class="input-group">',
                '<label>Teléfono</label>',
                '<input type="tel" class="input-field" id="manual-telefono" maxlength="16" inputmode="tel">',
            '</div>',
            '<div class="input-group">',
                '<label>Estado</label>',
                '<select class="select-field" id="manual-estado">',
                    '<option value="pagado">Pagado</option>',
                    '<option value="apartado" selected>Apartado</option>',
                '</select>',
            '</div>',
            '<button type="button" class="btn-accion" id="manual-guardar">✅ Registrar venta</button>',
            '<button type="button" class="btn-accion btn-ghost" id="manual-cancelar">Cancelar</button>'
        ].join('');

        U.abrirModal(html);

        U.$('#manual-cancelar').addEventListener('click', U.cerrarModal);
        U.$('#manual-guardar').addEventListener('click', ejecutarVentaManual);
    }

    function ejecutarVentaManual() {
        var cfg = Store.leerConfig();
        var total = (cfg.opciones && cfg.opciones.totalNumeros) || 100;
        var modoAcceso = (cfg.opciones && cfg.opciones.modoAcceso) || 'cedula';

        var num      = U.normalizarNumeroSegunTotal(U.$('#manual-num').value, total);
        var nombre   = U.$('#manual-nombre').value.trim();
        var cedula   = U.$('#manual-cedula').value.trim();
        var clave    = U.$('#manual-clave').value.trim();
        var telefono = U.$('#manual-telefono').value.trim();
        var estado   = U.$('#manual-estado').value;

        if (!U.esNumeroRifaValidoSegunTotal(num, total)) {
            U.toast('Número inválido (0-' + (total - 1) + ')', 'warn');
            return;
        }
        if (nombre.length < 3) { U.toast('Nombre inválido', 'warn'); return; }

        if (modoAcceso === 'cedula' && !U.esCedulaValida(cedula)) {
            U.toast('Cédula inválida en modo cédula obligatoria', 'warn');
            return;
        }
        if (cedula && !U.esCedulaValida(cedula)) {
            U.toast('Cédula inválida', 'warn');
            return;
        }
        if (clave && !U.validarClave4(clave)) {
            U.toast('La clave debe ser de 4 dígitos', 'warn');
            return;
        }
        if (!U.esTelefonoValido(telefono)) {
            U.toast('Teléfono inválido', 'warn');
            return;
        }

        Store.cargarRegistros(true).then(function (actuales) {
            var ocupados = Store.numerosOcupados(actuales);
            if (ocupados.has(num)) {
                U.toast('El número ' + num + ' ya está ocupado', 'warn');
                return;
            }

            var fecha = new Date().toISOString();
            var horas = (cfg.opciones && cfg.opciones.reservaHorasLimite) || 48;
            var fechaLimite = new Date(new Date(fecha).getTime() + horas * 3600000).toISOString();

            var montoStr = (cfg.identidad && cfg.identidad.monto) || '$5';
            var limpio = String(montoStr).replace(/[^0-9.,]/g, '').replace(',', '.');
            var montoUnit = parseFloat(limpio) || 0;

            var cedulaFormateada = cedula ? U.formatearCedula(cedula) : null;

            var reg = {
                id: U.generarId(),
                numero: num,
                nombre: nombre,
                cedula: cedulaFormateada,
                telefono: telefono,
                clave: clave || null,
                sinClave: !clave && !!cedulaFormateada,
                estado: estado,
                metodoPago: 'manual',
                boleto: Store.generarCodigoBoleto(
                    nombre, num, cedula || '', fecha,
                    (cfg.identidad && cfg.identidad.loteria) || 'Chance A'
                ),
                aceptoTerminos: true,
                versionTerminos: cfg.terminosVersion || 'v1',
                notas: 'Registrado desde panel admin',
                fecha: fecha,
                fechaLimite: fechaLimite,
                recordatorioActivo: false,
                autorizaRecordatorio: false,
                totalUsd: montoUnit,
                totalBs: null,
                totalCop: null,
                montoUnitUsd: montoUnit
            };

            Store.crearRegistros([reg]).then(function () {
                U.cerrarModal();
                U.toast('✅ Venta registrada', 'ok');
                renderizarRegistros();
                refrescarDashboard();
                sincronizarMuestraDespuesDeCambio();
            });
        });
    }

    /* ============================================================
       19. INIT
       ============================================================ */
    function init() {
        if (state.inicializado) return;
        state.inicializado = true;

        cachearElementos();

        try {
            document.title = 'Admin · ' + Theme.nombreRifa();
        } catch (e) { /* silent */ }

        inicializarPIN();
        inicializarTabs();
        inicializarRegistros();
        inicializarRecordatorios();
        inicializarLanding();
        inicializarApariencia();
        inicializarPlantillas();
        inicializarPremios();
        inicializarIdentidad();
        inicializarBCV();
        inicializarContenido();
        inicializarRespaldos();
        inicializarEnlaces();
        inicializarFab();

        refrescarDashboard();

        U.log('Admin inicializado correctamente');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ============================================================
       20. API PÚBLICA
       ============================================================ */
    var Admin = {
        init:               init,
        activarTab:         activarTab,
        refrescarDashboard: refrescarDashboard,
        renderizarRegistros:renderizarRegistros,
        renderizarRecordatorios: renderizarRecordatorios,
        abrirVentaManual:   abrirVentaManual,
        recordarATodos:     recordarATodos,
        guardarLanding:     guardarLanding,
        refrescarPreviewLanding: refrescarPreviewLanding,
        refrescarPreviewGrilla:  refrescarPreviewGrilla,
        resetearIntentosPIN: resetearIntentos,
        leerEstadoPIN:       leerEstadoIntentos
    };

    global.Admin = Admin;

})(typeof window !== 'undefined' ? window : this);