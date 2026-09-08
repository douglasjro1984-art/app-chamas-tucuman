const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('./database'); 

const app = express();

// ============================================
//  CONFIGURACIÓN DE SEGURIDAD
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'cambiar-este-secreto-en-produccion';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Lista de orígenes permitidos para CORS
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5500',
    'https://chamas-spa.onrender.com'
];

// Limitador de peticiones general: máx 300 por IP cada 15 min
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiadas peticiones. Intentá de nuevo más tarde.' }
});

// Limitador estricto para login/registro: máx 10 intentos por 15 min
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiados intentos. Intentá de nuevo en 15 minutos.' }
});

// ============================================
//  MIDDLEWARES
// ============================================
app.use(cors({
    origin: (origin, callback) => {
        // Permitir peticiones sin origen (curl, herramientas, mismo servidor)
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use('/api', generalLimiter);

// Servir el frontend estático desde la raíz del proyecto.
// IMPORTANTE: bloqueamos explícitamente el acceso a carpetas y archivos sensibles
// (backend/, node_modules/, .env, package-lock, etc.) para no exponerlos.
const BLOCKED_STATIC = [
    '/backend/', '/node_modules/', '/.env', '/package-lock.json',
    '/git', '/TiDB Cloud', '/.git/', '/readme', '/verificar_db', '/update_passwords'
];
app.use((req, res, next) => {
    if (BLOCKED_STATIC.some(seg => req.path.toLowerCase().includes(seg.toLowerCase()))) {
        return res.status(404).send('Not found');
    }
    next();
});
app.use(express.static(path.join(__dirname, '../')));
app.use('/img', express.static(path.join(__dirname, '../img')));

// Helper: registra peticiones solo en desarrollo (evita loguear datos en producción)
if (NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`📨 ${req.method} ${req.url}`);
        next();
    });
}

// ============================================
//  AUTENTICACIÓN JWT
// ============================================
// Genera un token firmado con los datos del usuario (sin password)
function generarToken(usuario) {
    return jwt.sign(
        { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre },
        JWT_SECRET,
        { expiresIn: '8h' }
    );
}

// Middleware: verifica que haya un token válido y adjunta el usuario a req.usuario
function autenticar(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
    }
    const token = header.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.usuario = payload;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Sesión expirada o inválida' });
    }
}

// Middleware: restringe por rol (["admin"], ["admin","profesional"], etc.)
function autorizar(rolesPermitidos) {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ success: false, message: 'No autenticado' });
        }
        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({ success: false, message: 'No tenés permiso para esta acción' });
        }
        next();
    };
}

// Manejo de errores de CORS: responder un error limpio sin exponer detalles
app.use((err, req, res, next) => {
    if (err.message === 'Origen no permitido por CORS') {
        return res.status(403).json({ success: false, message: 'Origen no permitido' });
    }
    console.error('❌ Error no controlado:', err.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// ============================================
//  AUTENTICACIÓN - RUTA DE LOGIN
// ============================================
app.post('/api/auth/login', authLimiter, async (req, res) => {
    // Acepta "emailOTelefono" (nuevo) o "email" (compatibilidad)
    const identificador = (req.body.emailOTelefono || req.body.email || '').trim();
    const password      = req.body.password;

    if (!identificador || !password) {
        return res.json({ success: false, message: 'Ingresá tu email o teléfono y contraseña' });
    }

    try {
        // Buscar por email O por teléfono
        const [rows] = await pool.query(
            `SELECT id, nombre, email, rol, telefono, password
             FROM usuarios
             WHERE email = ? OR telefono = ?
             LIMIT 1`,
            [identificador, identificador]
        );

        if (rows.length === 0) {
            return res.json({ success: false, message: 'Datos incorrectos. Revisá tu email, teléfono o contraseña.' });
        }

        const usuario = rows[0];
        const passwordMatch = await bcrypt.compare(password, usuario.password);
        const usuarioSinPassword = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, telefono: usuario.telefono };

        if (passwordMatch) {
            const token = generarToken(usuarioSinPassword);
            res.json({ success: true, token, usuario: usuarioSinPassword });
        } else {
            res.json({ success: false, message: 'Datos incorrectos. Revisá tu email, teléfono o contraseña.' });
        }
    } catch (error) {
        console.error('❌ Error login:', error.message);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});


// ============================================
//  REGISTRO DE CLIENTE (desde el login público)
// ============================================
app.post('/api/auth/registro', authLimiter, async (req, res) => {
    const { nombre, email, telefono, password, rol = 'cliente' } = req.body;

    if (!nombre || !email || !telefono || !password) {
        return res.status(400).json({ success: false, message: 'Completá todos los campos' });
    }
    if (rol !== 'cliente') {
        return res.status(400).json({ success: false, message: 'Solo se pueden crear cuentas de cliente' });
    }
    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    try {
        // Verificar email duplicado
        const [porEmail] = await pool.query(
            'SELECT id FROM usuarios WHERE email = ?', [email]
        );
        if (porEmail.length > 0) {
            return res.status(400).json({ success: false, message: 'Ese email ya está registrado' });
        }

        // Verificar teléfono duplicado (compatible con TiDB Cloud)
        const [porTelefono] = await pool.query(
            'SELECT id FROM usuarios WHERE telefono = ?', [telefono]
        );
        if (porTelefono.length > 0) {
            return res.status(400).json({ success: false, message: 'Ese teléfono ya está registrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Intentar insertar con telefono; si falla por columna inexistente, insertar sin él
        try {
            const [result] = await pool.query(
                'INSERT INTO usuarios (nombre, email, password, rol, telefono) VALUES (?, ?, ?, ?, ?)',
                [nombre, email, hashedPassword, 'cliente', telefono]
            );
        } catch (insertError) {
            // Si falla por columna telefono inexistente, intentar sin telefono
            if (insertError.code === 'ER_BAD_FIELD_ERROR' && insertError.message.includes('telefono')) {
                await pool.query(
                    'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
                    [nombre, email, hashedPassword, 'cliente']
                );
            } else {
                throw insertError;
            }
        }

        res.json({ success: true, message: '¡Cuenta creada exitosamente!' });
    } catch (error) {
        console.error('❌ Error en registro:', error.message);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

// ============================================
//  VERIFICAR SESIÓN (para reconstruir sesión al recargar)
// ============================================
app.get('/api/auth/me', autenticar, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, nombre, email, rol, telefono FROM usuarios WHERE id = ?',
            [req.usuario.id]
        );
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
        }
        res.json({ success: true, usuario: rows[0] });
    } catch (error) {
        console.error('❌ Error en /auth/me:', error.message);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

// ============================================
//  CREAR USUARIO / REGISTRAR PROFESIONAL
// ============================================
app.post('/api/usuarios', autenticar, autorizar(['admin']), async (req, res) => {
    const { nombre, email, password, telefono, rol = 'profesional', servicios, porcentaje_retiro } = req.body;
    
    // Validaciones básicas
    if (!nombre || !email || !password || !telefono) {
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
    }
    
    if (rol !== 'profesional' && rol !== 'cliente' && rol !== 'caja') {
        return res.status(400).json({ success: false, message: 'Solo se pueden crear profesionales, caja o clientes' });
    }

    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    try { 
        // Verificar si el email ya existe
        const [existente] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existente.length > 0) {
            return res.status(400).json({ success: false, message: 'El email ya está registrado' });
        }
        
        // Hash de contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insertar usuario
        const pct = (rol === 'profesional') ? Math.min(100, Math.max(0, parseFloat(porcentaje_retiro) || 70)) : null;
        const [result] = await pool.query(
            'INSERT INTO usuarios (nombre, email, password, rol, telefono, porcentaje_retiro) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, email, hashedPassword, rol, telefono, pct]
        );

        const nuevoId = result.insertId;
        
        // Asignar servicios si se proporcionan (array de IDs) y es profesional
        if (rol === 'profesional' && Array.isArray(servicios) && servicios.length > 0) {
            const valores = servicios.map(id => [nuevoId, id]);
            await pool.query('INSERT INTO profesional_servicios (profesional_id, servicio_id) VALUES ?', [valores]);
        }
        
        res.json({ success: true, id: nuevoId, message: 'Usuario registrado exitosamente' });
    } catch (error) {
        console.error('❌ Error creando usuario:', error.message);
        res.status(500).json({ success: false, message: 'Error al crear el usuario' });
    }
});

// Obtener un profesional/usuario con sus servicios asignados
// Editar un profesional/usuario (nombre, email, telefono, rol, servicios, contraseña opcional)
app.put('/api/usuarios/:id', autenticar, autorizar(['admin']), async (req, res) => {
    const { id } = req.params;
    const { nombre, email, telefono, password, rol, servicios, porcentaje_retiro } = req.body;
    try {
        const [u] = await pool.query('SELECT id, rol FROM usuarios WHERE id = ?', [id]);
        if (!u.length) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        if (u[0].rol === 'admin') return res.status(403).json({ success: false, message: 'No se puede editar el admin' });

        // Validar email único (excepto a sí mismo)
        if (email) {
            const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, id]);
            if (existe.length) return res.status(400).json({ success: false, message: 'El email ya está registrado' });
        }

        let campos = [];
        let valores = [];
        if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre); }
        if (email !== undefined) { campos.push('email = ?'); valores.push(email); }
        if (telefono !== undefined) { campos.push('telefono = ?'); valores.push(telefono); }
        if (rol !== undefined) { campos.push('rol = ?'); valores.push(rol); }
        if (porcentaje_retiro !== undefined) { campos.push('porcentaje_retiro = ?'); valores.push(Math.min(100, Math.max(0, parseFloat(porcentaje_retiro) || 0))); }
        if (password) {
            const hashed = await bcrypt.hash(password, 10);
            campos.push('password = ?'); valores.push(hashed);
        }
        if (campos.length) {
            valores.push(id);
            await pool.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, valores);
        }

        // Reemplazar servicios del profesional
        if (u[0].rol === 'profesional' && Array.isArray(servicios)) {
            await pool.query('DELETE FROM profesional_servicios WHERE profesional_id = ?', [id]);
            const nuevos = servicios.map(s => [id, parseInt(s)]).filter(([, s]) => !isNaN(s));
            if (nuevos.length) {
                await pool.query('INSERT INTO profesional_servicios (profesional_id, servicio_id) VALUES ?', [nuevos]);
            }
        }

        res.json({ success: true, message: 'Profesional actualizado correctamente' });
    } catch (error) {
        console.error('❌ Error editando usuario:', error.message);
        res.status(500).json({ success: false, message: 'Error al editar el usuario' });
    }
});

// ============================================
// 📦 SERVICIOS
// ============================================
app.get('/api/servicios', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM servicios WHERE activo = TRUE ORDER BY id');
        res.json(rows);
    } catch (error) {
        console.error('❌ Error servicios:', error.message);
        res.status(500).json({ error: 'Error al obtener servicios' });
    }
});

