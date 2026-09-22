// =====================================================
// GESTIÓN DE HORARIOS – CALENDARIO MENSUAL + CONFIG POR DÍA
// Vista: Panel izquierdo = detalle del día | Panel derecho = calendario
// =====================================================

const URL_BASE_HORARIOS = window.API_BASE;
let profesionalHorarioSeleccionado = null;
let _horariosCalendario = {
    mes: new Date().getMonth(),
    anio: new Date().getFullYear(),
    dias: {},
    profesionalId: null
};

const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DIAS_NOMBRES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const PASOS = [90, 60, 30, 20];

async function cargarGestionHorarios() {
    const container = document.getElementById('horarios-lista');
    const usuario = obtenerUsuarioActual();
    if (!container || !usuario) return;

    if (usuario.rol === 'super_admin' || usuario.rol === 'admin' || usuario.rol === 'recepcionista') {
        await _renderSelectorProfesional(container);
    } else if (usuario.rol === 'especialista') {
        await _initCalendario(container, usuario.id, usuario.nombre);
    } else if (usuario.rol === 'profesional') {
        await _initCalendario(container, usuario.id, usuario.nombre);
    } else {
        container.innerHTML = '<p style="color:red;text-align:center;padding:20px;">No tenés permiso para gestionar horarios</p>';
    }
}

