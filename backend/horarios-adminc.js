// =====================================================
// GESTIÓN DE HORARIOS – ADMIN PUEDE ELEGIR PROFESIONAL
// =====================================================

// Usamos la variable global
const URL_BASE_HORARIOS = window.API_BASE; 

let profesionalHorarioSeleccionado = null;

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

async function cargarGestionHorariosAdmin(container) {
    container.innerHTML = `
        <div class="info-card" style="background:#fff3cd;border-left:4px solid #ffc107;margin-bottom:20px;">
            <p><strong>⚙️ Panel de Administración:</strong> Seleccioná un profesional para editar sus horarios.</p>
        </div>
        <div style="background:white;padding:20px;border-radius:12px;margin-bottom:25px;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
            <label style="font-weight:600;color:#555;display:block;margin-bottom:8px;">👨‍💼 Seleccionar Profesional:</label>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <select id="select-profesional-horario" style="flex:1;min-width:220px;padding:10px 14px;border:2px solid #C06C84;border-radius:8px;" onchange="onCambiarProfesionalHorario()">
                    <option value="">— Cargando profesionales... —</option>
                </select>
            </div>
        </div>
        <div id="horarios-profesional-panel"></div>
    `;

    try {
        // ✅ CORRECCIÓN 1: Ruta correcta para obtener profesionales (GET)
        const res = await fetch(`${URL_BASE_HORARIOS}/auth/profesionales`);
        const profesionales = await res.json();

        const select = document.getElementById('select-profesional-horario');
        select.innerHTML = '<option value="">— Elegir profesional —</option>';

        profesionales.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nombre;
            select.appendChild(opt);
        });

        if (profesionalHorarioSeleccionado) {
            select.value = profesionalHorarioSeleccionado;
            onCambiarProfesionalHorario();
        }
    } catch (error) {
        console.error('❌ Error:', error);
        mostrarNotificacion('❌ Error al cargar la lista de profesionales', 'error');
    }
}

async function onCambiarProfesionalHorario() {
    const select = document.getElementById('select-profesional-horario');
    const id = select.value;
    const nombre = select.options[select.selectedIndex]?.text || '';
    if (!id) return;
    profesionalHorarioSeleccionado = id;
    await renderHorariosPanel(id, nombre);
}

async function cargarGestionHorariosProfesional(container, profesionalId, nombre) {
    container.innerHTML = `<div id="horarios-profesional-panel"></div>`;
    await renderHorariosPanel(profesionalId, nombre);
}

async function renderHorariosPanel(profesionalId, nombreProfesional) {
    const panel = document.getElementById('horarios-profesional-panel');
    if (!panel) return;
    panel.innerHTML = `<p style="text-align:center;color:#C06C84;padding:20px;">⏳ Cargando horarios...</p>`;

    try {
        // ✅ CORRECCIÓN 2: Usar URL dinámica
        const res = await fetch(`${URL_BASE_HORARIOS}/disponibilidad_completa/${profesionalId}`);
        const disponibilidadDB = await res.json();

        const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const horariosGenerados = {};
        
        disponibilidadDB.forEach(slot => {
            const fecha = new Date(slot.fecha + 'T00:00:00');
            const nombreDia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fecha.getDay()];
            if (!horariosGenerados[nombreDia]) horariosGenerados[nombreDia] = new Set();
            horariosGenerados[nombreDia].add(slot.hora_inicio.substring(0, 5));
        });

        panel.innerHTML = `
            <div style="background:white;padding:20px;border-radius:12px;border-left:4px solid #C06C84;">
                <h3 style="color:#C06C84;margin:0;">👨‍💼 ${nombreProfesional}</h3>
            </div>
            <div class="horarios-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top:20px;">
                ${dias.map(dia => `
                    <div class="dia-config">
                        <label><strong>${dia}</strong></label>
                        <div class="selector-horas">${generarBotonesPersistentes(dia, horariosGenerados[dia] || new Set())}</div>
                    </div>
                `).join('')}
            </div>
            <div style="display:flex;gap:12px;margin-top:25px;">
                <button onclick="enviarDisponibilidad(${profesionalId}, '${nombreProfesional}')" class="btn-guardar" style="flex:1; padding:15px;">💾 GUARDAR HORARIOS</button>
            </div>
        `;
    } catch (error) {
        panel.innerHTML = '<p style="color:red;">❌ Error al cargar horarios.</p>';
    }
}

function generarBotonesPersistentes(dia, horasDelDia) {
    const horas = ["08:00","09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
    return horas.map(hora => {
        const activo = horasDelDia.has(hora);
        return `<button class="btn-hora ${activo ? 'seleccionado' : ''}" data-dia="${dia}" data-hora="${hora}" onclick="this.classList.toggle('seleccionado'); return false;">${hora}</button>`;
    }).join('');
}

async function enviarDisponibilidad(profesionalId, nombreProfesional) {
    const horarios = [];
    document.querySelectorAll('.btn-hora.seleccionado').forEach(b => {
        horarios.push({ dia: b.dataset.dia, inicio: b.dataset.hora });
    });

    try {
        // ✅ CORRECCIÓN 3: Usar URL dinámica y fechas automáticas
        const hoy = new Date();
        const desde = hoy.toISOString().split('T')[0];
        const hasta = new Date();
        hasta.setDate(hoy.getDate() + 180);

        const res = await fetch(`${URL_BASE_HORARIOS}/disponibilidad`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                profesional_id: profesionalId, 
                desde, 
                hasta: hasta.toISOString().split('T')[0], 
                horarios 
            })
        });
        
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion(`✅ Horarios guardados`);
            await renderHorariosPanel(profesionalId, nombreProfesional);
        }
    } catch (error) {
        mostrarNotificacion('❌ Error de conexión', 'error');
    }
}