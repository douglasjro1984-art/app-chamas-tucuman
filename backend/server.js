const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const pool = require('./database'); 

const app = express();

// ============================================
//  CONFIGURACIÃ“N DE SEGURIDAD
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'cambiar-este-secreto-en-produccion';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Lista de orÃ­genes permitidos para CORS
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5500',
    'https://chamas-spa.onrender.com'
];

// Limitador de peticiones general: mÃ¡x 300 por IP cada 15 min
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiadas peticiones. IntentÃ¡ de nuevo mÃ¡s tarde.' }
});

// Limitador estricto para login/registro: mÃ¡x 10 intentos por 15 min
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiados intentos. IntentÃ¡ de nuevo en 15 minutos.' }
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

// Servir el frontend estÃ¡tico desde la raÃ­z del proyecto.
// IMPORTANTE: bloqueamos explÃ­citamente el acceso a carpetas y archivos sensibles
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

// Helper: registra peticiones solo en desarrollo (evita loguear datos en producciÃ³n)
if (NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`ðŸ“¨ ${req.method} ${req.url}`);
        next();
    });
}

// ============================================
//  AUTENTICACIÃ“N JWT
// ============================================
// Genera un token firmado con los datos del usuario (sin password)
function generarToken(usuario) {
    return jwt.sign(
        { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre },
        JWT_SECRET,
        { expiresIn: '8h' }
    );
}

// Middleware: verifica que haya un token vÃ¡lido y adjunta el usuario a req.usuario
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
        return res.status(401).json({ success: false, message: 'SesiÃ³n expirada o invÃ¡lida' });
    }
}

// Middleware: restringe por rol (["admin"], ["admin","profesional"], etc.)
function autorizar(rolesPermitidos) {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ success: false, message: 'No autenticado' });
        }
        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({ success: false, message: 'No tenÃ©s permiso para esta acciÃ³n' });
        }
        next();
    };
}