app.put('/api/servicios/:id', autenticar, autorizar(['admin']), async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio, imagen, activo } = req.body;

    try {
        let fields = [];
        let values = [];

        if (activo !== undefined) { fields.push('activo = ?'); values.push(activo ? 1 : 0); }
        if (precio !== undefined) { fields.push('precio = ?'); values.push(precio); }
        if (nombre !== undefined) { fields.push('nombre = ?'); values.push(nombre); }
        if (descripcion !== undefined) { fields.push('descripcion = ?'); values.push(descripcion); }
        if (imagen !== undefined) { fields.push('imagen = ?'); values.push(imagen); }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        values.push(id);
        await pool.query(`UPDATE servicios SET ${fields.join(', ')} WHERE id = ?`, values);

        res.json({ success: true, message: activo !== undefined ? (activo ? 'Servicio activado' : 'Servicio pausado') : 'Actualizado' });
    } catch (error) {
        console.error('❌ Error actualizando servicio:', error.message);
        res.status(500).json({ success: false, error: 'Error al actualizar el servicio' });
    }
});

// ============================================
// 📦 SERVICIOS — CREAR / PAUSAR / ELIMINAR
// ============================================

// Obtener TODOS los servicios incluyendo pausados (para el admin editor)
app.get('/api/servicios/todos', autenticar, autorizar(['admin']), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM servicios ORDER BY activo DESC, id');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Error al cargar servicios' }); }
});

// Crear nuevo servicio
app.post('/api/servicios', autenticar, autorizar(['admin']), async (req, res) => {
    const { nombre, descripcion, precio, imagen } = req.body;
    if (!nombre || !precio) return res.status(400).json({ success: false, message: 'Nombre y precio son obligatorios' });
    try {
        const [r] = await pool.query(
            'INSERT INTO servicios (nombre, descripcion, precio, imagen, activo) VALUES (?, ?, ?, ?, TRUE)',
            [nombre.trim(), descripcion||'', parseFloat(precio), imagen||'img/default.jpg']
        );
        res.json({ success: true, id: r.insertId, message: 'Servicio creado correctamente' });
    } catch (e) { console.error('❌ Error creando servicio:', e.message); res.status(500).json({ success: false, message: 'Error al crear el servicio' }); }
});

// Pausar / reactivar servicio (toggle activo)
app.patch('/api/servicios/:id/activo', autenticar, autorizar(['admin']), async (req, res) => {
    const { activo } = req.body; // true o false
    try {
        await pool.query('UPDATE servicios SET activo = ? WHERE id = ?', [activo ? 1 : 0, req.params.id]);
        res.json({ success: true, message: activo ? 'Servicio reactivado' : 'Servicio pausado' });
    } catch (e) { console.error('❌ Error:', e.message); res.status(500).json({ success: false, message: 'Error al actualizar el servicio' }); }
});

// Eliminar servicio (solo si no tiene turnos futuros)
app.delete('/api/servicios/:id', autenticar, autorizar(['admin']), async (req, res) => {
    const { id } = req.params;
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const [turnos] = await pool.query(
            'SELECT COUNT(*) as cnt FROM turnos WHERE servicio_id = ? AND fecha >= ?', [id, hoy]
        );
        if (turnos[0].cnt > 0) {
            return res.status(400).json({ success: false, message: `No se puede eliminar: tiene ${turnos[0].cnt} turno(s) próximo(s). Pausalo primero.` });
        }
        await pool.query('DELETE FROM profesional_servicios WHERE servicio_id = ?', [id]);
        await pool.query('DELETE FROM servicios WHERE id = ?', [id]);
        res.json({ success: true, message: 'Servicio eliminado' });
    } catch (e) { console.error('❌ Error eliminando servicio:', e.message); res.status(500).json({ success: false, message: 'Error al eliminar el servicio' }); }
});

// DELETE /api/usuarios
app.delete('/api/usuarios/:id', autenticar, autorizar(['admin']), async (req, res) => {
    const { id } = req.params;
    try {
        const [u] = await pool.query('SELECT rol, nombre FROM usuarios WHERE id = ?', [id]);
        if (!u.length) return res.status(404).json({ success: false, message: 'No encontrado' });
        if (u[0].rol === 'admin') return res.status(403).json({ success: false, message: 'No se puede eliminar admin' });
        await pool.query('DELETE FROM profesional_servicios WHERE profesional_id = ?', [id]);
        await pool.query('DELETE FROM disponibilidad_fechas WHERE profesional_id = ?', [id]);
        await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
        res.json({ success: true, message: `"${u[0].nombre}" eliminado` });
    } catch (e) { console.error('❌ Error eliminando usuario:', e.message); res.status(500).json({ success: false, message: 'Error al eliminar el usuario' }); }
});

