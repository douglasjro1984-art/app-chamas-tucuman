// =====================================================
// GESTIÓN DE HORARIOS – ADMIN PUEDE ELEGIR PROFESIONAL
// =====================================================
// VERSIÓN CORREGIDA - Soluciona problemas de guardado y recarga

// ID del profesional actualmente seleccionado en el panel de horarios
let profesionalHorarioSeleccionado = null;

// =====================================================
// FUNCIÓN PRINCIPAL – detecta rol y renderiza el panel
// =====================================================
async function cargarGestionHorarios() {
    const container = document.getElementById('horarios-lista');
    const usuario   = obtenerUsuarioActual();
    if (!container || !usuario) return;

    if (usuario.rol === 'admin') {
        await cargarGestionHorariosAdmin(container);
    } else {
        await cargarGestionHorariosProfesional(container, usuario.id, usuario.nombre);
    }
}

// =====================================================
// PANEL DE ADMIN – selector de profesional primero
// =====================================================
async function cargarGestionHorariosAdmin(container) {
    container.innerHTML = `
        <div class="info-card" style="background:#fff3cd;border-left:4px solid #ffc107;margin-bottom:20px;">
            <p><strong>⚙️ Panel de Administración:</strong>
            Seleccioná un profesional para ver y editar sus horarios disponibles.</p>
        </div>

        <div style="background:white;padding:20px;border-radius:12px;margin-bottom:25px;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
            <label style="font-weight:600;color:#555;display:block;margin-bottom:8px;">
                👨‍💼 Seleccionar Profesional:
            </label>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <select id="select-profesional-horario"
                        style="flex:1;min-width:220px;padding:10px 14px;border:2px solid #C06C84;border-radius:8px;font-size:1rem;"
                        onchange="onCambiarProfesionalHorario()">
                    <option value="">— Elegir profesional —</option>
                </select>
                <button onclick="onCambiarProfesionalHorario()"
                        class="btn-guardar"
                        style="padding:10px 20px;">
                    🔍 Ver Horarios
                </button>
            </div>
        </div>

        <div id="horarios-profesional-panel"></div>
    `;

    // Llenar el select con profesionales
    try {
        const res = await fetch('https://chamas-backend.onrender.com/api/usuarios/profesionales');
        const profesionales = await res.json();

        const select = document.getElementById('select-profesional-horario');
        if (!select) return;

        if (profesionales.length === 0) {
            select.innerHTML = '<option value="">No hay profesionales registrados</option>';
            return;
        }

        profesionales.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nombre;
            select.appendChild(opt);
        });

        // Si ya había uno seleccionado antes, mantenerlo
        if (profesionalHorarioSeleccionado) {
            select.value = profesionalHorarioSeleccionado;
            await renderHorariosPanel(profesionalHorarioSeleccionado,
                select.options[select.selectedIndex]?.text || '');
        }

    } catch (error) {
        console.error('❌ Error cargando profesionales:', error);
        mostrarNotificacion('❌ Error al cargar profesionales', 'error');
    }
}

// =====================================================
// Se llama cuando el admin cambia el select
// =====================================================
async function onCambiarProfesionalHorario() {
    const select = document.getElementById('select-profesional-horario');
    if (!select) return;

    const id     = select.value;
    const nombre = select.options[select.selectedIndex]?.text || '';

    if (!id) {
        document.getElementById('horarios-profesional-panel').innerHTML =
            '<p style="color:#999;text-align:center;padding:20px;">Seleccioná un profesional para ver sus horarios.</p>';
        return;
    }

    profesionalHorarioSeleccionado = id;
    await renderHorariosPanel(id, nombre);
}

// =====================================================
// PANEL DE PROFESIONAL (admin editando o propio)
// =====================================================
async function cargarGestionHorariosProfesional(container, profesionalId, nombre) {
    container.innerHTML = `
        <div class="info-card" style="background:#e8f5e9;border-left:4px solid #4CAF50;margin-bottom:20px;">
            <p><strong>📌</strong> Seleccioná los horarios en que estás disponible. Los clientes solo podrán agendar en estos horarios.</p>
        </div>
        <div id="horarios-profesional-panel"></div>
    `;
    await renderHorariosPanel(profesionalId, nombre);
}