async function _renderSelectorProfesional(container) {
    container.innerHTML = `
        <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:14px 18px;border-radius:8px;margin-bottom:20px;">
            <p style="margin:0;font-weight:600;color:#856404;">⚙️ Panel de Administración — Elegí un profesional para editar sus horarios.</p>
        </div>
        <div style="background:white;padding:16px 20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
            <label style="font-weight:600;color:#555;display:block;margin-bottom:8px;">👨‍💼 Seleccionar Profesional:</label>
            <select id="select-profesional-horario" style="width:100%;padding:10px 14px;border:2px solid #C06C84;border-radius:8px;font-size:1rem;" onchange="onCambiarProfesionalHorario()">
                <option value="">— Cargando profesionales... —</option>
            </select>
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

async function onCambiarProfesionalHorario() {
    const select = document.getElementById('select-profesional-horario');
    if (!select || !select.value) return;
    profesionalHorarioSeleccionado = select.value;
    const nombre = select.options[select.selectedIndex]?.text || '';
    await _initCalendario(document.getElementById('horarios-profesional-panel'), profesionalHorarioSeleccionado, nombre);
}

async function _initCalendario(container, profesionalId, nombre) {
    _horariosCalendario.profesionalId = profesionalId;
    _horariosCalendario.mes = new Date().getMonth();
    _horariosCalendario.anio = new Date().getFullYear();

    container.innerHTML = `
        <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
            <div id="horarios-dia-detalle" style="flex:1;min-width:300px;background:white;border-radius:12px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.08);min-height:400px;">
                <p style="text-align:center;color:#999;padding:40px 0;">📅 Elegí un día en el calendario para configurar sus horarios</p>
            </div>
            <div id="horarios-calendario-panel" style="flex:1;min-width:320px;background:white;border-radius:12px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
                <p style="text-align:center;color:#C06C84;padding:10px;">⏳ Cargando calendario...</p>
            </div>
        </div>
    `;
    await _cargarDiasProfesional(profesionalId);
    _renderCalendario();
}

async function _cargarDiasProfesional(profesionalId) {
    _horariosCalendario.dias = {};
    try {
        const res = await fetch(URL_BASE_HORARIOS + '/horarios/dia/' + profesionalId, {
            headers: { 'Authorization': 'Bearer ' + obtenerToken() }
        });
        const lista = await res.json();
        lista.forEach(d => {
            _horariosCalendario.dias[d.dia_semana] = {
                activo: d.activo,
                manana_desde: (d.manana_desde || '10:00').substring(0, 5),
                manana_hasta: (d.manana_hasta || '12:30').substring(0, 5),
                manana_paso: d.manana_paso || 90,
                tarde_desde: (d.tarde_desde || '15:00').substring(0, 5),
                tarde_hasta: (d.tarde_hasta || '19:00').substring(0, 5),
                tarde_paso: d.tarde_paso || 90
            };
        });
    } catch (e) {
        console.error('Error cargando horarios_dia:', e);
    }
    // Completar días faltantes con defaults
    DIAS_NOMBRES.forEach(nombre => {
        if (!_horariosCalendario.dias[nombre]) {
            _horariosCalendario.dias[nombre] = {
                activo: nombre !== 'Domingo',
                manana_desde: '10:00', manana_hasta: '12:30', manana_paso: 90,
                tarde_desde: '15:00', tarde_hasta: '19:00', tarde_paso: 90
            };
        }
    });
}

function _renderCalendario() {
    const panel = document.getElementById('horarios-calendario-panel');
    if (!panel) return;
    const { mes, anio } = _horariosCalendario;
    const primerDia = new Date(anio, mes, 1).getDay();
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const offset = primerDia === 0 ? 6 : primerDia - 1; // Lunes = 0
    const hoy = new Date();

    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <button onclick="_calendarioNavegar(-1)" style="background:none;border:2px solid #C06C84;color:#C06C84;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:600;">◀</button>
            <h3 style="color:#C06C84;margin:0;">${MESES[mes]} ${anio}</h3>
            <button onclick="_calendarioNavegar(1)" style="background:none;border:2px solid #C06C84;color:#C06C84;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:600;">▶</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;margin-bottom:8px;">
            ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => '<div style="font-weight:700;color:#C06C84;font-size:0.8rem;padding:6px 0;">' + d + '</div>').join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
    `;

    for (let i = 0; i < offset; i++) {
        html += '<div></div>';
    }

    for (let dia = 1; dia <= diasEnMes; dia++) {
        const fecha = new Date(anio, mes, dia);
        const nombreDia = DIAS_SEMANA[fecha.getDay()];
        const esDomingo = fecha.getDay() === 0;
        const esHoy = fecha.toDateString() === hoy.toDateString();
        const config = _horariosCalendario.dias[nombreDia];
        const activo = config && config.activo;

        let bgColor = '#f8f9fa';
        let textColor = '#333';
        let border = '1px solid #e0e0e0';
        if (esDomingo) {
            bgColor = '#f0f0f0';
            textColor = '#aaa';
        } else if (activo) {
            bgColor = '#e8f5e9';
            textColor = '#2e7d32';
            border = '2px solid #4CAF50';
        } else {
            bgColor = '#fff3e0';
            textColor = '#e65100';
            border = '2px solid #ff9800';
        }
        if (esHoy) {
            border = '3px solid #C06C84';
        }

        html += `<div onclick="_seleccionarDia(${dia})" style="cursor:pointer;padding:10px 4px;border-radius:8px;background:${bgColor};color:${textColor};border:${border};font-weight:${esHoy?'800':'600'};font-size:0.9rem;text-align:center;transition:all 0.2s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">${dia}${activo ? '<div style="font-size:0.6rem;color:#4CAF50;">✓</div>' : ''}</div>`;
    }

    html += '</div>';
    html += `
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <span style="font-size:0.75rem;display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#e8f5e9;border:2px solid #4CAF50;border-radius:3px;display:inline-block;"></span> Activo</span>
            <span style="font-size:0.75rem;display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#fff3e0;border:2px solid #ff9800;border-radius:3px;display:inline-block;"></span> Inactivo</span>
            <span style="font-size:0.75rem;display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#f0f0f0;border:1px solid #aaa;border-radius:3px;display:inline-block;"></span> Domingo</span>
        </div>
        <div style="margin-top:16px;text-align:center;">
            <button onclick="_guardarTodosLosDias()" class="btn-guardar" style="padding:12px 30px;font-size:1rem;">💾 GUARDAR TODOS LOS CAMBIOS</button>
        </div>
    `;

    panel.innerHTML = html;
}

function _calendarioNavegar(delta) {
    _horariosCalendario.mes += delta;
    if (_horariosCalendario.mes > 11) { _horariosCalendario.mes = 0; _horariosCalendario.anio++; }
    if (_horariosCalendario.mes < 0) { _horariosCalendario.mes = 11; _horariosCalendario.anio--; }
    _renderCalendario();
}

function _seleccionarDia(dia) {
    const fecha = new Date(_horariosCalendario.anio, _horariosCalendario.mes, dia);
    const nombreDia = DIAS_SEMANA[fecha.getDay()];
    if (fecha.getDay() === 0) {
        mostrarNotificacion('Domingo no configurable', 'error');
        return;
    }
    _renderDetalleDia(dia, nombreDia, fecha);
}

