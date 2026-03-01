// roles-funciones.js - FUNCIONES AUXILIARES POR ROL

// Este archivo contiene funciones auxiliares que pueden ser 
// usadas por diferentes roles. La mayoría de la lógica principal
// ya está en app.js y auth.js

// ==========================================
// UTILIDADES DE FECHA
// ==========================================
function formatearFecha(fechaStr) {
    const opciones = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return new Date(fechaStr).toLocaleDateString('es-ES', opciones);
}

function obtenerFechaHoy() {
    const hoy = new Date();
    return hoy.toISOString().split('T')[0]; // formato YYYY-MM-DD
}

// ==========================================
// VALIDACIONES
// ==========================================
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function validarTelefono(telefono) {
    // Acepta formatos: +54 9 11 1234-5678, 1234567890, etc.
    const regex = /^[\d\s\-\+\(\)]+$/;
    return regex.test(telefono) && telefono.replace(/\D/g, '').length >= 10;
}

// ==========================================
// FUNCIONES DE EXPORTACIÓN (ADMIN)
// ==========================================
function exportarDatos() {
    if (!tienePermiso('ver_estadisticas')) {
        mostrarNotificacion('❌ No tienes permiso para exportar datos', 'error');
        return;
    }
    
    mostrarNotificacion('📥 Exportando datos... (función en desarrollo)');
}

function limpiarDatos() {
    if (!tienePermiso('ver_estadisticas')) {
        mostrarNotificacion('❌ No tienes permiso para esta acción', 'error');
        return;
    }
    
    const confirmar = confirm('⚠️ ¿Estás seguro de que deseas limpiar TODOS los datos? Esta acción no se puede deshacer.');
    
    if (confirmar) {
        mostrarNotificacion('🗑️ Limpieza de datos... (función en desarrollo)');
    }
}

// ==========================================
// CHATBOT (si decides implementarlo)
// ==========================================
function toggleChat() {
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) {
        chatWindow.classList.toggle('hidden');
    }
}