// Manejo de errores de CORS: responder un error limpio sin exponer detalles
app.use((err, req, res, next) => {
    if (err.message === 'Origen no permitido por CORS') {
        return res.status(403).json({ success: false, message: 'Origen no permitido' });
    }
    console.error('âŒ Error no controlado:', err.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// ============================================
//  AUTENTICACIÃ“N - RUTA DE LOGIN
// ============================================
app.post('/api/auth/login', authLimiter, async (req, res) => {
    // Acepta "emailOTelefono" (nuevo) o "email" (compatibilidad)
    const identificador = (req.body.emailOTelefono || req.body.email || '').trim();
    const password      = req.body.password;

    if (!identificador || !password) {
        return res.json({ success: false, message: 'IngresÃ¡ tu email o telÃ©fono y contraseÃ±a' });
    }

    try {
        // Buscar por email O por telÃ©fono
        const [rows] = await pool.query(
            `SELECT id, nombre, email, rol, telefono, password
             FROM usuarios
             WHERE email = ? OR telefono = ?
             LIMIT 1`,
            [identificador, identificador]
        );

        if (rows.length === 0) {
            return res.json({ success: false, message: 'Datos incorrectos. RevisÃ¡ tu email, telÃ©fono o contraseÃ±a.' });
        }

        const usuario = rows[0];
        const passwordMatch = await bcrypt.compare(password, usuario.password);
        const usuarioSinPassword = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, telefono: usuario.telefono };

        // Solo permiten ingresar los roles operativos: admin y recepcionista.
        // clientes/profesionales/caja antiguos ya no pueden entrar.
        const rolesPermitidos = ['admin', 'recepcionista'];
        if (passwordMatch && !rolesPermitidos.includes(usuario.rol)) {
            return res.json({ success: false, message: 'Esta cuenta no tiene acceso al sistema. ContactÃ¡ al administrador.' });
        }

        if (passwordMatch) {
            const token = generarToken(usuarioSinPassword);
            res.json({ success: true, token, usuario: usuarioSinPassword });
        } else {
            res.json({ success: false, message: 'Datos incorrectos. RevisÃ¡ tu email, telÃ©fono o contraseÃ±a.' });
        }
    } catch (error) {
        console.error('âŒ Error login:', error.message);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});


// ============================================
//  REGISTRO DE CLIENTE (desde el login pÃºblico)
// ============================================
app.post('/api/auth/registro', authLimiter, async (req, res) => {
    // El registro pÃºblico quedÃ³ deshabilitado: el sistema ahora se maneja
    // con cuentas creadas internamente (admin y recepcionista).
    return res.status(403).json({ success: false, message: 'El registro pÃºblico estÃ¡ deshabilitado' });
});

// ============================================
//  VERIFICAR SESIÃ“N (para reconstruir sesiÃ³n al recargar)
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
        console.error('âŒ Error en /auth/me:', error.message);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

// ============================================
//  RECUPERACIÃ“N DE CONTRASEÃ‘A
// ============================================

// Genera cÃ³digo numÃ©rico de 6 dÃ­gitos
function generarCodigo6() {
    return String(crypto.randomInt(100000, 999999));
}

// Normaliza telÃ©fono argentino a formato internacional sin '+' (ej: 5493865437108)
function normalizarTelefonoArgentina(tel) {
    let num = (tel || '').replace(/[^\d]/g, '');
    if (!num) return null;
    if (num.startsWith('549')) return num;
    if (num.startsWith('54')) return num;
    if (num.startsWith('0')) num = num.slice(1);
    return '549' + num;
}

// Enviar correo con el cÃ³digo de recuperaciÃ³n usando SMTP (nodemailer)
function crearTransportadorCorreo() {
    const host = process.env.MAIL_HOST;
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASSWORD;
    if (!host || !user || !pass) return null;
    return nodemailer.createTransport({
        host,
        port: parseInt(process.env.MAIL_PORT || '465', 10),
        secure: (process.env.MAIL_SECURE || 'true') === 'true',
        auth: { user, pass }
    });
}

async function enviarCorreoRecuperacion(destino, codigo) {
    if (!destino) return { ok: false, reason: 'sin_email' };
    const transport = crearTransportadorCorreo();
    if (!transport) return { ok: false, reason: 'correo_no_configurado' };
    try {
        await transport.sendMail({
            from: process.env.MAIL_FROM || `Chamas Spa <${process.env.MAIL_USER}>`,
            to: destino,
            subject: 'ðŸ” Chamas Spa â€” CÃ³digo de recuperaciÃ³n',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden;">
                    <div style="background:#C06C84;color:white;padding:18px 24px;text-align:center;">
                        <h2 style="margin:0;font-size:1.2rem;">ðŸ’† Chamas Spa</h2>
                        <p style="margin:4px 0 0;font-size:0.85rem;opacity:.9;">RecuperaciÃ³n de contraseÃ±a</p>
                    </div>
                    <div style="padding:24px;">
                        <p style="margin:0 0 8px;color:#333;">Tu cÃ³digo de recuperaciÃ³n es:</p>
                        <div style="font-size:2rem;font-weight:700;letter-spacing:8px;color:#C06C84;text-align:center;padding:14px;background:#fdf4f6;border-radius:10px;margin:12px 0;">${codigo}</div>
                        <p style="margin:0;color:#888;font-size:0.85rem;">VÃ¡lido por 10 minutos. Si no solicitaste este cÃ³digo, ignorÃ¡ este correo.</p>
                    </div>
                </div>`
        });
        return { ok: true };
    } catch (e) {
        console.error('âŒ Error enviando correo:', e.message);
        return { ok: false, reason: 'error_envio' };
    }
}

// Enviar mensaje por WhatsApp Meta Cloud API
async function enviarWhatsAppMeta(destinoInternacional, mensaje) {
    const token = process.env.META_WHATSAPP_TOKEN;
    const phoneId = process.env.META_WHATSAPP_PHONE_ID;
    if (!token || !phoneId) {
        console.log('âš ï¸ Meta WhatsApp no configurado (META_WHATSAPP_TOKEN / META_WHATSAPP_PHONE_ID)');
        return { ok: false, reason: 'no_configurado' };
    }
    const body = JSON.stringify({
        messaging_product: 'whatsapp',
        to: destinoInternacional,
        type: 'text',
        text: { body: mensaje }
    });
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'graph.facebook.com',
            port: 443,
            path: `/v21.0/${phoneId}/messages`,
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ ok: true });
                } else {
                    console.error('âŒ Meta API error:', res.statusCode, data);
                    resolve({ ok: false, reason: 'api_error', status: res.statusCode });
                }
            });
        });
        req.on('error', (e) => { console.error('âŒ Meta API red:', e.message); resolve({ ok: false, reason: 'network_error' }); });
        req.write(body);
        req.end();
    });
}

// Solicitar cÃ³digo de recuperaciÃ³n (envÃ­a por WhatsApp)
app.post('/api/auth/recuperar', authLimiter, async (req, res) => {
    const identifier = (req.body.emailOrPhone || req.body.email || '').trim();
    if (!identifier) {
        return res.status(400).json({ success: false, message: 'IngresÃ¡ tu email o telÃ©fono' });
    }
    try {
        const [rows] = await pool.query(
            `SELECT id, nombre, email, rol, telefono
             FROM usuarios
             WHERE (email = ? OR telefono = ?) AND rol IN ('admin','recepcionista') AND activo != 0
             LIMIT 1`,
            [identifier, identifier]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'No se encontrÃ³ una cuenta activa con ese dato' });
        }
        const usuario = rows[0];
        const codigo = generarCodigo6();
        const expiraAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
        await pool.query(
            'INSERT INTO recuperaciones (usuario_id, codigo, expira_at) VALUES (?, ?, ?)',
            [usuario.id, codigo, expiraAt]
        );

        // Intentar enviar por correo
        const correoEnviado = await enviarCorreoRecuperacion(usuario.email, codigo);
        let codigoEnPantalla = null;

        // En desarrollo (o si fallÃ³ el correo), devolver cÃ³digo en respuesta para que funcione
        const esDesarrollo = process.env.NODE_ENV !== 'production';
        if (!correoEnviado.ok && esDesarrollo) {
            codigoEnPantalla = codigo;
        }

        res.json({
            success: true,
            mensaje: correoEnviado.ok
                ? 'âœ… Te enviamos un cÃ³digo por correo a ' + usuario.email
                : (correoEnviado.reason === 'sin_email' ? 'âš ï¸ La cuenta no tiene email registrado. ContactÃ¡ al administrador.' : 'âš ï¸ No se pudo enviar el correo. ContactÃ¡ al administrador.'),
            usuario_nombre: usuario.nombre,
            correo_enviado: correoEnviado.ok,
            ...(codigoEnPantalla ? { _debug_codigo: codigo } : {})
        });
    } catch (e) {
        console.error('âŒ Error recuperar:', e.message);
        res.status(500).json({ success: false, message: 'Error al procesar la solicitud' });
    }
});

// Confirmar cÃ³digo y establecer nueva contraseÃ±a
app.post('/api/auth/recuperar/confirmar', authLimiter, async (req, res) => {
    const identifier = (req.body.emailOrPhone || req.body.email || '').trim();
    const codigo = (req.body.codigo || '').trim();
    const nuevaPassword = req.body.nuevaPassword || '';
    if (!identifier || !codigo || !nuevaPassword) {
        return res.status(400).json({ success: false, message: 'CompletÃ¡ todos los campos' });
    }
    if (nuevaPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'La contraseÃ±a debe tener al menos 6 caracteres' });
    }
    try {
        const [rows] = await pool.query(
            `SELECT r.id, r.usuario_id, r.codigo, r.expira_at
             FROM recuperaciones r
             JOIN usuarios u ON u.id = r.usuario_id
             WHERE (u.email = ? OR u.telefono = ?)
               AND r.usado = 0
             ORDER BY r.id DESC
             LIMIT 1`,
            [identifier, identifier]
        );
        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'No se encontrÃ³ una solicitud de recuperaciÃ³n' });
        }
        const reg = rows[0];
        const now = new Date();
        if (now > new Date(reg.expira_at)) {
            return res.status(400).json({ success: false, message: 'El cÃ³digo expirÃ³. SolicitÃ¡ uno nuevo.' });
        }
        if (reg.codigo !== codigo) {
            return res.status(400).json({ success: false, message: 'El cÃ³digo es incorrecto' });
        }
        const hashed = await bcrypt.hash(nuevaPassword, 10);
        await pool.query('UPDATE usuarios SET password = ? WHERE id = ?', [hashed, reg.usuario_id]);
        await pool.query('UPDATE recuperaciones SET usado = 1 WHERE id = ?', [reg.id]);
        res.json({ success: true, mensaje: 'âœ… ContraseÃ±a actualizada correctamente. Ya podÃ©s iniciar sesiÃ³n.' });
    } catch (e) {
        console.error('âŒ Error recuperar/confirmar:', e.message);
        res.status(500).json({ success: false, message: 'Error al actualizar la contraseÃ±a' });
    }
});

// Cambiar contraseÃ±a (requiere sesiÃ³n activa)
app.patch('/api/auth/cambiar-contrasena', autenticar, async (req, res) => {
    const { passwordActual, nuevaPassword } = req.body;
    if (!passwordActual || !nuevaPassword) {
        return res.status(400).json({ success: false, message: 'CompletÃ¡ ambos campos' });
    }
    if (nuevaPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'La nueva contraseÃ±a debe tener al menos 6 caracteres' });
    }
    try {
        const [rows] = await pool.query('SELECT id, password FROM usuarios WHERE id = ?', [req.usuario.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        const ok = await bcrypt.compare(passwordActual, rows[0].password);
        if (!ok) return res.status(400).json({ success: false, message: 'La contraseÃ±a actual es incorrecta' });
        const hashed = await bcrypt.hash(nuevaPassword, 10);
        await pool.query('UPDATE usuarios SET password = ? WHERE id = ?', [hashed, req.usuario.id]);
        res.json({ success: true, mensaje: 'âœ… ContraseÃ±a actualizada' });
    } catch (e) {
        console.error('âŒ Error cambiar-contrasena:', e.message);
        res.status(500).json({ success: false, message: 'Error al cambiar la contraseÃ±a' });
    }
});

// ============================================
//  CREAR USUARIO / REGISTRAR PROFESIONAL
// ============================================
// Permite que un profesional comparta email con admin/recepcionista (la misma persona
// puede hacer las dos funciones). Devuelve true si el email estÃ¡ disponible.
async function emailDisponibleProfesional(email, rolNuevo, excluirId = null) {
    if (!email) return true;
    const [rows] = await pool.query(
        excluirId
            ? 'SELECT id, rol FROM usuarios WHERE email = ? AND id != ?'
            : 'SELECT id, rol FROM usuarios WHERE email = ?',
        excluirId ? [email, excluirId] : [email]
    );
    for (const u of rows) {
        const mismoTipo = (u.rol === rolNuevo);
        const esProfBase = (u.rol === 'profesional' || rolNuevo === 'profesional');
        const esGestor = (u.rol === 'admin' || u.rol === 'recepcionista' || rolNuevo === 'admin' || rolNuevo === 'recepcionista');
        // Solo se permite duplicar entre profesional <-> admin/recepcionista
        if (mismoTipo || !(esProfBase && esGestor)) {
            return false;
        }
    }
    return true;
}

app.post('/api/usuarios', autenticar, autorizar(['admin']), async (req, res) => {
    const { nombre, email, password, telefono, rol = 'profesional', servicios, porcentaje_retiro } = req.body;
    
    // Validaciones bÃ¡sicas
    if (!nombre || !email || !telefono) {
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
    }
    
    if (rol !== 'profesional' && rol !== 'cliente' && rol !== 'recepcionista') {
        return res.status(400).json({ success: false, message: 'Solo se pueden crear profesionales, recepcionistas o clientes' });
    }

    // Profesionales no acceden al sistema (sin login): la contraseÃ±a es opcional.
    // Recepcionistas sÃ­ acceden, asÃ­ que deben definir una contraseÃ±a.
    if (rol === 'recepcionista' || rol === 'cliente') {
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'La contraseÃ±a debe tener al menos 6 caracteres' });
        }
    }
    
    try { 
        // Verificar si el email ya existe (los profesionales pueden repetir
        // con admin/recepcionista porque hacen las dos funciones)
        if (!(await emailDisponibleProfesional(email, rol))) {
            return res.status(400).json({ success: false, message: 'El email ya estÃ¡ registrado' });
        }
        
        // Hash de contraseÃ±a (placeholder aleatorio para profesionales que no acceden)
        const passFinal = password || 'prof-no-accede';
        const hashedPassword = await bcrypt.hash(passFinal, 10);
        
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
        console.error('âŒ Error creando usuario:', error.message);
        res.status(500).json({ success: false, message: 'Error al crear el usuario' });
    }
});

// Obtener un profesional/usuario con sus servicios asignados
// Editar un profesional/usuario (nombre, email, telefono, rol, servicios, contraseÃ±a opcional)
app.put('/api/usuarios/:id', autenticar, autorizar(['admin']), async (req, res) => {
    const { id } = req.params;
    const { nombre, email, telefono, password, rol, servicios, porcentaje_retiro } = req.body;
    try {
        const [u] = await pool.query('SELECT id, rol FROM usuarios WHERE id = ?', [id]);
        if (!u.length) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        if (u[0].rol === 'admin') return res.status(403).json({ success: false, message: 'No se puede editar el admin' });

        // Validar email Ãºnico (excepto a sÃ­ mismo); los profesionales pueden
        // repetir con admin/recepcionista porque hacen las dos funciones
        if (email && !(await emailDisponibleProfesional(email, rol || u[0].rol, id))) {
            return res.status(400).json({ success: false, message: 'El email ya estÃ¡ registrado' });
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
        console.error('âŒ Error editando usuario:', error.message);
        res.status(500).json({ success: false, message: 'Error al editar el usuario' });
    }
});

// ============================================
// ðŸ“¦ SERVICIOS
// ============================================
app.get('/api/servicios', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM servicios WHERE activo = TRUE ORDER BY id');
        res.json(rows);
    } catch (error) {
        console.error('âŒ Error servicios:', error.message);
        res.status(500).json({ error: 'Error al obtener servicios' });
    }
});

app.put('/api/servicios/:id', autenticar, autorizar(['admin']), async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio, imagen, activo, duracion, dias_disponibles } = req.body;

    try {
        let fields = [];
        let values = [];

        if (activo !== undefined) { fields.push('activo = ?'); values.push(activo ? 1 : 0); }
        if (precio !== undefined) { fields.push('precio = ?'); values.push(precio); }
        if (nombre !== undefined) { fields.push('nombre = ?'); values.push(nombre); }
        if (descripcion !== undefined) { fields.push('descripcion = ?'); values.push(descripcion); }
        if (imagen !== undefined) { fields.push('imagen = ?'); values.push(imagen); }
        if (duracion !== undefined) { fields.push('duracion = ?'); values.push(parseInt(duracion,10)); }
        if (dias_disponibles !== undefined) {
            const dias = typeof dias_disponibles === 'string' ? dias_disponibles.trim() : '';
            fields.push('dias_disponibles = ?');
            values.push(dias === '' ? null : dias);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        values.push(id);
        await pool.query(`UPDATE servicios SET ${fields.join(', ')} WHERE id = ?`, values);

        res.json({ success: true, message: activo !== undefined ? (activo ? 'Servicio activado' : 'Servicio pausado') : 'Actualizado' });
    } catch (error) {
        console.error('âŒ Error actualizando servicio:', error.message);
        res.status(500).json({ success: false, error: 'Error al actualizar el servicio' });
    }
});

// ============================================
// ðŸ“¦ SERVICIOS â€” CREAR / PAUSAR / ELIMINAR
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
    const { nombre, descripcion, precio, imagen, duracion, dias_disponibles } = req.body;
    if (!nombre || !precio) return res.status(400).json({ success: false, message: 'Nombre y precio son obligatorios' });
    try {
        const dias = typeof dias_disponibles === 'string' ? dias_disponibles.trim() : '';
        const [r] = await pool.query(
            'INSERT INTO servicios (nombre, descripcion, precio, imagen, duracion, dias_disponibles, activo) VALUES (?, ?, ?, ?, COALESCE(?, 60), ?, TRUE)',
            [nombre.trim(), descripcion||'', parseFloat(precio), imagen||'img/default.jpg', duracion ? parseInt(duracion,10) : null, dias === '' ? null : dias]
        );
        res.json({ success: true, id: r.insertId, message: 'Servicio creado correctamente' });
    } catch (e) { console.error('âŒ Error creando servicio:', e.message); res.status(500).json({ success: false, message: 'Error al crear el servicio' }); }
});

// Pausar / reactivar servicio (toggle activo)
app.patch('/api/servicios/:id/activo', autenticar, autorizar(['admin']), async (req, res) => {
    const { activo } = req.body; // true o false
    try {
        await pool.query('UPDATE servicios SET activo = ? WHERE id = ?', [activo ? 1 : 0, req.params.id]);
        res.json({ success: true, message: activo ? 'Servicio reactivado' : 'Servicio pausado' });
    } catch (e) { console.error('âŒ Error:', e.message); res.status(500).json({ success: false, message: 'Error al actualizar el servicio' }); }
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
            return res.status(400).json({ success: false, message: `No se puede eliminar: tiene ${turnos[0].cnt} turno(s) prÃ³ximo(s). Pausalo primero.` });
        }
        await pool.query('DELETE FROM profesional_servicios WHERE servicio_id = ?', [id]);
        await pool.query('DELETE FROM servicios WHERE id = ?', [id]);
        res.json({ success: true, message: 'Servicio eliminado' });
    } catch (e) { console.error('âŒ Error eliminando servicio:', e.message); res.status(500).json({ success: false, message: 'Error al eliminar el servicio' }); }
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
    } catch (e) { console.error('âŒ Error eliminando usuario:', e.message); res.status(500).json({ success: false, message: 'Error al eliminar el usuario' }); }
});

// ============================================
// ðŸ‘¥ PROFESIONALES Y USUARIOS
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
        console.error('âŒ Error profesionales servicio:', error.message);
        res.status(500).json({ error: 'Error al obtener profesionales' });
    }
});

// Profesionales que cubren TODOS los servicios seleccionados (multi-servicio)
app.post('/api/profesionales/servicios', async (req, res) => {
    const ids = Array.isArray(req.body.servicios) ? req.body.servicios.map(Number) : [];
    if (!ids.length) return res.status(400).json({ error: 'IndicÃ¡ al menos un servicio' });
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
        console.error('âŒ Error profesionales multi-servicio:', error.message);
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
        console.error('âŒ Error profesionales:', error.message);
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
        console.error('âŒ Error obteniendo usuario:', error.message);
        res.status(500).json({ success: false, message: 'Error al obtener el usuario' });
    }
});

// ============================================
// â° DISPONIBILIDAD POR FECHAS EXACTAS
// ============================================

// Slots futuros de un profesional agrupados por fecha
app.get('/api/disponibilidad_completa/:id', async (req, res) => {
    try {
        const profesionalId = req.params.id;
        
        // Validar que el ID sea un nÃºmero
        if (!profesionalId || isNaN(profesionalId)) {
            return res.status(400).json({ error: 'ID de profesional invÃ¡lido' });
        }

        console.log('ðŸ“… Buscando disponibilidad para profesional:', profesionalId);

        // Verificar que la tabla existe
        const [tableCheck] = await pool.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_NAME='disponibilidad_fechas' LIMIT 1`
        );

        if (tableCheck.length === 0) {
            console.warn('âš ï¸ Tabla disponibilidad_fechas no existe');
            return res.json([]); // Retornar array vacÃ­o si no existe la tabla
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

        console.log('âœ… Disponibilidad cargada:', rows?.length || 0, 'registros');
        res.json(rows || []);
    } catch (error) {
        console.error('âŒ Error en disponibilidad_completa:', error.message);
        // No retornar error 500, retornar array vacÃ­o
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
        console.error('âŒ Error disponibilidad rango:', error.message);
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
        console.error('âŒ Error disponibilidad:', error.message);
        res.status(500).json({ error: 'Error al obtener horarios' });
    }
});

// Guardar disponibilidad: recibe rango + plantilla de dÃ­as/horas
// y genera los slots concretos en disponibilidad_fechas
app.post('/api/disponibilidad', autenticar, autorizar(['admin','profesional','recepcionista']), async (req, res) => {
    const { profesional_id, desde, hasta, horarios } = req.body;
    // horarios: [{ dia: "Lunes", inicio: "09:00" }, ...]
    // desde / hasta: "YYYY-MM-DD"

    // Un profesional solo puede gestionar SU propia disponibilidad
    if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'recepcionista' && profesional_id !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No podÃ©s modificar horarios de otro profesional' });
    }

    if (!profesional_id || !desde || !hasta || !Array.isArray(horarios)) {
        return res.status(400).json({ success: false, message: 'Faltan datos' });
    }

    const mapDia = { 'Lunes':1,'Martes':2,'MiÃ©rcoles':3,'Jueves':4,'Viernes':5,'SÃ¡bado':6,'Domingo':0 };

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
        console.error('âŒ Error guardando disponibilidad:', error.message);
        res.status(500).json({ success: false, error: 'Error al guardar la disponibilidad' });
    }

});

// ============================================
// âœ… CALENDARIO INTERACTIVO - RUTAS
// ============================================

// POST: Guardar horarios directamente (fechas especÃ­ficas)
app.post('/api/disponibilidad/guardar-directas', autenticar, autorizar(['admin','profesional','recepcionista']), async (req, res) => {
    const { profesional_id, horarios } = req.body;

    if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'recepcionista' && profesional_id !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No podÃ©s modificar horarios de otro profesional' });
    }

    if (!profesional_id || !Array.isArray(horarios) || horarios.length === 0) {
        return res.json({ success: false, message: 'Datos invÃ¡lidos' });
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

        console.log(`âœ… ${insertados} horarios guardados`);
        res.json({ success: true, message: `${insertados} horarios guardados`, count: insertados });
    } catch (error) {
        console.error('âŒ Error al guardar horarios:', error.message);
        res.json({ success: false, message: 'Error del servidor' });
    }
});

// POST: Eliminar todos los horarios de una fecha especÃ­fica
app.post('/api/disponibilidad/eliminar-fecha', autenticar, autorizar(['admin','profesional','recepcionista']), async (req, res) => {
    const { profesional_id, fecha } = req.body;

    if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'recepcionista' && profesional_id !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No podÃ©s modificar horarios de otro profesional' });
    }

    if (!profesional_id || !fecha) {
        return res.json({ success: false, message: 'Datos invÃ¡lidos' });
    }

    try {
        const [result] = await pool.query(
            'DELETE FROM disponibilidad_fechas WHERE profesional_id = ? AND fecha = ?',
            [profesional_id, fecha]
        );

        res.json({ success: true, message: `${result.affectedRows} registros eliminados`, deletedCount: result.affectedRows });
    } catch (error) {
        console.error('âŒ Error:', error.message);
        res.json({ success: false, message: 'Error del servidor' });
    }
});