function _renderDetalleDia(dia, nombreDia, fecha) {
    const panel = document.getElementById('horarios-dia-detalle');
    if (!panel) return;
    const config = _horariosCalendario.dias[nombreDia];
    const fechaStr = `${dia} de ${MESES[_horariosCalendario.mes]}`;

    const pasoOptions = (actual, key) => PASOS.map(p => `<option value="${p}" ${actual === p ? 'selected' : ''}>${p} min</option>`).join('');

    const slotsManana = _generarSlotsHorario(config.manana_desde, config.manana_hasta, config.manana_paso);
    const slotsTarde = _generarSlotsHorario(config.tarde_desde, config.tarde_hasta, config.tarde_paso);

    panel.innerHTML = `
        <div style="border-bottom:2px solid #C06C84;padding-bottom:12px;margin-bottom:16px;">
            <h3 style="color:#C06C84;margin:0;">📅 ${nombreDia} ${dia} de ${MESES[_horariosCalendario.mes]}</h3>
            <p style="color:#888;font-size:0.85rem;margin:4px 0 0;">Configurá los horarios para este día</p>
        </div>

        <div style="margin-bottom:16px;">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="dia-activo" ${config.activo ? 'checked' : ''} onchange="_toggleDiaActivo()" style="width:20px;height:20px;accent-color:#4CAF50;">
                <span style="font-weight:700;color:#333;font-size:1rem;">${config.activo ? '🟢 Día Activo' : '🔴 Día Inactivo'}</span>
            </label>
        </div>

        <div id="dia-config-content" style="${config.activo ? '' : 'opacity:0.4;pointer-events:none;'}">
            <div style="background:#e8f5e9;border-radius:10px;padding:16px;margin-bottom:14px;">
                <h4 style="color:#2e7d32;margin:0 0 12px;">☀️ Mañana</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
                    <div>
                        <label style="font-size:0.8rem;color:#555;display:block;margin-bottom:4px;">Desde</label>
                        <input type="time" id="dia-m-desde" value="${config.manana_desde}" onchange="_onCambioDetalle()" style="width:100%;padding:8px;border:2px solid #4CAF50;border-radius:6px;font-size:0.95rem;">
                    </div>
                    <div>
                        <label style="font-size:0.8rem;color:#555;display:block;margin-bottom:4px;">Hasta</label>
                        <input type="time" id="dia-m-hasta" value="${config.manana_hasta}" onchange="_onCambioDetalle()" style="width:100%;padding:8px;border:2px solid #4CAF50;border-radius:6px;font-size:0.95rem;">
                    </div>
                    <div>
                        <label style="font-size:0.8rem;color:#555;display:block;margin-bottom:4px;">Intervalo</label>
                        <select id="dia-m-paso" onchange="_onCambioDetalle()" style="width:100%;padding:8px;border:2px solid #4CAF50;border-radius:6px;font-size:0.95rem;">
                            ${pasoOptions(config.manana_paso, 'manana')}
                        </select>
                    </div>
                </div>
                <div id="dia-slots-manana" style="display:flex;flex-wrap:wrap;gap:6px;">
                    ${slotsManana.map(s => `<span style="background:white;padding:4px 10px;border-radius:15px;font-size:0.8rem;color:#2e7d32;border:1px solid #4CAF50;">${s}</span>`).join('')}
                    ${slotsManana.length === 0 ? '<span style="color:#999;font-size:0.85rem;">Sin horarios configurados</span>' : ''}
                </div>
            </div>

            <div style="background:#fff3e0;border-radius:10px;padding:16px;margin-bottom:14px;">
                <h4 style="color:#e65100;margin:0 0 12px;">🌙 Tarde</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
                    <div>
                        <label style="font-size:0.8rem;color:#555;display:block;margin-bottom:4px;">Desde</label>
                        <input type="time" id="dia-t-desde" value="${config.tarde_desde}" onchange="_onCambioDetalle()" style="width:100%;padding:8px;border:2px solid #ff9800;border-radius:6px;font-size:0.95rem;">
                    </div>
                    <div>
                        <label style="font-size:0.8rem;color:#555;display:block;margin-bottom:4px;">Hasta</label>
                        <input type="time" id="dia-t-hasta" value="${config.tarde_hasta}" onchange="_onCambioDetalle()" style="width:100%;padding:8px;border:2px solid #ff9800;border-radius:6px;font-size:0.95rem;">
                    </div>
                    <div>
                        <label style="font-size:0.8rem;color:#555;display:block;margin-bottom:4px;">Intervalo</label>
                        <select id="dia-t-paso" onchange="_onCambioDetalle()" style="width:100%;padding:8px;border:2px solid #ff9800;border-radius:6px;font-size:0.95rem;">
                            ${pasoOptions(config.tarde_paso, 'tarde')}
                        </select>
                    </div>
                </div>
                <div id="dia-slots-tarde" style="display:flex;flex-wrap:wrap;gap:6px;">
                    ${slotsTarde.map(s => `<span style="background:white;padding:4px 10px;border-radius:15px;font-size:0.8rem;color:#e65100;border:1px solid #ff9800;">${s}</span>`).join('')}
                    ${slotsTarde.length === 0 ? '<span style="color:#999;font-size:0.85rem;">Sin horarios configurados</span>' : ''}
                </div>
            </div>

            <div style="background:#e3f2fd;border-radius:10px;padding:12px;margin-bottom:14px;">
                <p style="margin:0;font-size:0.85rem;color:#1565c0;">
                    💡 <strong>Sobreturnos:</strong> Se activan automáticamente cuando un servicio termina dentro del tiempo estipulado y hay un hueco disponible.
                    Intervalo del servicio: <strong id="dia-intervalo-display">${config.manana_paso}</strong> min
                </p>
            </div>
        </div>
    `;

    // Highlight day in calendar
    _resaltarDiaCalendario(dia);
}