// ============================================
// 👥 PROFESIONALES Y USUARIOS
// ============================================
app.get('/api/profesionales/servicio/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT u.id, u.nombre FROM usuarios u
             JOIN profesional_servicios ps ON u.id = ps.profesional_id
             WHERE ps.servicio_id = ? AND u.rol = 'profesional'`,
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('❌ Error profesionales servicio:', error.message);
        res.status(500).json({ error: 'Error al obtener profesionales' });
    }
});

// Profesionales que cubren TODOS los servicios seleccionados (multi-servicio)
app.post('/api/profesionales/servicios', async (req, res) => {
    const ids = Array.isArray(req.body.servicios) ? req.body.servicios.map(Number) : [];
    if (!ids.length) return res.status(400).json({ error: 'Indicá al menos un servicio' });
    try {
        const placeholders = ids.map(() => '?').join(', ');
        const [rows] = await pool.query(
            `SELECT u.id, u.nombre
             FROM usuarios u
             JOIN profesional_servicios ps ON u.id = ps.profesional_id
             WHERE u.rol = 'profesional' AND ps.servicio_id IN (${placeholders})
             GROUP BY u.id, u.nombre
             HAVING COUNT(DISTINCT ps.servicio_id) = ?`,
            [...ids, ids.length]
        );
        res.json(rows);
    } catch (error) {
        console.error('❌ Error profesionales multi-servicio:', error.message);
        res.status(500).json({ error: 'Error al obtener profesionales' });
    }
});

app.get('/api/usuarios/profesionales', autenticar, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, nombre, email, telefono, porcentaje_retiro FROM usuarios WHERE rol = 'profesional' ORDER BY nombre`
        );
        res.json(rows);
    } catch (error) {
        console.error('❌ Error profesionales:', error.message);
        res.status(500).json({ error: 'Error al obtener profesionales' });
    }
});

// Obtener un profesional/usuario con sus servicios asignados
app.get('/api/usuarios/:id', autenticar, autorizar(['admin']), async (req, res) => {
    const { id } = req.params;
    try {
        const [u] = await pool.query(
            'SELECT id, nombre, email, telefono, rol, porcentaje_retiro FROM usuarios WHERE id = ?', [id]
        );
        if (!u.length) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        const usuario = u[0];
        const [servicios] = await pool.query(
            'SELECT servicio_id FROM profesional_servicios WHERE profesional_id = ?', [id]
        );
        res.json({ success: true, usuario: { ...usuario, servicios: servicios.map(s => s.servicio_id) } });
    } catch (error) {
        console.error('❌ Error obteniendo usuario:', error.message);
        res.status(500).json({ success: false, message: 'Error al obtener el usuario' });
    }
});

// ============================================
// ⏰ DISPONIBILIDAD POR FECHAS EXACTAS
// ============================================