// POST: Eliminar una hora especÃ­fica de TODOS los dÃ­as
app.post('/api/disponibilidad/eliminar-horas', autenticar, autorizar(['admin','profesional','recepcionista']), async (req, res) => {
    const { profesional_id, horas } = req.body;

    if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'recepcionista' && profesional_id !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No podÃ©s modificar horarios de otro profesional' });
    }

    if (!profesional_id || !Array.isArray(horas) || horas.length === 0) {
        return res.json({ success: false, message: 'Datos invÃ¡lidos' });
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

        console.log(`âœ… ${deletedCount} registros eliminados`);
        res.json({ success: true, message: `${deletedCount} registros eliminados`, deletedCount: deletedCount });
    } catch (error) {
        console.error('âŒ Error:', error.message);
        res.json({ success: false, message: 'Error del servidor' });
    }
});

// POST: Eliminar UNA hora especÃ­fica de UNA fecha especÃ­fica
app.post('/api/disponibilidad/eliminar-hora-especifica', autenticar, autorizar(['admin','profesional','recepcionista']), async (req, res) => {
    const { profesional_id, fecha, hora_inicio } = req.body;

    if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'recepcionista' && profesional_id !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No podÃ©s modificar horarios de otro profesional' });
    }

    if (!profesional_id || !fecha || !hora_inicio) {
        return res.json({ success: false, message: 'Datos invÃ¡lidos' });
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
        console.error('âŒ Error:', error.message);
        res.json({ success: false, message: 'Error del servidor' });
    }
});

