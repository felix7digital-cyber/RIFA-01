/* ============================================================
   MOTOR DE RIFAS · assets/js/theme.js
   Aplica configuración visual + identidad + landing
   Expone window.Theme
   Marco: CCG-IA v1.0.0 · Autor: Felix
   ============================================================ */

(function (global) {
    'use strict';

    var U = global.UI;
    var Store = global.Store;

    /* ============================================================
       1. CONSTANTES
       ============================================================ */
    var PLANTILLAS_VALIDAS = ['boleto', 'neon', 'clasico', 'minimal'];
    var TIPOGRAFIAS_VALIDAS = ['system', 'serif', 'mono', 'rounded'];

    var TIPOGRAFIA_MAP = {
        system:  'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        serif:   'Georgia, "Times New Roman", serif',
        mono:    '"SF Mono", "Roboto Mono", Consolas, monospace',
        rounded: 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif'
    };

    /* ============================================================
       2. UTILIDADES DE COLOR
       ============================================================ */
    function hexARgb(hex) {
        if (!hex) return { r: 0, g: 0, b: 0 };
        var h = String(hex).replace('#', '').trim();
        if (h.length === 3) {
            h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }
        if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
            return { r: 0, g: 0, b: 0 };
        }
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16)
        };
    }

    function hexARgba(hex, alpha) {
        var c = hexARgb(hex);
        return 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + alpha + ')';
    }

    function esColorClaro(hex) {
        var c = hexARgb(hex);
        var l = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
        return l > 0.62;
    }

    function textoContraste(hex) {
        return esColorClaro(hex) ? '#000000' : '#ffffff';
    }

    /* ============================================================
       3. FORMATEO DE TELÉFONO VENEZOLANO
       ============================================================ */
    function formatearTelefonoVzla(tel) {
        var d = String(tel || '').replace(/\D/g, '');
        if (!d) return '';

        if (d.length === 13 && d.indexOf('580') === 0) {
            d = d.slice(3);
        } else if (d.length === 12 && d.indexOf('58') === 0) {
            d = d.slice(2);
        } else if (d.length === 11 && d.indexOf('0') === 0) {
            d = d.slice(1);
        }

        if (d.length === 10) {
            return '+58 ' + d.slice(0, 3) + '-' + d.slice(3);
        }
        return tel;
    }

    /* ============================================================
       4. APLICAR COLORES
       ============================================================ */
    function aplicarColores(cfg) {
        var acento = (cfg.marca && cfg.marca.colorAcento) || '#fbbf24';
        var secund = (cfg.marca && cfg.marca.colorSecundario) || '#38bdf8';

        var root = document.documentElement;
        root.style.setProperty('--accent', acento);
        root.style.setProperty('--accent-glow', hexARgba(acento, 0.35));
        root.style.setProperty('--accent-soft', hexARgba(acento, 0.12));
        root.style.setProperty('--accent-text', textoContraste(acento));

        root.style.setProperty('--sky', secund);
        root.style.setProperty('--sky-glow', hexARgba(secund, 0.35));
        root.style.setProperty('--sky-soft', hexARgba(secund, 0.12));

        var metaTheme = document.querySelector('meta[name="theme-color"]');
        if (!metaTheme) {
            metaTheme = document.createElement('meta');
            metaTheme.name = 'theme-color';
            document.head.appendChild(metaTheme);
        }
        metaTheme.content = acento;
    }

    /* ============================================================
       5. APLICAR TIPOGRAFÍA
       ============================================================ */
    function aplicarTipografia(cfg) {
        var tipo = (cfg.marca && cfg.marca.tipografia) || 'system';
        if (TIPOGRAFIAS_VALIDAS.indexOf(tipo) === -1) tipo = 'system';

        var family = TIPOGRAFIA_MAP[tipo] || TIPOGRAFIA_MAP.system;
        document.documentElement.style.setProperty('--font-family', family);

        TIPOGRAFIAS_VALIDAS.forEach(function (t) {
            document.body.classList.remove('tipografia-' + t);
        });
        document.body.classList.add('tipografia-' + tipo);
    }

    /* ============================================================
       6. APLICAR PLANTILLA
       ============================================================ */
    function aplicarPlantilla(cfg) {
        var p = cfg.plantilla || 'boleto';
        if (PLANTILLAS_VALIDAS.indexOf(p) === -1) p = 'boleto';

        PLANTILLAS_VALIDAS.forEach(function (x) {
            document.body.classList.remove('plantilla-' + x);
        });
        document.body.classList.add('plantilla-' + p);

        if (cfg.marca && cfg.marca.colorAcento) {
            aplicarColores(cfg);
        }
    }

    /* ============================================================
       7. APLICAR LOGO
       ============================================================ */
    function aplicarLogo(cfg) {
        var logoValor = (cfg.marca && cfg.marca.logoValor) || '🎟️';
        var tipo      = (cfg.marca && cfg.marca.tipoLogo) || 'emoji';

        var contenedores = document.querySelectorAll('[data-theme="logo"]');

        Array.prototype.forEach.call(contenedores, function (el) {
            el.innerHTML = '';

            if (tipo === 'imagen' && logoValor && logoValor.indexOf('data:image') === 0) {
                var img = document.createElement('img');
                img.src = logoValor;
                img.alt = (cfg.identidad && cfg.identidad.nombreRifa) || 'Logo';
                el.appendChild(img);
                el.classList.add('logo-imagen');
            } else if (tipo === 'texto' && logoValor) {
                el.textContent = logoValor;
                el.classList.add('logo-texto');
            } else {
                el.textContent = logoValor || '🎟️';
                el.classList.add('logo-emoji');
            }
        });
    }

    /* ============================================================
       8. APLICAR IDENTIDAD
       ============================================================ */
    function aplicarIdentidad(cfg) {
        var ident = cfg.identidad || {};

        setTextTodos('[data-theme="rifa"]',     ident.nombreRifa || 'Gran Rifa');
        setTextTodos('[data-theme="loteria"]',  ident.loteria || 'Chance A');
        setTextTodos('[data-theme="monto"]',    ident.monto || '$5');
        setTextTodos('[data-theme="organizador"]', ident.nombreOrg || '');
        setTextTodos('[data-theme="horario"]',  ident.horarioAtencion || '');
        setTextTodos('[data-theme="fecha-sorteo"]', ident.fechaSorteo || '');
        setTextTodos('[data-theme="hora-sorteo"]',  ident.horaSorteo || '');

        if (ident.nombreRifa && document.title.indexOf('{{rifa}}') !== -1) {
            document.title = document.title.replace(/\{\{rifa\}\}/g, ident.nombreRifa);
        }

        aplicarWhatsApp(ident);

        var wa = U.soloDigitos(ident.whatsappOrg || '');
        if (wa) {
            document.querySelectorAll('[data-theme="whatsapp-link"]').forEach(function (el) {
                var msg = ident.mensajePredeterminado || '¡Hola! Vengo de la rifa.';
                el.href = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(msg);
                el.target = '_blank';
                el.rel = 'noopener';
            });
        }

        if (ident.fechaSorteo) {
            setTextTodos('[data-theme="fecha-sorteo-humana"]',
                U.fechaCorta(ident.fechaSorteo));
        }
    }

    function setTextTodos(selector, valor) {
        if (!selector || valor == null) return;
        var els = document.querySelectorAll(selector);
        Array.prototype.forEach.call(els, function (el) {
            var prefijo = el.getAttribute('data-theme-prefix') || '';
            el.textContent = prefijo + valor;
        });
    }

    function aplicarWhatsApp(ident) {
        var tel = U.soloDigitos(ident.whatsappOrg || '');
        if (!tel) return;
        var formateado = formatearTelefonoVzla(tel);
        setTextTodos('[data-theme="whatsapp-visible"]', formateado);
    }

    /* ============================================================
       9. APLICAR LANDING (nuevo)
       ============================================================
       Lee cfg.landing y personaliza la landing pública:
       - Imagen (Base64) o emoji
       - Título
       - Subtítulo
       - Texto del botón principal
       - Texto del botón secundario
       ============================================================ */
    function aplicarLanding(cfg) {
        var landing = cfg.landing || {};
        var contenedoresImagen = document.querySelectorAll('[data-theme="landing-imagen"]');

        // --- Imagen / emoji ---
        Array.prototype.forEach.call(contenedoresImagen, function (el) {
            el.innerHTML = '';

            if (landing.imagen && String(landing.imagen).indexOf('data:image') === 0) {
                var img = document.createElement('img');
                img.src = landing.imagen;
                img.alt = 'Imagen de la rifa';
                img.loading = 'lazy';
                el.appendChild(img);
                el.classList.add('con-imagen');
            } else {
                var span = document.createElement('span');
                span.className = 'landing-image-emoji';
                span.textContent = landing.emoji || '🎟️';
                el.appendChild(span);
                el.classList.remove('con-imagen');
            }
        });

        // --- Título ---
        if (landing.titulo) {
            setTextTodos('[data-theme="landing-titulo"]', landing.titulo);
        }

        // --- Subtítulo ---
        if (landing.subtitulo) {
            setTextTodos('[data-theme="landing-subtitulo"]', landing.subtitulo);
        }

        // --- Texto botón principal ---
        if (landing.ctaPrincipal) {
            setTextTodos('[data-theme="landing-cta-principal"]', landing.ctaPrincipal);
        }

        // --- Texto botón secundario ---
        if (landing.ctaSecundario) {
            setTextTodos('[data-theme="landing-cta-secundario"]', landing.ctaSecundario);
        }

        // --- URL del botón secundario (opcional) ---
        if (landing.ctaSecundarioUrl) {
            document.querySelectorAll('[data-theme="landing-cta-secundario"]').forEach(function (el) {
                el.href = landing.ctaSecundarioUrl;
            });
        }
    }

    /* ============================================================
       10. APLICAR TODO
       ============================================================ */
    function aplicarTodo(cfg) {
        cfg = cfg || (Store ? Store.leerConfig() : null);
        if (!cfg) {
            U.warn('Theme: no hay configuración disponible.');
            return;
        }
        aplicarPlantilla(cfg);
        aplicarColores(cfg);
        aplicarTipografia(cfg);
        aplicarLogo(cfg);
        aplicarIdentidad(cfg);
        aplicarLanding(cfg);
    }

    /* ============================================================
       11. VISTA PREVIA EN VIVO (para el admin)
       ============================================================ */
    function previsualizar(cfgTemporal) {
        var original = Store.leerConfig();
        var temp = JSON.parse(JSON.stringify(original));
        Object.keys(cfgTemporal || {}).forEach(function (k) {
            if (cfgTemporal[k] && typeof cfgTemporal[k] === 'object' && !Array.isArray(cfgTemporal[k])) {
                temp[k] = Object.assign({}, temp[k], cfgTemporal[k]);
            } else {
                temp[k] = cfgTemporal[k];
            }
        });
        aplicarTodo(temp);
    }

    /* ============================================================
       12. RESET
       ============================================================ */
    function resetear() {
        if (!Store) return;
        aplicarTodo(Store.CONFIG_DEFAULT);
    }

    /* ============================================================
       13. HELPERS DE IDENTIDAD
       ============================================================ */
    function nombreRifa() {
        var cfg = Store ? Store.leerConfig() : null;
        return (cfg && cfg.identidad && cfg.identidad.nombreRifa) || 'Gran Rifa';
    }

    function whatsappOrganizador() {
        var cfg = Store ? Store.leerConfig() : null;
        return (cfg && cfg.identidad && cfg.identidad.whatsappOrg) || '';
    }

    function monto() {
        var cfg = Store ? Store.leerConfig() : null;
        return (cfg && cfg.identidad && cfg.identidad.monto) || '$5';
    }

    /* ============================================================
       14. INICIALIZACIÓN AUTOMÁTICA
       ============================================================ */
    function inicializar() {
        aplicarTodo();

        if (global.addEventListener) {
            global.addEventListener('storage', function (e) {
                if (e && e.key === (Store ? Store.KEYS.CONFIG : null)) {
                    U.log('Config cambió en otra pestaña, reaplicando tema.');
                    aplicarTodo();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }

    /* ============================================================
       15. API PÚBLICA · window.Theme
       ============================================================ */
    var Theme = {
        aplicarTodo:       aplicarTodo,
        aplicarColores:    aplicarColores,
        aplicarTipografia: aplicarTipografia,
        aplicarPlantilla:  aplicarPlantilla,
        aplicarLogo:       aplicarLogo,
        aplicarIdentidad:  aplicarIdentidad,
        aplicarLanding:    aplicarLanding,
        aplicarWhatsApp:   aplicarWhatsApp,
        previsualizar:     previsualizar,
        resetear:          resetear,

        nombreRifa:            nombreRifa,
        whatsappOrganizador:   whatsappOrganizador,
        monto:                 monto,
        textoContraste:        textoContraste,
        hexARgba:              hexARgba,
        formatearTelefonoVzla: formatearTelefonoVzla,

        PLANTILLAS_VALIDAS:    PLANTILLAS_VALIDAS,
        TIPOGRAFIAS_VALIDAS:   TIPOGRAFIAS_VALIDAS
    };

    global.Theme = Theme;

})(typeof window !== 'undefined' ? window : this);