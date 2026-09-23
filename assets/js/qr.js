/* ============================================================
   MOTOR DE RIFAS · assets/js/qr.js
   Generador de QR Code 100% offline (sin api.qrserver.com)
   Basado en el algoritmo QR Code Model 2 de Kazuhiko Arase (MIT)
   Expone window.QR
   Marco: CCG-IA v1.0.0 · Autor: Felix
   ============================================================ */

(function (global) {
    'use strict';

    /* ============================================================
       1. CONSTANTES · Tablas del estándar QR
       ============================================================ */
    var MODE_8BIT = 4;

    var RS_BLOCK_TABLE = [
        [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
        [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
        [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
        [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
        [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
        [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
        [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
        [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
        [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
        [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]
    ];

    var ALIGNMENT_PATTERN_TABLE = [
        [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
        [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
        [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66],
        [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
        [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90]
    ];

    var ERROR_CORRECT_L = 1;

    /* ============================================================
       2. GF(256) · Aritmética de campo de Galois
       ============================================================ */
    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    (function initGalois() {
        for (var i = 0; i < 8; i++) {
            EXP_TABLE[i] = 1 << i;
        }
        for (var j = 8; j < 256; j++) {
            EXP_TABLE[j] = EXP_TABLE[j - 4] ^ EXP_TABLE[j - 5] ^
                           EXP_TABLE[j - 6] ^ EXP_TABLE[j - 8];
        }
        for (var k = 0; k < 255; k++) {
            LOG_TABLE[EXP_TABLE[k]] = k;
        }
    })();

    function gexp(n) {
        while (n < 0) n += 255;
        while (n >= 256) n -= 255;
        return EXP_TABLE[n];
    }

    function glog(n) {
        if (n < 1) throw new Error('glog(' + n + ')');
        return LOG_TABLE[n];
    }

    /* ============================================================
       3. POLINOMIOS
       ============================================================ */
    function Polynomial(num, shift) {
        if (num.length === undefined) throw new Error('invalid num');
        var offset = 0;
        while (offset < num.length && num[offset] === 0) offset++;
        this.num = new Array(num.length - offset + shift);
        for (var i = 0; i < num.length - offset; i++) {
            this.num[i] = num[i + offset];
        }
    }

    Polynomial.prototype.get = function (i) {
        return this.num[i];
    };

    Polynomial.prototype.getLength = function () {
        return this.num.length;
    };

    Polynomial.prototype.multiply = function (other) {
        var num = new Array(this.getLength() + other.getLength() - 1);
        for (var i = 0; i < num.length; i++) num[i] = 0;
        for (var j = 0; j < this.getLength(); j++) {
            for (var k = 0; k < other.getLength(); k++) {
                num[j + k] ^= gexp(glog(this.get(j)) + glog(other.get(k)));
            }
        }
        return new Polynomial(num, 0);
    };

    Polynomial.prototype.mod = function (other) {
        if (this.getLength() - other.getLength() < 0) return this;
        var ratio = glog(this.get(0)) - glog(other.get(0));
        var num = new Array(this.getLength());
        for (var i = 0; i < this.getLength(); i++) num[i] = this.get(i);
        for (var j = 0; j < other.getLength(); j++) {
            num[j] ^= gexp(glog(other.get(j)) + ratio);
        }
        return new Polynomial(num, 0).mod(other);
    };

    function errorCorrectPolynomial(errorCorrectLength) {
        var a = new Polynomial([1], 0);
        for (var i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new Polynomial([1, gexp(i)], 0));
        }
        return a;
    }

    /* ============================================================
       4. BIT BUFFER
       ============================================================ */
    function BitBuffer() {
        this.buffer = [];
        this.length = 0;
    }

    BitBuffer.prototype.put = function (num, length) {
        for (var i = 0; i < length; i++) {
            this.putBit(((num >>> (length - i - 1)) & 1) === 1);
        }
    };

    BitBuffer.prototype.putBit = function (bit) {
        var bufIndex = Math.floor(this.length / 8);
        if (this.buffer.length <= bufIndex) this.buffer.push(0);
        if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
        this.length++;
    };

    /* ============================================================
       5. UTIL · UTF-8
       ============================================================ */
    function utf8Bytes(str) {
        var out = [];
        for (var i = 0; i < str.length; i++) {
            var c = str.charCodeAt(i);
            if (c < 0x80) {
                out.push(c);
            } else if (c < 0x800) {
                out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
            } else if (c >= 0xD800 && c <= 0xDBFF) {
                var c2 = str.charCodeAt(++i);
                var cp = ((c - 0xD800) << 10) + (c2 - 0xDC00) + 0x10000;
                out.push(
                    0xF0 | (cp >> 18),
                    0x80 | ((cp >> 12) & 0x3F),
                    0x80 | ((cp >> 6) & 0x3F),
                    0x80 | (cp & 0x3F)
                );
            } else {
                out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
            }
        }
        return out;
    }

    /* ============================================================
       6. CORE · Generar matriz QR
       ============================================================ */
    function createQRCode(text) {
        var bytes = utf8Bytes(String(text));

        // Elegir la versión mínima que quepa
        var typeNumber = 1;
        var maxBytes = 0;
        for (var t = 1; t <= 40; t++) {
            var rsBlocks = RS_BLOCK_TABLE[(t - 1) * 4 + (ERROR_CORRECT_L - 1)];
            var totalDataCount = 0;
            for (var r = 0; r < rsBlocks.length; r += 3) {
                totalDataCount += rsBlocks[r + 2];
            }
            // 4 bits modo + 8 bits length (para v1-9)
            var headerLen = (t <= 9) ? 12 : 16;
            var available = totalDataCount * 8 - headerLen;
            if (Math.ceil(bytes.length * 8) <= available) {
                typeNumber = t;
                maxBytes = available;
                break;
            }
        }

        // Bit buffer
        var buffer = new BitBuffer();
        buffer.put(MODE_8BIT, 4);
        if (typeNumber <= 9) {
            buffer.put(bytes.length, 8);
        } else {
            buffer.put(bytes.length, 16);
        }
        for (var b = 0; b < bytes.length; b++) {
            buffer.put(bytes[b], 8);
        }

        // Terminador + padding
        var rsBlocksForType = RS_BLOCK_TABLE[(typeNumber - 1) * 4 + (ERROR_CORRECT_L - 1)];
        var totalDataCount = 0;
        for (var r2 = 0; r2 < rsBlocksForType.length; r2 += 3) {
            totalDataCount += rsBlocksForType[r2 + 2];
        }
        var totalBits = totalDataCount * 8;

        if (buffer.length + 4 <= totalBits) buffer.put(0, 4);
        while (buffer.length % 8 !== 0) buffer.putBit(false);

        var PAD0 = 0xEC, PAD1 = 0x11;
        var padByteToggle = true;
        while (buffer.buffer.length < totalDataCount) {
            buffer.put(padByteToggle ? PAD0 : PAD1, 8);
            padByteToggle = !padByteToggle;
        }

        // Interleave data
        var dataBytes = buffer.buffer;

        var rsBlocks = [];
        var offset = 0;
        for (var r3 = 0; r3 < rsBlocksForType.length; r3 += 3) {
            var count = rsBlocksForType[r3];
            var totalCount = rsBlocksForType[r3 + 1];
            var dataCount = rsBlocksForType[r3 + 2];
            for (var c = 0; c < count; c++) {
                rsBlocks.push({
                    totalCount: totalCount,
                    dataCount: dataCount
                });
            }
        }

        // Calcular bloques con RS
        var dcdata = [];
        var ecdata = [];
        var offset2 = 0;
        for (var i2 = 0; i2 < rsBlocks.length; i2++) {
            var rsBlock = rsBlocks[i2];
            var dcCount = rsBlock.dataCount;
            var ecCount = rsBlock.totalCount - dcCount;
            var dc = dataBytes.slice(offset2, offset2 + dcCount);
            offset2 += dcCount;

            var rsPoly = errorCorrectPolynomial(ecCount);
            var rawPoly = new Polynomial(dc, rsPoly.getLength() - 1);
            var modPoly = rawPoly.mod(rsPoly);

            var ec = new Array(rsPoly.getLength() - 1);
            for (var j2 = 0; j2 < ec.length; j2++) {
                var modIndex = j2 + modPoly.getLength() - ec.length;
                ec[j2] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
            }
            dcdata.push(dc);
            ecdata.push(ec);
        }

        // Interleave
        var data = [];
        var maxDcCount = 0, maxEcCount = 0;
        for (var k2 = 0; k2 < dcdata.length; k2++) {
            maxDcCount = Math.max(maxDcCount, dcdata[k2].length);
            maxEcCount = Math.max(maxEcCount, ecdata[k2].length);
        }
        for (var idx = 0; idx < maxDcCount; idx++) {
            for (var i3 = 0; i3 < dcdata.length; i3++) {
                if (idx < dcdata[i3].length) data.push(dcdata[i3][idx]);
            }
        }
        for (var idx2 = 0; idx2 < maxEcCount; idx2++) {
            for (var i4 = 0; i4 < ecdata.length; i4++) {
                if (idx2 < ecdata[i4].length) data.push(ecdata[i4][idx2]);
            }
        }

        // ---- Crear matriz ----
        var moduleCount = typeNumber * 4 + 17;
        var modules = [];
        for (var row = 0; row < moduleCount; row++) {
            modules.push(new Array(moduleCount).fill(null));
        }

        setupPositionProbePattern(modules, 0, 0, moduleCount);
        setupPositionProbePattern(modules, moduleCount - 7, 0, moduleCount);
        setupPositionProbePattern(modules, 0, moduleCount - 7, moduleCount);
        setupPositionAdjustPattern(modules, typeNumber, moduleCount);
        setupTimingPattern(modules, moduleCount);
        setupTypeInfo(modules, typeNumber, moduleCount);
        mapData(modules, data, moduleCount);

        return {
            moduleCount: moduleCount,
            modules: modules
        };
    }

    function setupPositionProbePattern(modules, row, col, moduleCount) {
        for (var r = -1; r <= 7; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (var c = -1; c <= 7; c++) {
                if (col + c < 0 || moduleCount <= col + c) continue;
                if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
                    (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
                    (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
                    modules[row + r][col + c] = true;
                } else {
                    modules[row + r][col + c] = false;
                }
            }
        }
    }

    function setupPositionAdjustPattern(modules, typeNumber, moduleCount) {
        var pos = ALIGNMENT_PATTERN_TABLE[typeNumber];
        if (!pos || pos.length === 0) return;
        for (var i = 0; i < pos.length; i++) {
            for (var j = 0; j < pos.length; j++) {
                var row = pos[i];
                var col = pos[j];
                if (modules[row][col] !== null) continue;
                for (var r = -2; r <= 2; r++) {
                    for (var c = -2; c <= 2; c++) {
                        if (r === -2 || r === 2 || c === -2 || c === 2 ||
                            (r === 0 && c === 0)) {
                            modules[row + r][col + c] = true;
                        } else {
                            modules[row + r][col + c] = false;
                        }
                    }
                }
            }
        }
    }

    function setupTimingPattern(modules, moduleCount) {
        for (var r = 8; r < moduleCount - 8; r++) {
            if (modules[r][6] !== null) continue;
            modules[r][6] = (r % 2 === 0);
        }
        for (var c = 8; c < moduleCount - 8; c++) {
            if (modules[6][c] !== null) continue;
            modules[6][c] = (c % 2 === 0);
        }
    }

    function setupTypeInfo(modules, typeNumber, moduleCount) {
        // Formato info (nivel L + máscara 0)
        var data = (ERROR_CORRECT_L << 3) | 0;
        var bits = getBCHTypeInfo(data);

        for (var i = 0; i < 15; i++) {
            var mod = ((bits >> i) & 1) === 1;

            if (i < 6) {
                modules[i][8] = mod;
            } else if (i < 8) {
                modules[i + 1][8] = mod;
            } else {
                modules[moduleCount - 15 + i][8] = mod;
            }
        }
        for (var j = 0; j < 15; j++) {
            var mod2 = ((bits >> j) & 1) === 1;

            if (j < 8) {
                modules[8][moduleCount - j - 1] = mod2;
            } else if (j < 9) {
                modules[8][15 - j - 1 + 1] = mod2;
            } else {
                modules[8][15 - j - 1] = mod2;
            }
        }
        modules[moduleCount - 8][8] = true;
    }

    function getBCHTypeInfo(data) {
        var d = data << 10;
        while (getBCHDigit(d) - getBCHDigit(0x537) >= 0) {
            d ^= (0x537 << (getBCHDigit(d) - getBCHDigit(0x537)));
        }
        return ((data << 10) | d) ^ 0x5412;
    }

    function getBCHDigit(data) {
        var digit = 0;
        while (data !== 0) {
            digit++;
            data >>>= 1;
        }
        return digit;
    }

    function mapData(modules, data, moduleCount) {
        var inc = -1;
        var row = moduleCount - 1;
        var bitIndex = 7;
        var byteIndex = 0;

        for (var col = moduleCount - 1; col > 0; col -= 2) {
            if (col === 6) col--;
            while (true) {
                for (var c = 0; c < 2; c++) {
                    if (modules[row][col - c] === null) {
                        var dark = false;
                        if (byteIndex < data.length) {
                            dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
                        }
                        var mask = getMask(0, row, col - c);
                        if (mask) dark = !dark;
                        modules[row][col - c] = dark;
                        bitIndex--;
                        if (bitIndex === -1) {
                            byteIndex++;
                            bitIndex = 7;
                        }
                    }
                }
                row += inc;
                if (row < 0 || moduleCount <= row) {
                    row -= inc;
                    inc = -inc;
                    break;
                }
            }
        }
    }

    function getMask(maskPattern, i, j) {
        switch (maskPattern) {
            case 0: return (i + j) % 2 === 0;
            case 1: return i % 2 === 0;
            case 2: return j % 3 === 0;
            case 3: return (i + j) % 3 === 0;
            case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
            case 5: return (i * j) % 2 + (i * j) % 3 === 0;
            case 6: return ((i * j) % 2 + (i * j) % 3) % 2 === 0;
            case 7: return ((i * j) % 3 + (i + j) % 2) % 2 === 0;
            default: throw new Error('bad maskPattern:' + maskPattern);
        }
    }

    /* ============================================================
       7. API PÚBLICA · generar() y generarSVG()
       ============================================================ */
    function generarSVG(texto, opciones) {
        opciones = opciones || {};
        var margin = (opciones.margin != null) ? opciones.margin : 2;
        var size = opciones.size || 260;

        var qr;
        try {
            qr = createQRCode(texto);
        } catch (e) {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size +
                   '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
                   '<rect width="100%" height="100%" fill="#fee2e2"/>' +
                   '<text x="50%" y="50%" text-anchor="middle" fill="#991b1b" font-size="12">QR no disponible</text>' +
                   '</svg>';
        }

        var moduleCount = qr.moduleCount;
        var cellSize = size / (moduleCount + margin * 2);

        var paths = [];
        for (var r = 0; r < moduleCount; r++) {
            for (var c = 0; c < moduleCount; c++) {
                if (qr.modules[r][c]) {
                    var x = (c + margin) * cellSize;
                    var y = (r + margin) * cellSize;
                    paths.push(
                        'M' + x.toFixed(2) + ' ' + y.toFixed(2) +
                        'h' + cellSize.toFixed(2) +
                        'v' + cellSize.toFixed(2) +
                        'h-' + cellSize.toFixed(2) + 'z'
                    );
                }
            }
        }

        var bgColor = opciones.bgColor || '#ffffff';
        var fgColor = opciones.fgColor || '#0f172a';

        return '<svg xmlns="http://www.w3.org/2000/svg" ' +
               'width="' + size + '" height="' + size + '" ' +
               'viewBox="0 0 ' + size + ' ' + size + '" ' +
               'shape-rendering="crispEdges">' +
               '<rect width="100%" height="100%" fill="' + bgColor + '"/>' +
               '<path d="' + paths.join(' ') + '" fill="' + fgColor + '"/>' +
               '</svg>';
    }

    function generarDataURL(texto, opciones) {
        var svg = generarSVG(texto, opciones);
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    /* ============================================================
       8. EXPORT
       ============================================================ */
    var QR = {
        generarSVG:    generarSVG,
        generarDataURL: generarDataURL,
        generar:       generarDataURL
    };

    global.QR = QR;

})(typeof window !== 'undefined' ? window : this);