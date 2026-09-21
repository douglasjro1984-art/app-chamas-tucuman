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
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Nuevos campos para RBAC extendido
    desde_manana TIME NULL DEFAULT '10:00:00',
    desde_tarde TIME NULL DEFAULT '15:00:00',
    permisos_especiales JSON NULL,
    INDEX idx_usuarios_rol (rol)
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
    categoria VARCHAR(30) NOT NULL DEFAULT 'general',
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_servicios_categoria (categoria),
    INDEX idx_servicios_activo (activo)
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
    servicio_id BIGINT NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'disponible',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_prof_fecha_hora_serv (profesional_id, fecha, hora_inicio, servicio_id)
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
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_turnos_estado (estado),
    INDEX idx_turnos_prof_fecha (profesional_id, fecha),
    INDEX idx_turnos_cliente (cliente_id),
    INDEX idx_turnos_fecha (fecha)
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
    cerrada_at DATETIME NULL,
    INDEX idx_cajas_fecha (fecha),
    INDEX idx_cajas_estado (estado)
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
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_retiros_caja (caja_id),
    INDEX idx_retiros_profesional (profesional_id)
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
-- NUEVAS TABLAS PARA RBAC Y CONFIGURACIÓN
-- ============================================================

-- Tabla de permisos por rol
CREATE TABLE IF NOT EXISTS permisos_roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rol VARCHAR(20) NOT NULL,
    permiso VARCHAR(50) NOT NULL,
    descripcion VARCHAR(200) NULL,
    UNIQUE KEY uq_rol_permiso (rol, permiso)
) ENGINE=InnoDB;

-- Configuración de horarios por profesional
CREATE TABLE IF NOT EXISTS horarios_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    profesional_id BIGINT NOT NULL,
    desde_manana TIME NOT NULL DEFAULT '10:00:00',
    hasta_manana TIME NOT NULL DEFAULT '12:30:00',
    desde_tarde TIME NOT NULL DEFAULT '15:00:00',
    hasta_tarde TIME NOT NULL DEFAULT '19:00:00',
    tipo_turno VARCHAR(20) NOT NULL DEFAULT 'ambos',
    dias_laborables VARCHAR(100) NULL DEFAULT 'Lunes,Martes,Miércoles,Jueves,Viernes,Sábado',
    paso_tiempo INT NOT NULL DEFAULT 90,
    INDEX idx_horarios_profesional (profesional_id)
) ENGINE=InnoDB;

-- Cierre semanal de caja (para especialistas como Carmen)
CREATE TABLE IF NOT EXISTS cajas_semanal (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    caja_id BIGINT NOT NULL,
    profesional_id BIGINT NOT NULL,
    profesional_nombre VARCHAR(100) NOT NULL,
    semana_inicio DATE NOT NULL,
    semana_fin DATE NOT NULL,
    monto_inicial DECIMAL(10,2) NOT NULL DEFAULT 0,
    monto_final DECIMAL(10,2) NULL,
    total_ventas DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_gastos DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_retiros DECIMAL(10,2) NOT NULL DEFAULT 0,
    comision_profesional DECIMAL(10,2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
    cerrada_at DATETIME NULL,
    INDEX idx_cajas_sem_profesional (profesional_id, semana_inicio),
    INDEX idx_cajas_sem_estado (estado)
) ENGINE=InnoDB;

-- Índices adicionales
CREATE INDEX idx_servicios_categoria ON servicios (categoria);
CREATE INDEX idx_usuarios_rol ON usuarios (rol);
CREATE INDEX idx_turnos_estado ON turnos (estado);
CREATE INDEX idx_horarios_profesional ON horarios_config (profesional_id);

-- ============================================================
-- INSERCIÓN DE ROLLES Y PERMISOS INICIALES
-- ============================================================

-- Roles y permisos por defecto
INSERT IGNORE INTO permisos_roles (rol, permiso, descripcion) VALUES
    ('super_admin', 'gestion_total', 'Acceso total al sistema: usuarios, roles, permisos'),
    ('super_admin', 'gestionar_turnos_todos', 'Agendar y gestionar turnos de todos los profesionales'),
    ('super_admin', 'gestionar_servicios', 'Agregar, editar y eliminar servicios'),
    ('super_admin', 'gestionar_precios', 'Actualizar precios de todos los servicios'),
    ('super_admin', 'admin_contable', 'Acceso al módulo de administración contable y financiera'),
    ('super_admin', 'acceso_clientes', 'Acceso total a la base de datos de clientas'),
    ('super_admin', 'asignar_roles', 'Asignar tareas, funciones y permisos a otros usuarios'),
    ('super_admin', 'gestionar_horarios_todos', 'Gestionar horarios de todos los profesionales'),

    ('admin', 'gestionar_turnos_todos', 'Agendar y gestionar turnos de todos los profesionales'),
    ('admin', 'gestionar_servicios', 'Agregar, editar y eliminar servicios'),
    ('admin', 'gestionar_precios', 'Actualizar precios de todos los servicios'),
    ('admin', 'admin_contable', 'Acceso al módulo de administración contable'),
    ('admin', 'acceso_clientes', 'Acceso total a la base de datos de clientas'),
    ('admin', 'gestionar_horarios_todos', 'Gestionar horarios de todos los profesionales'),
    ('admin', 'gestionar_sobreturnos', 'Crear y gestionar sobreturnos'),

    ('profesional', 'gestionar_propios_turnos', 'Agendar y editar exclusivamente sus propios turnos'),
    ('profesional', 'gestionar_propios_horarios', 'Configurar únicamente sus propios horarios de atención'),

    ('especialista', 'gestionar_propios_turnos', 'Agendar y editar exclusivamente sus propios turnos'),
    ('especialista', 'gestionar_propios_horarios', 'Configurar únicamente sus propios horarios de atención'),
    ('especialista', 'gestionar_servicios_categoria', 'Agregar, editar y eliminar servicios de su categoría'),
    ('especialista', 'gestionar_precios_propios', 'Editar y actualizar precios de sus servicios'),
    ('especialista', 'cierre_semanal', 'Realizar cierre de caja con frecuencia semanal');

-- Insertar categorías de servicios por defecto
INSERT IGNORE INTO configuracion (clave, valor) VALUES
    ('categoria_masajes', 'Masajes'),
    ('categoria_general', 'General'),
    ('categoria_depilacion', 'Depilación');