// Slots futuros de un profesional agrupados por fecha
app.get('/api/disponibilidad_completa/:id', async (req, res) => {
    try {
        const profesionalId = req.params.id;
        
        // Validar que el ID sea un número
        if (!profesionalId || isNaN(profesionalId)) {
            return res.status(400).json({ error: 'ID de profesional inválido' });
        }

        console.log('📅 Buscando disponibilidad para profesional:', profesionalId);

        // Verificar que la tabla existe
        const [tableCheck] = await pool.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_NAME='disponibilidad_fechas' LIMIT 1`
        );

        if (tableCheck.length === 0) {
            console.warn('⚠️ Tabla disponibilidad_fechas no existe');
            return res.json([]); // Retornar array vacío si no existe la tabla
        }

        // Obtener los datos
        const [rows] = await pool.query(
            `SELECT 
                DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
                TIME_FORMAT(hora_inicio, '%H:%i:%s') as hora_inicio
             FROM disponibilidad_fechas
             WHERE profesional_id = ? AND fecha >= CURDATE()
             ORDER BY fecha, hora_inicio`,
            [profesionalId]
        );

        console.log('✅ Disponibilidad cargada:', rows?.length || 0, 'registros');
        res.json(rows || []);
    } catch (error) {
        console.error('❌ Error en disponibilidad_completa:', error.message);
        // No retornar error 500, retornar array vacío
        res.json([]);
    }
});

// Fechas disponibles en un rango (para marcar el calendario del cliente)
app.get('/api/disponibilidad/rango/:profesionalId', async (req, res) => {
    const { profesionalId } = req.params;
    const { desde, hasta } = req.query;
    try {
        const [rows] = await pool.query(
            `SELECT DISTINCT df.fecha
             FROM disponibilidad_fechas df
             WHERE df.profesional_id = ?
               AND df.fecha >= COALESCE(?, CURDATE())
               AND df.fecha <= COALESCE(?, DATE_ADD(CURDATE(), INTERVAL 6 MONTH))
               AND df.fecha >= CURDATE()
               AND NOT EXISTS (
                   SELECT 1 FROM turnos t
                   WHERE t.profesional_id = df.profesional_id
                     AND t.fecha = df.fecha
                     AND t.hora_inicio = df.hora_inicio
               )
             ORDER BY df.fecha`,
            [profesionalId, desde || null, hasta || null]
        );
        // Devolver array de strings "YYYY-MM-DD"
        res.json(rows.map(r => {
            const d = new Date(r.fecha);
            return d.toISOString().split('T')[0];
        }));
    } catch (error) {
        console.error('❌ Error disponibilidad rango:', error.message);
        res.status(500).json({ error: 'Error al obtener fechas disponibles' });
    }
});

// Horas disponibles para un profesional en una fecha exacta
app.get('/api/disponibilidad/:profesionalId/:fecha', async (req, res) => {
    const { profesionalId, fecha } = req.params;
    try {
        const [rows] = await pool.query(
            `SELECT df.hora_inicio
             FROM disponibilidad_fechas df
             WHERE df.profesional_id = ?
               AND df.fecha = ?
               AND NOT EXISTS (
                   SELECT 1 FROM turnos t
                   WHERE t.profesional_id = df.profesional_id
                     AND t.fecha = df.fecha
                     AND t.hora_inicio = df.hora_inicio
               )
             ORDER BY df.hora_inicio`,
            [profesionalId, fecha]
        );
        res.json(rows);
    } catch (error) {
        console.error('❌ Error disponibilidad:', error.message);
        res.status(500).json({ error: 'Error al obtener horarios' });
    }
});

// Guardar disponibilidad: recibe rango + plantilla de días/horas
// y genera los slots concretos en disponibilidad_fechas
app.post('/api/disponibilidad', autenticar, autorizar(['admin','profesional']), async (req, res) => {
    const { profesional_id, desde, hasta, horarios } = req.body;
    // horarios: [{ dia: "Lunes", inicio: "09:00" }, ...]
    // desde / hasta: "YYYY-MM-DD"

    // Un profesional solo puede gestionar SU propia disponibilidad
    if (req.usuario.rol !== 'admin' && profesional_id !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No podés modificar horarios de otro profesional' });
    }

    if (!profesional_id || !desde || !hasta || !Array.isArray(horarios)) {
        return res.status(400).json({ success: false, message: 'Faltan datos' });
    }

    const mapDia = { 'Lunes':1,'Martes':2,'Miércoles':3,'Jueves':4,'Viernes':5,'Sábado':6,'Domingo':0 };

    try {
        // Borrar slots existentes en ese rango para ese profesional
        await pool.query(
            'DELETE FROM disponibilidad_fechas WHERE profesional_id = ? AND fecha BETWEEN ? AND ?',
            [profesional_id, desde, hasta]
        );

        if (horarios.length === 0) {
            return res.json({ success: true, count: 0 });
        }


        // Generar todas las fechas del rango
        const slots = [];
        const fechaInicio = new Date(desde + 'T00:00:00');
        const fechaFin    = new Date(hasta  + 'T00:00:00');
        const cursor = new Date(fechaInicio);

        while (cursor <= fechaFin) {
            const diaCursor = cursor.getDay(); // 0=Dom, 1=Lun ...
            const horasDelDia = horarios.filter(h => mapDia[h.dia] === diaCursor);
            horasDelDia.forEach(h => {
                const fechaStr = cursor.toISOString().split('T')[0];
                const horaStr  = h.inicio.length === 5 ? h.inicio + ':00' : h.inicio;
                slots.push([profesional_id, fechaStr, horaStr]);
            });
            cursor.setDate(cursor.getDate() + 1);
        }

        if (slots.length > 0) {
            await pool.query(
                'INSERT IGNORE INTO disponibilidad_fechas (profesional_id, fecha, hora_inicio) VALUES ?',
                [slots]
            );
        }

        res.json({ success: true, count: slots.length });
    } catch (error) {
        console.error('❌ Error guardando disponibilidad:', error.message);
        res.status(500).json({ success: false, error: 'Error al guardar la disponibilidad' });
    }

});

// ============================================
// ✅ CALENDARIO INTERACTIVO - RUTAS
// ============================================

// POST: Guardar horarios directamente (fechas específicas)
app.post('/api/disponibilidad/guardar-directas', autenticar, autorizar(['admin','profesional']), async (req, res) => {
    const { profesional_id, horarios } = req.body;

    if (req.usuario.rol !== 'admin' && profesional_id !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No podés modificar horarios de otro profesional' });
    }

    if (!profesional_id || !Array.isArray(horarios) || horarios.length === 0) {
        return res.json({ success: false, message: 'Datos inválidos' });
    }

    try {
        let insertados = 0;

        for (const horario of horarios) {
            const { fecha, hora_inicio } = horario;
            if (!fecha || !hora_inicio) continue;

            // Verificar si ya existe
            const [existe] = await pool.query(
                'SELECT id FROM disponibilidad_fechas WHERE profesional_id = ? AND fecha = ? AND hora_inicio = ?',
                [profesional_id, fecha, hora_inicio]
            );

            if (existe.length === 0) {
                await pool.query(
                    'INSERT INTO disponibilidad_fechas (profesional_id, fecha, hora_inicio) VALUES (?, ?, ?)',
                    [profesional_id, fecha, hora_inicio]
                );
                insertados++;
            }
        }

        console.log(`✅ ${insertados} horarios guardados`);
        res.json({ success: true, message: `${insertados} horarios guardados`, count: insertados });
    } catch (error) {
        console.error('❌ Error al guardar horarios:', error.message);
        res.json({ success: false, message: 'Error del servidor' });
    }
});

// POST: Eliminar todos los horarios de una fecha específica
app.post('/api/disponibilidad/eliminar-fecha', autenticar, autorizar(['admin','profesional']), async (req, res) => {
    const { profesional_id, fecha } = req.body;

    if (req.usuario.rol !== 'admin' && profesional_id !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No podés modificar horarios de otro profesional' });
    }

    if (!profesional_id || !fecha) {
        return res.json({ success: false, message: 'Datos inválidos' });
    }

    try {
        const [result] = await pool.query(
            'DELETE FROM disponibilidad_fechas WHERE profesional_id = ? AND fecha = ?',
            [profesional_id, fecha]
        );

        res.json({ success: true, message: `${result.affectedRows} registros eliminados`, deletedCount: result.affectedRows });
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.json({ success: false, message: 'Error del servidor' });
    }
});

// POST: Eliminar una hora específica de TODOS los días
app.post('/api/disponibilidad/eliminar-horas', autenticar, autorizar(['admin','profesional']), async (req, res) => {
    const { profesional_id, horas } = req.body;

    if (req.usuario.rol !== 'admin' && profesional_id !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No podés modificar horarios de otro profesional' });
    }

    if (!profesional_id || !Array.isArray(horas) || horas.length === 0) {
        return res.json({ success: false, message: 'Datos inválidos' });
    }

    try {
        let deletedCount = 0;

        for (const hora of horas) {
            const horaFormato = `${hora}:00`;
            const [result] = await pool.query(
                'DELETE FROM disponibilidad_fechas WHERE profesional_id = ? AND hora_inicio = ?',
                [profesional_id, horaFormato]
            );
            deletedCount += result.affectedRows;
        }

        console.log(`✅ ${deletedCount} registros eliminados`);
        res.json({ success: true, message: `${deletedCount} registros eliminados`, deletedCount: deletedCount });
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.json({ success: false, message: 'Error del servidor' });
    }
});

// POST: Eliminar UNA hora específica de UNA fecha específica
app.post('/api/disponibilidad/eliminar-hora-especifica', autenticar, autorizar(['admin','profesional']), async (req, res) => {
    const { profesional_id, fecha, hora_inicio } = req.body;

    if (req.usuario.rol !== 'admin' && profesional_id !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No podés modificar horarios de otro profesional' });
    }

    if (!profesional_id || !fecha || !hora_inicio) {
        return res.json({ success: false, message: 'Datos inválidos' });
    }

    try {
        const [result] = await pool.query(
            'DELETE FROM disponibilidad_fechas WHERE profesional_id = ? AND fecha = ? AND hora_inicio = ?',
            [profesional_id, fecha, hora_inicio]
        );

        res.json({
            success: true,
            message: `Hora eliminada`,
            deletedCount: result.affectedRows
        });
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.json({ success: false, message: 'Error del servidor' });
    }
});

// ============================================
// 🚫 HORARIOS OCUPADOS
// ============================================
app.get('/api/horarios-ocupados/:profesionalId/:fecha', autenticar, async (req, res) => {
    const { profesionalId, fecha } = req.params;
    const excluirId = req.query.excluir; // Para excluir un turno al editar
    
    try {
        let query = 'SELECT hora_inicio FROM turnos WHERE profesional_id = ? AND fecha = ?';
        let params = [profesionalId, fecha];
        
        if (excluirId) {
            query += ' AND id != ?';
            params.push(excluirId);
        }
        
        query += ' ORDER BY hora_inicio';
        
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ error: 'Error al obtener horarios' });
    }
});

// ============================================
// 📅 TURNOS
// ============================================
// Todos los turnos (Admin)
app.get('/api/turnos/todos', autenticar, autorizar(['admin']), async (req, res) => {
    try {
        // Extraer parámetros de filtro
        const { profesional_id, fecha_desde, fecha_hasta } = req.query;
        
        let query = `
            SELECT t.id, t.fecha, t.hora_inicio,
                   t.profesional_id,
                   s.nombre as servicio, s.precio,
                   p.nombre as profesional,
                   COALESCE(t.cliente_nombre, c.nombre) as cliente_nombre,
                   COALESCE(t.cliente_telefono, c.telefono) as telefono,
                   c.nombre as registrado_por,
                   c.email
            FROM turnos t 
            JOIN servicios s ON t.servicio_id = s.id 
            JOIN usuarios p ON t.profesional_id = p.id
            JOIN usuarios c ON t.cliente_id = c.id
            WHERE 1=1
        `;
        
        let params = [];
        
        if (profesional_id) {
            query += ' AND t.profesional_id = ?';
            params.push(profesional_id);
        }
        
        if (fecha_desde) {
            query += ' AND t.fecha >= ?';
            params.push(fecha_desde);
        }
        
        if (fecha_hasta) {
            query += ' AND t.fecha <= ?';
            params.push(fecha_hasta);
        }
        
        query += ' ORDER BY t.fecha DESC, t.hora_inicio DESC';
        
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error turnos todos:', error.message);
        res.status(500).json({ error: 'Error al obtener los turnos' });
    }
});

// ============================================
// 📲 RECORDATORIOS (ADMIN / CAJA)
// ============================================
// Turnos de hoy y mañana con teléfono del cliente para enviar recordatorios
app.get('/api/recordatorios', autenticar, autorizar(['admin','caja']), async (req, res) => {
    try {
        const hoy = new Date();
        const fechas = [hoy];
        const maniana = new Date(hoy); maniana.setDate(hoy.getDate() + 1);
        fechas.push(maniana);
        const fmt = f => f.toISOString().slice(0, 10);
        const fechasStr = fechas.map(fmt);

        const [rows] = await pool.query(
            `SELECT t.id, t.fecha, DATE_FORMAT(t.hora_inicio, '%H:%i') as hora_inicio, t.estado,
                    COALESCE(t.cliente_nombre, c.nombre) as cliente_nombre,
                    COALESCE(t.cliente_telefono, c.telefono) as cliente_telefono,
                    p.nombre as profesional,
                    t.recordatorio_enviado
             FROM turnos t
             LEFT JOIN usuarios c ON t.cliente_id = c.id
             JOIN usuarios p ON t.profesional_id = p.id
             WHERE t.fecha IN (?, ?)
             ORDER BY t.fecha, t.hora_inicio`,
            fechasStr
        );
        res.json(rows);
    } catch (e) {
        console.error('❌ Error recordatorios:', e.message);
        res.status(500).json({ error: 'Error al obtener recordatorios' });
    }
});

// Marcar recordatorio como enviado
app.post('/api/recordatorios/:id/enviado', autenticar, autorizar(['admin','caja']), async (req, res) => {
    try {
        await pool.query('UPDATE turnos SET recordatorio_enviado = 1 WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error('❌ Error marcar recordatorio:', e.message);
        res.status(500).json({ success: false });
    }
});

// Obtener un turno específico
app.get('/api/turnos/:id', autenticar, async (req, res) => {
    const { id } = req.params;
    
    try {
        const [rows] = await pool.query(
            `SELECT t.id, t.fecha, t.hora_inicio, t.servicio_id, t.profesional_id, t.cliente_id,
                    s.nombre as servicio_nombre, s.precio,
                    p.nombre as profesional_nombre,
                    COALESCE(t.cliente_nombre, c.nombre) as cliente_nombre,
                    COALESCE(t.cliente_telefono, c.telefono) as telefono,
                    c.nombre as registrado_por
             FROM turnos t 
             JOIN servicios s ON t.servicio_id = s.id 
             JOIN usuarios p ON t.profesional_id = p.id
             JOIN usuarios c ON t.cliente_id = c.id
             WHERE t.id = ?`,
            [id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }

        // Restricción: solo admin, el profesional asignado o el cliente dueño del turno
        const turno = rows[0];
        if (req.usuario.rol !== 'admin' &&
            req.usuario.id !== turno.profesional_id &&
            req.usuario.id !== turno.cliente_id) {
            return res.status(403).json({ success: false, message: 'No tenés permiso para ver este turno' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ error: 'Error al obtener el turno' });
    }
});

// Turnos del profesional
app.get('/api/turnos/profesional/:id', autenticar, async (req, res) => {
    // Un profesional solo puede ver SUS propios turnos; admin puede ver todos
    if (req.usuario.rol !== 'admin' && parseInt(req.params.id) !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No tenés permiso para ver estos turnos' });
    }
    try {
        const [rows] = await pool.query(
            `SELECT t.id, t.fecha, t.hora_inicio,
                    COALESCE(t.cliente_nombre, u.nombre)     as cliente_nombre,
                    COALESCE(t.cliente_telefono, u.telefono) as telefono,
                    u.nombre as registrado_por,
                    s.nombre as servicio
             FROM turnos t 
             JOIN servicios s ON t.servicio_id = s.id 
             JOIN usuarios u ON t.cliente_id = u.id
             WHERE t.profesional_id = ? 
             ORDER BY t.fecha ASC, t.hora_inicio ASC`,
            [req.params.id]
        );
        res.json(rows || []);
    } catch (error) {
        console.error('❌ Error turnos profesional:', error.message);
        res.status(500).json({ error: 'Error al obtener los turnos' });
    }
});

// Turnos del cliente
app.get('/api/turnos/cliente/:id', autenticar, async (req, res) => {
    // Un cliente solo puede ver SUS propios turnos; admin puede ver todos
    if (req.usuario.rol !== 'admin' && parseInt(req.params.id) !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No tenés permiso para ver estos turnos' });
    }
    try {
        const [rows] = await pool.query(
            `SELECT t.id, t.fecha, t.hora_inicio, s.nombre as servicio_nombre, u.nombre as profesional_nombre
             FROM turnos t 
             JOIN servicios s ON t.servicio_id = s.id 
             JOIN usuarios u ON t.profesional_id = u.id
             WHERE t.cliente_id = ? 
             ORDER BY t.fecha DESC, t.hora_inicio DESC`,
            [req.params.id]
        );
        res.json(rows || []);
    } catch (error) {
        console.error('❌ Error turnos cliente:', error.message);
        res.status(500).json({ error: 'Error al obtener los turnos' });
    }
});

// Crear turno (soporta uno o varios servicios: servicios = array de ids)
app.post('/api/turnos', autenticar, async (req, res) => {
    const { cliente_id, cliente_nombre, cliente_telefono, profesional_id, servicio_id, fecha, hora_inicio } = req.body;
    const servicios = Array.isArray(req.body.servicios) ? req.body.servicios : (servicio_id ? [servicio_id] : []);
    if (!servicios.length) {
        return res.status(400).json({ success: false, message: 'Seleccioná al menos un servicio' });
    }
    try {
        const [existente] = await pool.query(
            'SELECT id FROM turnos WHERE profesional_id = ? AND fecha = ? AND hora_inicio = ?',
            [profesional_id, fecha, hora_inicio]
        );
        if (existente.length > 0) {
            return res.status(400).json({ success: false, message: 'Este horario ya está ocupado. Por favor selecciona otro.' });
        }
        let nombreFinal = (cliente_nombre || '').trim();
        if (!nombreFinal && cliente_id) {
            const [u] = await pool.query('SELECT nombre FROM usuarios WHERE id = ?', [cliente_id]);
            if (u.length) nombreFinal = u[0].nombre;
        }
        const telFinal = (cliente_telefono || '').trim() || null;

        // Precios de los servicios seleccionados
        const [serviciosInfo] = await pool.query(
            `SELECT id, nombre, precio FROM servicios WHERE id IN (?)`, [servicios]
        );
        if (!serviciosInfo.length) {
            return res.status(400).json({ success: false, message: 'Servicios inválidos' });
        }
        const precioTotal = serviciosInfo.reduce((s, sv) => s + parseFloat(sv.precio || 0), 0);
        const primerId = serviciosInfo[0].id;

        const [r] = await pool.query(
            'INSERT INTO turnos (cliente_id, cliente_nombre, cliente_telefono, profesional_id, servicio_id, fecha, hora_inicio, precio, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [cliente_id, nombreFinal || null, telFinal, profesional_id, primerId, fecha, hora_inicio, precioTotal, 'confirmado']
        );
        const turnoId = r.insertId;

        // Registrar items
        const items = serviciosInfo.map(sv => [turnoId, sv.id, sv.nombre, parseFloat(sv.precio || 0)]);
        await pool.query(
            'INSERT INTO turno_items (turno_id, servicio_id, nombre, precio) VALUES ?', [items]
        );

        res.json({ success: true, id: turnoId, message: 'Turno agendado correctamente' });
    } catch (error) {
        console.error('❌ Error al crear turno:', error.message);
        res.status(500).json({ success: false, error: 'Error al crear el turno' });
    }
});

// EDITAR turno
app.put('/api/turnos/:id', autenticar, autorizar(['admin','profesional']), async (req, res) => {
    const { id } = req.params;
    const { servicio_id, profesional_id, fecha, hora_inicio, estado } = req.body;
    try {
        if (estado && !servicio_id && !profesional_id && !fecha && !hora_inicio) {
            await pool.query('UPDATE turnos SET estado = ? WHERE id = ?', [estado, id]);
            return res.json({ success: true, message: 'Estado actualizado' });
        }
        // Verificar que el nuevo horario no esté ocupado (excluyendo el turno actual)
        const [existente] = await pool.query(
            'SELECT id FROM turnos WHERE profesional_id = ? AND fecha = ? AND hora_inicio = ? AND id != ?',
            [profesional_id, fecha, hora_inicio, id]
        );
        
        if (existente.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Este horario ya está ocupado. Por favor selecciona otro.' 
            });
        }
        
        // Actualizar el turno
        await pool.query(
            'UPDATE turnos SET servicio_id = ?, profesional_id = ?, fecha = ?, hora_inicio = ? WHERE id = ?',
            [servicio_id, profesional_id, fecha, hora_inicio, id]
        );
        
        res.json({ success: true, message: 'Turno actualizado correctamente' });
    } catch (error) {
        console.error('❌ Error al editar turno:', error.message);
        res.status(500).json({ success: false, error: 'Error al actualizar el turno' });
    }
});

// Obtener los servicios (items) de un turno
app.get('/api/turnos/:id/items', autenticar, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT id, servicio_id, nombre, precio FROM turno_items WHERE turno_id = ? ORDER BY id',
            [id]
        );
        res.json(rows);
    } catch (e) {
        console.error('❌ Error items turno:', e.message);
        res.status(500).json({ error: 'Error al obtener los servicios del turno' });
    }
});

// Agregar un servicio extra a un turno existente
app.post('/api/turnos/:id/servicios', autenticar, autorizar(['admin','profesional']), async (req, res) => {
    const { id } = req.params;
    const { servicio_id } = req.body;
    try {
        const [sv] = await pool.query('SELECT id, nombre, precio FROM servicios WHERE id = ? AND activo = TRUE', [servicio_id]);
        if (!sv.length) return res.status(400).json({ success: false, message: 'Servicio inválido' });

        const [existe] = await pool.query(
            'SELECT id FROM turno_items WHERE turno_id = ? AND servicio_id = ?', [id, servicio_id]
        );
        if (existe.length) return res.status(400).json({ success: false, message: 'Ese servicio ya está en el turno' });

        await pool.query(
            'INSERT INTO turno_items (turno_id, servicio_id, nombre, precio) VALUES (?, ?, ?, ?)',
            [id, sv[0].id, sv[0].nombre, parseFloat(sv[0].precio || 0)]
        );

        // Actualizar precio total del turno
        const [items] = await pool.query('SELECT IFNULL(SUM(precio),0) as total FROM turno_items WHERE turno_id = ?', [id]);
        await pool.query('UPDATE turnos SET precio = ? WHERE id = ?', [items[0].total, id]);

        res.json({ success: true, message: 'Servicio agregado al turno' });
    } catch (e) {
        console.error('❌ Error agregar servicio a turno:', e.message);
        res.status(500).json({ success: false, error: 'Error al agregar el servicio' });
    }
});

// Quitar un servicio de un turno existente
app.delete('/api/turnos/:id/servicios/:itemId', autenticar, autorizar(['admin','profesional']), async (req, res) => {
    const { id, itemId } = req.params;
    try {
        const [r] = await pool.query('DELETE FROM turno_items WHERE id = ? AND turno_id = ?', [itemId, id]);
        if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Item no encontrado' });

        // Recalcular precio: si quedan items, usar el primero como servicio principal
        const [items] = await pool.query('SELECT * FROM turno_items WHERE turno_id = ? ORDER BY id', [id]);
        if (items.length) {
            const total = items.reduce((s, it) => s + parseFloat(it.precio || 0), 0);
            await pool.query('UPDATE turnos SET precio = ?, servicio_id = ? WHERE id = ?', [total, items[0].servicio_id, id]);
        } else {
            await pool.query('UPDATE turnos SET precio = 0 WHERE id = ?', [id]);
        }
        res.json({ success: true, message: 'Servicio quitado del turno' });
    } catch (e) {
        console.error('❌ Error quitar servicio de turno:', e.message);
        res.status(500).json({ success: false, error: 'Error al quitar el servicio' });
    }
});

// ELIMINAR turno
app.delete('/api/turnos/:id', autenticar, autorizar(['admin']), async (req, res) => {
    const { id } = req.params;
    
    try {
        const [result] = await pool.query('DELETE FROM turnos WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Turno no encontrado' 
            });
        }
        
        res.json({ success: true, message: 'Turno eliminado correctamente' });
    } catch (error) {
        console.error('❌ Error al eliminar turno:', error.message);
        res.status(500).json({ success: false, error: 'Error al eliminar el turno' });
    }
});

// ============================================
// 📊 ESTADÍSTICAS
// ============================================
app.get('/api/estadisticas', autenticar, autorizar(['admin']), async (req, res) => {
    try {
        const [turnosHoy] = await pool.query('SELECT COUNT(*) as count FROM turnos WHERE DATE(fecha) = CURDATE()');
        const [ingresosMes] = await pool.query(
            `SELECT SUM(s.precio) as total FROM turnos t 
             JOIN servicios s ON t.servicio_id = s.id 
             WHERE MONTH(t.fecha) = MONTH(CURDATE()) AND YEAR(t.fecha) = YEAR(CURDATE())`
        );
        const [clientesUnicos] = await pool.query('SELECT COUNT(DISTINCT id) as count FROM usuarios WHERE rol = "cliente"');
        
        res.json({
            turnosHoy: turnosHoy[0].count || 0,
            ingresosMes: ingresosMes[0].total || 0,
            clientesUnicos: clientesUnicos[0].count || 0
        });
    } catch (error) {
        console.error('❌ Error estadísticas:', error.message);
        res.status(500).json({ error: 'Error al obtener las estadísticas' });
    }
});

// ============================================
// 💵 CAJA - PANEL DE COBRO Y TICKETS
// ============================================

// Configuración del local (para el ticket)
app.get('/api/caja/config', autenticar, autorizar(['admin','caja']), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT clave, valor FROM configuracion');
        const config = {};
        rows.forEach(r => config[r.clave] = r.valor);
        res.json(config);
    } catch (e) {
        console.error('❌ Error configuracion:', e.message);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

// Editar configuración del local (solo admin)
app.put('/api/caja/config', autenticar, autorizar(['admin']), async (req, res) => {
    const { local_nombre, local_cuit, local_direccion, local_telefono, punto_venta } = req.body;
    try {
        const mapa = { local_nombre, local_cuit, local_direccion, local_telefono, punto_venta };
        for (const [clave, valor] of Object.entries(mapa)) {
            if (valor !== undefined) {
                await pool.query('INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [clave, String(valor)]);
            }
        }
        res.json({ success: true, message: 'Configuración guardada' });
    } catch (e) {
        console.error('❌ Error guardando config:', e.message);
        res.status(500).json({ success: false, message: 'Error al guardar configuración' });
    }
});

// Teléfono del local (público, para botones de WhatsApp)
app.get('/api/caja/config/public', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT valor FROM configuracion WHERE clave = 'local_telefono'");
        const telefono = rows[0]?.valor || '';
        res.json({ local_telefono: telefono });
    } catch (e) {
        console.error('❌ Error config publica:', e.message);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

// Turnos del día para el panel de caja
app.get('/api/caja/dia', autenticar, autorizar(['admin','caja']), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT t.id, t.fecha, DATE_FORMAT(t.hora_inicio, '%H:%i') as hora_inicio, t.estado,
                    COALESCE(t.cliente_nombre, c.nombre) as cliente_nombre,
                    COALESCE(t.cliente_telefono, c.telefono) as cliente_telefono,
                    t.cliente_email,
                    s.nombre as servicio,
                    COALESCE(NULLIF(t.precio,0), s.precio) as precio,
                    p.nombre as profesional,
                    (SELECT COUNT(*) FROM turno_items ti WHERE ti.turno_id = t.id) as cant_items
             FROM turnos t
             JOIN servicios s ON t.servicio_id = s.id
             LEFT JOIN usuarios p ON t.profesional_id = p.id
             LEFT JOIN usuarios c ON t.cliente_id = c.id
             WHERE t.fecha = CURDATE()
             ORDER BY t.hora_inicio ASC`
        );
        res.json(rows);
    } catch (e) {
        console.error('❌ Error caja dia:', e.message);
        res.status(500).json({ error: 'Error al obtener turnos del día' });
    }
});

