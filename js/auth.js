// auth.js - SISTEMA DE AUTENTICACIÓN CON REGISTRO DE CLIENTES

// ==========================================
// 1. VERIFICAR SESIÓN AL CARGAR LA PÁGINA
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const token = obtenerToken();
    
    if (token) {
        // Validar el token contra el servidor y reconstruir la sesión
        try {
            const res = await fetch(`${window.API_BASE}/auth/me`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('usuario', JSON.stringify(data.usuario));
                console.log('✅ Usuario logueado:', data.usuario.nombre, '- Rol:', data.usuario.rol);
                ocultarLogin();
                mostrarApp();
                configurarInterfazPorRol(data.usuario.rol);
                return;
            }
        } catch (e) {
            console.error('Error al validar sesión:', e);
        }
        // Token inválido o expirado → cerrar sesión
        cerrarSesion();
    }
    
    console.log('⚠️ No hay sesión activa');
    mostrarApp();
    ocultarLogin();
    showSection('servicios');
    // Ocultar todo contenido restringido por rol
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.prof-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.cliente-puede').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.caja-only').forEach(el => el.style.display = 'none');
    // Mostrar solo el botón de servicios en el nav
    document.querySelectorAll('.nav-links button').forEach(b => b.style.display = 'none');
    const navServicios = document.querySelector('[onclick*="servicios"]');
    if (navServicios) navServicios.style.display = 'inline-block';
    const navLogin = document.getElementById('nav-login-btn');
    if (navLogin) navLogin.style.display = 'inline-block';
    const userStatus = document.querySelector('.user-status-card');
    if (userStatus) userStatus.style.display = 'none';
    if (typeof cargarDatosDesdeAPI === 'function') { cargarDatosDesdeAPI(); }
});

// ==========================================
// 2. TABS: CAMBIAR ENTRE LOGIN Y REGISTRO
// ==========================================
function mostrarTab(tab) {
    const tabLogin    = document.getElementById('tab-login');
    const tabRegistro = document.getElementById('tab-registro');
    const btnLogin    = document.getElementById('tab-btn-login');
    const btnRegistro = document.getElementById('tab-btn-registro');

    if (tab === 'login') {
        tabLogin.style.display    = 'block';
        tabRegistro.style.display = 'none';
        btnLogin.classList.add('active');
        btnRegistro.classList.remove('active');
    } else {
        tabLogin.style.display    = 'none';
        tabRegistro.style.display = 'block';
        btnLogin.classList.remove('active');
        btnRegistro.classList.add('active');
    }
}

// ==========================================
// 3. FORMULARIO DE LOGIN
// ==========================================
document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const emailOTelefono = document.getElementById('login-identificador').value.trim();
    const password       = document.getElementById('login-password').value;
    
    if (!emailOTelefono) {
        mostrarNotificacion('❌ Ingresá tu email o teléfono', 'error');
        return;
    }

    console.log('🔐 Intentando login con:', emailOTelefono);
    
    const btnLogin = e.target.querySelector('button[type="submit"]');
    const textoOriginal = btnLogin.textContent;
    btnLogin.textContent = 'Verificando...';
    btnLogin.disabled = true;
    
    try {
        const resultado = await loginAPI(emailOTelefono, password);
        
        if (resultado.success) {
            localStorage.setItem('token', resultado.token);
            localStorage.setItem('usuario', JSON.stringify(resultado.usuario));
            localStorage.setItem('userRol', resultado.usuario.rol);
            
            console.log('✅ Login exitoso');
            ocultarLogin();
            mostrarApp();
            configurarInterfazPorRol(resultado.usuario.rol);
            
            if (typeof cargarDatosDesdeAPI === 'function') {
                await cargarDatosDesdeAPI();
            }
            
            mostrarNotificacion(`✅ Bienvenido/a ${resultado.usuario.nombre}`);
        } else {
            console.log('❌ Login fallido:', resultado.message);
            mostrarNotificacion('❌ ' + (resultado.message || 'Datos incorrectos'), 'error');
            btnLogin.textContent = textoOriginal;
            btnLogin.disabled = false;
        }
    } catch (error) {
        console.error('❌ Error en login:', error);
        mostrarNotificacion('❌ Error de conexión con el servidor', 'error');
        btnLogin.textContent = textoOriginal;
        btnLogin.disabled = false;
    }
});