// ============================================
// ðŸš« HORARIOS OCUPADOS
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
        console.error('âŒ Error:', error.message);
        res.status(500).json({ error: 'Error al obtener horarios' });
    }
});

// ============================================
// ðŸ“… TURNOS
// ============================================
// Todos los turnos (Admin)
app.get('/api/turnos/todos', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    try {
        // Extraer parÃ¡metros de filtro
        const { profesional_id, fecha_desde, fecha_hasta } = req.query;
        
        let query = `
            SELECT t.id, t.fecha, t.hora_inicio,
                   t.estado,
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
        console.error('âŒ Error turnos todos:', error.message);
        res.status(500).json({ error: 'Error al obtener los turnos' });
    }
});

// ============================================
// ðŸ“² RECORDATORIOS (ADMIN / CAJA)
// ============================================
// Turnos de hoy y maÃ±ana con telÃ©fono del cliente para enviar recordatorios
app.get('/api/recordatorios', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
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
        console.error('âŒ Error recordatorios:', e.message);
        res.status(500).json({ error: 'Error al obtener recordatorios' });
    }
});

// Marcar recordatorio como enviado
app.post('/api/recordatorios/:id/enviado', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    try {
        await pool.query('UPDATE turnos SET recordatorio_enviado = 1 WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error('âŒ Error marcar recordatorio:', e.message);
        res.status(500).json({ success: false });
    }
});

// Obtener un turno especÃ­fico
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

        // RestricciÃ³n: solo admin, el profesional asignado o el cliente dueÃ±o del turno
        const turno = rows[0];
        if (req.usuario.rol !== 'admin' &&
            req.usuario.id !== turno.profesional_id &&
            req.usuario.id !== turno.cliente_id) {
            return res.status(403).json({ success: false, message: 'No tenÃ©s permiso para ver este turno' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('âŒ Error:', error.message);
        res.status(500).json({ error: 'Error al obtener el turno' });
    }
});

// Turnos del profesional
app.get('/api/turnos/profesional/:id', autenticar, async (req, res) => {
    // Un profesional solo puede ver SUS propios turnos; admin puede ver todos
    if (req.usuario.rol !== 'admin' && parseInt(req.params.id) !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No tenÃ©s permiso para ver estos turnos' });
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
        console.error('âŒ Error turnos profesional:', error.message);
        res.status(500).json({ error: 'Error al obtener los turnos' });
    }
});

// Turnos del cliente
app.get('/api/turnos/cliente/:id', autenticar, async (req, res) => {
    // Un cliente solo puede ver SUS propios turnos; admin puede ver todos
    if (req.usuario.rol !== 'admin' && parseInt(req.params.id) !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No tenÃ©s permiso para ver estos turnos' });
    }
    try {
        const [rows] = await pool.query(
            `SELECT t.id, t.fecha, t.hora_inicio, t.estado, s.nombre as servicio_nombre, u.nombre as profesional_nombre
             FROM turnos t 
             JOIN servicios s ON t.servicio_id = s.id 
             JOIN usuarios u ON t.profesional_id = u.id
             WHERE t.cliente_id = ? 
             ORDER BY t.fecha DESC, t.hora_inicio DESC`,
            [req.params.id]
        );
        res.json(rows || []);
    } catch (error) {
        console.error('âŒ Error turnos cliente:', error.message);
        res.status(500).json({ error: 'Error al obtener los turnos' });
    }
});

// ============================================
// ðŸŽ‚ CLIENTES FRECUENTES, CUMPLEAÃ‘OS Y CUPONES
// ============================================

// Listar clientes frecuentes (admin / recepcionista)
app.get('/api/clientes', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, nombre, email, telefono, fecha_nacimiento, direccion, notas,
                    fecha_ultima_visita, activo
             FROM clientes
             WHERE activo = 1
             ORDER BY nombre ASC`
        );
        res.json(rows);
    } catch (e) {
        console.error('âŒ Error clientes:', e.message);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

// Crear o actualizar un cliente frecuente (admin / recepcionista)
app.post('/api/clientes', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    const { id, nombre, email, telefono, fecha_nacimiento, direccion, notas } = req.body;
    const nom = (nombre || '').trim();
    if (!nom) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
    try {
        if (id) {
            await pool.query(
                `UPDATE clientes SET nombre = ?, email = ?, telefono = ?, fecha_nacimiento = ?,
                        direccion = ?, notas = ? WHERE id = ?`,
                [nom, email || null, telefono || null, fecha_nacimiento || null, direccion || null, notas || null, id]
            );
            return res.json({ success: true, id, cliente_id: id });
        }
        const tel = (telefono || '').trim();
        if (tel) {
            const [ex] = await pool.query('SELECT id FROM clientes WHERE telefono = ? AND activo = 1 LIMIT 1', [tel]);
            if (ex.length) {
                const cid = ex[0].id;
                await pool.query(
                    `UPDATE clientes SET nombre = ?, email = ?, telefono = ?, fecha_nacimiento = ?,
                            direccion = ?, notas = ? WHERE id = ?`,
                    [nom, email || null, tel, fecha_nacimiento || null, direccion || null, notas || null, cid]
                );
                return res.json({ success: true, id: cid, cliente_id: cid });
            }
        }
        const [r] = await pool.query(
            `INSERT INTO clientes (nombre, email, telefono, fecha_nacimiento, direccion, notas, fecha_ultima_visita, activo)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), 1)`,
            [nom, email || null, tel || null, fecha_nacimiento || null, direccion || null, notas || null]
        );
        res.json({ success: true, id: r.insertId, cliente_id: r.insertId });
    } catch (e) {
        console.error('âŒ Error guardar cliente:', e.message);
        res.status(500).json({ success: false, error: 'Error al guardar el cliente' });
    }
});