// Estado de la caja del día (abierta/cerrada + totales)
app.get('/api/caja/estado', autenticar, autorizar(['admin','caja']), async (req, res) => {
    try {
        const [caja] = await pool.query(
            "SELECT * FROM cajas WHERE estado = 'abierta' AND fecha = CURDATE() ORDER BY id DESC LIMIT 1"
        );
        if (!caja.length) {
            return res.json({ abierta: false });
        }
        res.json({ abierta: true, caja: caja[0] });
    } catch (e) {
        console.error('❌ Error estado caja:', e.message);
        res.status(500).json({ error: 'Error al obtener estado de la caja' });
    }
});

// Abrir caja del día (con monto inicial)
app.post('/api/caja/abrir', autenticar, autorizar(['admin','caja']), async (req, res) => {
    const { monto_inicial } = req.body;
    try {
        const [abierta] = await pool.query(
            "SELECT id FROM cajas WHERE estado = 'abierta' AND fecha = CURDATE()"
        );
        if (abierta.length) {
            return res.status(400).json({ success: false, message: 'Ya hay una caja abierta hoy' });
        }
        const inicial = Math.max(0, parseFloat(monto_inicial) || 0);
        const [r] = await pool.query(
            'INSERT INTO cajas (fecha, estado, monto_inicial, cajero_id, cajero_nombre) VALUES (CURDATE(), "abierta", ?, ?, ?)',
            [inicial, req.usuario.id, req.usuario.nombre || null]
        );
        res.json({ success: true, id: r.insertId, message: 'Caja abierta correctamente' });
    } catch (e) {
        console.error('❌ Error abrir caja:', e.message);
        res.status(500).json({ success: false, message: 'Error al abrir la caja' });
    }
});