// ==========================================
// 4. FORMULARIO DE REGISTRO DE CLIENTE
// ==========================================
document.getElementById('form-registro-cliente')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombre    = document.getElementById('reg-nombre').value.trim();
    const email     = document.getElementById('reg-email').value.trim();
    const telefono  = document.getElementById('reg-telefono').value.trim();
    const password  = document.getElementById('reg-password').value;
    const confirmar = document.getElementById('reg-password-confirmar').value;
    
    // --- Validaciones frontend ---
    if (!nombre || !email || !telefono || !password || !confirmar) {
        mostrarNotificacion('❌ Completá todos los campos', 'error');
        return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        mostrarNotificacion('❌ El email no es válido', 'error');
        return;
    }

    // Validar teléfono (mínimo 8 dígitos)
    const telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.length < 8) {
        mostrarNotificacion('❌ Ingresá un teléfono válido (mínimo 8 dígitos)', 'error');
        return;
    }

    if (password !== confirmar) {
        mostrarNotificacion('❌ Las contraseñas no coinciden', 'error');
        return;
    }
    if (password.length < 6) {
        mostrarNotificacion('❌ La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    const btn = e.target.querySelector('button[type="submit"]');
    const textoOriginal = btn.textContent;
    btn.textContent = 'Creando cuenta...';
    btn.disabled = true;
    
    try {
        const response = await fetch(`${window.API_BASE}/auth/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, telefono, password, rol: 'cliente' })
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion(`✅ ¡Cuenta creada! Bienvenida/o ${nombre}`);
            
            // Login automático con el email (garantizado único)
            const loginResult = await loginAPI(email, password);
            if (loginResult.success) {
                localStorage.setItem('token', loginResult.token);
                localStorage.setItem('usuario', JSON.stringify(loginResult.usuario));
                localStorage.setItem('userRol', loginResult.usuario.rol);
                ocultarLogin();
                mostrarApp();
                configurarInterfazPorRol(loginResult.usuario.rol);
                if (typeof cargarDatosDesdeAPI === 'function') {
                    await cargarDatosDesdeAPI();
                }
            }
        } else {
            // El backend devuelve el mensaje exacto del error (email o teléfono duplicado)
            mostrarNotificacion('❌ ' + (data.message || 'Error al crear la cuenta'), 'error');
            btn.textContent = textoOriginal;
            btn.disabled = false;
        }
    } catch (error) {
        console.error('❌ Error en registro:', error);
        mostrarNotificacion('❌ Error de conexión con el servidor', 'error');
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
});

// ==========================================
// 5. FUNCIONES DE API
// ==========================================
async function loginAPI(emailOTelefono, password) {
    try {
        const response = await fetch(`${window.API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailOTelefono, password })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error en loginAPI:', error);
        return { success: false, message: 'Error de conexión' };
    }
}

// ==========================================
// 5b. RECUPERACIÓN DE CONTRASEÑA
// ==========================================
let _recuperarIdentifier = null;

function abrirModalRecuperar() {
    _recuperarIdentifier = null;
    const modal = document.getElementById('modal-recuperar');
    if (!modal) return;
    modal.style.visibility = 'visible';
    // Paso 1 visible
    document.getElementById('recuperar-paso1').style.display = 'block';
    document.getElementById('recuperar-paso2').style.display = 'none';
    document.getElementById('recuperar-msg1').style.display = 'none';
    document.getElementById('recuperar-msg2').style.display = 'none';
    document.getElementById('recuperar-identificador').value = '';
    document.getElementById('recuperar-codigo').value = '';
    document.getElementById('recuperar-nueva-password').value = '';
    document.getElementById('recuperar-nueva-password2').value = '';
    setTimeout(() => document.getElementById('recuperar-identificador')?.focus(), 80);
}

function cerrarModalRecuperar() {
    const modal = document.getElementById('modal-recuperar');
    if (modal) modal.style.visibility = 'hidden';
}

function volverAPaso1Recuperar() {
    document.getElementById('recuperar-paso1').style.display = 'block';
    document.getElementById('recuperar-paso2').style.display = 'none';
}

async function solicitarCodigo() {
    const identifier = document.getElementById('recuperar-identificador').value.trim();
    const msg = document.getElementById('recuperar-msg1');
    const btn = document.getElementById('recuperar-btn-enviar');
    if (!identifier) { msg.style.display = 'block'; msg.textContent = 'Ingresá tu email o teléfono'; return; }
    msg.style.display = 'none';
    const texto = btn.textContent; btn.textContent = 'Enviando...'; btn.disabled = true;
    try {
        const res = await fetch(`${window.API_BASE}/auth/recuperar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailOrPhone: identifier })
        });
        const data = await res.json();
        if (data.success) {
            _recuperarIdentifier = identifier;
            // Si no hay WhatsApp configurado y viene un código de desarrollo, mostrarlo
            const info = document.getElementById('recuperar-paso2-info');
            if (data._debug_codigo) {
                info.textContent = `⚠️ WhatsApp no configurado en este entorno. Tu código es: ${data._debug_codigo}`;
            } else {
                info.textContent = data.mensaje || 'Código enviado por WhatsApp.';
            }
            document.getElementById('recuperar-paso1').style.display = 'none';
            document.getElementById('recuperar-paso2').style.display = 'block';
            document.getElementById('recuperar-msg2').style.display = 'none';
            setTimeout(() => document.getElementById('recuperar-codigo')?.focus(), 80);
        } else {
            msg.style.display = 'block';
            msg.textContent = data.message || 'No se pudo enviar el código';
        }
    } catch (e) {
        msg.style.display = 'block'; msg.textContent = 'Error de conexión';
    } finally {
        btn.textContent = texto; btn.disabled = false;
    }
}

async function confirmarCodigo() {
    const codigo = document.getElementById('recuperar-codigo').value.trim();
    const pass1 = document.getElementById('recuperar-nueva-password').value;
    const pass2 = document.getElementById('recuperar-nueva-password2').value;
    const msg = document.getElementById('recuperar-msg2');
    const btn = document.getElementById('recuperar-btn-confirmar');
    if (!codigo || codigo.length !== 6) { msg.style.display = 'block'; msg.textContent = 'El código tiene 6 dígitos'; return; }
    if (pass1.length < 6) { msg.style.display = 'block'; msg.textContent = 'La contraseña debe tener al menos 6 caracteres'; return; }
    if (pass1 !== pass2) { msg.style.display = 'block'; msg.textContent = 'Las contraseñas no coinciden'; return; }
    msg.style.display = 'none';
    const texto = btn.textContent; btn.textContent = 'Guardando...'; btn.disabled = true;
    try {
        const res = await fetch(`${window.API_BASE}/auth/recuperar/confirmar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailOrPhone: _recuperarIdentifier, codigo, nuevaPassword: pass1 })
        });
        const data = await res.json();
        if (data.success) {
            cerrarModalRecuperar();
            mostrarNotificacion(data.mensaje || '✅ Contraseña actualizada');
        } else {
            msg.style.display = 'block'; msg.textContent = data.message || 'No se pudo cambiar la contraseña';
        }
    } catch (e) {
        msg.style.display = 'block'; msg.textContent = 'Error de conexión';
    } finally {
        btn.textContent = texto; btn.disabled = false;
    }
}