// =====================================================
// RENDERIZAR LA GRILLA DE HORARIOS para un profesional
// 🔥 VERSIÓN CORREGIDA - Recupera de disponibilidad_fechas correctamente
// =====================================================
async function renderHorariosPanel(profesionalId, nombreProfesional) {
    const panel = document.getElementById('horarios-profesional-panel');
    if (!panel) return;

    panel.innerHTML = `<p style="text-align:center;color:#C06C84;padding:20px;">⏳ Cargando horarios...</p>`;

    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    // 🔥 CORRECCIÓN: Mapeo correcto de días (disponibilidad_fechas usa fecha, no día de semana)
    // Vamos a usar los últimos 30 días como referencia
    const hoy = new Date();
    const hace30 = new Date();
    hace30.setDate(hoy.getDate() - 30);
    
    const desde = hace30.toISOString().split('T')[0];
    const hasta = new Date();
    hasta.setDate(hoy.getDate() + 180); // 6 meses al futuro
    const hastaStr = hasta.toISOString().split('T')[0];

    try {
        // 🔥 Cargar disponibilidad_completa (que devuelve fecha y hora_inicio)
        const res = await fetch(`https://chamas-backend.onrender.com/api/disponibilidad_completa/${profesionalId}`);
        const disponibilidadDB = await res.json();

        // 🔥 NUEVA LÓGICA: Mapear las fechas disponibles a días de semana y horas
        const horariosGenerados = {};
        
        // Crear mapa de día_semana → horas
        disponibilidadDB.forEach(slot => {
            // slot tiene: { fecha, hora_inicio }
            const fecha = new Date(slot.fecha + 'T00:00:00');
            const diaSemana = fecha.getDay(); // 0=Dom, 1=Lun, 2=Mar...
            
            // Convertir número a nombre de día
            const nombreDia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][diaSemana];
            
            if (!horariosGenerados[nombreDia]) {
                horariosGenerados[nombreDia] = new Set();
            }
            
            // Extraer la hora (HH:MM de HH:MM:SS)
            const hora = slot.hora_inicio.substring(0, 5);
            horariosGenerados[nombreDia].add(hora);
        });

        panel.innerHTML = `
            <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;
                        border-left:4px solid #C06C84;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
                <h3 style="color:#C06C84;margin:0 0 4px 0;">
                    👨‍💼 ${nombreProfesional || 'Profesional'}
                </h3>
                <p style="color:#888;font-size:0.9rem;margin:0;">
                    Hacé click en los horarios para activarlos o desactivarlos, luego guardá.
                </p>
            </div>

            <div class="horarios-grid">
                ${dias.map(dia => `
                    <div class="dia-config">
                        <label><strong>${dia}</strong></label>
                        <div class="selector-horas">
                            ${generarBotonesPersistentes(dia, horariosGenerados[dia] || new Set())}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div style="display:flex;gap:12px;margin-top:25px;">
                <button onclick="seleccionarTodosHorarios()" class="btn-reset" style="flex:1;">
                    ✅ Seleccionar todos
                </button>
                <button onclick="deseleccionarTodosHorarios()" class="btn-reset" style="flex:1;">
                    ❌ Limpiar todo
                </button>
                <button onclick="enviarDisponibilidad(${profesionalId}, '${nombreProfesional}')" class="btn-guardar" style="flex:2;">
                    💾 GUARDAR HORARIOS
                </button>
            </div>
        `;

    } catch (error) {
        panel.innerHTML = '<p style="color:red;text-align:center;">❌ Error al cargar horarios.</p>';
        console.error(error);
    }
}

// =====================================================
// GENERAR BOTONES DE HORA (con estado persistido)
// =====================================================
function generarBotonesPersistentes(dia, horasDelDia) {
    const horas = ["08:00","09:00","10:00","11:00","12:00",
                   "14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
    
    return horas.map(hora => {
        // horasDelDia es un Set de strings como "08:00"
        const activo = horasDelDia && horasDelDia.has(hora);
        
        return `<button
            class="btn-hora ${activo ? 'seleccionado' : ''}"
            data-dia="${dia}"
            data-hora="${hora}"
            onclick="this.classList.toggle('seleccionado'); return false;">
            ${hora}
        </button>`;
    }).join('');
}

// =====================================================
// HELPERS – seleccionar / deseleccionar todos
// =====================================================
function seleccionarTodosHorarios() {
    document.querySelectorAll('.btn-hora').forEach(b => b.classList.add('seleccionado'));
}

function deseleccionarTodosHorarios() {
    document.querySelectorAll('.btn-hora').forEach(b => b.classList.remove('seleccionado'));
}

// =====================================================
// 🔥 GUARDAR DISPONIBILIDAD - VERSIÓN CORREGIDA
// Ahora envía desde y hasta correctamente
// =====================================================
async function enviarDisponibilidad(profesionalId, nombreProfesional) {
    const usuario = obtenerUsuarioActual();
    if (!usuario) return;

    // Si no se pasa profesionalId, usar el del usuario logueado
    const idFinal = profesionalId || usuario.id;
    const nombreFinal = nombreProfesional || usuario.nombre;

    // 🔥 CORRECCIÓN: Generar rango de fechas (6 meses)
    const hoy = new Date();
    const desde = hoy.toISOString().split('T')[0]; // Hoy
    
    const hasta = new Date();
    hasta.setDate(hoy.getDate() + 180); // 6 meses adelante
    const hastaStr = hasta.toISOString().split('T')[0];

    // Recopilar horarios seleccionados
    const horarios = [];
    document.querySelectorAll('.btn-hora.seleccionado').forEach(b => {
        horarios.push({ 
            dia: b.dataset.dia, 
            inicio: b.dataset.hora 
        });
    });

    const btnGuardar = document.querySelector(`[onclick*="enviarDisponibilidad"]`);
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '⏳ Guardando...';
    }

    try {
        // 🔥 CORRECCIÓN: Enviar desde y hasta
        const res = await fetch('https://chamas-backend.onrender.com/api/disponibilidad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                profesional_id: idFinal, 
                desde: desde,           // 🔥 NUEVO
                hasta: hastaStr,        // 🔥 NUEVO
                horarios 
            })
        });
        
        const data = await res.json();

        if (data.success) {
            mostrarNotificacion(`✅ ${data.count} horarios guardados correctamente`);
            
            // 🔥 CORRECCIÓN: Recargar los horarios después de guardar
            // Esperar 300ms para que la DB se actualice
            await new Promise(resolve => setTimeout(resolve, 300));
            await renderHorariosPanel(idFinal, nombreFinal);
            
        } else {
            mostrarNotificacion('❌ ' + (data.message || 'Error al guardar'), 'error');
        }
    } catch (error) {
        console.error('❌ Error:', error);
        mostrarNotificacion('❌ Error de conexión: ' + error.message, 'error');
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '💾 GUARDAR HORARIOS';
        }
    }
}