function _toggleDiaActivo() {
    const cb = document.getElementById('dia-activo');
    const content = document.getElementById('dia-config-content');
    if (!cb || !content) return;
    content.style.opacity = cb.checked ? '1' : '0.4';
    content.style.pointerEvents = cb.checked ? 'auto' : 'none';
    const label = cb.nextElementSibling;
    if (label) label.textContent = cb.checked ? '🟢 Día Activo' : '🔴 Día Inactivo';
}

function _onCambioDetalle() {
    const desde = document.getElementById('dia-m-desde')?.value || '10:00';
    const hasta = document.getElementById('dia-m-hasta')?.value || '12:30';
    const paso = parseInt(document.getElementById('dia-m-paso')?.value || '90');
    const slots = _generarSlotsHorario(desde, hasta, paso);
    const container = document.getElementById('dia-slots-manana');
    if (container) {
        container.innerHTML = slots.map(s => `<span style="background:white;padding:4px 10px;border-radius:15px;font-size:0.8rem;color:#2e7d32;border:1px solid #4CAF50;">${s}</span>`).join('') || '<span style="color:#999;font-size:0.85rem;">Sin horarios</span>';
    }

    const desdeT = document.getElementById('dia-t-desde')?.value || '15:00';
    const hastaT = document.getElementById('dia-t-hasta')?.value || '19:00';
    const pasoT = parseInt(document.getElementById('dia-t-paso')?.value || '90');
    const slotsT = _generarSlotsHorario(desdeT, hastaT, pasoT);
    const containerT = document.getElementById('dia-slots-tarde');
    if (containerT) {
        containerT.innerHTML = slotsT.map(s => `<span style="background:white;padding:4px 10px;border-radius:15px;font-size:0.8rem;color:#e65100;border:1px solid #ff9800;">${s}</span>`).join('') || '<span style="color:#999;font-size:0.85rem;">Sin horarios</span>';
    }

    const display = document.getElementById('dia-intervalo-display');
    if (display) display.textContent = paso;
}

function _resaltarDiaCalendario(dia) {
    document.querySelectorAll('#horarios-calendario-panel [onclick^="_seleccionarDia"]').forEach(el => {
        el.style.boxShadow = 'none';
    });
    const el = document.querySelector(`[onclick="_seleccionarDia(${dia})"]`);
    if (el) el.style.boxShadow = '0 0 0 3px #C06C84';
}

