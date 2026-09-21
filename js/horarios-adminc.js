// =====================================================
// GESTIÓN DE HORARIOS – ADMIN Y ESPECIALISTAS
// RBAC: Permisos granulares por rol
// =====================================================

const URL_BASE_HORARIOS = window.API_BASE;
let profesionalHorarioSeleccionado = null;

async function cargarGestionHorarios() {
    const container = document.getElementById('horarios-lista');
    const usuario = obtenerUsuarioActual();
    if (!container || !usuario) return;

    if (usuario.rol === 'super_admin' || usuario.rol === 'admin') {
        await cargarGestionHorariosAdmin(container);
    } else if (usuario.rol === 'especialista') {
        await cargarGestionHorariosEspecialista(container, usuario.id, usuario.nombre);
    } else if (usuario.rol === 'profesional') {
        await cargarGestionHorariosProfesional(container, usuario.id, usuario.nombre);
    } else {
        container.innerHTML = '<p style="color:red;text-align:center;padding:20px;">No tenés permiso para gestionar horarios</p>';
    }
}

async function cargarGestionHorariosAdmin(container) {
    container.innerHTML = `
        <div class="info-card" style="background:#fff3cd;border-left:4px solid #ffc107;margin-bottom:20px;">
            <p><strong>⚙️ Panel de Administración:</strong> Elegí un profesional para editar sus horarios.</p>
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
        const res = await fetch(URL_BASE_HORARIOS + '/usuarios/profesionales', {
            headers: { 'Authorization': 'Bearer ' + obtenerToken() }
        });
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
        mostrarNotificacion('Error al cargar profesionales', 'error');
    }
}

async function cargarGestionHorariosEspecialista(container, profesionalId, nombre) {
    container.innerHTML = `
        <div class="info-card" style="background:#e8f5e9;border-left:4px solid #4CAF50;margin-bottom:20px;">
            <p><strong>⚙️ Tu Panel de Horarios:</strong> Configurá tus horarios de atención.</p>
        </div>
        <div id="horarios-profesional-panel"></div>
    `;
    await renderHorariosPanel(profesionalId, nombre);
}

async function onCambiarProfesionalHorario() {
    const select = document.getElementById('select-profesional-horario');
    if (!select || !select.value) return;
    profesionalHorarioSeleccionado = select.value;
    const nombre = select.options[select.selectedIndex]?.text || '';
    await renderHorariosPanel(profesionalHorarioSeleccionado, nombre);
}

async function cargarGestionHorariosProfesional(container, profesionalId, nombre) {
    container.innerHTML = `<div id="horarios-profesional-panel"></div>`;
    await renderHorariosPanel(profesionalId, nombre);
}

async function renderHorariosPanel(profesionalId, nombreProfesional) {
    const panel = document.getElementById('horarios-profesional-panel');
    if (!panel) return;
    panel.innerHTML = '<p style="text-align:center;color:#C06C84;padding:20px;">⏳ Cargando horarios...</p>';
    try {
        const res = await fetch(URL_BASE_HORARIOS + '/disponibilidad_completa/' + profesionalId, {
            headers: { 'Authorization': 'Bearer ' + obtenerToken() }
        });
        const disponibilidadDB = await res.json();

        const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const horariosGenerados = {};
        disponibilidadDB.forEach(slot => {
            const fecha = new Date(slot.fecha + 'T00:00:00');
            const nombreDia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fecha.getDay()];
            if (!horariosGenerados[nombreDia]) horariosGenerados[nombreDia] = new Set();
            horariosGenerados[nombreDia].add(slot.hora_inicio.substring(0, 5));
        });

        // Verificar si es especialista (puede configurar horarios de masajes)
        const usuario = obtenerUsuarioActual();
        const esEspecialista = usuario?.rol === 'especialista';

        panel.innerHTML = `
            <div style="background:white;padding:20px;border-radius:12px;border-left:4px solid #C06C84;">
                <h3 style="color:#C06C84;margin:0;">👨‍💼 ${nombreProfesional}</h3>
                ${esEspecialista ? '<p style="color:#4CAF50;font-size:0.85rem;margin:5px 0 0;">🔒 Solo podés gestionar horarios para servicios de masajes</p>' : ''}
            </div>
            <div class="horarios-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:15px;margin-top:20px;">
                ${dias.map(dia => `
                    <div class="dia-config">
                        <label><strong>${dia}</strong></label>
                        <div class="selector-horas">${generarBotonesPersistentes(dia, horariosGenerados[dia] || new Set())}</div>
                    </div>
                `).join('')}
            </div>
            <div style="display:flex;gap:12px;margin-top:25px;">
                <button onclick="enviarDisponibilidad(${profesionalId}, '${nombreProfesional}')" class="btn-guardar" style="flex:1;padding:15px;">💾 GUARDAR HORARIOS</button>
                <button onclick="cargarConfigHorarios(${profesionalId})" class="btn-reset" style="flex:1;padding:15px;">⚙️ Configurar Horarios Base</button>
            </div>
        `;
    } catch (error) {
        panel.innerHTML = '<p style="color:red;">Error al cargar horarios.</p>';
    }
}

function generarBotonesPersistentes(dia, horasDelDia) {
    const horas = ["08:00", "09:00", "10:00", "11:00", "11:30", "12:00", "14:00", "15:00", "15:30", "16:00", "16:30", "17:00", "18:00", "18:30", "19:00", "19:30", "20:00"];
    return horas.map(hora => {
        const activo = horasDelDia.has(hora);
        return '<button class="btn-hora ' + (activo ? 'seleccionado' : '') + '" data-dia="' + dia + '" data-hora="' + hora + '" onclick="this.classList.toggle(\'seleccionado\');return false;">' + hora + '</button>';
    }).join('');
}

async function enviarDisponibilidad(profesionalId, nombreProfesional) {
    const horarios = [];
    document.querySelectorAll('.btn-hora.seleccionado').forEach(b => {
        horarios.push({ dia: b.dataset.dia, inicio: b.dataset.hora });
    });
    try {
        const hoy = new Date();
        const desde = hoy.toISOString().split('T')[0];
        const hasta = new Date();
        hasta.setDate(hoy.getDate() + 180);
        const res = await fetch(URL_BASE_HORARIOS + '/disponibilidad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + obtenerToken() },
            body: JSON.stringify({ profesional_id: profesionalId, desde, hasta: hasta.toISOString().split('T')[0], horarios })
        });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion('Horarios guardados');
            await renderHorariosPanel(profesionalId, nombreProfesional);
        }
    } catch (error) {
        mostrarNotificacion('Error de conexión', 'error');
    }
}

async function cargarConfigHorarios(profesionalId) {
    try {
        const data = await cargarConfiguracionHorarios(profesionalId);
        if (!data) return;
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);';
        const manana = data.desde_manana ? data.desde_manana.substring(0, 5) : '10:00';
        const tarde = data.desde_tarde ? data.desde_tarde.substring(0, 5) : '15:00';
        const dias = data.dias_laborables || 'Lunes,Martes,Miércoles,Jueves,Viernes,Sábado';
        modal.innerHTML = '<div style="background:white;border-radius:20px;padding:36px;max-width:500px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);"><h3 style="color:#C06C84;margin:0 0 20px">Configurar Horarios Base</h3><p style="color:#888;font-size:0.88rem;margin-bottom:16px">Define desde qu hora comienza cada profesional su jornada.</p><div style="display:flex;flex-direction:column;gap:14px;"><div><label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px">Inicio Mañana</label><input type="time" id="cfg-manana" value="' + manana + '" style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.95rem"></div><div><label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px">Inicio Tarde</label><input type="time" id="cfg-tarde" value="' + tarde + '" style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.95rem"></div><div><label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px">Días Laborables</label><input type="text" id="cfg-dias" value="' + dias + '" placeholder="Ej: Lunes,Martes..." style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.95rem"></div><div style="display:flex;gap:12px;margin-top:4px"><button onclick="guardarConfigHorarios(' + profesionalId + ')" style="flex:1;background:#C06C84;color:white;padding:12px;border:none;border-radius:9px;cursor:pointer;font-weight:700">Guardar</button><button onclick="modal.remove()" style="flex:1;background:#f0f0f0;color:#555;padding:12px;border:none;border-radius:9px;cursor:pointer;font-weight:600">Cancelar</button></div></div></div>';
        document.body.appendChild(modal);
        modal.onclick = ev => { if (ev.target === modal) modal.remove(); };
    } catch (e) { console.error('Error:', e); }
}

async function guardarConfigHorarios(profesionalId) {
    const manana = document.getElementById('cfg-manana')?.value || '10:00';
    const tarde = document.getElementById('cfg-tarde')?.value || '15:00';
    const dias = document.getElementById('cfg-dias')?.value || 'Lunes,Martes,Miércoles,Jueves,Viernes,Sábado';
    const data = await guardarConfiguracionHorarios(profesionalId, manana + ':00', tarde + ':00', dias);
    if (data?.success) {
        mostrarNotificacion('✅ Horarios base configurados');
        document.querySelector('div[style*="z-index:20000"]')?.remove();
        cargarGestionHorarios();
    }
}
