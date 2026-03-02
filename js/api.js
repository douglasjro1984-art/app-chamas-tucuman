/// api.js - Conexión del frontend con el backend MySQL

const API_URL = 'https://chamas-backend.onrender.com/api';

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