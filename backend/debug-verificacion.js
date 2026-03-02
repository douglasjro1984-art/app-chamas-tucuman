// =====================================================
// SCRIPT DE VERIFICACIÓN - DEBUGGING
// =====================================================
// Pegar este código en la consola del navegador (F12)
// para verificar el estado del sistema

console.log('🔍 INICIANDO VERIFICACIÓN DEL SISTEMA...\n');

// 1. Verificar usuario logueado
const usuario = obtenerUsuarioActual();
if (usuario) {
    console.log('✅ Usuario logueado:');
    console.log('   - Nombre:', usuario.nombre);
    console.log('   - Rol:', usuario.rol);
    console.log('   - ID:', usuario.id);
} else {
    console.log('❌ No hay usuario logueado');
}

// 2. Verificar conexión con backend
async function verificarBackend() {
    try {
        const res = await fetch(`${window.API_BASE}/health`);
        const data = await res.json();
        if (data.status === 'ok') {
            console.log('\n✅ Backend conectado correctamente');
            console.log('   - Status:', data.status);
            console.log('   - Timestamp:', data.timestamp);
        }
    } catch (error) {
        console.log('\n❌ Error conectando con backend:');
        console.log('   ', error.message);
    }
}

// 3. Verificar disponibilidad de horarios (si hay usuario profesional/admin)
async function verificarHorariosAPI() {
    if (!usuario || usuario.rol === 'cliente') return console.log('\n⏭️ Saltando horarios');
    try {
        const id = usuario.rol === 'profesional' ? usuario.id : 1;
        const res = await fetch(`${window.API_BASE}/disponibilidad_completa/${id}`); // <--- CORREGIDO
        const horarios = await res.json();
        console.log('\n📅 Horarios en DB:', horarios);
    } catch (e) { console.log('\n❌ Error horarios:', e.message); }
}


// 4. Verificar servicios
async function verificarServicios() {
    try {
        const res = await fetch(`${window.API_BASE}/servicios`);
        const servicios = await res.json();
        console.log('\n💅 Servicios:', servicios);
    } catch (e) { console.log('\n❌ Error servicios:', e.message); }
}

// 5. Verificar elementos del DOM
function verificarDOM() {
    console.log('\n🎨 Verificación de elementos DOM:');
    
    const elementos = {
        'horarios-lista': 'Panel de horarios',
        'todos-turnos-lista': 'Lista de turnos (admin)',
        'lista-precios-editar': 'Editor de precios',
        'select-profesional-horario': 'Selector de profesional',
        'horarios-profesional-panel': 'Panel de horarios del profesional'
    };
    
    Object.keys(elementos).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            console.log(`   ✅ ${elementos[id]} encontrado`);
        } else {
            console.log(`   ⚠️ ${elementos[id]} no encontrado (puede ser normal si no estás en esa sección)`);
        }
    });
}

// 6. Verificar funciones cargadas
function verificarFunciones() {
    console.log('\n⚙️ Funciones JavaScript disponibles:');
    
    const funciones = [
        'cargarGestionHorarios',
        'enviarDisponibilidad',
        'renderHorariosPanel',
        'cargarEditorPrecios',
        'guardarCambiosServicioCompleto',
        'cargarTodosLosTurnos'
    ];
    
    funciones.forEach(fn => {
        if (typeof window[fn] === 'function') {
            console.log(`   ✅ ${fn}() disponible`);
        } else {
            console.log(`   ❌ ${fn}() NO encontrada`);
        }
    });
}

// 7. Verificar CSS aplicado
function verificarCSS() {
    console.log('\n🎨 Verificación de estilos CSS:');
    
    const testElements = document.querySelectorAll('.editor-servicio-card');
    if (testElements.length > 0) {
        const computed = getComputedStyle(testElements[0]);
        console.log('   Grid template columns:', computed.gridTemplateColumns);
        console.log('   Gap:', computed.gap);
        console.log('   Background:', computed.background);
    } else {
        console.log('   ⚠️ No se encontraron elementos .editor-servicio-card (normal si no estás en "Editar Precios")');
    }
    
    const btnHoras = document.querySelectorAll('.btn-hora');
    if (btnHoras.length > 0) {
        console.log(`   ✅ ${btnHoras.length} botones de hora encontrados`);
        const seleccionados = document.querySelectorAll('.btn-hora.seleccionado');
        console.log(`   📌 ${seleccionados.length} horarios seleccionados actualmente`);
    }
}

// EJECUTAR TODAS LAS VERIFICACIONES
(async function ejecutarVerificaciones() {
    await verificarBackend();
    await verificarHorariosAPI();
    await verificarServicios();
    verificarDOM();
    verificarFunciones();
    verificarCSS();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ VERIFICACIÓN COMPLETA');
    console.log('='.repeat(60));
    console.log('\n💡 TIPS:');
    console.log('   - Si hay errores rojos, revisa la consola');
    console.log('   - Si faltan funciones, verifica que todos los JS están cargados');
    console.log('   - Si el backend no responde, ejecuta: node server.js');
})();

// =====================================================
// FUNCIONES ADICIONALES DE DEBUGGING
// =====================================================

// Forzar recarga de horarios (para admin)
window.debug_recargarHorarios = async function(profesionalId) {
    console.log('🔄 Recargando horarios del profesional ID:', profesionalId);
    await renderHorariosPanel(profesionalId, 'Test');
    console.log('✅ Recarga completada');
};

// Ver horarios seleccionados actualmente
window.debug_verHorariosSeleccionados = function() {
    const seleccionados = [];
    document.querySelectorAll('.btn-hora.seleccionado').forEach(btn => {
        seleccionados.push({
            dia: btn.dataset.dia,
            hora: btn.dataset.hora
        });
    });
    console.log('📌 Horarios seleccionados:', seleccionados);
    return seleccionados;
};

// Simular guardado (sin enviar al backend)
window.debug_simularGuardado = function() {
    const horarios = window.debug_verHorariosSeleccionados();
    console.log('💾 Simulando guardado de', horarios.length, 'horarios');
    console.log(JSON.stringify({ horarios }, null, 2));
};

console.log('\n🔧 Funciones de debugging disponibles:');
console.log('   - debug_recargarHorarios(profesionalId)');
console.log('   - debug_verHorariosSeleccionados()');
console.log('   - debug_simularGuardado()');