function _generarSlotsHorario(desde, hasta, paso) {
    const [dh, dm] = (desde || '10:00').split(':').map(Number);
    const [hh, hm] = (hasta || '12:30').split(':').map(Number);
    let inicio = dh * 60 + dm;
    const fin = hh * 60 + hm;
    const slots = [];
    while (inicio < fin) {
        const h = Math.floor(inicio / 60);
        const m = inicio % 60;
        slots.push(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
        inicio += paso;
    }
    return slots;
}

function _recopilarDias() {
    const dias = [];
    DIAS_NOMBRES.forEach(nombre => {
        const config = _horariosCalendario.dias[nombre];
        if (!config) return;
        dias.push({
            dia_semana: nombre,
            activo: config.activo,
            manana_desde: config.manana_desde + ':00',
            manana_hasta: config.manana_hasta + ':00',
            manana_paso: config.manana_paso,
            tarde_desde: config.tarde_desde + ':00',
            tarde_hasta: config.tarde_hasta + ':00',
            tarde_paso: config.tarde_paso
        });
    });
    return dias;
}

async function _guardarTodosLosDias() {
    if (!_horariosCalendario.profesionalId) {
        mostrarNotificacion('Seleccioná un profesional primero', 'error');
        return;
    }
    // Si hay detalle abierto, aplicar cambios del formulario
    _aplicarDetalleAConfig();
    const dias = _recopilarDias();
    try {
        const res = await fetch(URL_BASE_HORARIOS + '/horarios/dia/' + _horariosCalendario.profesionalId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + obtenerToken() },
            body: JSON.stringify({ dias })
        });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion('✅ Horarios por día guardados correctamente');
            // Regenerar slots en disponibilidad_fechas
            await _generarDisponibilidadDesdeDias();
            _renderCalendario();
        } else {
            mostrarNotificacion('Error al guardar: ' + (data.error || data.message), 'error');
        }
    } catch (e) {
        mostrarNotificacion('Error de conexión', 'error');
    }
}

function _aplicarDetalleAConfig() {
    const activo = document.getElementById('dia-activo')?.checked;
    const mDesde = document.getElementById('dia-m-desde')?.value;
    const mHasta = document.getElementById('dia-m-hasta')?.value;
    const mPaso = document.getElementById('dia-m-paso')?.value;
    const tDesde = document.getElementById('dia-t-desde')?.value;
    const tHasta = document.getElementById('dia-t-hasta')?.value;
    const tPaso = document.getElementById('dia-t-paso')?.value;

    if (activo === null || activo === undefined) return;

    // Encontrar qué día está seleccionado
    const diaLabel = document.querySelector('#horarios-dia-detalle h3')?.textContent || '';
    const nombreDia = DIAS_NOMBRES.find(n => diaLabel.includes(n));
    if (!nombreDia) return;

    _horariosCalendario.dias[nombreDia] = {
        activo,
        manana_desde: mDesde || _horariosCalendario.dias[nombreDia].manana_desde,
        manana_hasta: mHasta || _horariosCalendario.dias[nombreDia].manana_hasta,
        manana_paso: parseInt(mPaso) || _horariosCalendario.dias[nombreDia].manana_paso,
        tarde_desde: tDesde || _horariosCalendario.dias[nombreDia].tarde_desde,
        tarde_hasta: tHasta || _horariosCalendario.dias[nombreDia].tarde_hasta,
        tarde_paso: parseInt(tPaso) || _horariosCalendario.dias[nombreDia].tarde_paso
    };
}

async function _generarDisponibilidadDesdeDias() {
    const pid = _horariosCalendario.profesionalId;
    if (!pid) return;

    const hoy = new Date();
    const desde = hoy.toISOString().split('T')[0];
    const hasta = new Date(hoy);
    hasta.setDate(hasta.getDate() + 180);
    const hastaStr = hasta.toISOString().split('T')[0];

    const horarios = [];
    for (let d = new Date(hoy); d <= hasta; d.setDate(d.getDate() + 1)) {
        const nombreDia = DIAS_SEMANA[d.getDay()];
        const config = _horariosCalendario.dias[nombreDia];
        if (!config || !config.activo) continue;
        const fecha = d.toISOString().split('T')[0];

        // Mañana
        if (config.manana_desde && config.manana_hasta) {
            const slots = _generarSlotsHorario(config.manana_desde, config.manana_hasta, config.manana_paso);
            slots.forEach(h => horarios.push({ fecha, hora: h }));
        }
        // Tarde
        if (config.tarde_desde && config.tarde_hasta) {
            const slots = _generarSlotsHorario(config.tarde_desde, config.tarde_hasta, config.tarde_paso);
            slots.forEach(h => horarios.push({ fecha, hora: h }));
        }
    }

    if (horarios.length === 0) return;

    try {
        await fetch(URL_BASE_HORARIOS + '/disponibilidad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + obtenerToken() },
            body: JSON.stringify({ profesional_id: pid, desde, hasta: hastaStr, horarios })
        });
    } catch (e) {
        console.error('Error generando disponibilidad:', e);
    }
}