// Cerrar caja del día (monto final contado en caja)
app.post('/api/caja/cerrar', autenticar, autorizar(['admin','caja']), async (req, res) => {
    const { monto_real } = req.body;
    try {
        const [caja] = await pool.query(
            "SELECT * FROM cajas WHERE estado = 'abierta' AND fecha = CURDATE() ORDER BY id DESC LIMIT 1"
        );
        if (!caja.length) {
            return res.status(400).json({ success: false, message: 'No hay caja abierta para cerrar' });
        }
        const c = caja[0];
        const total = parseFloat(c.total_efectivo || 0) + parseFloat(c.total_transferencia || 0) +
                      parseFloat(c.total_debito || 0);
        const [retiros] = await pool.query(
            'SELECT id, profesional_nombre, monto_retirado FROM retiros WHERE caja_id = ?', [c.id]
        );
        const totalRetiros = retiros.reduce((s, r) => s + parseFloat(r.monto_retirado || 0), 0);
        const real = parseFloat(monto_real) || 0;
        const esperado = parseFloat(c.monto_inicial || 0) + total - totalRetiros;
        const diferencia = Math.round((real - esperado) * 100) / 100;

        await pool.query(
            `UPDATE cajas SET estado = 'cerrada', monto_final = ?, cerrada_at = NOW() WHERE id = ?`,
            [real, c.id]
        );

        res.json({
            success: true,
            message: 'Caja cerrada correctamente',
            resumen: {
                monto_inicial: parseFloat(c.monto_inicial || 0),
                total_efectivo: parseFloat(c.total_efectivo || 0),
                total_transferencia: parseFloat(c.total_transferencia || 0),
                total_debito: parseFloat(c.total_debito || 0),
                total_ventas: total,
                retiros,
                total_retiros: Math.round(totalRetiros * 100) / 100,
                dinero_en_caja_esperado: Math.round(esperado * 100) / 100,
                dinero_contado: real,
                diferencia
            }
        });
    } catch (e) {
        console.error('❌ Error cerrar caja:', e.message);
        res.status(500).json({ success: false, message: 'Error al cerrar la caja' });
    }
});