// ==========================================
// 5c. CAMBIAR CONTRASEÑA (SESIÓN ACTIVA)
// ==========================================
function abrirModalCambiarContrasena() {
    const modal = document.getElementById('modal-cambiar-contrasena');
    if (!modal) return;
    modal.style.visibility = 'visible';
    document.getElementById('cc-password-actual').value = '';
    document.getElementById('cc-password-nueva').value = '';
    document.getElementById('cc-password-nueva2').value = '';
    document.getElementById('cc-msg').style.display = 'none';
    setTimeout(() => document.getElementById('cc-password-actual')?.focus(), 80);
}

function cerrarModalCambiarContrasena() {
    const modal = document.getElementById('modal-cambiar-contrasena');
    if (modal) modal.style.visibility = 'hidden';
}

async function confirmarCambioContrasena() {
    const actual = document.getElementById('cc-password-actual').value;
    const n1 = document.getElementById('cc-password-nueva').value;
    const n2 = document.getElementById('cc-password-nueva2').value;
    const msg = document.getElementById('cc-msg');
    const btn = event.target;
    if (!actual) { msg.style.display = 'block'; msg.textContent = 'Ingresá tu contraseña actual'; return; }
    if (n1.length < 6) { msg.style.display = 'block'; msg.textContent = 'La nueva contraseña debe tener al menos 6 caracteres'; return; }
    if (n1 !== n2) { msg.style.display = 'block'; msg.textContent = 'Las contraseñas no coinciden'; return; }
    msg.style.display = 'none';
    const texto = btn.textContent; btn.textContent = 'Guardando...'; btn.disabled = true;
    try {
        const res = await fetch(`${window.API_BASE}/auth/cambiar-contrasena`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passwordActual: actual, nuevaPassword: n1 })
        });
        const data = await res.json();
        if (data.success) {
            cerrarModalCambiarContrasena();
            mostrarNotificacion(data.mensaje || '✅ Contraseña actualizada');
        } else {
            msg.style.display = 'block'; msg.textContent = data.message || 'No se pudo cambiar';
        }
    } catch (e) {
        msg.style.display = 'block'; msg.textContent = 'Error de conexión';
    } finally {
        btn.textContent = texto; btn.disabled = false;
    }
}

