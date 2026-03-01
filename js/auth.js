// auth.js - SISTEMA DE AUTENTICACIÓN CON REGISTRO DE CLIENTES

// ==========================================
// 1. VERIFICAR SESIÓN AL CARGAR LA PÁGINA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const usuario = obtenerUsuarioActual();
    
    if (usuario) {
        console.log('✅ Usuario logueado:', usuario.nombre, '- Rol:', usuario.rol);
        ocultarLogin();
        mostrarApp();
        configurarInterfazPorRol(usuario.rol);
    } else {
        console.log('⚠️ No hay sesión activa');
        mostrarLogin();
        ocultarApp();
    }
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
        const response = await fetch('http://localhost:3000/api/auth/registro', {
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
        const response = await fetch('http://localhost:3000/api/auth/login', {
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
    if (login) {
        login.style.display    = 'none';
        login.style.visibility = 'hidden';
        login.style.pointerEvents = 'none';
        login.style.zIndex    = '-1';
    }
}

function mostrarApp() {
    const mainApp = document.getElementById('main-app');
    if (mainApp) {
        mainApp.style.display    = 'block';
        mainApp.style.visibility = 'visible';
        mainApp.style.pointerEvents = 'auto';
    }
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

function cerrarSesion() {
    console.log('👋 Cerrando sesión...');
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
    
    const usuario = obtenerUsuarioActual();
    if (usuario) {
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = usuario.nombre;
    }
    
    if (rol === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.prof-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.cliente-puede').forEach(el => el.style.display = 'block');
    } else if (rol === 'profesional') {
        document.querySelectorAll('.prof-only').forEach(el => el.style.display = 'block');
    } else if (rol === 'cliente') {
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
        'agendar_turno':       ['admin', 'profesional', 'cliente'],
        'ver_catalogo':        ['admin', 'profesional', 'cliente']
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