// Historial de cierres (últimos días)
app.get('/api/caja/historial', autenticar, autorizar(['admin']), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT c.id, c.fecha, c.estado, c.monto_inicial, c.monto_final,
                    c.total_efectivo, c.total_transferencia, c.total_debito,
                    c.cajero_nombre, c.abierta_at, c.cerrada_at,
                    (SELECT COALESCE(SUM(r.monto_retirado),0) FROM retiros r WHERE r.caja_id = c.id) AS total_retiros,
                    (SELECT COALESCE(SUM(r.monto_retirado),0) FROM retiros r WHERE r.caja_id = c.id) != 0 AS tiene_retiros
             FROM cajas c ORDER BY c.id DESC LIMIT 15`
        );
        res.json(rows);
    } catch (e) {
        console.error('❌ Error historial caja:', e.message);
        res.status(500).json({ error: 'Error al obtener historial de cajas' });
    }
});

// Cobrar un turno + generar ticket (comprobante no fiscal)
// Registra el pago en la caja del día si hay una caja abierta.
app.post('/api/caja/turnos/:id/cerrar', autenticar, autorizar(['admin','caja']), async (req, res) => {
    const { id } = req.params;
    const { monto, metodo_pago } = req.body;
    try {
        const [turno] = await pool.query('SELECT * FROM turnos WHERE id = ?', [id]);
        if (!turno.length) return res.status(404).json({ success: false, message: 'Turno no encontrado' });
        if (turno[0].estado === 'cobrado') {
            return res.status(400).json({ success: false, message: 'Este turno ya fue cobrado' });
        }

        const montoFinal = parseFloat(monto);
        if (!montoFinal || montoFinal <= 0) {
            return res.status(400).json({ success: false, message: 'Monto inválido' });
        }
        const metodo = metodo_pago || 'efectivo';
        if (metodo === 'credito') {
            return res.status(400).json({ success: false, message: 'Este negocio no acepta tarjetas de crédito' });
        }

        // Items del turno (multi-servicio). Si no hay, usa el servicio principal.
        const [itemsDb] = await pool.query(
            'SELECT id, nombre, precio FROM turno_items WHERE turno_id = ? ORDER BY id', [id]
        );
        let itemsTicket;
        if (itemsDb.length) {
            itemsTicket = itemsDb.map(it => ({ servicio: it.nombre, importe: parseFloat(it.precio || 0) }));
        } else {
            itemsTicket = [{ servicio: 'Servicio', importe: montoFinal }];
        }

        // Marcar turno como cobrado
        await pool.query('UPDATE turnos SET estado = ?, precio = ? WHERE id = ?', ['cobrado', montoFinal, id]);

        // Datos del turno para el ticket
        const [d] = await pool.query(
            `SELECT COALESCE(t.cliente_nombre, c.nombre) as cliente_nombre,
                    COALESCE(t.cliente_telefono, c.telefono) as cliente_telefono,
                    t.cliente_email,
                    p.nombre as profesional
             FROM turnos t
             LEFT JOIN usuarios p ON t.profesional_id = p.id
             LEFT JOIN usuarios c ON t.cliente_id = c.id
             WHERE t.id = ?`, [id]
        );
        const dato = d[0] || {};

        // Caja abierta del día (si existe)
        const [cajaAbierta] = await pool.query(
            "SELECT * FROM cajas WHERE estado = 'abierta' AND fecha = CURDATE() ORDER BY id DESC LIMIT 1"
        );
        let cajaId = null;
        if (cajaAbierta.length) {
            cajaId = cajaAbierta[0].id;
            const colMetodo = {
                efectivo: 'total_efectivo',
                transferencia: 'total_transferencia',
                debito: 'total_debito'
            }[metodo] || 'total_efectivo';
            await pool.query(
                `UPDATE cajas SET ${colMetodo} = ${colMetodo} + ? WHERE id = ?`,
                [montoFinal, cajaId]
            );
        }

        // Número correlativo de ticket
        const [ult] = await pool.query('SELECT COALESCE(MAX(numero), 0) as max FROM tickets');
        const numero = ult[0].max + 1;

        const items = JSON.stringify(itemsTicket);

        // Guardar ticket con campos de respaldo para futura integracion ARCA
        const [tick] = await pool.query(
            `INSERT INTO tickets (numero, turno_id, cliente_nombre, cliente_telefono, cliente_email,
                                  profesional_nombre, items, subtotal, descuento, total, metodo_pago,
                                  cajero_id, cajero_nombre, tipo_comprobante, caja_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ticket', ?)`,
            [numero, id, dato.cliente_nombre || null, dato.cliente_telefono || null, dato.cliente_email || null,
             dato.profesional || null, items, montoFinal, 0, montoFinal, metodo,
             req.usuario.id, req.usuario.nombre || null, cajaId]
        );

        // Datos del local para el encabezado del ticket
        const [cfgRows] = await pool.query('SELECT clave, valor FROM configuracion');
        const cfg = {};
        cfgRows.forEach(r => cfg[r.clave] = r.valor);

        res.json({
            success: true,
            message: 'Turno cobrado y ticket generado',
            ticket: {
                id: tick.insertId,
                numero,
                local_nombre: cfg.local_nombre || 'CHAMAS SPA',
                local_cuit: cfg.local_cuit || '',
                local_direccion: cfg.local_direccion || '',
                local_telefono: cfg.local_telefono || '',
                punto_venta: cfg.punto_venta || '1',
                fecha_emision: new Date().toLocaleString('es-AR'),
                cliente_nombre: dato.cliente_nombre,
                cliente_telefono: dato.cliente_telefono,
                cliente_email: dato.cliente_email,
                profesional: dato.profesional,
                items: itemsTicket,
                subtotal: montoFinal,
                descuento: 0,
                total: montoFinal,
                metodo_pago: metodo
            }
        });
    } catch (e) {
        console.error('❌ Error al cobrar turno:', e.message);
        res.status(500).json({ success: false, message: 'Error al procesar el cobro' });
    }
});