// ðŸŽ‚ CumpleaÃ±os: clientes que cumplen en el mes actual (ordenados por dÃ­a)
app.get('/api/cumpleanos', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, nombre, email, telefono, fecha_nacimiento,
                    DAY(fecha_nacimiento) as dia_cumple,
                    CASE WHEN DAY(fecha_nacimiento) = DAY(CURDATE()) THEN 1 ELSE 0 END as cumple_hoy
             FROM clientes
             WHERE activo = 1 AND fecha_nacimiento IS NOT NULL
               AND MONTH(fecha_nacimiento) = MONTH(CURDATE())
             ORDER BY cumple_hoy DESC, DAY(fecha_nacimiento) ASC, nombre ASC`
        );
        res.json(rows);
    } catch (e) {
        console.error('âŒ Error cumpleaÃ±os:', e.message);
        res.status(500).json({ error: 'Error al obtener cumpleaÃ±os' });
    }
});

// Crear cupÃ³n de servicio gratis (SOLO admin) â€” estado inicial "autorizado"
app.post('/api/cupones', autenticar, autorizar(['admin']), async (req, res) => {
    const { cliente_id, servicio_id } = req.body;
    if (!cliente_id || !servicio_id) {
        return res.status(400).json({ success: false, message: 'SeleccionÃ¡ cliente y servicio' });
    }
    try {
        const [sv] = await pool.query('SELECT id FROM servicios WHERE id = ?', [servicio_id]);
        if (!sv.length) return res.status(400).json({ success: false, message: 'Servicio invÃ¡lido' });
        const [r] = await pool.query(
            `INSERT INTO cupones (cliente_id, servicio_id, estado, creado_por)
             VALUES (?, ?, 'autorizado', ?)`,
            [cliente_id, servicio_id, req.usuario.id]
        );
        res.json({ success: true, id: r.insertId, message: 'CupÃ³n autorizado' });
    } catch (e) {
        console.error('âŒ Error crear cupÃ³n:', e.message);
        res.status(500).json({ success: false, error: 'Error al crear el cupÃ³n' });
    }
});

// Listar cupones (admin y recepcionista ven todos, con estado)
app.get('/api/cupones', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT cp.id, cp.cliente_id, cp.servicio_id, cp.estado, cp.fecha_autorizado, cp.fecha_envio,
                    c.nombre as cliente_nombre, c.telefono as cliente_telefono,
                    s.nombre as servicio_nombre
             FROM cupones cp
             LEFT JOIN clientes c ON cp.cliente_id = c.id
             LEFT JOIN servicios s ON cp.servicio_id = s.id
             ORDER BY (cp.estado = 'autorizado') DESC, cp.fecha_autorizado DESC`
        );
        res.json(rows);
    } catch (e) {
        console.error('âŒ Error cupones:', e.message);
        res.status(500).json({ error: 'Error al obtener cupones' });
    }
});

// Marcar cupÃ³n como enviado (lo envÃ­a la recepcionista por WhatsApp)
app.post('/api/cupones/:id/enviado', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    try {
        await pool.query(
            `UPDATE cupones SET estado = 'enviado', fecha_envio = NOW() WHERE id = ?`,
            [req.params.id]
        );
        res.json({ success: true });
    } catch (e) {
        console.error('âŒ Error marcar cupÃ³n:', e.message);
        res.status(500).json({ success: false, error: 'Error al marcar el cupÃ³n' });
    }
});

// Crear turno (soporta uno o varios servicios: servicios = array de ids)
app.post('/api/turnos', autenticar, async (req, res) => {
    const { cliente_id, cliente_nombre, cliente_telefono, cliente_email, cliente_fecha_nacimiento, profesional_id, servicio_id, fecha, hora_inicio } = req.body;
    const servicios = Array.isArray(req.body.servicios) ? req.body.servicios : (servicio_id ? [servicio_id] : []);
    if (!servicios.length) {
        return res.status(400).json({ success: false, message: 'SeleccionÃ¡ al menos un servicio' });
    }
    try {
        const [existente] = await pool.query(
            'SELECT id FROM turnos WHERE profesional_id = ? AND fecha = ? AND hora_inicio = ?',
            [profesional_id, fecha, hora_inicio]
        );
        if (existente.length > 0) {
            return res.status(400).json({ success: false, message: 'Este horario ya estÃ¡ ocupado. Por favor selecciona otro.' });
        }
        let nombreFinal = (cliente_nombre || '').trim();
        if (!nombreFinal && cliente_id) {
            const [u] = await pool.query('SELECT nombre FROM usuarios WHERE id = ?', [cliente_id]);
            if (u.length) nombreFinal = u[0].nombre;
        }
        const telFinal = (cliente_telefono || '').trim() || null;

        // Upsert cliente frecuente (fecha de nacimiento para cumpleaÃ±os y cupones)
        if (nombreFinal) {
            try {
                const telCliente = telFinal;
                if (telCliente) {
                    const [exCl] = await pool.query('SELECT id FROM clientes WHERE telefono = ? AND activo = 1 LIMIT 1', [telCliente]);
                    if (exCl.length) {
                        await pool.query(
                            `UPDATE clientes SET nombre = ?, email = COALESCE(?, email),
                                    fecha_nacimiento = COALESCE(?, fecha_nacimiento),
                                    fecha_ultima_visita = NOW() WHERE id = ?`,
                            [nombreFinal, cliente_email || null, cliente_fecha_nacimiento || null, exCl[0].id]
                        );
                    } else {
                        await pool.query(
                            `INSERT INTO clientes (nombre, email, telefono, fecha_nacimiento, fecha_ultima_visita, activo)
                             VALUES (?, ?, ?, ?, NOW(), 1)`,
                            [nombreFinal, cliente_email || null, telCliente, cliente_fecha_nacimiento || null]
                        );
                    }
                }
            } catch (eCli) {
                console.error('âš ï¸ Sin impacto en turno - error upsert cliente:', eCli.message);
            }
        }

        // Precios de los servicios seleccionados
        const [serviciosInfo] = await pool.query(
            `SELECT id, nombre, precio FROM servicios WHERE id IN (?)`, [servicios]
        );
        if (!serviciosInfo.length) {
            return res.status(400).json({ success: false, message: 'Servicios invÃ¡lidos' });
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
        console.error('âŒ Error al crear turno:', error.message);
        res.status(500).json({ success: false, error: 'Error al crear el turno' });
    }
});

// EDITAR turno
app.put('/api/turnos/:id', autenticar, async (req, res) => {
    const { id } = req.params;
    const { servicio_id, profesional_id, fecha, hora_inicio, estado } = req.body;
    try {
        if (estado && !servicio_id && !profesional_id && !fecha && !hora_inicio) {
            if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'recepcionista') {
                return res.status(403).json({ success: false, message: 'No tenés permisos para cambiar el estado del turno' });
            }
            await pool.query('UPDATE turnos SET estado = ? WHERE id = ?', [estado, id]);
            return res.json({ success: true, message: 'Estado actualizado' });
        }
        // Verificar que el nuevo horario no estÃ© ocupado (excluyendo el turno actual)
        const [existente] = await pool.query(
            'SELECT id FROM turnos WHERE profesional_id = ? AND fecha = ? AND hora_inicio = ? AND id != ?',
            [profesional_id, fecha, hora_inicio, id]
        );
        
        if (existente.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Este horario ya estÃ¡ ocupado. Por favor selecciona otro.' 
            });
        }
        
        // Actualizar el turno
        await pool.query(
            'UPDATE turnos SET servicio_id = ?, profesional_id = ?, fecha = ?, hora_inicio = ? WHERE id = ?',
            [servicio_id, profesional_id, fecha, hora_inicio, id]
        );
        
        res.json({ success: true, message: 'Turno actualizado correctamente' });
    } catch (error) {
        console.error('âŒ Error al editar turno:', error.message);
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
        console.error('âŒ Error items turno:', e.message);
        res.status(500).json({ error: 'Error al obtener los servicios del turno' });
    }
});