// ==========================================
// 6. FUNCIONES DE UI
// ==========================================
function mostrarLogin() {
    const login = document.getElementById('login-screen'); 
    if (login) {
        login.style.display    = 'flex';
        login.style.visibility = 'visible';
        login.style.pointerEvents = 'auto';
    }
}

function ocultarLogin() {
    const login = document.getElementById('login-screen');
    const closeBtn = document.getElementById('login-close-btn');
    if (login) {
        login.style.display    = 'none';
        login.style.visibility = 'hidden';
        login.style.pointerEvents = 'none';
        login.style.zIndex    = '-1';
    }
    if (closeBtn) closeBtn.style.display = 'none';
}

function mostrarLoginVisitante() {
    const login = document.getElementById('login-screen');
    const closeBtn = document.getElementById('login-close-btn');
    if (login) {
        login.style.cssText = 'display:flex;position:fixed;top:0;left:0;width:100%;height:100%;z-index:15000;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);visibility:visible;pointer-events:auto;';
    }
    if (closeBtn) closeBtn.style.display = 'block';
}

function mostrarAppVisitante() {
    mostrarApp();
    document.querySelectorAll('.nav-links button').forEach(b => b.style.display = 'none');
    const navServ = document.querySelector('[onclick*="servicios"]');
    if (navServ) navServ.style.display = 'inline-block';
    const navLogin = document.getElementById('nav-login-btn');
    if (navLogin) navLogin.style.display = 'inline-block';
    showSection('servicios');
}

function mostrarApp() {
    const mainApp = document.getElementById('main-app');
    if (mainApp) {
        mainApp.style.display    = 'block';
        mainApp.style.visibility = 'visible';
        mainApp.style.pointerEvents = 'auto';
    }
    // Restaurar nav completo para usuario logueado
    document.querySelectorAll('.nav-links button').forEach(b => b.style.display = '');
    const navLogin = document.getElementById('nav-login-btn');
    if (navLogin) navLogin.style.display = 'none';
    const userStatus = document.querySelector('.user-status-card');
    if (userStatus) userStatus.style.display = '';
}

function ocultarApp() {
    const mainApp = document.getElementById('main-app');
    if (mainApp) mainApp.style.display = 'none';
}

