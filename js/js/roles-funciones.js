// roles-funciones.js - FUNCIONES AUXILIARES POR ROL
// Sistema RBAC actualizado con roles: super_admin, admin, profesional, especialista, recepcionista, cliente
// PERMISOS_ROL y NOMBRES_PERMISOS se definen en app.js

// ==========================================
// UTILIDADES DE FECHA
// ==========================================
function formatearFecha(fechaStr) {
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(fechaStr).toLocaleDateString('es-ES', opciones);
}

function obtenerFechaHoy() {
    const hoy = new Date();
    return hoy.toISOString().split('T')[0];
}

// ==========================================
// VALIDACIONES
// ==========================================
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function validarTelefono(telefono) {
    const regex = /^[\d\s\-\+\(\)]+$/;
    return regex.test(telefono) && telefono.replace(/\D/g, '').length >= 8;
}

// ==========================================
// FUNCIONES DE PERMISO RBAC
// ==========================================
function tienePermiso(permiso) {
    const usuario = obtenerUsuarioActual();
    if (!usuario) return false;
    return (PERMISOS_ROL[usuario.rol] || []).includes(permiso);
}

function esSuperAdmin() {
    const usuario = obtenerUsuarioActual();
    return usuario?.rol === 'super_admin';
}

function esAdmin() {
    const usuario = obtenerUsuarioActual();
    return usuario?.rol === 'admin' || usuario?.rol === 'super_admin';
}

function esEspecialista() {
    const usuario = obtenerUsuarioActual();
    return usuario?.rol === 'especialista';
}

function esProfesional() {
    const usuario = obtenerUsuarioActual();
    return usuario?.rol === 'profesional' || usuario?.rol === 'especialista';
}

function esRecepcionista() {
    const usuario = obtenerUsuarioActual();
    return usuario?.rol === 'recepcionista';
}

function getPermisosUsuario() {
    const usuario = obtenerUsuarioActual();
    return PERMISOS_ROL[usuario?.rol] || [];
}

// ==========================================
// FUNCIONES DE EXPORTACIÓN (ADMIN)
// ==========================================
function exportarDatos() {
    if (!tienePermiso('gestion_total') && !tienePermiso('admin_contable')) {
        mostrarNotificacion('No tienes permiso para exportar datos', 'error');
        return;
    }
    mostrarNotificacion('Exportando datos... (función en desarrollo)');
}

function limpiarDatos() {
    if (!esSuperAdmin()) {
        mostrarNotificacion('Solo el Super Admin puede limpiar datos', 'error');
        return;
    }
    const confirmar = confirm('Estás seguro de limpiar TODOS los datos? Esta acción no se puede deshacer.');
    if (confirmar) mostrarNotificacion('Limpieza de datos... (función en desarrollo)');
}

// ==========================================
// ASIGNACIÓN DE ROLLES
// ==========================================
function puedeAsignarRoles() { return esSuperAdmin(); }

function obtenerRolesDisponibles() {
    return [
        { valor: 'super_admin', label: 'Super Admin (Laura)', permisos: 'Gestión total' },
        { valor: 'admin', label: 'Administradora (Anahí)', permisos: 'Admin completo' },
        { valor: 'profesional', label: 'Profesional (Belén)', permisos: 'Turnos y horarios propios' },
        { valor: 'especialista', label: 'Especialista (Carmen)', permisos: 'Turnos + masajes + cierre semanal' },
        { valor: 'recepcionista', label: 'Recepcionista', permisos: 'Caja, turnos, sobreturnos' },
        { valor: 'cliente', label: 'Cliente', permisos: 'Agendar turnos' }
    ];
}

// ==========================================
// CHATBOT
// ==========================================
function toggleChat() {
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) chatWindow.classList.toggle('hidden');
}