// Agregar un servicio extra a un turno existente
app.post('/api/turnos/:id/servicios', autenticar, autorizar(['admin','profesional','recepcionista']), async (req, res) => {
    const { id } = req.params;
    const { servicio_id } = req.body;
    try {
        const [sv] = await pool.query('SELECT id, nombre, precio FROM servicios WHERE id = ? AND activo = TRUE', [servicio_id]);
        if (!sv.length) return res.status(400).json({ success: false, message: 'Servicio invÃ¡lido' });

        const [existe] = await pool.query(
            'SELECT id FROM turno_items WHERE turno_id = ? AND servicio_id = ?', [id, servicio_id]
        );
        if (existe.length) return res.status(400).json({ success: false, message: 'Ese servicio ya estÃ¡ en el turno' });

        await pool.query(
            'INSERT INTO turno_items (turno_id, servicio_id, nombre, precio) VALUES (?, ?, ?, ?)',
            [id, sv[0].id, sv[0].nombre, parseFloat(sv[0].precio || 0)]
        );

        // Actualizar precio total del turno
        const [items] = await pool.query('SELECT IFNULL(SUM(precio),0) as total FROM turno_items WHERE turno_id = ?', [id]);
        await pool.query('UPDATE turnos SET precio = ? WHERE id = ?', [items[0].total, id]);

        res.json({ success: true, message: 'Servicio agregado al turno' });
    } catch (e) {
        console.error('âŒ Error agregar servicio a turno:', e.message);
        res.status(500).json({ success: false, error: 'Error al agregar el servicio' });
    }
});

// Quitar un servicio de un turno existente
app.delete('/api/turnos/:id/servicios/:itemId', autenticar, autorizar(['admin','profesional','recepcionista']), async (req, res) => {
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
        console.error('âŒ Error quitar servicio de turno:', e.message);
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
        console.error('âŒ Error al eliminar turno:', error.message);
        res.status(500).json({ success: false, error: 'Error al eliminar el turno' });
    }
});

// ============================================
// ⏱️ SOBRETURNOS (huecos entre turnos del día)
// ============================================

function _horaAMin(ht) {
    if (!ht) return null;
    try {
        const s = String(ht).split(':').map(Number);
        return (s[0] || 0) * 60 + (s[1] || 0);
    } catch (e) { return null; }
}

function _minAFecha(min) {
    const h = String(Math.floor(min / 60)).padStart(2, '0');
    const m = String(min % 60).padStart(2, '0');
    return h + ':' + m;
}

// Huecos disponibles: turnos cobrados cuyo fin_real deja minutos libres hasta el próximo turno del profesional
app.get('/api/sobreturnos/disponibles', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    const { fecha } = req.query;
    const dia = fecha || new Date().toISOString().slice(0, 10);
    try {
        const [rows] = await pool.query(
            `SELECT t.id, t.fecha, DATE_FORMAT(t.hora_inicio, '%H:%i') as hora_inicio,
                    DATE_FORMAT(t.fin_real, '%H:%i') as fin_real, t.estado, t.tipo,
                    t.profesional_id, p.nombre as profesional
             FROM turnos t
             LEFT JOIN usuarios p ON t.profesional_id = p.id
             WHERE t.fecha = ? AND t.estado <> 'cancelado'
             ORDER BY t.profesional_id, t.hora_inicio, t.id`,
            [dia]
        );
        // Agrupar por profesional
        const porProf = {};
        rows.forEach(t => {
            const key = t.profesional_id || 0;
            if (!porProf[key]) porProf[key] = { profesional_id: key, profesional: t.profesional || 'Sin asignar', turnos: [] };
            porProf[key].turnos.push(t);
        });

        const huecos = [];
        Object.values(porProf).forEach(g => {
            g.turnos.forEach((t, i) => {
                // Solo turnos cobrados con fin_real pueden generar hueco
                const finRealMin = _horaAMin(t.fin_real);
                if (t.estado !== 'cobrado' || finRealMin === null) return;
                // Buscar el próximo turno del profesional que empiece después del fin real
                const siguiente = g.turnos.find(n => _horaAMin(n.hora_inicio) > finRealMin);
                if (!siguiente) return;
                const inicioSig = _horaAMin(siguiente.hora_inicio);
                const libres = inicioSig - finRealMin;
                if (libres <= 0) return;
                huecos.push({
                    turno_origen: t.id,
                    profesional_id: g.profesional_id,
                    profesional: g.profesional,
                    desde: _minAFecha(finRealMin),
                    hasta: siguiente.hora_inicio,
                    minutos: libres
                });
            });
        });
        res.json(huecos);
    } catch (e) {
        console.error('âŒ Error sobreturnos disponibles:', e.message);
        res.status(500).json({ error: 'Error al calcular sobreturnos' });
    }
});

// Crear sobreturno: turno tipo 'sobreturno' en un hueco con los minutos libres disponibles
app.post('/api/sobreturnos', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    const { profesional_id, fecha, desde, cliente_nombre, cliente_telefono, cliente_email, cliente_fecha_nacimiento, servicios = [] } = req.body;
    if (!profesional_id || !fecha || !desde || !Array.isArray(servicios) || !servicios.length) {
        return res.status(400).json({ success: false, message: 'Faltan datos para el sobreturno' });
    }
    const clienteNom = (cliente_nombre || '').trim();
    if (!clienteNom) return res.status(400).json({ success: false, message: 'Ingresá el nombre del cliente' });

    try {
        // Obtener el próximo turno del profesional después de "desde"
        const [proximos] = await pool.query(
            `SELECT DATE_FORMAT(t.hora_inicio, '%H:%i') as hora_inicio
             FROM turnos t
             WHERE t.profesional_id = ? AND t.fecha = ? AND t.estado <> 'cancelado'
               AND t.hora_inicio > ?
             ORDER BY t.hora_inicio ASC LIMIT 1`,
            [profesional_id, fecha, desde + ':00']
        );
        let minutosLibres = null;
        if (proximos.length) {
            minutosLibres = _horaAMin(proximos[0].hora_inicio) - _horaAMin(desde);
        }
        // Sin próximo turno: el hueco va hasta cierre (22:00 por defecto)
        if (minutosLibres === null) {
            minutosLibres = 22 * 60 - _horaAMin(desde);
        }
        if (minutosLibres <= 0) {
            return res.status(400).json({ success: false, message: 'No hay hueco libre en ese horario' });
        }

        // Sumar duración de los servicios elegidos
        const [serviciosInfo] = await pool.query(
            `SELECT id, nombre, precio, COALESCE(duracion, 60) as duracion FROM servicios WHERE id IN (?) AND activo = TRUE`, [servicios]
        );
        if (!serviciosInfo.length) return res.status(400).json({ success: false, message: 'Servicios inválidos' });
        const duracionTotal = serviciosInfo.reduce((s, sv) => s + parseInt(sv.duracion || 60, 10), 0);
        if (duracionTotal > minutosLibres) {
            return res.status(400).json({ success: false, message: `Los servicios elegidos duran ${duracionTotal} min pero el hueco tiene ${minutosLibres} min` });
        }

        // Verificar no choque con turnos existentes en ese rango
        const [existentes] = await pool.query(
            `SELECT t.id FROM turnos t
             WHERE t.profesional_id = ? AND t.fecha = ? AND t.estado <> 'cancelado'
               AND t.hora_inicio > ? AND t.hora_inicio < ADDTIME(?, SEC_TO_TIME(?))`,
            [profesional_id, fecha, desde + ':00', desde + ':00', duracionTotal * 60]
        );

        const precioTotal = serviciosInfo.reduce((s, sv) => s + parseFloat(sv.precio || 0), 0);
        const primerId = serviciosInfo[0].id;

        // Upsert cliente frecuente (igual que en turnos)
        const telCliente = (cliente_telefono || '').trim() || null;
        if (telCliente) {
            try {
                const [exCl] = await pool.query('SELECT id FROM clientes WHERE telefono = ? AND activo = 1 LIMIT 1', [telCliente]);
                if (exCl.length) {
                    await pool.query(
                        `UPDATE clientes SET nombre = ?, email = COALESCE(?, email),
                                fecha_nacimiento = COALESCE(?, fecha_nacimiento),
                                fecha_ultima_visita = NOW() WHERE id = ?`,
                        [clienteNom, cliente_email || null, cliente_fecha_nacimiento || null, exCl[0].id]
                    );
                } else {
                    await pool.query(
                        `INSERT INTO clientes (nombre, email, telefono, fecha_nacimiento, fecha_ultima_visita, activo)
                         VALUES (?, ?, ?, ?, NOW(), 1)`,
                        [clienteNom, cliente_email || null, telCliente, cliente_fecha_nacimiento || null]
                    );
                }
            } catch (eCli) { console.error('⚠️ Error upsert cliente sobreturno:', eCli.message); }
        }

        const [r] = await pool.query(
            `INSERT INTO turnos (cliente_id, cliente_nombre, cliente_telefono, profesional_id, servicio_id, fecha, hora_inicio, precio, estado, tipo, notas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmado', 'sobreturno', ?)`,
            [null, clienteNom, telCliente, profesional_id, primerId, fecha, desde + ':00', precioTotal, `Sobreturno — hueco ${duracionTotal} min`]
        );
        const turnoId = r.insertId;

        const items = serviciosInfo.map(sv => [turnoId, sv.id, sv.nombre, parseFloat(sv.precio || 0)]);
        await pool.query(
            'INSERT INTO turno_items (turno_id, servicio_id, nombre, precio) VALUES ?', [items]
        );

        res.json({ success: true, id: turnoId, message: 'Sobreturno agendado correctamente' });
    } catch (e) {
        console.error('âŒ Error crear sobreturno:', e.message);
        res.status(500).json({ success: false, error: 'Error al crear el sobreturno: ' + e.message });
    }
});