// ============================================
// 💸 RETIROS DE PROFESIONALES
// ============================================
// Resumen de retiros del día + lo que le correspondería retirar a cada
// profesional según sus turnos cobrados del día (monto × porcentaje_retiro).
app.get('/api/caja/retiros', autenticar, autorizar(['admin','caja']), async (req, res) => {
    try {
        const [sugerencias] = await pool.query(
            `SELECT u.id AS profesional_id, u.nombre AS profesional_nombre, u.porcentaje_retiro,
                    COALESCE(SUM(t.precio), 0) AS cobrado_hoy, COUNT(t.id) AS turnos_cobrados
             FROM usuarios u
             LEFT JOIN turnos t ON t.profesional_id = u.id
                  AND t.estado = 'cobrado' AND t.fecha = CURDATE()
             WHERE u.rol = 'profesional'
             GROUP BY u.id, u.nombre, u.porcentaje_retiro
             HAVING cobrado_hoy > 0
             ORDER BY u.nombre`
        );
        const [retiros] = await pool.query(
            `SELECT r.id, r.profesional_id, r.profesional_nombre, r.monto_bruto,
                    r.porcentaje_retiro, r.monto_retirado, r.monto_estetica, r.creado_at
             FROM retiros r WHERE r.fecha = CURDATE() ORDER BY r.id`
        );
        res.json({ sugerencias, retiros });
    } catch (e) {
        console.error('❌ Error retiros:', e.message);
        res.status(500).json({ error: 'Error al obtener retiros' });
    }
});

// Registrar el retiro de una profesional (calcula lo que le corresponde
// según sus turnos cobrados del día y su porcentaje).
app.post('/api/caja/retiros', autenticar, autorizar(['admin','caja']), async (req, res) => {
    const { profesional_id, monto_retirar } = req.body;
    if (!profesional_id) return res.status(400).json({ success: false, message: 'Indicá la profesional' });
    try {
        const [rows] = await pool.query(
            `SELECT u.id, u.nombre, u.porcentaje_retiro, COALESCE(SUM(t.precio), 0) AS cobrado_hoy
             FROM usuarios u
             LEFT JOIN turnos t ON t.profesional_id = u.id
                  AND t.estado = 'cobrado' AND t.fecha = CURDATE()
             WHERE u.id = ? GROUP BY u.id, u.nombre, u.porcentaje_retiro`, [profesional_id]
        );
        const p = rows[0];
        if (!p) return res.status(400).json({ success: false, message: 'Profesional no encontrado' });
        const pct = parseFloat(p.porcentaje_retiro) || 70;
        const bruto = parseFloat(p.cobrado_hoy) || 0;
        const maximo = Math.round(bruto * pct / 100 * 100) / 100;
        let retirado;
        if (monto_retirar !== undefined && monto_retirar !== null && monto_retirar !== '') {
            retirado = Math.min(maximo, Math.max(0, parseFloat(monto_retirar) || 0));
        } else {
            retirado = maximo; // por defecto, se retira TODO lo que le corresponde
        }
        const estetica = Math.round((bruto - retirado) * 100) / 100;

        const [caja] = await pool.query(
            "SELECT id FROM cajas WHERE estado = 'abierta' AND fecha = CURDATE() ORDER BY id DESC LIMIT 1"
        );
        const cajaId = caja.length ? caja[0].id : null;

        const [r] = await pool.query(
            `INSERT INTO retiros (caja_id, profesional_id, profesional_nombre, fecha, monto_bruto,
                                  porcentaje_retiro, monto_retirado, monto_estetica, creado_por)
             VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?)`,
            [cajaId, p.id, p.nombre, bruto, pct, retirado, estetica, req.usuario.id]
        );
        res.json({
            success: true,
            retiro: {
                id: r.insertId, profesional_nombre: p.nombre, monto_bruto: bruto,
                porcentaje_retiro: pct, monto_retirado: retirado, monto_estetica: estetica
            },
            mensaje: `Retiro de $${retirado.toFixed(2)} registrado para ${p.nombre}`
        });
    } catch (e) {
        console.error('❌ Error registrar retiro:', e.message);
        res.status(500).json({ success: false, message: 'Error al registrar el retiro' });
    }
});

// Eliminar un retiro del día (corrección de error)
app.delete('/api/caja/retiros/:id', autenticar, autorizar(['admin','caja']), async (req, res) => {
    try {
        await pool.query('DELETE FROM retiros WHERE id = ? AND fecha = CURDATE()', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Error al eliminar retiro' });
    }
});

// ============================================
// 🏥 HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// 🚀 INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.clear();
    console.log('\n' + '='.repeat(70));
    console.log('🚀  SERVIDOR CHAMAS INICIADO');
    console.log('='.repeat(70));
    console.log(`📍  URL: https://chamas-spa.onrender.com`);
    console.log(`⏰  Hora: ${new Date().toLocaleString()}`);
    console.log('='.repeat(70));
    console.log('\n📋  RUTAS DISPONIBLES:\n');
    console.log('   🔐 POST   /api/auth/login');
    console.log('   👤 POST   /api/usuarios (registrar profesional)');
    console.log('   📦 GET    /api/servicios');
    console.log('   ✏️  PUT    /api/servicios/:id');
    console.log('   👥 GET    /api/profesionales/servicio/:id');
    console.log('   👥 GET    /api/usuarios/profesionales');
    console.log('   ⏰ GET    /api/disponibilidad_completa/:id');
    console.log('   ⏰ GET    /api/disponibilidad/:profesionalId/:dia');
    console.log('   📅 POST   /api/disponibilidad');
    console.log('   💾 POST   /api/disponibilidad/guardar-directas (CALENDARIO)');
    console.log('   🗑️  POST   /api/disponibilidad/eliminar-fecha (CALENDARIO)');
    console.log('   🗑️  POST   /api/disponibilidad/eliminar-horas (CALENDARIO)');
    console.log('   🚫 GET    /api/horarios-ocupados/:profesionalId/:fecha');
    console.log('   📋 GET    /api/turnos/todos (ADMIN)');
    console.log('   📋 GET    /api/turnos/:id (obtener uno)');
    console.log('   📋 GET    /api/turnos/:id/items (servicios del turno)');
    console.log('   ➕ POST   /api/turnos/:id/servicios (agregar servicio)');
    console.log('   ➖ DELETE /api/turnos/:id/servicios/:itemId (quitar servicio)');
    console.log('   👥 POST   /api/profesionales/servicios (multi-servicio)');
    console.log('   📅 GET    /api/turnos/profesional/:id');
    console.log('   📅 GET    /api/turnos/cliente/:id');
    console.log('   📝 POST   /api/turnos (crear)');
    console.log('   ✏️  PUT    /api/turnos/:id (editar)');
    console.log('   🗑️  DELETE /api/turnos/:id (eliminar)');
    console.log('   💵 GET    /api/caja/estado (abierta/cerrada + totales)');
    console.log('   💵 POST   /api/caja/abrir (abrir caja del día)');
    console.log('   💵 POST   /api/caja/cerrar (cerrar y resumen)');
    console.log('   💵 GET    /api/caja/historial (cierres previos)');
    console.log('   🧾 POST   /api/caja/turnos/:id/cerrar (cobrar + ticket)');
    console.log('   💸 GET    /api/caja/retiros (sugerencias + registrados)');
    console.log('   💸 POST   /api/caja/retiros (registrar retiro de profesional)');
    console.log('   🗑️  DELETE /api/caja/retiros/:id (eliminar retiro)');
    console.log('   📊 GET    /api/estadisticas');
    console.log('   🏥 GET    /api/health');
    console.log('\n' + '='.repeat(70));
    console.log('✅  SERVIDOR LISTO - CALENDARIO INTERACTIVO ACTIVADO');
    console.log('='.repeat(70) + '\n');
});
