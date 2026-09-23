/* ============================================================
   MOTOR DE RIFAS · assets/js/rifas.js
   Grilla dinámica + 3 modos de acceso + aleatorio puro
   + grilla mezclada (muestra persistida C2)
   + modal simplificado (captura movida a boleto.html)
   Expone window.Rifas
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
    var KEY_TOTAL_USD = 'rifa_total_usd';
    var KEY_TOTAL_BS  = 'rifa_total_bs';
    var KEY_TOTAL_COP = 'rifa_total_cop';
    var KEY_RECARGAR  = 'rifa_recargar';

    var COLUMNAS_DEFECTO   = 7;
    var MAX_BUYERS_VISIBLES = 12;

    var MODOS_TERM   = ['auto', 'boton', 'checkbox'];
    var MODOS_ACCESO = ['cedula', 'clave', 'publico'];

    var MAX_ALEATORIOS_SUAVE = 5;

    /* ============================================================
       2. ESTADO LOCAL
       ============================================================ */
    var state = {
        registros:    [],
        porNumero:    new Map(),
        seleccion:    [],
        refsCeldas:   new Map(),
        bcvInfo:      null,
        copInfo:      null,
        bcvUnsub:     null,

        total:           100,
        modoAcceso:      'cedula',
        modoTerminos:    'auto',
        aleatorioActivo: false,
        grillaMezclada:  false,

        ordenGrilla:     [],

        aleatoriosAgregados: 0,

        inicializado: false
    };

    /* ============================================================
       3. REFERENCIAS DOM
       ============================================================ */
    var el = {};

    function cachearElementos() {
        el.grid             = U.$('#grid');
        el.anclaGrilla      = U.$('#ancla-grilla');
        el.avisoTerminos    = U.$('#aviso-terminos');
        el.buyersList       = U.$('#buyers-list');
        el.progressFill     = U.$('#progress-fill');
        el.badgeTotal       = U.$('#badge-total');
        el.btnSorprendeme   = U.$('#btn-sorprendeme');
        el.sorprendemeTit   = U.$('#sorprendeme-titulo');
        el.sorprendemeCont  = U.$('#sorprendeme-contador');

        el.miniBar          = U.$('#mini-bar');
        el.miniResumen      = U.$('#mini-resumen');
        el.miniAdd          = U.$('#mini-add');
        el.miniComprar      = U.$('#mini-comprar');
    }

    /* ============================================================
       4. CONFIG DINÁMICA
       ============================================================ */
    function leerConfigActual() {
        var cfg = Store.leerConfig();
        var op = cfg.opciones || {};

        state.total = Store.normalizarTotalNumeros(op.totalNumeros || 100);
        state.modoAcceso = op.modoAcceso || 'cedula';
        state.modoTerminos = op.modoTerminos || 'auto';
        state.aleatorioActivo = !!op.aleatorioActivo;
        state.grillaMezclada = !!op.grillaMezclada;

        if (MODOS_TERM.indexOf(state.modoTerminos) === -1) {
            state.modoTerminos = 'auto';
        }
        if (MODOS_ACCESO.indexOf(state.modoAcceso) === -1) {
            state.modoAcceso = 'cedula';
        }
    }

    /* ============================================================
       5. PERSISTENCIA
       ============================================================ */
    function guardarSeleccion() {
        try {
            sessionStorage.setItem(KEY_SELECCION, JSON.stringify(state.seleccion));
        } catch (e) { /* silent */ }
    }

    function restaurarSeleccion() {
        try {
            var raw = sessionStorage.getItem(KEY_SELECCION);
            var arr = raw ? JSON.parse(raw) : [];
            if (Array.isArray(arr)) {
                var visibles = new Set(state.ordenGrilla);
                state.seleccion = arr.filter(function (n) {
                    return visibles.has(n);
                });
            }
        } catch (e) { state.seleccion = []; }
    }

    function guardarBorradorForm(data) {
        try {
            var existente = leerBorradorForm() || {};
            var fusion = Object.assign({}, existente, data || {});
            sessionStorage.setItem(KEY_FORM, JSON.stringify(fusion));
        } catch (e) { /* silent */ }
    }

    function leerBorradorForm() {
        try {
            var raw = sessionStorage.getItem(KEY_FORM);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }

    /* ============================================================
       6. APLICAR COLUMNAS
       ============================================================ */
    function aplicarColumnas() {
        var cfg = Store.leerConfig();
        var cols = COLUMNAS_DEFECTO;
        if (cfg && cfg.grilla && cfg.grilla.columnas) {
            cols = parseInt(cfg.grilla.columnas, 10) || COLUMNAS_DEFECTO;
        }
        cols = Math.max(4, Math.min(10, cols));
        document.documentElement.style.setProperty('--cols', cols);
        document.documentElement.style.setProperty('--cols-sm', Math.max(5, cols - 1));
        document.documentElement.style.setProperty('--cols-lg', Math.min(12, cols + 3));
    }

    /* ============================================================
       7. CONSTRUIR ORDEN DE LA GRILLA
       ============================================================ */
    function construirOrdenGrilla() {
        var cfg = Store.leerConfig();
        var op = cfg.opciones || {};

        if (state.grillaMezclada) {
            var muestra = op.muestraGrilla;

            if (!Array.isArray(muestra) || muestra.length === 0) {
                var ocupados = Store.numerosOcupados(state.registros);
                muestra = Store.generarMuestraGrilla(state.total, ocupados);
            }

            state.ordenGrilla = muestra.slice();
            return;
        }

        var arr = [];
        for (var i = 0; i < state.total; i++) {
            arr.push(U.formatearNumeroSegunTotal(i, state.total));
        }
        state.ordenGrilla = arr;
    }

    /* ============================================================
       8. CARGA DE DATOS
       ============================================================ */
    function cargarTodo() {
        el.grid.innerHTML = '<p class="empty-msg">Cargando grilla…</p>';

        return Store.cargarRegistros(true).then(function (registros) {
            state.registros = registros || [];
            state.porNumero = Store.mapaPorNumero(state.registros);

            if (state.grillaMezclada && typeof Store.sincronizarMuestraGrilla === 'function') {
                Store.sincronizarMuestraGrilla();
                var cfg = Store.leerConfig();
                state.total = Store.normalizarTotalNumeros(cfg.opciones.totalNumeros || 100);
            }

            construirOrdenGrilla();

            var visibles = new Set(state.ordenGrilla);
            state.seleccion = state.seleccion.filter(function (num) {
                return visibles.has(num) && !state.porNumero.has(num);
            });

            actualizarBadgeTotal();
            renderGrilla();
            renderBuyers();
            actualizarMiniBar();
            actualizarAvisoTerminos();
            actualizarBotonSorprendeme();

            state.seleccion.forEach(function (num) {
                var refs = state.refsCeldas.get(num);
                if (refs) refs.btn.classList.add('seleccionado');
            });

            return state.registros;
        }).catch(function (err) {
            U.warn('Error cargando registros:', err);
            el.grid.innerHTML = '<p class="empty-msg">⚠️ No se pudieron cargar los datos.</p>';
            return [];
        });
    }

    function actualizarBadgeTotal() {
        if (!el.badgeTotal) return;
        var n = state.ordenGrilla.length || state.total;
        el.badgeTotal.textContent = n + ' números';
    }

    function actualizarBotonSorprendeme() {
        if (!el.btnSorprendeme) return;
        if (state.aleatorioActivo) {
            el.btnSorprendeme.classList.remove('hidden');
            actualizarContadorSorprendeme();
        } else {
            el.btnSorprendeme.classList.add('hidden');
        }
    }

    function actualizarContadorSorprendeme() {
        var n = state.aleatoriosAgregados;

        if (el.sorprendemeCont) {
            if (n > 0) {
                el.sorprendemeCont.hidden = false;
                el.sorprendemeCont.textContent = n;
                el.sorprendemeCont.classList.toggle(
                    'warn',
                    n >= MAX_ALEATORIOS_SUAVE
                );
            } else {
                el.sorprendemeCont.hidden = true;
            }
        }

        if (el.sorprendemeTit) {
            el.sorprendemeTit.textContent = (n > 0)
                ? 'Sorpréndeme · ' + n
                : 'Sorpréndeme';
        }
    }

    /* ============================================================
       9. GRILLA (render)
       ============================================================ */
    function renderGrilla() {
        var frag = document.createDocumentFragment();
        state.refsCeldas = new Map();

        var orden = state.ordenGrilla;

        if (!orden || orden.length === 0) {
            el.grid.innerHTML = '<p class="empty-msg">Sin números disponibles.</p>';
            return;
        }

        for (var i = 0; i < orden.length; i++) {
            var num = orden[i];
            var reg = state.porNumero.get(num);

            var cell = document.createElement('div');
            cell.className = 'num-cell';

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'num-btn';
            btn.textContent = num;
            btn.dataset.num = num;
            btn.setAttribute('aria-label', 'Número ' + num);

            var tag = document.createElement('div');
            tag.className = 'num-tag';

            if (reg) {
                btn.classList.add(reg.estado === 'pagado' ? 'pagado' : 'apartado');
                tag.classList.add(reg.estado);
                tag.textContent = primerNombre(reg.nombre);
                btn.addEventListener('click', hacerHandlerOcupado(num));
            } else {
                tag.classList.add('vacia');
                tag.textContent = '·';
                if (state.seleccion.indexOf(num) !== -1) {
                    btn.classList.add('seleccionado');
                }
                btn.addEventListener('click', hacerHandlerLibre(num));
            }

            cell.appendChild(btn);
            cell.appendChild(tag);
            frag.appendChild(cell);

            state.refsCeldas.set(num, { btn: btn, tag: tag, cell: cell });
        }

        el.grid.innerHTML = '';
        el.grid.appendChild(frag);
    }

    function primerNombre(nombreCompleto) {
        if (!nombreCompleto) return '—';
        var partes = String(nombreCompleto).trim().split(/\s+/);
        var nombre = partes[0] || '—';
        if (nombre.length > 7) nombre = nombre.slice(0, 6) + '…';
        return nombre;
    }

    /* ============================================================
       10. LISTA DE COMPRADORES
       ============================================================ */
    function renderBuyers() {
        if (!el.buyersList) return;

        var ordenados = state.registros.slice().sort(function (a, b) {
            return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });

        if (ordenados.length === 0) {
            el.buyersList.innerHTML =
                '<p class="empty-msg">Aún no hay números apartados. ¡Sé el primero!</p>';
            return;
        }

        var mostrar = ordenados.slice(0, MAX_BUYERS_VISIBLES);

        el.buyersList.innerHTML = mostrar.map(function (r) {
            var esPagado = r.estado === 'pagado';
            var clase = esPagado ? 'pagado' : 'apartado';
            var badgeTxt = esPagado ? '✓ Pagado' : '⏳ Apartado';
            var fecha = U.fechaCorta(r.fecha);

            return [
                '<div class="buyer-item ' + clase + '">',
                    '<span class="buyer-num ' + clase + '">' +
                        U.escapeHtml(r.numero) +
                    '</span>',
                    '<div class="buyer-info">',
                        '<span class="buyer-nombre">' +
                            U.escapeHtml(r.nombre || '—') +
                        '</span>',
                        '<span class="buyer-fecha">' + U.escapeHtml(fecha) + '</span>',
                    '</div>',
                    '<span class="buyer-badge ' + clase + '">' +
                        badgeTxt +
                    '</span>',
                '</div>'
            ].join('');
        }).join('');

        if (ordenados.length > MAX_BUYERS_VISIBLES) {
            var restantes = ordenados.length - MAX_BUYERS_VISIBLES;
            el.buyersList.innerHTML +=
                '<p class="empty-msg" style="padding: 8px 0; font-size:0.72rem;">' +
                '+ ' + restantes + ' más…' +
                '</p>';
        }
    }

    /* ============================================================
       11. HANDLERS
       ============================================================ */
    function hacerHandlerLibre(num) {
        return function () { toggleSeleccion(num); };
    }

    function toggleSeleccion(num) {
        var idx = state.seleccion.indexOf(num);
        var refs = state.refsCeldas.get(num);
        if (!refs) return;

        if (idx === -1) {
            state.seleccion.push(num);
            refs.btn.classList.add('seleccionado');
        } else {
            state.seleccion.splice(idx, 1);
            refs.btn.classList.remove('seleccionado');
        }

        state.seleccion.sort(function (a, b) {
            return parseInt(a, 10) - parseInt(b, 10);
        });
        guardarSeleccion();
        actualizarMiniBar();
    }

    function hacerHandlerOcupado(num) {
        return function () {
            var reg = state.porNumero.get(num);
            if (!reg) return;
            mostrarInfoNumero(reg);
        };
    }

    /* ============================================================
       12. MODAL · Número ocupado
       ============================================================ */
    function mostrarInfoNumero(reg) {
        var esPagado = reg.estado === 'pagado';
        var cfg = Store.leerConfig();
        var monto = (cfg.identidad && cfg.identidad.monto) || '$5';

        var html = [
            '<div class="modal-grabber"></div>',
            '<div class="modal-title">Número ' + U.escapeHtml(reg.numero) + '</div>',
            '<div class="modal-subtitle">' +
                (esPagado ? '✅ Comprado y pagado' : '⏳ Apartado / reservado') +
            '</div>',
            '<div class="info-line"><span>Nombre</span><span>' +
                U.escapeHtml(reg.nombre) + '</span></div>',
            (reg.cedula ?
                '<div class="info-line"><span>Cédula</span><span>' +
                U.escapeHtml(enmascararCedula(reg.cedula)) + '</span></div>' : ''),
            '<div class="info-line"><span>Estado</span><span class="' +
                (esPagado ? 'text-ok' : 'text-warn') + '">' +
                U.escapeHtml((reg.estado || '').toUpperCase()) + '</span></div>',
            '<div class="info-line"><span>Monto</span><span>' +
                U.escapeHtml(monto) + '</span></div>',
            '<div class="info-line"><span>Fecha</span><span>' +
                U.escapeHtml(U.fechaHumana(reg.fecha)) + '</span></div>',
            '<button type="button" class="btn-accion btn-blue" id="modal-num-consultar" ' +
                'style="margin-top:6px;">🔎 Consultar mi boleto</button>',
            '<button type="button" class="btn-accion btn-ghost" id="modal-num-cerrar">Cerrar</button>'
        ].join('');

        U.abrirModal(html);

        var btnConsultar = U.$('#modal-num-consultar');
        var btnCerrar = U.$('#modal-num-cerrar');

        if (btnConsultar) {
            btnConsultar.addEventListener('click', function () {
                U.cerrarModal();
                location.href = 'boleto.html';
            });
        }
        if (btnCerrar) btnCerrar.addEventListener('click', U.cerrarModal);
    }

    function enmascararCedula(cedula) {
        var d = U.soloDigitos(cedula);
        if (d.length < 5) return U.formatearCedula(cedula) || '—';
        return 'V-' + d.slice(0, 2) + '.***.***.' + d.slice(-2);
    }

    /* ============================================================
       13. MINI BARRA
       ============================================================ */
    function actualizarMiniBar() {
        if (!el.miniBar) return;
        var n = state.seleccion.length;

        if (n === 0) {
            el.miniBar.hidden = true;
            document.body.classList.remove('con-reserva');
            return;
        }

        el.miniBar.hidden = false;
        document.body.classList.add('con-reserva');

        if (el.miniResumen) {
            var texto;
            if (n === 1) {
                texto = '1 número · ' + state.seleccion[0];
            } else if (n <= 4) {
                texto = n + ' números · ' + state.seleccion.join(', ');
            } else {
                texto = n + ' números · ' + state.seleccion.slice(0, 3).join(', ') +
                        '… (+' + (n - 3) + ')';
            }
            el.miniResumen.textContent = texto;
        }
    }

    /* ============================================================
       14. CÁLCULOS
       ============================================================ */
    function calcularTotalUSD() {
        var cfg = Store.leerConfig();
        var montoStr = (cfg.identidad && cfg.identidad.monto) || '$5';
        var limpio = String(montoStr).replace(/[^0-9.,]/g, '').replace(',', '.');
        var monto = parseFloat(limpio) || 0;
        return monto * state.seleccion.length;
    }

    function formatearUSD(n) {
        return '$' + Number(n || 0).toFixed(2);
    }

    function formatearBs(n) {
        if (!isFinite(n) || n <= 0) return '';
        return n.toLocaleString('es-VE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatearCOP(n) {
        if (!isFinite(n) || n <= 0) return '';
        return n.toLocaleString('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }

    /* ============================================================
       15. TÉRMINOS
       ============================================================ */
    function construirBloqueTerminos(modo, yaAcepto, fechaAcepto) {
        if (yaAcepto) {
            return [
                '<div class="terminos-previos">',
                    '<span class="terminos-previos-icon">✓</span>',
                    '<span>Aceptaste los términos el ' +
                        U.escapeHtml(U.fechaHumana(fechaAcepto)) +
                    '</span>',
                '</div>'
            ].join('');
        }

        if (modo === 'auto') {
            return [
                '<p class="terminos-microcopy">',
                    'Al confirmar aceptas los ' +
                    '<a href="terminos.html" target="_blank" rel="noopener">' +
                        'términos y condiciones' +
                    '</a>' +
                    ' de participación.',
                '</p>'
            ].join('');
        }

        if (modo === 'boton') {
            return [
                '<p class="terminos-microcopy">',
                    'Al pulsar el botón aceptas los ' +
                    '<a href="terminos.html" target="_blank" rel="noopener">' +
                        'términos y condiciones' +
                    '</a>' +
                    '.',
                '</p>'
            ].join('');
        }

        return [
            '<label class="check-terminos" for="compra-acepta-term">',
                '<input type="checkbox" id="compra-acepta-term">',
                '<span>He leído y acepto los ' +
                    '<a href="terminos.html" target="_blank" rel="noopener">' +
                        'términos y condiciones' +
                    '</a>' +
                    ' de participación en esta rifa.</span>',
            '</label>'
        ].join('');
    }

    /* ============================================================
       16. MODAL DE COMPRA (simplificado · captura movida a boleto.html)
       ============================================================
       Este modal ahora SOLO:
       - Muestra los números seleccionados
       - Muestra los totales (USD / Bs / COP)
       - Pide aceptar términos (según modo)
       - Botón "Continuar" → guarda selección y va a boleto.html

       La captura de nombre / cédula / clave / teléfono se hace
       toda en boleto.html (panel-registro). Una sola pantalla.
       ============================================================ */
    function abrirModalCompra() {
        var n = state.seleccion.length;
        if (n === 0) {
            U.toast('Selecciona al menos un número.', 'warn');
            return;
        }

        var modoTerm = state.modoTerminos;

        var totalUSD = calcularTotalUSD();
        var totalBsGuardado = '';
        try { totalBsGuardado = sessionStorage.getItem(KEY_TOTAL_BS) || ''; } catch (e) {}

        var terminosPrevios = Store.leerTerminosAceptados();
        var yaAcepto = !!(terminosPrevios && terminosPrevios.version);

        var chipsHTML = state.seleccion.map(function (num) {
            return '<span class="compra-chip">' + U.escapeHtml(num) + '</span>';
        }).join('');

        var terminosHTML = construirBloqueTerminos(
            modoTerm, yaAcepto, terminosPrevios && terminosPrevios.fecha
        );

        var html = [
            '<div class="modal-grabber"></div>',
            '<div class="modal-title">Tus números</div>',
            '<div class="modal-subtitle">' +
                n + ' número' + (n === 1 ? '' : 's') +
                ' seleccionado' + (n === 1 ? '' : 's') +
            '</div>',

            '<div class="compra-seccion">',
                '<span class="compra-seccion-label">🎟️ Números elegidos</span>',
                '<div class="compra-chips">' + chipsHTML + '</div>',
            '</div>',

            '<div class="compra-seccion">',
                '<span class="compra-seccion-label">💰 Total de compra</span>',

                '<div class="compra-total-row">',
                    '<span class="compra-total-label">💵 En dólares</span>',
                    '<strong class="compra-total-valor" id="compra-total-usd">' +
                        formatearUSD(totalUSD) +
                    '</strong>',
                '</div>',

                '<div class="compra-total-row">',
                    '<span class="compra-total-label">💴 En bolívares (BCV)</span>',
                    '<input type="tel" inputmode="decimal" ',
                        'class="input-field compra-input-bs" ',
                        'id="compra-total-bs" ',
                        'placeholder="Calculando…" ',
                        'value="' + U.escapeHtml(totalBsGuardado) + '">',
                '</div>',

                '<div class="compra-total-row">',
                    '<span class="compra-total-label">🇨🇴 En pesos (COP)</span>',
                    '<strong class="compra-total-valor" id="compra-total-cop" ',
                        'style="color:var(--sky);">Calculando…</strong>',
                '</div>',

                '<div class="compra-tasa-info" id="compra-tasa-info">',
                    '<span class="compra-tasa-loading">⏳ Obteniendo tasas…</span>',
                '</div>',
            '</div>',

            '<div class="modal-aviso" style="text-align:center;">',
                '➡️ En el siguiente paso completarás tus datos y confirmarás la reserva.',
            '</div>',

            terminosHTML,

            '<button type="button" class="btn-accion" id="compra-continuar">' +
                '➡️ Continuar' +
            '</button>',
            '<button type="button" class="btn-accion btn-ghost" id="compra-cancelar">',
                'Cancelar',
            '</button>'
        ].join('');

        U.abrirModal(html, { bloqueante: false });

        var inputBs       = U.$('#compra-total-bs');
        var copValor      = U.$('#compra-total-cop');
        var tasaInfo      = U.$('#compra-tasa-info');
        var btnContinuar  = U.$('#compra-continuar');
        var btnCancelar   = U.$('#compra-cancelar');
        var checkTerminos = U.$('#compra-acepta-term');

        var bsEditadoPorUsuario = false;

        function validarTerminos() {
            if (modoTerm !== 'checkbox') return true;
            if (yaAcepto) return true;
            return checkTerminos ? checkTerminos.checked : false;
        }

        function aplicarTasas() {
            if (!BCV) return;

            var guardadoEnSesion = totalBsGuardado && totalBsGuardado.trim() !== '';
            if (guardadoEnSesion && !bsEditadoPorUsuario) {
                if (inputBs.value.trim() === '') {
                    inputBs.value = totalBsGuardado;
                }
            }

            var promesas = [
                BCV.getRate().catch(function () { return null; }),
                BCV.getCopRate().catch(function () { return null; })
            ];

            Promise.all(promesas).then(function (resultados) {
                var infoBcv = resultados[0];
                var infoCop = resultados[1];

                state.bcvInfo = infoBcv;
                state.copInfo = infoCop;

                if (infoBcv && infoBcv.rate) {
                    var totalBsCalc = BCV.usdABS(totalUSD, infoBcv.rate);
                    if (!bsEditadoPorUsuario) {
                        inputBs.value = formatearBs(totalBsCalc);
                        try {
                            sessionStorage.setItem(KEY_TOTAL_BS, inputBs.value.trim());
                        } catch (e) {}
                    }
                } else {
                    inputBs.placeholder = 'Opcional';
                }

                if (infoCop && infoCop.rate && copValor) {
                    var totalCopCalc = BCV.usdACOP(totalUSD, infoCop.rate);
                    copValor.textContent = '$' + totalUSD.toFixed(2) + ' ≈ ' +
                        formatearCOP(totalCopCalc) + ' COP';
                } else if (copValor) {
                    copValor.textContent = '—';
                }

                mostrarTasaInfo(infoBcv, infoCop);
            });
        }

        function mostrarTasaInfo(infoBcv, infoCop) {
            if (!tasaInfo) return;

            var partes = [];

            if (infoBcv && infoBcv.rate) {
                var fuenteBcv = infoBcv.manual ? 'manual' : (infoBcv.source || '');
                partes.push('🇻🇪 1$ = ' + BCV.formatearTasa(infoBcv.rate) +
                    (fuenteBcv ? ' · ' + fuenteBcv : ''));
            }
            if (infoCop && infoCop.rate) {
                var fuenteCop = infoCop.manual ? 'manual' : (infoCop.source || '');
                partes.push('🇨🇴 1$ = ' + BCV.formatearCop(infoCop.rate) +
                    (fuenteCop ? ' · ' + fuenteCop : ''));
            }

            if (partes.length === 0) {
                tasaInfo.innerHTML =
                    '<span class="compra-tasa-error">⚠️ Sin conexión a las tasas. ' +
                    'Introduce los montos manualmente.</span>';
                return;
            }

            tasaInfo.innerHTML = '<span class="compra-tasa-detalle">' +
                U.escapeHtml(partes.join(' · ')) + '</span>';
        }

        if (checkTerminos) {
            checkTerminos.addEventListener('change', function () {
                if (btnContinuar) btnContinuar.disabled = !validarTerminos();
            });
        }

        if (inputBs) {
            inputBs.addEventListener('input', function () {
                bsEditadoPorUsuario = true;
                try { sessionStorage.setItem(KEY_TOTAL_BS, inputBs.value.trim()); } catch (e) {}
            });

            inputBs.addEventListener('blur', function () {
                var raw = inputBs.value.trim();
                if (raw === '') {
                    bsEditadoPorUsuario = false;
                    if (state.bcvInfo && state.bcvInfo.rate) {
                        var calc = BCV.usdABS(totalUSD, state.bcvInfo.rate);
                        inputBs.value = formatearBs(calc);
                        try {
                            sessionStorage.setItem(KEY_TOTAL_BS, inputBs.value.trim());
                        } catch (e) {}
                    }
                    return;
                }
                var n2 = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
                if (isFinite(n2) && n2 > 0) {
                    inputBs.value = formatearBs(n2);
                    try {
                        sessionStorage.setItem(KEY_TOTAL_BS, inputBs.value.trim());
                    } catch (e) {}
                }
            });
        }

        if (btnCancelar) btnCancelar.addEventListener('click', U.cerrarModal);

        if (btnContinuar) {
            btnContinuar.disabled = !validarTerminos();

            btnContinuar.addEventListener('click', function () {
                if (!validarTerminos()) {
                    U.toast('Debes aceptar los términos para continuar.', 'warn');
                    return;
                }

                if (!Store.leerTerminosAceptados()) {
                    var cfgActual = Store.leerConfig();
                    Store.guardarTerminosAceptados(cfgActual.terminosVersion || 'v1');
                }

                var copTxt = '';
                if (state.copInfo && state.copInfo.rate) {
                    var copCalc = BCV.usdACOP(totalUSD, state.copInfo.rate);
                    copTxt = formatearCOP(copCalc);
                }

                try {
                    sessionStorage.setItem(KEY_TOTAL_USD, String(totalUSD));
                    sessionStorage.setItem(KEY_TOTAL_BS, inputBs ? inputBs.value.trim() : '');
                    sessionStorage.setItem(KEY_TOTAL_COP, copTxt);
                } catch (e) { /* silent */ }

                btnContinuar.disabled = true;
                btnContinuar.textContent = '⏳ Verificando…';

                Store.cargarRegistros(true).then(function (actuales) {
                    var ocupados = Store.numerosOcupados(actuales);
                    var conflicto = state.seleccion.filter(function (num) {
                        return ocupados.has(num);
                    });

                    if (conflicto.length > 0) {
                        U.cerrarModal();
                        U.toast(
                            'Los números ' + conflicto.join(', ') + ' ya fueron apartados.',
                            'danger', 5000
                        );
                        state.seleccion = state.seleccion.filter(function (num) {
                            return !ocupados.has(num);
                        });
                        guardarSeleccion();
                        return cargarTodo();
                    }

                    guardarSeleccion();
                    U.cerrarModal();
                    setTimeout(function () {
                        location.href = 'boleto.html?accion=registrar';
                    }, 200);
                }).catch(function () {
                    btnContinuar.disabled = false;
                    btnContinuar.textContent = '➡️ Continuar';
                    U.toast('Error verificando disponibilidad. Intenta de nuevo.', 'danger');
                });
            });
        }

        aplicarTasas();
    }

    /* ============================================================
       17. ALEATORIO · 1 click = 1 número al azar
       ============================================================ */
    function agregarAleatorio() {
        if (!state.aleatorioActivo) return;

        var ocupados = Store.numerosOcupados(state.registros);
        var seleccionadosSet = new Set(state.seleccion);

        var elegibles = state.ordenGrilla.filter(function (num) {
            return !ocupados.has(num) && !seleccionadosSet.has(num);
        });

        if (elegibles.length === 0) {
            U.toast('No quedan números libres visibles.', 'warn');
            return;
        }

        var idx = Math.floor(Math.random() * elegibles.length);
        var elegido = elegibles[idx];

        state.seleccion.push(elegido);
        state.seleccion.sort(function (a, b) {
            return parseInt(a, 10) - parseInt(b, 10);
        });

        var refs = state.refsCeldas.get(elegido);
        if (refs) refs.btn.classList.add('seleccionado');

        state.aleatoriosAgregados++;
        guardarSeleccion();
        actualizarMiniBar();
        actualizarContadorSorprendeme();

        if (refs && refs.btn) {
            refs.btn.style.animation = 'none';
            void refs.btn.offsetWidth;
            refs.btn.style.animation = 'numPulse 0.55s ease';
        }

        if (state.aleatoriosAgregados > MAX_ALEATORIOS_SUAVE) {
            U.toast('🎲 Nº ' + elegido + ' agregado. ¡Ya llevas muchos al azar!',
                'info', 1800);
        } else {
            U.toast('🎲 Nº ' + elegido + ' agregado', 'ok', 1200);
        }
    }

    function generarAleatorios(n) {
        var ocupados = Store.numerosOcupados(state.registros);
        var seleccionadosSet = new Set(state.seleccion);

        var libres = state.ordenGrilla.filter(function (num) {
            return !ocupados.has(num) && !seleccionadosSet.has(num);
        });

        if (libres.length === 0) return [];

        var arr = libres.slice();
        for (var k = arr.length - 1; k > 0; k--) {
            var j = Math.floor(Math.random() * (k + 1));
            var tmp = arr[k]; arr[k] = arr[j]; arr[j] = tmp;
        }

        return arr.slice(0, Math.min(n, arr.length));
    }

    /* ============================================================
       18. AVISO DE TÉRMINOS
       ============================================================ */
    function actualizarAvisoTerminos() {
        if (!el.avisoTerminos) return;

        var acepto = Store.leerTerminosAceptados();
        var debeMostrar = (state.modoTerminos === 'checkbox') && !acepto;

        if (debeMostrar) {
            el.avisoTerminos.classList.remove('hidden');
        } else {
            el.avisoTerminos.classList.add('hidden');
        }
    }

    /* ============================================================
       19. BIND
       ============================================================ */
    function bind() {
        if (el.miniAdd) {
            el.miniAdd.addEventListener('click', function () {
                var ancla = el.anclaGrilla || el.grid;
                if (!ancla) return;
                var y = ancla.getBoundingClientRect().top + window.pageYOffset - 70;
                window.scrollTo({ top: y, behavior: 'smooth' });
                U.toast('Toca los números que quieras sumar', 'info', 2200);
            });
        }
        if (el.miniComprar) {
            el.miniComprar.addEventListener('click', abrirModalCompra);
        }
        if (el.btnSorprendeme) {
            el.btnSorprendeme.addEventListener('click', agregarAleatorio);
        }
    }

    /* ============================================================
       20. SUSCRIPCIÓN A TASAS
       ============================================================ */
    function suscribirTasas() {
        if (!BCV || !BCV.suscribir) return;
        BCV.getRate().then(function (info) { state.bcvInfo = info; }).catch(function () {});
        BCV.getCopRate().then(function (info) { state.copInfo = info; }).catch(function () {});
        state.bcvUnsub = BCV.suscribir(function (snapshot) {
            if (snapshot && snapshot.bcv) state.bcvInfo = snapshot.bcv;
            if (snapshot && snapshot.cop) state.copInfo = snapshot.cop;
        });
    }

    /* ============================================================
       21. RECARGA AL VOLVER
       ============================================================ */
    function configurarRecargaAlVolver() {
        function chequearRecarga() {
            if (document.visibilityState !== 'visible') return;
            var flag = null;
            try { flag = sessionStorage.getItem(KEY_RECARGAR); } catch (e) {}
            if (flag === '1') {
                try { sessionStorage.removeItem(KEY_RECARGAR); } catch (e) {}
                leerConfigActual();
                cargarTodo();
            } else {
                actualizarAvisoTerminos();
            }
        }
        document.addEventListener('visibilitychange', chequearRecarga);
        global.addEventListener('pageshow', chequearRecarga);
        global.addEventListener('focus', chequearRecarga);
    }

    /* ============================================================
       22. MODO EMBED / PREVIEW + ESCUCHA DE CONFIG
       ============================================================ */
    function activarModoEmbed() {
        document.body.classList.add('embed-mode');
        if (U.$('.embed-close-btn')) return;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'embed-close-btn';
        btn.textContent = '← Volver al Panel';
        btn.addEventListener('click', function () {
            if (global.parent && global.parent !== global) {
                try {
                    global.parent.postMessage({ tipo: 'cerrar-embed' }, '*');
                    return;
                } catch (e) { /* fallback */ }
            }
            location.href = 'admin.html';
        });
        document.body.appendChild(btn);
    }

    function configurarEscuchaConfig() {
        if (!global.addEventListener) return;

        global.addEventListener('storage', function (e) {
            if (e && e.key === (Store.KEYS && Store.KEYS.CONFIG)) {
                leerConfigActual();
                cargarTodo();
            }
        });

        global.addEventListener('message', function (e) {
            if (!e || !e.data) return;
            if (e.data.tipo === 'refrescar-rifas') {
                leerConfigActual();
                cargarTodo();
            }
        });
    }

    /* ============================================================
       23. INIT
       ============================================================ */
    function init() {
        if (state.inicializado) return;
        state.inicializado = true;

        if (U.getParam('embed') === '1') activarModoEmbed();

        cachearElementos();

        if (!el.grid) {
            U.warn('rifas.js: no se encontró #grid.');
            return;
        }

        try {
            document.title = 'Panel de Rifas · ' + Theme.nombreRifa();
        } catch (e) { /* silent */ }

        inyectarCSSPulse();

        leerConfigActual();
        aplicarColumnas();

        construirOrdenGrilla();
        restaurarSeleccion();

        bind();
        suscribirTasas();
        configurarEscuchaConfig();

        cargarTodo();
        configurarRecargaAlVolver();
    }

    function inyectarCSSPulse() {
        if (document.getElementById('rifas-dynamic-css')) return;

        var style = document.createElement('style');
        style.id = 'rifas-dynamic-css';
        style.textContent = [
            '@keyframes numPulse {',
            '  0%   { transform: scale(1); }',
            '  35%  { transform: scale(1.18); box-shadow: 0 0 22px var(--accent-glow); }',
            '  100% { transform: scale(1); }',
            '}'
        ].join('\n');

        document.head.appendChild(style);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ============================================================
       24. API PÚBLICA
       ============================================================ */
    var Rifas = {
        init:             init,
        cargarTodo:       cargarTodo,
        renderGrilla:     renderGrilla,
        renderBuyers:     renderBuyers,
        abrirCompra:      abrirModalCompra,
        agregarAleatorio: agregarAleatorio,
        generarAleatorios:generarAleatorios,
        mostrarInfoNumero:mostrarInfoNumero,
        aplicarColumnas:  aplicarColumnas,
        getBCVInfo:       function () { return state.bcvInfo; },
        getCOPInfo:       function () { return state.copInfo; },
        getSeleccion:     function () { return state.seleccion.slice(); },
        getRegistros:     function () { return state.registros.slice(); },
        getTotal:         function () { return state.total; },
        getModoAcceso:    function () { return state.modoAcceso; },
        leerModoTerminos: function () { return state.modoTerminos; },
        isGrillaMezclada: function () { return state.grillaMezclada; },
        getOrdenGrilla:   function () { return state.ordenGrilla.slice(); }
    };

    global.Rifas = Rifas;

})(typeof window !== 'undefined' ? window : this);