// ============================================
// ðŸ“Š ESTADÃSTICAS
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
        console.error('âŒ Error estadÃ­sticas:', error.message);
        res.status(500).json({ error: 'Error al obtener las estadÃ­sticas' });
    }
});

// ============================================
// ðŸ’µ CAJA - PANEL DE COBRO Y TICKETS
// ============================================

// ConfiguraciÃ³n del local (para el ticket)
app.get('/api/caja/config', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT clave, valor FROM configuracion');
        const config = {};
        rows.forEach(r => config[r.clave] = r.valor);
        res.json(config);
    } catch (e) {
        console.error('âŒ Error configuracion:', e.message);
        res.status(500).json({ error: 'Error al obtener configuraciÃ³n' });
    }
});

// Editar configuraciÃ³n del local (solo admin)
app.put('/api/caja/config', autenticar, autorizar(['admin']), async (req, res) => {
    const { local_nombre, local_cuit, local_direccion, local_telefono, punto_venta } = req.body;
    try {
        const mapa = { local_nombre, local_cuit, local_direccion, local_telefono, punto_venta };
        for (const [clave, valor] of Object.entries(mapa)) {
            if (valor !== undefined) {
                await pool.query('INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [clave, String(valor)]);
            }
        }
        res.json({ success: true, message: 'ConfiguraciÃ³n guardada' });
    } catch (e) {
        console.error('âŒ Error guardando config:', e.message);
        res.status(500).json({ success: false, message: 'Error al guardar configuraciÃ³n' });
    }
});

// TelÃ©fono del local (pÃºblico, para botones de WhatsApp)
app.get('/api/caja/config/public', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT valor FROM configuracion WHERE clave = 'local_telefono'");
        const telefono = rows[0]?.valor || '';
        res.json({ local_telefono: telefono });
    } catch (e) {
        console.error('âŒ Error config publica:', e.message);
        res.status(500).json({ error: 'Error al obtener configuraciÃ³n' });
    }
});

// Turnos del dÃ­a para el panel de caja
app.get('/api/caja/dia', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT t.id, t.fecha, DATE_FORMAT(t.hora_inicio, '%H:%i') as hora_inicio, t.estado, t.tipo,
                    DATE_FORMAT(t.fin_real, '%H:%i') as fin_real,
                    COALESCE(t.cliente_nombre, c.nombre) as cliente_nombre,
                    COALESCE(t.cliente_telefono, c.telefono) as cliente_telefono,
                    t.cliente_email,
                    s.nombre as servicio,
                    COALESCE(NULLIF(t.precio,0), s.precio) as precio,
                    p.nombre as profesional, t.profesional_id,
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
        console.error('âŒ Error caja dia:', e.message);
        res.status(500).json({ error: 'Error al obtener turnos del dÃ­a' });
    }
});

// Estado de la caja del dÃ­a (abierta/cerrada + totales)
app.get('/api/caja/estado', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    try {
        const [caja] = await pool.query(
            "SELECT * FROM cajas WHERE estado = 'abierta' AND fecha = CURDATE() ORDER BY id DESC LIMIT 1"
        );
        if (!caja.length) {
            return res.json({ abierta: false });
        }
        res.json({ abierta: true, caja: caja[0] });
    } catch (e) {
        console.error('âŒ Error estado caja:', e.message);
        res.status(500).json({ error: 'Error al obtener estado de la caja' });
    }
});

// Abrir caja del dÃ­a (con monto inicial)
app.post('/api/caja/abrir', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
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
        console.error('âŒ Error abrir caja:', e.message);
        res.status(500).json({ success: false, message: 'Error al abrir la caja' });
    }
});

// Cerrar caja del dÃ­a (monto final contado en caja)
app.post('/api/caja/cerrar', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
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
            'SELECT id, profesional_nombre, monto_retirado, metodo_retiro FROM retiros WHERE caja_id = ?', [c.id]
        );
        const totalRetiros = retiros.reduce((s, r) => s + parseFloat(r.monto_retirado || 0), 0);
        const real = parseFloat(monto_real) || 0;
        // Los retiros ya descontaron dinero de la caja al registrarse, por eso el esperado
        // NO vuelve a restar los retiros.
        const esperado = parseFloat(c.monto_inicial || 0) + total;
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
                total_ventas: total + totalRetiros,
                retiros,
                total_retiros: Math.round(totalRetiros * 100) / 100,
                dinero_en_caja_esperado: Math.round(esperado * 100) / 100,
                dinero_contado: real,
                diferencia
            }
        });
    } catch (e) {
        console.error('âŒ Error cerrar caja:', e.message);
        res.status(500).json({ success: false, message: 'Error al cerrar la caja' });
    }
});

// Historial de cierres (Ãºltimos dÃ­as)
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
        console.error('âŒ Error historial caja:', e.message);
        res.status(500).json({ error: 'Error al obtener historial de cajas' });
    }
});

// Cobrar un turno + generar ticket (comprobante no fiscal)
// Registra el pago en la caja del dÃ­a si hay una caja abierta.
app.post('/api/caja/turnos/:id/cerrar', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    const { id } = req.params;
    const { monto, metodo_pago } = req.body;
    try {
        const [turno] = await pool.query('SELECT * FROM turnos WHERE id = ?', [id]);
        if (!turno.length) return res.status(404).json({ success: false, message: 'Turno no encontrado' });
        if (turno[0].estado === 'cobrado') {
            return res.status(400).json({ success: false, message: 'Este turno ya fue cobrado' });
        }
        if (turno[0].estado === 'cancelado') {
            return res.status(400).json({ success: false, message: 'Este turno fue cancelado y no puede cobrarse' });
        }

        const montoFinal = parseFloat(monto);
        if (!montoFinal || montoFinal <= 0) {
            return res.status(400).json({ success: false, message: 'Monto invÃ¡lido' });
        }
        const metodo = metodo_pago || 'efectivo';
        if (metodo === 'credito') {
            return res.status(400).json({ success: false, message: 'Este negocio no acepta tarjetas de crÃ©dito' });
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

        // Marcar turno como cobrado y registrar el fin real (para sobreturnos)
        await pool.query('UPDATE turnos SET estado = ?, precio = ?, fin_real = CURTIME() WHERE id = ?', ['cobrado', montoFinal, id]);

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

        // Caja abierta del dÃ­a (si existe)
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

        // NÃºmero correlativo de ticket
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
        console.error('âŒ Error al cobrar turno:', e.message);
        res.status(500).json({ success: false, message: 'Error al procesar el cobro' });
    }
});

