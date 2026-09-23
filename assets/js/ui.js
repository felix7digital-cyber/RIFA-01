/* ============================================================
   MOTOR DE RIFAS · assets/js/ui.js
   Helpers universales · Sin dependencias · Expone window.UI
   Marco: CCG-IA v1.0.0 · Autor: Felix
   ============================================================ */

(function (global) {
    'use strict';

    /* ============================================================
       1. SELECTORES RÁPIDOS
       ============================================================ */
    function $(sel, root) {
        return (root || document).querySelector(sel);
    }

    function $$(sel, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    }

    /* ============================================================
       2. UTILIDADES DE TEXTO Y DATOS
       ============================================================ */

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/[&<>"']/g, function (c) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[c];
        });
    }

    function soloDigitos(str) {
        return String(str == null ? '' : str).replace(/\D/g, '');
    }

    function formatearCedula(str) {
        var d = soloDigitos(str);
        if (!d) return '';
        if (d.length <= 1) return d;
        return 'V-' + d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function formatearTelefono(str) {
        var d = soloDigitos(str);
        if (!d) return '';
        if (d.length === 11 && d.indexOf('58') === 0) {
            return '+58 ' + d.slice(2, 5) + '-' + d.slice(5);
        }
        if (d.length === 10) {
            return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
        }
        return str;
    }

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    function fechaHumana(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return String(iso);
            var dd = pad2(d.getDate());
            var mm = pad2(d.getMonth() + 1);
            var yy = d.getFullYear();
            var hh = pad2(d.getHours());
            var mi = pad2(d.getMinutes());
            return dd + '/' + mm + '/' + yy + ' ' + hh + ':' + mi;
        } catch (e) {
            return String(iso);
        }
    }

    function fechaCorta(iso) {
        if (!iso) return '';
        var meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                     'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return String(iso);
            return pad2(d.getDate()) + ' ' + meses[d.getMonth()];
        } catch (e) {
            return String(iso);
        }
    }

    function timestampArchivo() {
        var d = new Date();
        return d.getFullYear() + '-' +
               pad2(d.getMonth() + 1) + '-' +
               pad2(d.getDate()) + '_' +
               pad2(d.getHours()) +
               pad2(d.getMinutes());
    }

    function generarId() {
        return Date.now().toString(36) + '-' +
               Math.random().toString(36).slice(2, 8);
    }

    function formatearMonto(monto) {
        if (typeof monto === 'number') {
            return monto.toLocaleString('es-VE');
        }
        return String(monto || '');
    }

    /* ============================================================
       2.b · HELPERS NUEVOS · Grilla dinámica + clave
       ============================================================ */

    /** Genera una clave de 4 dígitos al azar. */
    function generarClave4() {
        return String(Math.floor(1000 + Math.random() * 9000));
    }

    /** Valida que una clave sea 4 dígitos numéricos. */
    function validarClave4(s) {
        return /^\d{4}$/.test(String(s || ''));
    }

    /**
     * Devuelve el padding según la cantidad total de la grilla.
     *   5   → 1 dígito
     *   10  → 2 dígitos (0-9, con pad 0)
     *   20  → 2 dígitos (00-19)
     *   50  → 2 dígitos (00-49)
     *   100 → 2 dígitos (00-99)
     *   1000 → 3 dígitos
     */
    function paddingSegunTotal(total) {
        total = parseInt(total, 10) || 100;
        if (total <= 10) return 1;
        if (total <= 100) return 2;
        if (total <= 1000) return 3;
        return String(total - 1).length;
    }

    /** Formatea el número i (0-based) según el total. */
    function formatearNumeroSegunTotal(i, total) {
        var pad = paddingSegunTotal(total);
        return String(i).padStart(pad, '0');
    }

    /** Normaliza un número ingresado por el usuario. */
    function normalizarNumeroSegunTotal(str, total) {
        var pad = paddingSegunTotal(total);
        var d = soloDigitos(str);
        // Acepta "7" para grilla de 100 → "07"
        if (d.length < pad) {
            d = d.padStart(pad, '0');
        }
        if (d.length > pad) d = d.slice(-pad);
        return d;
    }

    /** Valida que el número esté en el rango [0, total-1]. */
    function esNumeroRifaValidoSegunTotal(str, total) {
        total = parseInt(total, 10) || 100;
        var n = normalizarNumeroSegunTotal(str, total);
        var num = parseInt(n, 10);
        return isFinite(num) && num >= 0 && num < total;
    }

    /** Lista de todos los números válidos como strings (con padding). */
    function listaNumeros(total) {
        total = parseInt(total, 10) || 100;
        var out = [];
        for (var i = 0; i < total; i++) {
            out.push(formatearNumeroSegunTotal(i, total));
        }
        return out;
    }

    /* ============================================================
       3. UTILIDADES DE URL
       ============================================================ */

    function getParam(nombre) {
        try {
            return new URLSearchParams(global.location.search).get(nombre);
        } catch (e) {
            return null;
        }
    }

    function urlHermana(pagina) {
        try {
            var u = new URL(global.location.href);
            var p = u.pathname;
            var i = p.lastIndexOf('/');
            u.pathname = (i >= 0 ? p.slice(0, i + 1) : '') + pagina;
            u.search = '';
            u.hash = '';
            return u.toString();
        } catch (e) {
            return pagina;
        }
    }

    function esFileProtocol() {
        return global.location.protocol === 'file:';
    }

    function enIframe() {
        try {
            return global.self !== global.top;
        } catch (e) {
            return true;
        }
    }

    /* ============================================================
       4. DOM · Utilidades seguras
       ============================================================ */

    function crearEl(tag, attrs, hijos) {
        var el = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                if (k === 'class') el.className = attrs[k];
                else if (k === 'html') el.innerHTML = attrs[k];
                else if (k === 'text') el.textContent = attrs[k];
                else if (k === 'style' && typeof attrs[k] === 'object') {
                    Object.keys(attrs[k]).forEach(function (p) {
                        el.style[p] = attrs[k][p];
                    });
                }
                else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
                    el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
                }
                else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
            });
        }
        if (hijos) {
            (Array.isArray(hijos) ? hijos : [hijos]).forEach(function (h) {
                if (h == null) return;
                if (typeof h === 'string' || typeof h === 'number') {
                    el.appendChild(document.createTextNode(String(h)));
                } else if (h instanceof Node) {
                    el.appendChild(h);
                }
            });
        }
        return el;
    }

    function on(root, selector, evento, handler) {
        if (!root) return;
        root.addEventListener(evento, function (e) {
            var target = e.target.closest(selector);
            if (target && root.contains(target)) {
                handler.call(target, e, target);
            }
        });
    }

    function sleep(ms) {
        return new Promise(function (r) { setTimeout(r, ms); });
    }

    function debounce(fn, ms) {
        var t = null;
        return function () {
            var ctx = this;
            var args = arguments;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(ctx, args); }, ms);
        };
    }

    function throttle(fn, ms) {
        var last = 0;
        return function () {
            var now = Date.now();
            if (now - last >= ms) {
                last = now;
                return fn.apply(this, arguments);
            }
        };
    }

    /* ============================================================
       5. PORTAPAPELES
       ============================================================ */

    function copiar(texto) {
        return new Promise(function (resolve) {
            if (navigator.clipboard && global.isSecureContext) {
                navigator.clipboard.writeText(texto).then(
                    function () { resolve(true); },
                    function () { resolve(_copiarFallback(texto)); }
                );
                return;
            }
            resolve(_copiarFallback(texto));
        });
    }

    function _copiarFallback(texto) {
        try {
            var ta = document.createElement('textarea');
            ta.value = texto;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.top = '-1000px';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, ta.value.length);
            var ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (e) {
            return false;
        }
    }

    /* ============================================================
       6. TOAST
       ============================================================ */

    function _getToastContainer() {
        var c = document.getElementById('toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toast-container';
            c.className = 'toast-container';
            document.body.appendChild(c);
        }
        return c;
    }

    function toast(mensaje, tipo, duracion) {
        tipo = tipo || 'info';
        duracion = duracion || 3200;

        var iconos = {
            ok:     '✅',
            warn:   '⚠️',
            danger: '❌',
            info:   'ℹ️'
        };

        var c = _getToastContainer();
        var el = document.createElement('div');
        el.className = 'toast ' + tipo;
        el.innerHTML =
            '<span class="toast-icon">' + (iconos[tipo] || iconos.info) + '</span>' +
            '<span>' + escapeHtml(mensaje) + '</span>';

        c.appendChild(el);

        setTimeout(function () {
            el.classList.add('saliendo');
            setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 260);
        }, duracion);

        return el;
    }

    /* ============================================================
       7. MODAL
       ============================================================ */

    var _modalBackdrop = null;

    function _crearModal() {
        if (_modalBackdrop) return _modalBackdrop;
        var back = document.createElement('div');
        back.className = 'modal-backdrop';
        back.id = 'ui-modal-backdrop';
        back.hidden = true;
        back.innerHTML = '<div class="modal-sheet" id="ui-modal-sheet"></div>';
        document.body.appendChild(back);

        back.addEventListener('click', function (e) {
            if (e.target === back) cerrarModal();
        });

        _modalBackdrop = back;
        return back;
    }

    function abrirModal(html, opciones) {
        opciones = opciones || {};
        var back = _crearModal();
        var sheet = document.getElementById('ui-modal-sheet');
        sheet.innerHTML = html;
        sheet._bloqueante = !!opciones.bloqueante;
        back.hidden = false;
        document.body.classList.add('no-scroll');
        return sheet;
    }

    function cerrarModal() {
        var back = document.getElementById('ui-modal-backdrop');
        if (!back) return;
        var sheet = document.getElementById('ui-modal-sheet');
        if (sheet && sheet._bloqueante) return;
        back.hidden = true;
        if (sheet) sheet.innerHTML = '';
        document.body.classList.remove('no-scroll');
    }

    /* ============================================================
       8. CONFIRMACIÓN
       ============================================================ */

    function confirmar(mensaje, opciones) {
        opciones = opciones || {};
        var titulo  = opciones.titulo || '¿Estás seguro?';
        var okText  = opciones.okText || 'Sí, continuar';
        var noText  = opciones.noText || 'Cancelar';
        var claseOk = opciones.peligro ? 'btn-danger' : '';

        return new Promise(function (resolve) {
            var html =
                '<div class="modal-grabber"></div>' +
                '<div class="modal-title">' + escapeHtml(titulo) + '</div>' +
                '<div class="modal-subtitle" style="margin-top:8px;">' +
                    escapeHtml(mensaje) +
                '</div>' +
                '<button type="button" class="btn-accion ' + claseOk + '" id="ui-conf-ok">' +
                    escapeHtml(okText) +
                '</button>' +
                '<button type="button" class="btn-accion btn-ghost" id="ui-conf-no">' +
                    escapeHtml(noText) +
                '</button>';

            abrirModal(html, { bloqueante: true });

            var btnOk = document.getElementById('ui-conf-ok');
            var btnNo = document.getElementById('ui-conf-no');

            function limpiar() {
                var sheet = document.getElementById('ui-modal-sheet');
                if (sheet) sheet._bloqueante = false;
                cerrarModal();
            }

            btnOk.addEventListener('click', function () {
                limpiar();
                resolve(true);
            });
            btnNo.addEventListener('click', function () {
                limpiar();
                resolve(false);
            });
        });
    }

    /* ============================================================
       9. INPUTS
       ============================================================ */

    function limpiarCampos(root) {
        $$('input, textarea, select', root || document).forEach(function (el) {
            if (el.type === 'checkbox' || el.type === 'radio') {
                el.checked = false;
            } else {
                el.value = '';
            }
        });
    }

    function marcarInvalido(el, invalido) {
        if (!el) return;
        if (invalido) {
            el.style.borderColor = 'var(--danger)';
            el.style.boxShadow = '0 0 0 3px var(--danger-soft)';
        } else {
            el.style.borderColor = '';
            el.style.boxShadow = '';
        }
    }

    /* ============================================================
       10. FECHAS
       ============================================================ */

    function esPasado(iso) {
        try {
            return new Date(iso).getTime() < Date.now();
        } catch (e) { return false; }
    }

    function horasEntre(a, b) {
        try {
            var d1 = new Date(a).getTime();
            var d2 = new Date(b).getTime();
            return Math.abs(d2 - d1) / 36e5;
        } catch (e) { return 0; }
    }

    /* ============================================================
       11. NÚMEROS
       ============================================================ */

    function num(v) {
        var n = Number(v);
        return isNaN(n) ? 0 : n;
    }

    function porcentaje(parte, total) {
        if (!total) return 0;
        return Math.round((parte / total) * 100);
    }

    function rango(n) {
        var a = [];
        for (var i = 0; i < n; i++) a.push(i);
        return a;
    }

    /* ============================================================
       12. SHARE
       ============================================================ */

    function compartir(datos, fallbackTexto) {
        if (navigator.share) {
            return navigator.share(datos).catch(function () {
                return copiar(fallbackTexto || datos.text || '').then(function () {
                    toast('Copiado al portapapeles', 'ok');
                });
            });
        }
        return copiar(fallbackTexto || datos.text || '').then(function (ok) {
            toast(ok ? 'Copiado al portapapeles' : 'No se pudo copiar', ok ? 'ok' : 'warn');
        });
    }

    /* ============================================================
       13. DESCARGA
       ============================================================ */

    function descargarArchivo(nombre, contenido, tipo) {
        try {
            var blob = new Blob([contenido], { type: tipo || 'text/plain;charset=utf-8' });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement('a');
            a.href = url;
            a.download = nombre;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
            return true;
        } catch (e) {
            console.error('Error al descargar archivo:', e);
            return false;
        }
    }

    /* ============================================================
       14. LECTURA DE ARCHIVOS
       ============================================================ */

    function leerArchivoTexto(file) {
        return new Promise(function (resolve, reject) {
            var r = new FileReader();
            r.onload = function () { resolve(r.result); };
            r.onerror = function () { reject(r.error); };
            r.readAsText(file);
        });
    }

    function leerArchivoDataURL(file) {
        return new Promise(function (resolve, reject) {
            var r = new FileReader();
            r.onload = function () { resolve(r.result); };
            r.onerror = function () { reject(r.error); };
            r.readAsDataURL(file);
        });
    }

    function comprimirImagen(file, anchoMax) {
        anchoMax = anchoMax || 600;
        return new Promise(function (resolve, reject) {
            leerArchivoDataURL(file).then(function (dataUrl) {
                var img = new Image();
                img.onload = function () {
                    var escala = Math.min(1, anchoMax / img.width);
                    var w = Math.round(img.width * escala);
                    var h = Math.round(img.height * escala);
                    var canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    var esPng = file.type === 'image/png';
                    var out = esPng
                        ? canvas.toDataURL('image/png')
                        : canvas.toDataURL('image/jpeg', 0.82);
                    resolve(out);
                };
                img.onerror = function () { reject(new Error('Imagen inválida')); };
                img.src = dataUrl;
            }).catch(reject);
        });
    }

    /* ============================================================
       15. VALIDACIONES LEGACY (compatibilidad)
       ============================================================ */

    function esEmailValido(s) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));
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

    /* ============================================================
       16. LOG
       ============================================================ */

    var DEBUG = !esFileProtocol() && /localhost|127\.0\.0\.1/.test(global.location.hostname);

    function log() {
        if (!DEBUG) return;
        console.log.apply(console, ['[RIFA]'].concat(Array.prototype.slice.call(arguments)));
    }

    function warn() {
        if (!DEBUG) return;
        console.warn.apply(console, ['[RIFA]'].concat(Array.prototype.slice.call(arguments)));
    }

    /* ============================================================
       17. API PÚBLICA
       ============================================================ */
    var UI = {
        // Selectores
        $: $,
        $$: $$,

        // Texto y datos
        escapeHtml:      escapeHtml,
        soloDigitos:     soloDigitos,
        formatearCedula: formatearCedula,
        formatearTelefono: formatearTelefono,
        pad2:            pad2,
        fechaHumana:     fechaHumana,
        fechaCorta:      fechaCorta,
        timestampArchivo: timestampArchivo,
        generarId:       generarId,
        formatearMonto:  formatearMonto,

        // NUEVOS · Grilla dinámica + clave
        generarClave4:                 generarClave4,
        validarClave4:                 validarClave4,
        paddingSegunTotal:             paddingSegunTotal,
        formatearNumeroSegunTotal:     formatearNumeroSegunTotal,
        normalizarNumeroSegunTotal:    normalizarNumeroSegunTotal,
        esNumeroRifaValidoSegunTotal:  esNumeroRifaValidoSegunTotal,
        listaNumeros:                  listaNumeros,

        // URL
        getParam:        getParam,
        urlHermana:      urlHermana,
        esFileProtocol:  esFileProtocol,
        enIframe:        enIframe,

        // DOM
        crearEl:         crearEl,
        on:              on,
        sleep:           sleep,
        debounce:        debounce,
        throttle:        throttle,

        // Portapapeles y share
        copiar:          copiar,
        compartir:       compartir,

        // Notificaciones y modales
        toast:           toast,
        abrirModal:      abrirModal,
        cerrarModal:     cerrarModal,
        confirmar:       confirmar,

        // Formularios
        limpiarCampos:   limpiarCampos,
        marcarInvalido:  marcarInvalido,

        // Fechas
        esPasado:        esPasado,
        horasEntre:      horasEntre,

        // Números
        num:             num,
        porcentaje:      porcentaje,
        rango:           rango,

        // Archivos
        descargarArchivo:  descargarArchivo,
        leerArchivoTexto:  leerArchivoTexto,
        leerArchivoDataURL: leerArchivoDataURL,
        comprimirImagen:   comprimirImagen,

        // Validaciones legacy
        esEmailValido:        esEmailValido,
        esCedulaValida:       esCedulaValida,
        esTelefonoValido:     esTelefonoValido,
        esNumeroRifaValido:   esNumeroRifaValido,
        normalizarNumero:     normalizarNumero,

        // Log
        log:   log,
        warn:  warn
    };

    global.UI = UI;

})(typeof window !== 'undefined' ? window : this);