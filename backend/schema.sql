-- ============================================================
-- schema.sql — Estructura de la base de datos de CHAMAS SPA
-- Compatible con MySQL 8 / TiDB Cloud.
-- Uso: aplicar en la base indicada por DB_NAME (ver .env).
-- No ejecuta DROP ni borra datos existentes.
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NULL,
    password VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'cliente',
    telefono VARCHAR(30) NULL,
    porcentaje_retiro DECIMAL(5,2) NULL DEFAULT 70,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS servicios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,
    precio DECIMAL(10,2) NOT NULL DEFAULT 0,
    imagen VARCHAR(255) NULL,
    duracion INT NOT NULL DEFAULT 60,
    dias_disponibles VARCHAR(100) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profesional_servicios (
    profesional_id BIGINT NOT NULL,
    servicio_id BIGINT NOT NULL,
    PRIMARY KEY (profesional_id, servicio_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS disponibilidad_fechas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    profesional_id BIGINT NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    UNIQUE KEY uq_prof_fecha_hora (profesional_id, fecha, hora_inicio)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS turnos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cliente_id BIGINT NULL,
    cliente_nombre VARCHAR(150) NULL,
    cliente_telefono VARCHAR(30) NULL,
    cliente_email VARCHAR(150) NULL,
    profesional_id BIGINT NOT NULL,
    servicio_id BIGINT NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    precio DECIMAL(10,2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'confirmado',
    tipo VARCHAR(20) NOT NULL DEFAULT 'normal',
    notas TEXT NULL,
    recordatorio_enviado TINYINT(1) NOT NULL DEFAULT 0,
    fin_real TIME NULL,
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS turno_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    turno_id BIGINT NOT NULL,
    servicio_id BIGINT NULL,
    nombre VARCHAR(100) NOT NULL,
    precio DECIMAL(10,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clientes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NULL,
    telefono VARCHAR(30) NULL,
    fecha_nacimiento DATE NULL,
    direccion VARCHAR(255) NULL,
    notas TEXT NULL,
    fecha_ultima_visita DATETIME NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cupones (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cliente_id BIGINT NOT NULL,
    servicio_id BIGINT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'autorizado',
    creado_por BIGINT NULL,
    fecha_autorizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_envio DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cajas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
    monto_inicial DECIMAL(10,2) NOT NULL DEFAULT 0,
    monto_final DECIMAL(10,2) NULL,
    cajero_id BIGINT NULL,
    cajero_nombre VARCHAR(100) NULL,
    total_efectivo DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_transferencia DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_debito DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_credito DECIMAL(10,2) NOT NULL DEFAULT 0,
    abierta_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cerrada_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tickets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    numero BIGINT NOT NULL,
    turno_id BIGINT NULL,
    cliente_nombre VARCHAR(150) NULL,
    cliente_telefono VARCHAR(30) NULL,
    cliente_email VARCHAR(150) NULL,
    profesional_nombre VARCHAR(100) NULL,
    items TEXT NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    descuento DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    metodo_pago VARCHAR(20) NOT NULL DEFAULT 'efectivo',
    cajero_id BIGINT NULL,
    cajero_nombre VARCHAR(100) NULL,
    tipo_comprobante VARCHAR(20) NOT NULL DEFAULT 'ticket',
    caja_id BIGINT NULL,
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_numero (numero)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gastos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'compra',
    descripcion VARCHAR(255) NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    metodo_pago VARCHAR(20) NOT NULL DEFAULT 'efectivo',
    caja_id BIGINT NULL,
    registrado_por BIGINT NULL,
    registrado_por_nombre VARCHAR(100) NULL,
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS retiros (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    caja_id BIGINT NULL,
    profesional_id BIGINT NOT NULL,
    profesional_nombre VARCHAR(100) NOT NULL,
    fecha DATE NOT NULL,
    monto_bruto DECIMAL(10,2) NOT NULL DEFAULT 0,
    porcentaje_retiro DECIMAL(5,2) NOT NULL DEFAULT 70,
    monto_retirado DECIMAL(10,2) NOT NULL DEFAULT 0,
    monto_estetica DECIMAL(10,2) NOT NULL DEFAULT 0,
    creado_por BIGINT NULL,
    metodo_retiro VARCHAR(20) NOT NULL DEFAULT 'efectivo',
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS arqueo_caja (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    caja_id BIGINT NOT NULL,
    denominacion VARCHAR(30) NOT NULL,
    tipo VARCHAR(10) NOT NULL DEFAULT 'billete',
    cantidad INT NOT NULL DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recuperaciones (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    codigo VARCHAR(10) NOT NULL,
    expira_at DATETIME NOT NULL,
    usado TINYINT(1) NOT NULL DEFAULT 0,
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(50) NOT NULL PRIMARY KEY,
    valor TEXT NULL
) ENGINE=InnoDB;

-- ============================================================
-- ÍNDICES SUGERIDOS (consultas más frecuentes del backend)
-- ============================================================

CREATE INDEX idx_turnos_prof_fecha ON turnos (profesional_id, fecha);
CREATE INDEX idx_turnos_cliente    ON turnos (cliente_id);
CREATE INDEX idx_turnos_fecha      ON turnos (fecha);
CREATE INDEX idx_usuarios_email    ON usuarios (email);
CREATE INDEX idx_usuarios_telefono ON usuarios (telefono);
CREATE INDEX idx_cupones_cliente   ON cupones (cliente_id);
CREATE INDEX idx_tickets_caja      ON tickets (caja_id);
CREATE INDEX idx_gastos_caja       ON gastos (caja_id);
CREATE INDEX idx_retiros_caja      ON retiros (caja_id);
CREATE INDEX idx_arqueo_caja       ON arqueo_caja (caja_id);