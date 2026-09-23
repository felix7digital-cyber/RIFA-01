-- ============================================================
-- MOTOR DE RIFAS · cloudflare/schema.sql
-- Esquema de la base de datos D1
-- Marco: CCG-IA v1.0.0 · Autor: Felix
-- ============================================================
--
-- Aplicar con:
--   wrangler d1 execute rifa-db --file=./schema.sql --remote
-- ============================================================

-- ============================================================
-- TABLA: registros
-- Un registro por cada número vendido o apartado.
-- ============================================================
CREATE TABLE IF NOT EXISTS registros (
    id              TEXT PRIMARY KEY,
    numero          TEXT NOT NULL,
    nombre          TEXT NOT NULL,
    cedula          TEXT NOT NULL,
    telefono        TEXT,
    estado          TEXT NOT NULL DEFAULT 'apartado',
    metodo_pago     TEXT,
    boleto          TEXT,
    acepto_terminos INTEGER DEFAULT 0,
    version_terminos TEXT,
    notas           TEXT,
    fecha           TEXT NOT NULL,
    updated_at      TEXT
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_registros_numero  ON registros(numero);
CREATE INDEX IF NOT EXISTS idx_registros_cedula  ON registros(cedula);
CREATE INDEX IF NOT EXISTS idx_registros_estado  ON registros(estado);
CREATE INDEX IF NOT EXISTS idx_registros_fecha   ON registros(fecha DESC);

-- Restricción: un solo registro por número
CREATE UNIQUE INDEX IF NOT EXISTS uniq_registros_numero ON registros(numero);

-- ============================================================
-- TABLA: config
-- Guarda la configuración visual desde el admin, para que
-- distintos dispositivos puedan ver los mismos colores.
-- ============================================================
CREATE TABLE IF NOT EXISTS config (
    clave       TEXT PRIMARY KEY,
    valor       TEXT NOT NULL,
    updated_at  TEXT
);

-- ============================================================
-- TABLA: logs (opcional, para auditoría)
-- ============================================================
CREATE TABLE IF NOT EXISTS logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    accion      TEXT NOT NULL,
    detalle     TEXT,
    ip          TEXT,
    user_agent  TEXT,
    fecha       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_fecha ON logs(fecha DESC);

-- ============================================================
-- VISTA: stats
-- Stats agregadas para consultar en un solo query.
-- ============================================================
CREATE VIEW IF NOT EXISTS v_stats AS
SELECT
    COUNT(*)                                              AS total_ocupados,
    SUM(CASE WHEN estado = 'pagado'   THEN 1 ELSE 0 END)  AS total_pagados,
    SUM(CASE WHEN estado = 'apartado' THEN 1 ELSE 0 END)  AS total_apartados,
    COUNT(DISTINCT cedula)                                AS total_clientes
FROM registros;

-- ============================================================
-- DATOS INICIALES
-- ============================================================
INSERT OR IGNORE INTO config (clave, valor, updated_at)
VALUES ('version', 'v2', datetime('now'));

-- ============================================================
-- FIN DEL ESQUEMA
-- ============================================================