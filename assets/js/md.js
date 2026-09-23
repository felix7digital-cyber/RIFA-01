/* ============================================================
   MOTOR DE RIFAS · assets/js/md.js
   Mini-parser Markdown + cargador con fallback
   Expone window.MD
   Marco: CCG-IA v1.0.0 · Autor: Felix
   ============================================================ */

(function (global) {
    'use strict';

    var U = global.UI;

    /* ============================================================
       1. CONFIGURACIÓN DEL PARSER
       ============================================================ */
    // Etiquetas permitidas por línea. Cualquier HTML crudo del .md se
    // escapa y queda como texto (por seguridad).
    var MAX_ANIDACION_LISTA = 3;

    /* ============================================================
       2. PARSER · Bloque principal
       ============================================================ */
    function parsearMarkdown(texto) {
        if (!texto) return '';

        // Normalizar saltos de línea
        texto = String(texto).replace(/\r\n?/g, '\n');

        // Limpiar el BOM si existe
        if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);

        var lineas = texto.split('\n');
        var html = [];
        var buffer = [];       // buffer de párrafo
        var listaActual = null; // { tipo: 'ul'|'ol', items: [] }
        var enCodigo = false;
        var bufferCodigo = [];

        function cerrarParrafo() {
            if (buffer.length > 0) {
                html.push('<p>' + procesarInline(buffer.join(' ')) + '</p>');
                buffer = [];
            }
        }

        function cerrarLista() {
            if (listaActual) {
                var tag = listaActual.tipo === 'ol' ? 'ol' : 'ul';
                html.push('<' + tag + '>' + listaActual.items.join('') + '</' + tag + '>');
                listaActual = null;
            }
        }

        for (var i = 0; i < lineas.length; i++) {
            var linea = lineas[i];
            var lineaTrim = linea.trim();

            // ---- Código con triple backtick ----
            if (/^```/.test(lineaTrim)) {
                if (enCodigo) {
                    html.push('<pre><code>' +
                        U.escapeHtml(bufferCodigo.join('\n')) +
                        '</code></pre>');
                    bufferCodigo = [];
                    enCodigo = false;
                } else {
                    cerrarParrafo();
                    cerrarLista();
                    enCodigo = true;
                }
                continue;
            }
            if (enCodigo) {
                bufferCodigo.push(linea);
                continue;
            }

            // ---- Línea en blanco ----
            if (lineaTrim === '') {
                cerrarParrafo();
                cerrarLista();
                continue;
            }

            // ---- Separador horizontal ----
            if (/^(-{3,}|\*{3,}|_{3,})$/.test(lineaTrim)) {
                cerrarParrafo();
                cerrarLista();
                html.push('<hr>');
                continue;
            }

            // ---- Encabezados (# ## ###) ----
            var matchH = lineaTrim.match(/^(#{1,6})\s+(.+)$/);
            if (matchH) {
                cerrarParrafo();
                cerrarLista();
                var nivel = matchH[1].length;
                html.push('<h' + nivel + '>' + procesarInline(matchH[2]) + '</h' + nivel + '>');
                continue;
            }

            // ---- Lista desordenada - item ----
            var matchUl = linea.match(/^(\s*)[-*+]\s+(.+)$/);
            if (matchUl) {
                cerrarParrafo();
                var contenidoUl = matchUl[2];
                if (!listaActual || listaActual.tipo !== 'ul') {
                    cerrarLista();
                    listaActual = { tipo: 'ul', items: [] };
                }
                listaActual.items.push('<li>' + procesarInline(contenidoUl) + '</li>');
                continue;
            }

            // ---- Lista ordenada 1. item ----
            var matchOl = linea.match(/^(\s*)\d+\.\s+(.+)$/);
            if (matchOl) {
                cerrarParrafo();
                var contenidoOl = matchOl[2];
                if (!listaActual || listaActual.tipo !== 'ol') {
                    cerrarLista();
                    listaActual = { tipo: 'ol', items: [] };
                }
                listaActual.items.push('<li>' + procesarInline(contenidoOl) + '</li>');
                continue;
            }

            // ---- Cita > texto ----
            var matchBlock = lineaTrim.match(/^>\s*(.+)$/);
            if (matchBlock) {
                cerrarParrafo();
                cerrarLista();
                html.push('<blockquote>' + procesarInline(matchBlock[1]) + '</blockquote>');
                continue;
            }

            // ---- Párrafo normal ----
            // Si ya hay una lista abierta, la cerramos (los párrafos
            // interrumpen listas).
            if (listaActual) cerrarLista();
            buffer.push(lineaTrim);
        }

        // Cerrar lo que quedó abierto
        cerrarParrafo();
        cerrarLista();
        if (enCodigo && bufferCodigo.length > 0) {
            html.push('<pre><code>' +
                U.escapeHtml(bufferCodigo.join('\n')) +
                '</code></pre>');
        }

        return html.join('\n');
    }

    /* ============================================================
       3. PARSER · Formato en línea
       ============================================================ */
    function procesarInline(texto) {
        if (!texto) return '';

        // 1) Escapamos HTML primero (seguridad)
        var s = U.escapeHtml(texto);

        // 2) Código inline `texto`
        s = s.replace(/`([^`]+?)`/g, '<code>$1</code>');

        // 3) Negrita **texto**
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // 4) Cursiva *texto* (evitar chocar con ** ya procesado)
        s = s.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');

        // 5) Tachado ~~texto~~
        s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');

        // 6) Enlaces [texto](url)
        s = s.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // 7) Enlaces mailto
        s = s.replace(/\[([^\]]+?)\]\((mailto:[^\s)]+)\)/g,
            '<a href="$2">$1</a>');

        return s;
    }

    /* ============================================================
       4. FALLBACKS · Contenido embebido para file://
       ============================================================
       Si estás abriendo el proyecto con doble clic (file://), fetch()
       falla por CORS. En ese caso, el parser devuelve el contenido
       mínimo embebido aquí. Para editarlo, edita el .md real.
       ============================================================ */
    var FALLBACKS = {

        'terminos': [
            '# TÉRMINOS Y CONDICIONES DE PARTICIPACIÓN',
            '',
            '**Última actualización:** [FECHA]',
            '',
            'Bienvenido(a) a la rifa. Al marcar la casilla de aceptación confirmas',
            'que has leído y aceptado los siguientes términos.',
            '',
            '---',
            '',
            '## 1. Organizador',
            '',
            'La presente rifa es organizada por **[NOMBRE DEL ORGANIZADOR]**,',
            'contacto: **[+58 4XX-XXX-XXXX]**.',
            '',
            '## 2. Aceptación',
            '',
            'La participación implica la aceptación plena de estos términos.',
            'Si no estás de acuerdo, abstente de participar.',
            '',
            '## 3. Elegibilidad',
            '',
            '- Ser mayor de edad o contar con autorización de un representante.',
            '- Proporcionar datos veraces: nombre, cédula y teléfono.',
            '- Aceptar estos términos.',
            '',
            '## 4. Mecánica',
            '',
            '1. Elige uno o varios números entre 00 y 99.',
            '2. Completa el formulario con tus datos.',
            '3. Recibe tu boleto digital con código de autenticación.',
            '4. Realiza el pago al Organizador.',
            '',
            '## 5. Estados',
            '',
            '- **APARTADO:** número reservado, pago no verificado.',
            '- **PAGADO:** pago confirmado. Participación firme.',
            '',
            '## 6. Premios',
            '',
            'Los premios se describen en la vitrina pública. No son transferibles',
            'ni canjeables por dinero.',
            '',
            '## 7. Sorteo',
            '',
            'El ganador se determina comparando los dos últimos dígitos del',
            'resultado oficial de la lotería indicada.',
            '',
            '## 8. Entrega del premio',
            '',
            'El ganador será contactado en 24 horas. Debe presentar boleto digital',
            'y cédula original.',
            '',
            '## 9. Privacidad',
            '',
            'Tus datos se usan solo para la administración de la rifa. No se',
            'comparten con terceros.',
            '',
            '## 10. Contacto',
            '',
            '**WhatsApp:** [+58 4XX-XXX-XXXX]',
            '',
            '---',
            '',
            '*Al marcar la casilla confirmas que has leído y aceptado.*',
            '',
            '> ⚠️ Estás en modo `file://`. Carga el proyecto desde un servidor',
            '> (localhost o Cloudflare Pages) para ver el contenido completo de',
            '> `content/terminos.md`.'
        ].join('\n'),

        'motivo': [
            '# ¿POR QUÉ HACEMOS ESTA RIFA?',
            '',
            'Detrás de cada número hay una razón.',
            '',
            '---',
            '',
            '## Nuestra historia',
            '',
            'Esta rifa nació para **[DESCRIBIR EL OBJETIVO]**. Cada boleto que',
            'se aparta es un paso más hacia esa meta.',
            '',
            '## Nuestro propósito',
            '',
            '### 🤝 Ayudar a quien lo necesita',
            '',
            'Los fondos recaudados están destinados a **[EXPLICAR DESTINO]**.',
            '',
            '### 🔒 100% transparente',
            '',
            'Cada número y cada pago queda registrado. Consulta tu boleto cuando',
            'quieras con tu cédula.',
            '',
            '### 💯 100% local',
            '',
            'Esta plataforma fue construida desde un teléfono, sin servidores',
            'costosos ni intermediarios.',
            '',
            '## Lo que buscamos lograr',
            '',
            '- Construir comunidad.',
            '- Demostrar que se puede.',
            '- Dejar algo bueno.',
            '',
            '## Un agradecimiento adelantado',
            '',
            'A cada persona que aparte un número, gracias.',
            '',
            '**— El equipo organizador**',
            '',
            '> ⚠️ Estás en modo `file://`. Carga desde un servidor para ver el',
            '> contenido completo de `content/motivo.md`.'
        ].join('\n'),

        'instrucciones': [
            '# CÓMO PARTICIPAR',
            '',
            'Guía rápida para apartar tus números. No necesitas instalar nada.',
            '',
            '---',
            '',
            '## 1. Elige tus números',
            '',
            '- Entra al Panel de Rifas.',
            '- Verás 100 números (del 00 al 99).',
            '- Toca los que quieras. Se marcarán en dorado.',
            '',
            '## 2. Acepta los términos',
            '',
            'Marca la casilla "He leído y acepto" y pulsa **Aceptar y continuar**.',
            '',
            '## 3. Confirma tus datos',
            '',
            '- Nombre completo',
            '- Cédula de identidad (tu clave para ver el boleto)',
            '- Teléfono con WhatsApp',
            '',
            '## 4. Recibe tu boleto',
            '',
            'Se genera con tu número, código de autenticación y QR. Puedes',
            'descargarlo como imagen.',
            '',
            '## 5. Paga tu número',
            '',
            'Pago Móvil, transferencia o efectivo. Envía comprobante por WhatsApp.',
            '',
            '## 6. Consulta tu boleto',
            '',
            'Entra a "Ver mi boleto", ingresa tu cédula y verás todos tus',
            'boletos con su estado.',
            '',
            '## 7. Contacta al organizador',
            '',
            '**WhatsApp:** [+58 4XX-XXX-XXXX]',
            '',
            '> ⚠️ Estás en modo `file://`. Carga desde un servidor para ver el',
            '> contenido completo de `content/instrucciones.md`.'
        ].join('\n')
    };

    /* ============================================================
       5. CARGADOR · Lee un .md con fetch + fallback
       ============================================================ */
    var _cacheMd = {};

    /**
     * Carga un archivo .md y devuelve su HTML ya parseado.
     * @param {string} ruta — ej: 'content/terminos.md'
     * @param {string} claveFallback — 'terminos' | 'motivo' | 'instrucciones'
     * @returns {Promise<string>} HTML
     */
    function cargarMd(ruta, claveFallback) {
        var clave = ruta + '|' + (claveFallback || '');
        if (_cacheMd[clave] !== undefined) {
            return Promise.resolve(_cacheMd[clave]);
        }

        // En file:// fetch() no funciona: usamos el fallback directo
        if (U.esFileProtocol()) {
            return Promise.resolve(usarFallback(claveFallback, ruta));
        }

        return fetch(ruta, { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function (texto) {
                var html = parsearMarkdown(texto);
                _cacheMd[clave] = html;
                return html;
            })
            .catch(function (err) {
                U.warn('No se pudo cargar ' + ruta + ':', err);
                var fb = usarFallback(claveFallback, ruta);
                _cacheMd[clave] = fb;
                return fb;
            });
    }

    function usarFallback(clave, ruta) {
        var texto = FALLBACKS[clave];
        if (!texto) {
            return '<p class="empty-msg">⚠️ No se encontró el contenido de ' +
                   U.escapeHtml(ruta || '') + '</p>';
        }
        var html = parsearMarkdown(texto);
        return html;
    }

    /**
     * Carga un .md y lo inyecta en un elemento del DOM.
     * @param {string} ruta
     * @param {string|Element} destino — selector o elemento
     * @param {string} claveFallback
     * @returns {Promise<boolean>}
     */
    function cargarEnDOM(ruta, destino, claveFallback) {
        var el = typeof destino === 'string' ? U.$(destino) : destino;
        if (!el) {
            U.warn('cargarEnDOM: no se encontró', destino);
            return Promise.resolve(false);
        }

        // Mostrar estado de carga
        el.innerHTML = '<p class="empty-msg">Cargando…</p>';

        return cargarMd(ruta, claveFallback).then(function (html) {
            el.innerHTML = html;
            return true;
        }).catch(function () {
            el.innerHTML = '<p class="empty-msg">⚠️ Error al cargar el contenido.</p>';
            return false;
        });
    }

    /** Limpia la caché de .md (útil si el contenido cambió). */
    function limpiarCache() {
        _cacheMd = {};
    }

    /* ============================================================
       6. UTILIDAD · Render directo (sin fetch)
       ============================================================ */
    function renderTexto(textoMd) {
        return parsearMarkdown(textoMd);
    }

    /* ============================================================
       7. API PÚBLICA · window.MD
       ============================================================ */
    var MD = {
        parsear:         parsearMarkdown,
        renderTexto:     renderTexto,
        cargar:          cargarMd,
        cargarEnDOM:     cargarEnDOM,
        limpiarCache:    limpiarCache,
        FALLBACKS:       FALLBACKS
    };

    global.MD = MD;

})(typeof window !== 'undefined' ? window : this);