// ==========================================
// 7. GESTIÓN DE SESIÓN
// ==========================================
function obtenerUsuarioActual() {
    const usuarioStr = localStorage.getItem('usuario');
    if (!usuarioStr) return null;
    try {
        return JSON.parse(usuarioStr);
    } catch (error) {
        localStorage.removeItem('usuario');
        return null;
    }
}

function obtenerToken() {
    return localStorage.getItem('token');
}

function cerrarSesion() {
    console.log('👋 Cerrando sesión...');
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('userRol');
    location.reload();
}

// ==========================================
// 8. CONFIGURAR INTERFAZ POR ROL
// ==========================================
function configurarInterfazPorRol(rol) {
    console.log('🎭 Configurando interfaz para rol:', rol);
    
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.prof-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.cliente-puede').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.caja-only').forEach(el => el.style.display = 'none');
    
    const usuario = obtenerUsuarioActual();
    if (usuario) {
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = usuario.nombre;
    }
    
    if (rol === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.prof-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.cliente-puede').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.caja-only').forEach(el => el.style.display = 'block');
    } else if (rol === 'profesional') {
        document.querySelectorAll('.prof-only').forEach(el => el.style.display = 'block');
    } else if (rol === 'cliente') {
        document.querySelectorAll('.cliente-puede').forEach(el => el.style.display = 'block');
    } else if (rol === 'recepcionista') {
        document.querySelectorAll('.caja-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.cliente-puede').forEach(el => el.style.display = 'block');
    }
    
    console.log('✅ Interfaz de', rol.toUpperCase(), 'activada');
}

// ==========================================
// 9. PERMISOS
// ==========================================
function tienePermiso(accion) {
    const usuario = obtenerUsuarioActual();
    if (!usuario) return false;
    
    const permisos = {
        'editar_servicios':    ['admin'],
        'ver_estadisticas':    ['admin'],
        'gestionar_horarios':  ['admin', 'profesional'],
        'agendar_turno':       ['admin', 'profesional', 'cliente', 'recepcionista'],
        'ver_catalogo':        ['admin', 'profesional', 'cliente', 'recepcionista']
    };
    
    return permisos[accion]?.includes(usuario.rol) || false;
}

// ==========================================
// 10. NOTIFICACIONES
// ==========================================
function mostrarNotificacion(mensaje, tipo = 'success') {
    const box = document.createElement('div');
    box.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        padding: 15px 25px; 
        background: ${tipo === 'success' ? '#4CAF50' : '#F44336'}; 
        color: white; 
        border-radius: 8px; 
        z-index: 10001; 
        font-weight: bold; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
        max-width: 350px;
    `;
    box.textContent = mensaje;
    document.body.appendChild(box);
    
    setTimeout(() => {
        box.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => box.remove(), 300);
    }, 3500);
}

// Animaciones
if (!document.getElementById('auth-animations')) {
    const style = document.createElement('style');
    style.id = 'auth-animations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to   { transform: translateX(400px); opacity: 0; }
        }

        /* ===== TABS DE AUTH ===== */
        .auth-tabs {
            display: flex;
            border-radius: 12px;
            overflow: hidden;
            border: 2px solid #C06C84;
            margin-bottom: 25px;
        }

        .auth-tab {
            flex: 1;
            padding: 12px;
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 0.95rem;
            font-weight: 600;
            color: #C06C84;
            transition: all 0.25s;
        }

        .auth-tab.active {
            background: #C06C84;
            color: white;
        }

        .auth-tab:hover:not(.active) {
            background: #f9e4ee;
        }

        /* ===== LINK CAMBIAR TAB ===== */
        .auth-switch {
            text-align: center;
            margin-top: 18px;
            font-size: 0.9rem;
            color: #666;
        }

        .auth-switch a {
            color: #C06C84;
            font-weight: 600;
            text-decoration: none;
        }

        .auth-switch a:hover {
            text-decoration: underline;
        }
    `;
    document.head.appendChild(style);
}