// ============================================
// ðŸ’¸ RETIROS DE PROFESIONALES
// ============================================
// Resumen de retiros del dÃ­a + lo que le corresponderÃ­a retirar a cada
// profesional segÃºn sus turnos cobrados del dÃ­a (monto Ã— porcentaje_retiro).
app.get('/api/caja/retiros', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
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
                    r.porcentaje_retiro, r.monto_retirado, r.monto_estetica, r.metodo_retiro, r.creado_at
             FROM retiros r WHERE r.fecha = CURDATE() ORDER BY r.id`
        );
        res.json({ sugerencias, retiros });
    } catch (e) {
        console.error('âŒ Error retiros:', e.message);
        res.status(500).json({ error: 'Error al obtener retiros' });
    }
});

// Registrar el retiro de una profesional (calcula lo que le corresponde
// segÃºn sus turnos cobrados del dÃ­a y su porcentaje). El retiro saca dinero
// de la caja del dÃ­a: descuenta del efectivo o de la transferencia segÃºn el
// mÃ©todo indicado. NO se puede eliminar un retiro ya registrado.
app.post('/api/caja/retiros', autenticar, autorizar(['admin','recepcionista']), async (req, res) => {
    const { profesional_id, monto_retirar, metodo } = req.body;
    if (!profesional_id) return res.status(400).json({ success: false, message: 'IndicÃ¡ la profesional' });
    const metodoRetiro = (metodo === 'transferencia') ? 'transferencia' : 'efectivo';
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
        // Descontar lo que la profesional ya retirÃ³ hoy para no retirar dos veces
        const [yaRetirado] = await pool.query(
            'SELECT COALESCE(SUM(monto_retirado),0) AS total FROM retiros WHERE profesional_id = ? AND fecha = CURDATE()',
            [profesional_id]
        );
        const yaRetiradoTotal = parseFloat(yaRetirado[0]?.total || 0);
        const maximo = Math.max(0, Math.round((bruto * pct / 100 - yaRetiradoTotal) * 100) / 100);
        let retirado;
        if (monto_retirar !== undefined && monto_retirar !== null && monto_retirar !== '') {
            retirado = Math.min(maximo, Math.max(0, parseFloat(monto_retirar) || 0));
        } else {
            retirado = maximo; // por defecto, se retira TODO lo que le corresponde
        }
        if (retirado <= 0) {
            return res.status(400).json({ success: false, message: 'No hay saldo para retirar en el dÃ­a de hoy' });
        }
        const estetica = Math.round((bruto - retirado) * 100) / 100;

        // Requiere caja abierta del dÃ­a: el retiro saca dinero de esa caja
        const [caja] = await pool.query(
            "SELECT id FROM cajas WHERE estado = 'abierta' AND fecha = CURDATE() ORDER BY id DESC LIMIT 1"
        );
        if (!caja.length) {
            return res.status(400).json({ success: false, message: 'AbrÃ­ la caja del dÃ­a para poder registrar retiros' });
        }
        const cajaId = caja[0].id;

        // Descontar del total correspondiente (efectivo o transferencia)
        const colMetodo = (metodoRetiro === 'transferencia') ? 'total_transferencia' : 'total_efectivo';
        await pool.query(
            `UPDATE cajas SET ${colMetodo} = GREATEST(0, ${colMetodo} - ?) WHERE id = ?`,
            [retirado, cajaId]
        );

        const [r] = await pool.query(
            `INSERT INTO retiros (caja_id, profesional_id, profesional_nombre, fecha, monto_bruto,
                                  porcentaje_retiro, monto_retirado, monto_estetica, creado_por, metodo_retiro)
             VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?)`,
            [cajaId, p.id, p.nombre, bruto, pct, retirado, estetica, req.usuario.id, metodoRetiro]
        );
        res.json({
            success: true,
            retiro: {
                id: r.insertId, profesional_nombre: p.nombre, monto_bruto: bruto,
                porcentaje_retiro: pct, monto_retirado: retirado, monto_estetica: estetica,
                metodo_retiro: metodoRetiro
            },
            mensaje: `Retiro de $${retirado.toFixed(2)} (${metodoRetiro}) registrado para ${p.nombre}`
        });
    } catch (e) {
        console.error('âŒ Error registrar retiro:', e.message);
        res.status(500).json({ success: false, message: 'Error al registrar el retiro' });
    }
});

// ============================================
// ðŸ¥ HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// ðŸš€ INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.clear();
    console.log('\n' + '='.repeat(70));
    console.log('ðŸš€  SERVIDOR CHAMAS INICIADO');
    console.log('='.repeat(70));
    console.log(`ðŸ“  URL: https://chamas-spa.onrender.com`);
    console.log(`â°  Hora: ${new Date().toLocaleString()}`);
    console.log('='.repeat(70));
    console.log('\nðŸ“‹  RUTAS DISPONIBLES:\n');
    console.log('   ðŸ” POST   /api/auth/login');
    console.log('   ðŸ‘¤ POST   /api/usuarios (registrar profesional)');
    console.log('   ðŸ“¦ GET    /api/servicios');
    console.log('   âœï¸  PUT    /api/servicios/:id');
    console.log('   ðŸ‘¥ GET    /api/profesionales/servicio/:id');
    console.log('   ðŸ‘¥ GET    /api/usuarios/profesionales');
    console.log('   â° GET    /api/disponibilidad_completa/:id');
    console.log('   â° GET    /api/disponibilidad/:profesionalId/:dia');
    console.log('   ðŸ“… POST   /api/disponibilidad');
    console.log('   ðŸ’¾ POST   /api/disponibilidad/guardar-directas (CALENDARIO)');
    console.log('   ðŸ—‘ï¸  POST   /api/disponibilidad/eliminar-fecha (CALENDARIO)');
    console.log('   ðŸ—‘ï¸  POST   /api/disponibilidad/eliminar-horas (CALENDARIO)');
    console.log('   ðŸš« GET    /api/horarios-ocupados/:profesionalId/:fecha');
    console.log('   ðŸ“‹ GET    /api/turnos/todos (ADMIN)');
    console.log('   ðŸ“‹ GET    /api/turnos/:id (obtener uno)');
    console.log('   ðŸ“‹ GET    /api/turnos/:id/items (servicios del turno)');
    console.log('   âž• POST   /api/turnos/:id/servicios (agregar servicio)');
    console.log('   âž– DELETE /api/turnos/:id/servicios/:itemId (quitar servicio)');
    console.log('   ðŸ‘¥ POST   /api/profesionales/servicios (multi-servicio)');
    console.log('   ðŸ“… GET    /api/turnos/profesional/:id');
    console.log('   ðŸ“… GET    /api/turnos/cliente/:id');
    console.log('   ðŸ“ POST   /api/turnos (crear)');
    console.log('   âœï¸  PUT    /api/turnos/:id (editar)');
    console.log('   ðŸ—‘ï¸  DELETE /api/turnos/:id (eliminar)');
    console.log('   ðŸ’µ GET    /api/caja/estado (abierta/cerrada + totales)');
    console.log('   ðŸ’µ POST   /api/caja/abrir (abrir caja del dÃ­a)');
    console.log('   ðŸ’µ POST   /api/caja/cerrar (cerrar y resumen)');
    console.log('   ðŸ’µ GET    /api/caja/historial (cierres previos)');
    console.log('   ðŸ§¾ POST   /api/caja/turnos/:id/cerrar (cobrar + ticket)');
    console.log('   ðŸ’¸ GET    /api/caja/retiros (sugerencias + registrados)');
    console.log('   ðŸ’¸ POST   /api/caja/retiros (registrar retiro de profesional)');
    console.log('   ðŸ“Š GET    /api/estadisticas');
    console.log('   ðŸ” POST   /api/auth/recuperar (solicitar cÃ³digo)');
    console.log('   ðŸ” POST   /api/auth/recuperar/confirmar (verificar cÃ³digo + nueva contraseÃ±a)');
    console.log('   ðŸ” PATCH  /api/auth/cambiar-contrasena (con sesiÃ³n)');
    console.log('   ðŸ¥ GET    /api/health');
    console.log('\n' + '='.repeat(70));
    console.log('âœ…  SERVIDOR LISTO - CALENDARIO INTERACTIVO ACTIVADO');
    console.log('='.repeat(70) + '\n');
});
