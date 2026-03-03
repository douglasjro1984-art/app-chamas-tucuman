/// api.js - Conexión del frontend con el backend MySQL

const API_URL = window.API_BASE;

// ==========================================
// FUNCIONES DE SERVICIOS
// ==========================================
async function obtenerServiciosAPI() {
    try {
        const response = await fetch(`${API_URL}/servicios`);
        const servicios = await response.json();
        return servicios;
    } catch (error) {
        console.error('Error al obtener servicios:', error);
        return [];
    }
}

async function actualizarServicioCompletoAPI(servicioId, servicioData) {
    try {
        const response = await fetch(`${API_URL}/servicios/${servicioId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(servicioData)
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error al actualizar servicio:', error);
        return { success: false };
    }
}

// ==========================================
// FUNCIÓN DE PRUEBA
// ==========================================
async function probarConexionAPI() {
    try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        console.log('✅ Conexión con backend:', data);
        return data.status === 'ok'; 
    } catch (error) {
        console.error('❌ Error de conexión con backend:', error);
        return false;
    }
}
// ==========================================
// FUNCIONES DE TURNOS (NUEVAS)
// ==========================================
async function obtenerTurnosOcupadosAPI(profesionalId, fecha) {
    try {
        // Consultamos al backend por profesional y fecha específica
        const response = await fetch(`${API_URL}/turnos?profesionalId=${profesionalId}&fecha=${fecha}`);
        const data = await response.json();
        // Retornamos solo el array de horas ocupadas para facilitar el filtro
        return Array.isArray(data) ? data.map(t => t.hora) : [];
    } catch (error) {
        console.error('Error al obtener turnos ocupados:', error);
        return [];
    }
}

async function guardarTurnoAPI(turnoData) {
    try {
        const response = await fetch(`${API_URL}/turnos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(turnoData)
        });
        return await response.json();
    } catch (error) {
        console.error('Error al guardar turno:', error);
        return { success: false };
    }
}