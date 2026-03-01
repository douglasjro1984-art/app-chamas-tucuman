// Archivo app.js COMPLETO con todas las funcionalidades

// ==========================================
// 1. VARIABLES GLOBALES
// ==========================================
let servicios = [];
let _calendario_mes_actual = new Date();
let _calendario_dias_seleccionados = {};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Aplicación iniciada");
    const usuario = obtenerUsuarioActual();
    if (usuario) {
        console.log("👤 Usuario actual:", usuario);
        document.getElementById('main-app').style.display = 'block';
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('user-name').textContent = usuario.nombre;
        
        await cargarDatosDesdeAPI();
        showSection('servicios');
        
        if (usuario.rol === 'admin') {
            cargarEstadisticas();
        }
    }
});

function obtenerUsuarioActual() {
    const usuarioStr = localStorage.getItem('usuario');
    if (!usuarioStr) return null;
    try {
        return JSON.parse(usuarioStr);
    } catch (error) {
        console.error('❌ Error:', error);
        localStorage.removeItem('usuario');
        return null;
    }
}

async function cargarDatosDesdeAPI() {
    try {
        const res = await fetch('http://localhost:3000/api/servicios');
        const datosS = await res.json();
        servicios = datosS.map(s => {
            let valorImagen = s.imagen || 'default.jpg';
            let rutaLimpia = valorImagen.split('\\').join('/').replace(/"/g, '');
            let rutaParaNavegador = rutaLimpia.startsWith('http') || rutaLimpia.startsWith('img/') 
                ? rutaLimpia : `img/${rutaLimpia}`;
            return {
                id: s.id, nombre: s.nombre || "Servicio", precio: parseFloat(s.precio) || 0,
                descripcion: s.descripcion || "", categoria_id: s.categoria_id || 1, 
                imagen: rutaParaNavegador, imagenBD: valorImagen
            };
        });
        renderizarServicios();
        llenarSelectServicios();
    } catch (error) {
        console.error('❌ Error:', error);
        mostrarNotificacion('❌ Error de conexión', 'error');
    }
}
document.getElementById('form-registro-profesional')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombre = document.getElementById('prof-nombre').value.trim();
    const email = document.getElementById('prof-email').value.trim();
    const password = document.getElementById('prof-password').value;
    const telefono = document.getElementById('prof-telefono').value.trim();
    const serviciosSelect = document.getElementById('prof-servicios');
    const servicios = Array.from(serviciosSelect.selectedOptions).map(opt => parseInt(opt.value));
    
    // Validaciones frontend
    if (!nombre || !email || !password || !telefono) {
        mostrarNotificacion('❌ Completa todos los campos requeridos', 'error');
        return;
    }
    if (!validarEmail(email)) {
        mostrarNotificacion('❌ Email inválido', 'error');
        return;
    }
    if (!validarTelefono(telefono)) {
        mostrarNotificacion('❌ Teléfono inválido (mínimo 10 dígitos)', 'error');
        return;
    }
    if (password.length < 6) {
        mostrarNotificacion('❌ Contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Registrando...';
    
    try {
        const response = await fetch('http://localhost:3000/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password, telefono, servicios })
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion('✅ Profesional registrado exitosamente');
            e.target.reset(); // Limpia el formulario
        } else {
            mostrarNotificacion('❌ ' + data.message, 'error');
        }
    } catch (error) {
        mostrarNotificacion('❌ Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Registrar Profesional';
    }
});

function renderizarServicios() {
    const grid = document.getElementById('servicios-grid');
    if (!grid) return;
    const usuario = obtenerUsuarioActual();
    const puedeAgendar = usuario && ['admin', 'cliente', 'profesional'].includes(usuario.rol);
    grid.innerHTML = servicios.map(s => `
        <div class="servicio-card">
            <div class="servicio-imagen" style="background-image: url('${encodeURI(s.imagen)}')"></div>
            <div class="servicio-contenido">
                <h3>${s.nombre}</h3>
                <p class="servicio-descripcion">${s.descripcion}</p>
                <div class="servicio-footer">
                    <p class="servicio-precio">$${s.precio.toLocaleString()}</p>
                </div>
                ${puedeAgendar ? `<div class="servicio-accion"><button class="btn-agendar-mini" onclick="prepararAgendado(${s.id})">AGENDAR</button></div>` : ''}
            </div>
        </div>
    `).join('');
}

// ==========================================
// EDITOR DE PRECIOS (ADMIN)
// ==========================================
function cargarEditorPrecios() {
    const lista = document.getElementById('lista-precios-editar');
    if (!lista) return;
    lista.innerHTML = servicios.map(s => `
        <div class="editor-servicio-card">
            <div><img src="${s.imagen}" alt="${s.nombre}" onerror="this.src='img/default.jpg'">
                <div><h3>${s.nombre}</h3><small>ID: ${s.id}</small></div></div>
            <div>
                <div class="grid-row">
                    <div><label>Nombre</label><input type="text" id="edit-nombre-${s.id}" value="${s.nombre}"></div>
                    <div><label>Precio</label><input type="number" id="edit-precio-${s.id}" value="${s.precio}"></div>
                </div>
                <div class="full-width"><label>Descripción</label><textarea id="edit-desc-${s.id}" rows="3">${s.descripcion}</textarea></div>
                <div class="full-width"><label>URL Imagen</label><input type="text" id="edit-imagen-${s.id}" value="${s.imagenBD}" placeholder="img/nombre.jpg"></div>
            </div>
            <div>
                <button class="btn-reset" onclick="resetearCampos(${s.id})">🔄 Restaurar</button>
                <button class="btn-guardar" onclick="guardarCambiosServicioCompleto(${s.id})">💾 Guardar</button>
            </div>
        </div>
    `).join('');
}

async function guardarCambiosServicioCompleto(id) {
    const nuevoNombre = document.getElementById(`edit-nombre-${id}`).value.trim();
    const nuevoPrecio = document.getElementById(`edit-precio-${id}`).value;
    const nuevaDesc = document.getElementById(`edit-desc-${id}`).value.trim();
    const nuevaImagen = document.getElementById(`edit-imagen-${id}`).value.trim();
    if (!nuevoNombre || !nuevoPrecio) {
        mostrarNotificacion('⚠️ Nombre y precio obligatorios', 'error');
        return;
    }
    try {
        const res = await fetch(`http://localhost:3000/api/servicios/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nuevoNombre, precio: nuevoPrecio, descripcion: nuevaDesc, imagen: nuevaImagen })
        });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion('✅ Servicio actualizado');
            await cargarDatosDesdeAPI();
            cargarEditorPrecios();
        } else {
            mostrarNotificacion('❌ Error', 'error');
        }
    } catch (error) {
        mostrarNotificacion('❌ Error de conexión', 'error');
    }
}

function resetearCampos(id) {
    const servicio = servicios.find(s => s.id === id);
    if (servicio) {
        document.getElementById(`edit-nombre-${id}`).value = servicio.nombre;
        document.getElementById(`edit-precio-${id}`).value = servicio.precio;
        document.getElementById(`edit-desc-${id}`).value = servicio.descripcion;
        document.getElementById(`edit-imagen-${id}`).value = servicio.imagenBD;
        mostrarNotificacion('🔄 Restaurado');
    }
}

// ==========================================
// GESTIÓN DE HORARIOS - CALENDARIO INTERACTIVO
// ==========================================

let _calendario_mes_actual = new Date();
let _calendario_dias_seleccionados = {}; // { "2026-02-21": ["08:00", "10:00"] }

async function cargarGestionHorarios() {
    const container = document.getElementById('horarios-lista');
    const usuario = obtenerUsuarioActual();
    if (!container || !usuario) return;

    if (usuario.rol === 'admin') {
        await _renderSelectorProfesionalCalendario(container);
    } else {
        container.innerHTML = `
            <div class="info-card" style="background:#e8f5e9;border-left:4px solid #4CAF50;margin-bottom:20px;">
                <p><strong>📌</strong> Selecciona días específicos y horas para estar disponible.</p>
            </div>
            <div id="calendario-profesional-panel"></div>
        `;
        await _renderCalendarioInteractivo(usuario.id, usuario.nombre);
    }
}

async function _renderSelectorProfesionalCalendario(container) {
    container.innerHTML = `
        <div class="info-card" style="background:#fff3cd;border-left:4px solid #ffc107;margin-bottom:20px;">
            <p><strong>⚙️ Admin:</strong> Elegí un profesional para ver y editar sus horarios.</p>
        </div>
        <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
            <label style="font-weight:600;color:#555;display:block;margin-bottom:8px;">👨‍💼 Seleccionar Profesional:</label>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <select id="select-prof-calendario" style="flex:1;min-width:220px;padding:10px 14px;border:2px solid #C06C84;border-radius:8px;font-size:1rem;background:#fff;">
                    <option value="">— Elegir profesional —</option>
                </select>
                <button onclick="_onElegirProfesionalCalendario()" class="btn-guardar" style="padding:10px 22px;">🔍 Ver Calendario</button>
            </div>
        </div>
        <div id="calendario-profesional-panel">
            <p style="text-align:center;color:#aaa;padding:30px;">Seleccioná un profesional para ver su calendario.</p>
        </div>
    `;

    try {
        const res = await fetch('http://localhost:3000/api/usuarios/profesionales');
        const profesionales = await res.json();
        const select = document.getElementById('select-prof-calendario');
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
    } catch (err) {
        mostrarNotificacion('❌ Error al cargar profesionales', 'error');
    }
}

async function _onElegirProfesionalCalendario() {
    const select = document.getElementById('select-prof-calendario');
    if (!select || !select.value) {
        document.getElementById('calendario-profesional-panel').innerHTML = '<p style="text-align:center;color:#aaa;padding:30px;">Seleccioná un profesional.</p>';
        return;
    }
    const nombre = select.options[select.selectedIndex]?.text || '';
    await _renderCalendarioInteractivo(select.value, nombre);
}

// ==========================================
// CALENDARIO INTERACTIVO
// ==========================================
async function _renderCalendarioInteractivo(profesionalId, nombreProfesional) {
    const panel = document.getElementById('calendario-profesional-panel');
    if (!panel) return;

    _calendario_mes_actual = new Date();
    _calendario_dias_seleccionados = {};

    // Cargar horarios ya guardados
    try {
        const res = await fetch(`http://localhost:3000/api/disponibilidad_completa/${profesionalId}`);
        const disponibilidad = await res.json();
        
        if (Array.isArray(disponibilidad)) {
            disponibilidad.forEach(slot => {
                if (!slot || !slot.fecha) return; // Validar que exista slot.fecha
                
                let fecha = slot.fecha;
                // Si viene con T, extraer solo la parte de fecha
                if (typeof fecha === 'string' && fecha.includes('T')) {
                    fecha = fecha.split('T')[0];
                }
                
                if (!_calendario_dias_seleccionados[fecha]) {
                    _calendario_dias_seleccionados[fecha] = [];
                }
                
                // Extraer hora de manera segura
                if (slot.hora_inicio) {
                    const hora = typeof slot.hora_inicio === 'string' 
                        ? slot.hora_inicio.substring(0, 5) 
                        : slot.hora_inicio;
                    if (!_calendario_dias_seleccionados[fecha].includes(hora)) {
                        _calendario_dias_seleccionados[fecha].push(hora);
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error cargando disponibilidad:', error);
    }

    const html = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:1400px;">
            <!-- COLUMNA IZQUIERDA: CALENDARIO -->
            <div>
                <div style="background:white;padding:20px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
                    <h3 style="color:#C06C84;margin:0 0 15px 0;">👨‍💼 ${nombreProfesional}</h3>
                    <div id="calendario-navegacion" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                        <button onclick="_mesAnterior()" class="btn-reset" style="padding:8px 14px;">◄ Anterior</button>
                        <h4 id="mes-nombre" style="margin:0;color:#555;min-width:150px;text-align:center;"></h4>
                        <button onclick="_mesSiguiente()" class="btn-reset" style="padding:8px 14px;">Siguiente ►</button>
                    </div>
                    <div id="calendario-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;"></div>
                </div>
            </div>

            <!-- COLUMNA DERECHA: SELECTOR DE HORAS -->
            <div>
                <div style="background:white;padding:20px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
                    <h3 style="color:#555;margin:0 0 15px 0;">⏰ Horarios para el día seleccionado</h3>
                    <div id="selector-horas-container" style="min-height:300px;">
                        <p style="color:#999;text-align:center;padding:40px 20px;">Selecciona un día en el calendario</p>
                    </div>
                    <div style="margin-top:15px;display:flex;gap:10px;flex-wrap:wrap;">
                        <button onclick="_guardarHorariosSeleccionados(${profesionalId})" class="btn-guardar" style="flex:1;padding:12px;">💾 Guardar Cambios</button>
                        <button onclick="_restaurarCalendario()" class="btn-reset" style="flex:1;padding:12px;">🔄 Restaurar</button>
                    </div>
                </div>

                <!-- HORARIOS GUARDADOS -->
                <div style="margin-top:20px;background:white;padding:20px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
                    <h3 style="color:#555;margin:0 0 15px 0;">📋 Horarios Configurados</h3>
                    <div id="horarios-guardados-lista" style="max-height:300px;overflow-y:auto;">
                        <p style="color:#999;">Cargando...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    panel.innerHTML = html;
    _actualizarCalendario();
    await _actualizarHorariosGuardados(profesionalId);
}

// ==========================================
// FUNCIONES DEL CALENDARIO
// ==========================================

function _actualizarCalendario() {
    const año = _calendario_mes_actual.getFullYear();
    const mes = _calendario_mes_actual.getMonth();
    
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    document.getElementById('mes-nombre').textContent = `${meses[mes]} ${año}`;

    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const diaInicio = primerDia.getDay();
    const cantidadDias = ultimoDia.getDate();

    const grid = document.getElementById('calendario-grid');
    grid.innerHTML = '';

    // Encabezados de días
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    diasSemana.forEach(d => {
        const header = document.createElement('div');
        header.textContent = d;
        header.style.cssText = 'font-weight:bold;text-align:center;padding:8px;color:#C06C84;';
        grid.appendChild(header);
    });

    // Días vacíos antes del mes
    for (let i = 0; i < diaInicio; i++) {
        const empty = document.createElement('div');
        grid.appendChild(empty);
    }

    // Días del mes
    for (let dia = 1; dia <= cantidadDias; dia++) {
        const fecha = `${año}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const btn = document.createElement('button');
        btn.textContent = dia;
        btn.dataset.fecha = fecha;
        
        const tieneHorarios = _calendario_dias_seleccionados[fecha] && _calendario_dias_seleccionados[fecha].length > 0;
        btn.style.cssText = `
            padding:8px;
            border:2px solid #ddd;
            border-radius:6px;
            background:${tieneHorarios ? '#C06C84' : 'white'};
            color:${tieneHorarios ? 'white' : '#555'};
            cursor:pointer;
            font-weight:${tieneHorarios ? 'bold' : 'normal'};
            transition:all 0.2s;
        `;
        
        btn.onclick = () => _seleccionarDia(fecha);
        grid.appendChild(btn);
    }
}

function _seleccionarDia(fecha) {
    const horasContainer = document.getElementById('selector-horas-container');
    const horas = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
    const horasSeleccionadas = _calendario_dias_seleccionados[fecha] || [];

    const fechaObj = new Date(fecha + 'T00:00:00');
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const nombreDia = diasSemana[fechaObj.getDay()];
    const [año, mes, dia] = fecha.split('-');
    const fechaFormato = `${nombreDia} ${dia}/${mes}/${año}`;

    horasContainer.innerHTML = `
        <h4 style="color:#555;margin:0 0 15px 0;">📅 ${fechaFormato}</h4>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:15px;">
            ${horas.map(h => `
                <button 
                    class="btn-hora-calendario ${horasSeleccionadas.includes(h) ? 'seleccionado' : ''}"
                    data-hora="${h}"
                    data-fecha="${fecha}"
                    onclick="toggleHora(this)"
                    style="padding:10px;border:2px solid #C06C84;border-radius:6px;background:${horasSeleccionadas.includes(h) ? '#C06C84' : 'white'};color:${horasSeleccionadas.includes(h) ? 'white' : '#C06C84'};cursor:pointer;font-weight:600;transition:all 0.2s;">
                    ${h}
                </button>
            `).join('')}
        </div>
        <div style="display:flex;gap:10px;">
            <button onclick="_seleccionarTodasLasHoras('${fecha}')" class="btn-reset" style="flex:1;padding:8px;">✅ Todas</button>
            <button onclick="_limpiarHoras('${fecha}')" class="btn-reset" style="flex:1;padding:8px;">❌ Limpiar</button>
        </div>
    `;
}

function toggleHora(btn) {
    const fecha = btn.dataset.fecha;
    const hora = btn.dataset.hora;

    if (!_calendario_dias_seleccionados[fecha]) {
        _calendario_dias_seleccionados[fecha] = [];
    }

    if (btn.classList.contains('seleccionado')) {
        btn.classList.remove('seleccionado');
        btn.style.background = 'white';
        btn.style.color = '#C06C84';
        _calendario_dias_seleccionados[fecha] = _calendario_dias_seleccionados[fecha].filter(h => h !== hora);
    } else {
        btn.classList.add('seleccionado');
        btn.style.background = '#C06C84';
        btn.style.color = 'white';
        if (!_calendario_dias_seleccionados[fecha].includes(hora)) {
            _calendario_dias_seleccionados[fecha].push(hora);
        }
    }
}

function _seleccionarTodasLasHoras(fecha) {
    const horas = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
    _calendario_dias_seleccionados[fecha] = [...horas];
    const btns = document.querySelectorAll(`[data-fecha="${fecha}"]`);
    btns.forEach(btn => {
        btn.classList.add('seleccionado');
        btn.style.background = '#C06C84';
        btn.style.color = 'white';
    });
}

function _limpiarHoras(fecha) {
    _calendario_dias_seleccionados[fecha] = [];
    const btns = document.querySelectorAll(`[data-fecha="${fecha}"]`);
    btns.forEach(btn => {
        btn.classList.remove('seleccionado');
        btn.style.background = 'white';
        btn.style.color = '#C06C84';
    });
}

function _mesAnterior() {
    _calendario_mes_actual.setMonth(_calendario_mes_actual.getMonth() - 1);
    _actualizarCalendario();
}

function _mesSiguiente() {
    _calendario_mes_actual.setMonth(_calendario_mes_actual.getMonth() + 1);
    _actualizarCalendario();
}

function _restaurarCalendario() {
    location.reload();
}

// ==========================================
// GUARDAR HORARIOS
// ==========================================
async function _guardarHorariosSeleccionados(profesionalId) {
    const horariosParaGuardar = [];

    for (const [fecha, horas] of Object.entries(_calendario_dias_seleccionados)) {
        if (horas.length > 0) {
            horas.forEach(hora => {
                horariosParaGuardar.push({
                    fecha: fecha,
                    hora_inicio: hora + ':00'
                });
            });
        }
    }

    if (horariosParaGuardar.length === 0) {
        mostrarNotificacion('⚠️ Selecciona al menos un horario', 'error');
        return;
    }

    try {
        const res = await fetch('http://localhost:3000/api/disponibilidad/guardar-directas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profesional_id: profesionalId,
                horarios: horariosParaGuardar
            })
        });

        const data = await res.json();
        if (data.success) {
            mostrarNotificacion(`✅ ${horariosParaGuardar.length} horarios guardados`);
            await _actualizarHorariosGuardados(profesionalId);
            _actualizarCalendario();
        } else {
            mostrarNotificacion('❌ ' + (data.message || 'Error'), 'error');
        }
    } catch (error) {
        mostrarNotificacion('❌ Error de conexión', 'error');
        console.error(error);
    }
}

// ==========================================
// MOSTRAR HORARIOS GUARDADOS
// ==========================================
async function _actualizarHorariosGuardados(profesionalId) {
    const container = document.getElementById('horarios-guardados-lista');
    if (!container) return;

    try {
        const res = await fetch(`http://localhost:3000/api/disponibilidad_completa/${profesionalId}`);
        const disponibilidad = await res.json();

        if (!disponibilidad || disponibilidad.length === 0) {
            container.innerHTML = '<p style="color:#999;">No hay horarios configurados</p>';
            return;
        }

        // Agrupar por fecha
        const horariosPorFecha = {};
        disponibilidad.forEach(slot => {
            if (!slot || !slot.fecha) return;
            
            let fecha = slot.fecha;
            // Si viene con T, extraer solo la parte de fecha
            if (typeof fecha === 'string' && fecha.includes('T')) {
                fecha = fecha.split('T')[0];
            }
            
            if (!horariosPorFecha[fecha]) {
                horariosPorFecha[fecha] = [];
            }
            
            // Extraer hora de manera segura
            if (slot.hora_inicio) {
                const hora = typeof slot.hora_inicio === 'string' 
                    ? slot.hora_inicio.substring(0, 5) 
                    : slot.hora_inicio;
                horariosPorFecha[fecha].push(hora);
            }
        });

        // Ordenar fechas
        const fechasOrdenadas = Object.keys(horariosPorFecha).sort();

        const html = fechasOrdenadas.map(fecha => {
            const fechaObj = new Date(fecha + 'T00:00:00');
            const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const nombreDia = diasSemana[fechaObj.getDay()];
            const [año, mes, dia] = fecha.split('-');
            const horas = horariosPorFecha[fecha].sort();

            return `
                <div style="background:#f9f9f9;padding:12px;border-radius:8px;margin-bottom:10px;border-left:3px solid #C06C84;">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
                        <strong style="color:#555;">${nombreDia} ${dia}/${mes}</strong>
                        <button onclick="eliminarDiaCompleto('${fecha}', ${profesionalId})" class="btn-eliminar" style="background:#dc3545;color:white;padding:4px 8px;border:none;border-radius:4px;cursor:pointer;font-size:0.8rem;">🗑️ Eliminar</button>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;">
                        ${horas.map(h => `
                            <span style="background:#C06C84;color:white;padding:4px 8px;border-radius:4px;font-size:0.85rem;font-weight:600;">
                                ${h}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    } catch (error) {
        console.error('Error cargando horarios:', error);
        container.innerHTML = '<p style="color:#dc3545;">Error al cargar horarios</p>';
    }
}

// ==========================================
// ELIMINAR DÍA COMPLETO
// ==========================================
async function eliminarDiaCompleto(fecha, profesionalId) {
    if (!confirm(`⚠️ ¿Eliminar todos los horarios del ${fecha}?`)) {
        return;
    }

    try {
        const res = await fetch(`http://localhost:3000/api/disponibilidad/eliminar-fecha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profesional_id: profesionalId,
                fecha: fecha
            })
        });

        const data = await res.json();
        if (data.success) {
            mostrarNotificacion('✅ Día eliminado');
            delete _calendario_dias_seleccionados[fecha];
            await _actualizarHorariosGuardados(profesionalId);
            _actualizarCalendario();
        } else {
            mostrarNotificacion('❌ Error', 'error');
        }
    } catch (error) {
        mostrarNotificacion('❌ Error de conexión', 'error');
    }
}

// ── Panel exclusivo para admin: selector de profesional ──────────────────
async function _renderSelectorProfesional(container) {
    container.innerHTML = `
        <div class="info-card" style="background:#fff3cd;border-left:4px solid #ffc107;margin-bottom:20px;">
            <p><strong>⚙️ Admin:</strong> Elegí un profesional para ver y editar sus horarios.</p>
        </div>
        <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;
                    box-shadow:0 2px 10px rgba(0,0,0,0.08);">
            <label style="font-weight:600;color:#555;display:block;margin-bottom:8px;">
                👨‍💼 Seleccionar Profesional:
            </label>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <select id="select-prof-horario"
                    style="flex:1;min-width:220px;padding:10px 14px;border:2px solid #C06C84;
                           border-radius:8px;font-size:1rem;background:#fff;">
                    <option value="">— Elegir profesional —</option>
                </select>
                <button onclick="_onElegirProfesional()" class="btn-guardar" style="padding:10px 22px;">
                    🔍 Ver Horarios
                </button>
            </div>
        </div>
        <div id="horarios-profesional-panel">
            <p style="text-align:center;color:#aaa;padding:30px;">
                Seleccioná un profesional para ver su disponibilidad.
            </p>
        </div>
    `;

    try {
        const res = await fetch('http://localhost:3000/api/usuarios/profesionales');
        const profesionales = await res.json();
        const select = document.getElementById('select-prof-horario');
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

        // Si ya había uno seleccionado antes, restaurarlo
        if (_profesionalHorarioId) {
            select.value = _profesionalHorarioId;
            const nombre = select.options[select.selectedIndex]?.text || '';
            await _renderGrillaHorarios(_profesionalHorarioId, nombre);
        }
    } catch (err) {
        mostrarNotificacion('❌ Error al cargar profesionales', 'error');
        console.error(err);
    }
}

// ── Se llama al hacer click en "Ver Horarios" ────────────────────────────
async function _onElegirProfesional() {
    const select = document.getElementById('select-prof-horario');
    if (!select || !select.value) {
        document.getElementById('horarios-profesional-panel').innerHTML =
            '<p style="text-align:center;color:#aaa;padding:30px;">Seleccioná un profesional.</p>';
        return;
    }
    _profesionalHorarioId = select.value;
    const nombre = select.options[select.selectedIndex]?.text || '';
    await _renderGrillaHorarios(_profesionalHorarioId, nombre);
}

// ── Grilla de días/horas para cualquier profesional ──────────────────────
async function _renderGrillaHorarios(profesionalId, nombreProfesional) {
    const panel = document.getElementById('horarios-profesional-panel');
    if (!panel) return;

    const hoy      = new Date();
    const defHasta = new Date(hoy);
    defHasta.setMonth(defHasta.getMonth() + 2);
    const fmtDate  = d => d.toISOString().split('T')[0];

    panel.innerHTML = `
        <div style="background:white;padding:20px;border-radius:12px;margin-bottom:16px;
                    border-left:4px solid #C06C84;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
            <h3 style="color:#C06C84;margin:0 0 12px 0;">👨‍💼 ${nombreProfesional || 'Profesional'}</h3>

            <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;">
                <div>
                    <label style="font-weight:600;color:#555;display:block;margin-bottom:4px;">📅 Desde</label>
                    <input type="date" id="rango-desde" value="${fmtDate(hoy)}" min="${fmtDate(hoy)}"
                           style="padding:8px 12px;border:2px solid #C06C84;border-radius:8px;font-size:0.95rem;">
                </div>
                <div>
                    <label style="font-weight:600;color:#555;display:block;margin-bottom:4px;">📅 Hasta</label>
                    <input type="date" id="rango-hasta" value="${fmtDate(defHasta)}" min="${fmtDate(hoy)}"
                           style="padding:8px 12px;border:2px solid #C06C84;border-radius:8px;font-size:0.95rem;">
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="_setHasta(1)" class="btn-reset" style="padding:8px 14px;font-size:0.85rem;">1 mes</button>
                    <button onclick="_setHasta(2)" class="btn-reset" style="padding:8px 14px;font-size:0.85rem;">2 meses</button>
                    <button onclick="_setHasta(3)" class="btn-reset" style="padding:8px 14px;font-size:0.85rem;">3 meses</button>
                </div>
            </div>
            <p style="color:#888;font-size:0.85rem;margin:0;">
                💡 Elegí el rango, marcá días y horarios, luego guardá. Se crean slots para cada día del rango.
            </p>
        </div>

        <div class="horarios-grid">
            ${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map(dia => `
                <div class="dia-config">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <label style="margin:0;"><strong>${dia}</strong></label>
                        <span style="font-size:0.78rem;cursor:pointer;color:#C06C84;font-weight:600;text-decoration:underline;"
                              onclick="toggleDia('${dia}')">Sel. todos</span>
                    </div>
                    <div class="selector-horas" id="horas-${dia}">
                        ${_botonesHora(dia)}
                    </div>
                </div>
            `).join('')}
        </div>

        <div id="resumen-slots" style="margin:16px 0;padding:14px;background:#f9f9f9;border-radius:10px;
             border:1px dashed #C06C84;font-size:0.88rem;color:#555;">
            ⏳ Cargando resumen...
        </div>

        <div style="display:flex;gap:12px;margin-top:8px;">
            <button onclick="document.querySelectorAll('.btn-hora').forEach(b=>b.classList.add('seleccionado'))"
                    class="btn-reset" style="flex:1;">✅ Todos</button>
            <button onclick="document.querySelectorAll('.btn-hora').forEach(b=>b.classList.remove('seleccionado'))"
                    class="btn-reset" style="flex:1;">❌ Limpiar</button>
            <button id="btn-guardar-horarios" onclick="enviarDisponibilidad(${profesionalId})" class="btn-guardar" style="flex:2;">
                💾 GUARDAR HORARIOS
            </button>
        </div>
    `;

    await _cargarResumenSlots(profesionalId);
}

function _botonesHora(dia) {
    const horas = ["08:00","09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
    return horas.map(h =>
        `<button class="btn-hora" data-dia="${dia}" data-hora="${h}"
             onclick="this.classList.toggle('seleccionado')">${h}</button>`
    ).join('');
}

function toggleDia(dia) {
    const bts = document.querySelectorAll(`#horas-${dia} .btn-hora`);
    const allOn = [...bts].every(b => b.classList.contains('seleccionado'));
    bts.forEach(b => allOn ? b.classList.remove('seleccionado') : b.classList.add('seleccionado'));
}

function _setHasta(meses) {
    const desde = document.getElementById('rango-desde');
    const hasta = document.getElementById('rango-hasta');
    if (!desde || !hasta) return;
    const d = new Date(desde.value + 'T00:00:00');
    d.setMonth(d.getMonth() + meses);
    hasta.value = d.toISOString().split('T')[0];
}

async function _cargarResumenSlots(profesionalId) {
    const el = document.getElementById('resumen-slots');
    if (!el) return;
    try {
        const res   = await fetch(`http://localhost:3000/api/disponibilidad_completa/${profesionalId}`);
        const slots = await res.json();
        if (!slots.length) {
            el.innerHTML = '📭 Sin horarios cargados. Definí el rango y guardá.';
            return;
        }
        const porMes = {};
        slots.forEach(s => {
            const mes = (s.fecha || '').substring(0, 7);
            if (mes) porMes[mes] = (porMes[mes] || 0) + 1;
        });
        const html = Object.entries(porMes).map(([mes, cnt]) => {
            const [y, m] = mes.split('-');
            const nombre = new Date(y, m - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
            return `<span style="margin-right:14px;">📅 <strong>${nombre}</strong>: ${cnt} slots</span>`;
        }).join('');
        el.innerHTML = `✅ Horarios actuales: ${html}`;
    } catch(e) {
        el.innerHTML = '⚠️ No se pudo cargar el resumen.';
    }
}

function generarBotonesPersistentes(dia, guardados) {
    const horas = ["08:00","09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
    return horas.map(h => {
        const on = guardados.some(g => g.hora_inicio && g.hora_inicio.startsWith(h));
        return `<button class="btn-hora ${on ? 'seleccionado' : ''}" data-dia="${dia}" data-hora="${h}"
                    onclick="this.classList.toggle('seleccionado')">${h}</button>`;
    }).join('');
}

async function enviarDisponibilidad(profesionalId) {
    const usuario = obtenerUsuarioActual();
    if (!usuario) return;

    const idFinal = profesionalId || usuario.id;
    const desde   = document.getElementById('rango-desde')?.value;
    const hasta   = document.getElementById('rango-hasta')?.value;

    if (!desde || !hasta) {
        mostrarNotificacion('❌ Seleccioná el rango de fechas', 'error');
        return;
    }
    if (desde > hasta) {
        mostrarNotificacion('❌ La fecha inicio debe ser anterior a la de fin', 'error');
        return;
    }

    const horarios = [];
    document.querySelectorAll('.btn-hora.seleccionado').forEach(b => {
        horarios.push({ dia: b.dataset.dia, inicio: b.dataset.hora });
    });

    if (!horarios.length) {
        mostrarNotificacion('⚠️ Seleccioná al menos un horario', 'error');
        return;
    }

    const btn = document.getElementById('btn-guardar-horarios');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

    try {
        const res  = await fetch('http://localhost:3000/api/disponibilidad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profesional_id: idFinal, desde, hasta, horarios })
        });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion(`✅ ${data.count} slots generados (${desde} → ${hasta})`);
            await _cargarResumenSlots(idFinal);
        } else {
            mostrarNotificacion('❌ ' + (data.message || 'Error al guardar'), 'error');
        }
    } catch (err) {
        mostrarNotificacion('❌ Error de conexión', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 GUARDAR HORARIOS'; }
    }
}

// ==========================================
// TURNOS DEL CLIENTE - FECHAS CORREGIDAS
// ==========================================
async function cargarTurnosCliente() {
    const container = document.getElementById('turnos-cliente-lista');
    const usuario = obtenerUsuarioActual();
    if (!container || !usuario) return;

    try {
        // Obtener turnos del cliente
        const resTurnos = await fetch(`http://localhost:3000/api/turnos/cliente/${usuario.id}`);
        const turnos = await resTurnos.json();

        // Obtener horarios disponibles de todos los profesionales
        const resProfs = await fetch('http://localhost:3000/api/usuarios/profesionales');
        const profesionales = await resProfs.json();

        let html = '';

        // ===== SECCIÓN 1: HORARIOS DISPONIBLES =====
        html += `
            <div style="background:white;padding:20px;border-radius:12px;margin-bottom:25px;box-shadow:0 2px 10px rgba(0,0,0,0.08);border-left:4px solid #C06C84;">
                <h3 style="color:#C06C84;margin-top:0;">📅 Horarios Disponibles para Agendar</h3>
                <p style="color:#888;font-size:0.9rem;margin:0 0 15px 0;">Estos son los horarios que los profesionales tienen disponibles:</p>
        `;

        let hayHorarios = false;
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

        for (const prof of profesionales) {
            const resDisp = await fetch(`http://localhost:3000/api/disponibilidad_completa/${prof.id}`);
            const disponibilidad = await resDisp.json();

            if (!disponibilidad || disponibilidad.length === 0) {
                continue; // Saltar profesionales sin horarios
            }

            hayHorarios = true;

            // Agrupar por fecha
            const horariosPorFecha = {};
            
            disponibilidad.forEach(slot => {
                // Extraer YYYY-MM-DD de la fecha (puede venir como ISO string)
                let fechaStr = slot.fecha;
                if (typeof fechaStr === 'string') {
                    fechaStr = fechaStr.split('T')[0]; // Tomar solo la parte YYYY-MM-DD
                }
                
                const fechaObj = new Date(fechaStr + 'T00:00:00');
                const diaSemana = diasSemana[fechaObj.getDay()];
                
                // Formatear fecha como DD/MM
                const [año, mes, dia] = fechaStr.split('-');
                const fechaFormato = `${dia}/${mes}`;
                const etiqueta = `${diaSemana} ${fechaFormato}`; // "Lunes 23/02"
                
                if (!horariosPorFecha[etiqueta]) {
                    horariosPorFecha[etiqueta] = [];
                }
                
                const hora = slot.hora_inicio.substring(0, 5); // "HH:MM"
                horariosPorFecha[etiqueta].push(hora);
            });

            // Ordenar fechas (extraer día/mes y comparar)
            const fechasOrdenadas = Object.keys(horariosPorFecha).sort((a, b) => {
                const fechaA = a.split(' ')[1]; // "23/02"
                const fechaB = b.split(' ')[1]; // "24/02"
                // Convertir a formato MMDD para comparar correctamente
                const [diaA, mesA] = fechaA.split('/');
                const [diaB, mesB] = fechaB.split('/');
                const numA = parseInt(mesA + diaA);
                const numB = parseInt(mesB + diaB);
                return numA - numB;
            });

            // Renderizar profesional
            html += `
                <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin-bottom:15px;border-left:3px solid #ff9cc5;">
                    <h4 style="color:#555;margin:0 0 12px 0;">👨‍💼 ${prof.nombre}</h4>
                    <div style="display:flex;flex-direction:column;gap:10px;">
            `;

            // Renderizar cada día con sus horas
            fechasOrdenadas.forEach(etiqueta => {
                const horas = horariosPorFecha[etiqueta];
                const horasUnicas = [...new Set(horas)].sort();
                
                html += `
                    <div style="background:white;padding:10px 12px;border-radius:6px;border:1px solid #e8d0da;">
                        <strong style="color:#C06C84;display:block;margin-bottom:6px;font-size:0.95rem;">📅 ${etiqueta}</strong>
                        <div style="display:flex;flex-wrap:wrap;gap:5px;">
                            ${horasUnicas.map(h => `
                                <span style="background:#C06C84;color:white;padding:4px 8px;border-radius:15px;font-size:0.85rem;font-weight:600;">
                                    ${h}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                    <p style="font-size:0.85rem;color:#888;margin:10px 0 0 0;">
                        ✅ Total: ${disponibilidad.length} horarios disponibles
                    </p>
                </div>
            `;
        }

        if (!hayHorarios) {
            html += `
                <div style="padding:20px;text-align:center;color:#888;">
                    <p>📭 No hay horarios disponibles configurados por los profesionales</p>
                </div>
            `;
        }

        html += `
                <p style="font-size:0.9rem;color:#666;margin-top:15px;">
                    💡 Haz click en "<strong>Agendar</strong>" para reservar un turno
                </p>
            </div>
        `;

        // ===== SECCIÓN 2: TURNOS AGENDADOS =====
        html += `
            <div style="background:white;padding:20px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.08);border-left:4px solid #4CAF50;">
                <h3 style="color:#555;margin-top:0;">📋 Tus Turnos Agendados</h3>
        `;

        if (!Array.isArray(turnos) || turnos.length === 0) {
            html += `
                <p style="color:#888;text-align:center;padding:20px;">
                    😊 Aún no has agendado turnos
                </p>
            `;
        } else {
            html += `
                <table class="tabla-turnos">
                    <thead>
                        <tr>
                            <th>Servicio</th>
                            <th>Profesional</th>
                            <th>Fecha</th>
                            <th>Hora</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${turnos.map(t => `
                            <tr>
                                <td><strong>${t.servicio_nombre || 'N/A'}</strong></td>
                                <td>${t.profesional_nombre || 'N/A'}</td>
                                <td>${new Date(t.fecha).toLocaleDateString('es-ES')}</td>
                                <td>${t.hora_inicio.substring(0,5)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        html += `</div>`;

        container.innerHTML = html;

    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = `<p class="error">❌ Error al cargar datos: ${error.message}</p>`;
    }
}

// ==========================================
// TURNOS DEL PROFESIONAL - FECHAS CORREGIDAS
// ==========================================
async function cargarTurnosProfesional() {
    const container = document.getElementById('turnos-profesional-lista');
    const usuario = obtenerUsuarioActual();
    if (!container || !usuario) return;

    try {
        // Obtener horarios configurados
        const resDisp = await fetch(`http://localhost:3000/api/disponibilidad_completa/${usuario.id}`);
        const disponibilidad = await resDisp.json();

        // Obtener turnos del profesional
        const resTurnos = await fetch(`http://localhost:3000/api/turnos/profesional/${usuario.id}`);
        const turnos = await resTurnos.json();

        let html = '';

        // ===== SECCIÓN 1: HORARIOS CONFIGURADOS =====
        html += `
            <div style="background:white;padding:20px;border-radius:12px;margin-bottom:25px;box-shadow:0 2px 10px rgba(0,0,0,0.08);border-left:4px solid #C06C84;">
                <h3 style="color:#C06C84;margin-top:0;">📅 Tus Horarios Disponibles</h3>
        `;

        if (!disponibilidad || disponibilidad.length === 0) {
            html += `
                <p style="color:#ff9800;padding:15px;background:#fff3cd;border-radius:6px;margin:0;">
                    ⚠️ No has configurado horarios disponibles. 
                    <strong>Configúralos en "Mis Horarios"</strong> para que los clientes puedan agendar.
                </p>
            `;
        } else {
            // Agrupar por fecha
            const horariosPorFecha = {};
            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            
            disponibilidad.forEach(slot => {
                // Extraer YYYY-MM-DD de la fecha (puede venir como ISO string)
                let fechaStr = slot.fecha;
                if (typeof fechaStr === 'string') {
                    fechaStr = fechaStr.split('T')[0]; // Tomar solo la parte YYYY-MM-DD
                }
                
                const fechaObj = new Date(fechaStr + 'T00:00:00');
                const diaSemana = diasSemana[fechaObj.getDay()];
                
                // Formatear fecha como DD/MM
                const [año, mes, dia] = fechaStr.split('-');
                const fechaFormato = `${dia}/${mes}`;
                const etiqueta = `${diaSemana} ${fechaFormato}`; // "Lunes 23/02"
                
                if (!horariosPorFecha[etiqueta]) {
                    horariosPorFecha[etiqueta] = [];
                }
                
                const hora = slot.hora_inicio.substring(0, 5); // "HH:MM"
                horariosPorFecha[etiqueta].push(hora);
            });

            // Ordenar por fecha (extraer día/mes y comparar)
            const fechasOrdenadas = Object.keys(horariosPorFecha).sort((a, b) => {
                const fechaA = a.split(' ')[1]; // "23/02"
                const fechaB = b.split(' ')[1]; // "24/02"
                // Convertir a formato MMDD para comparar correctamente
                const [diaA, mesA] = fechaA.split('/');
                const [diaB, mesB] = fechaB.split('/');
                const numA = parseInt(mesA + diaA);
                const numB = parseInt(mesB + diaB);
                return numA - numB;
            });

            // Renderizar horarios
            html += `<div style="display:flex;flex-direction:column;gap:12px;">`;
            
            fechasOrdenadas.forEach(etiqueta => {
                const horas = horariosPorFecha[etiqueta];
                // Remover duplicados y ordenar
                const horasUnicas = [...new Set(horas)].sort();
                
                html += `
                    <div style="background:#f9f9f9;padding:12px 14px;border-radius:8px;border-left:4px solid #C06C84;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong style="color:#555;font-size:1rem;">📅 ${etiqueta}</strong>
                            <span style="font-size:0.8rem;color:#888;background:#e8d0da;padding:4px 8px;border-radius:4px;font-weight:600;">
                                ${horasUnicas.length} hora(s)
                            </span>
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px;">
                            ${horasUnicas.map(h => `
                                <span style="background:#C06C84;color:white;padding:6px 10px;border-radius:20px;font-size:0.9rem;font-weight:600;">
                                    ${h}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
            html += `<p style="margin-top:15px;color:#666;font-size:0.9rem;">
                        ✅ Total: ${disponibilidad.length} horarios configurados
                    </p>`;
        }

        html += `</div>`;

        // ===== SECCIÓN 2: CITAS CON CLIENTES =====
        html += `
            <div style="background:white;padding:20px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.08);border-left:4px solid #4CAF50;">
                <h3 style="color:#555;margin-top:0;">👥 Citas de Clientes</h3>
        `;

        if (!Array.isArray(turnos) || turnos.length === 0) {
            html += `
                <p style="color:#888;text-align:center;padding:20px;">
                    📭 Aún no tienes citas agendadas
                </p>
            `;
        } else {
            html += `
                <table class="tabla-turnos">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Teléfono</th>
                            <th>Servicio</th>
                            <th>Fecha</th>
                            <th>Hora</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${turnos.map(t => `
                            <tr>
                                <td><strong>${t.cliente || 'N/A'}</strong></td>
                                <td>${t.telefono || 'N/A'}</td>
                                <td>${t.servicio || 'N/A'}</td>
                                <td>${new Date(t.fecha).toLocaleDateString('es-ES')}</td>
                                <td>${t.hora.substring(0,5)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        html += `</div>`;

        container.innerHTML = html;

    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = `<p class="error">❌ Error al cargar datos: ${error.message}</p>`;
    }
}

// ==========================================
// GESTIÓN DE TURNOS (ADMIN)
// ==========================================
async function cargarTodosLosTurnos() {
    const container = document.getElementById('todos-turnos-lista');
    if (!container) return;
    try {
        const profesionalId = document.getElementById('filtro-profesional')?.value || '';
        const fechaDesde = document.getElementById('filtro-fecha-desde')?.value || '';
        const fechaHasta = document.getElementById('filtro-fecha-hasta')?.value || '';
        let url = 'http://localhost:3000/api/turnos/todos';
        const params = new URLSearchParams();
        if (profesionalId) params.append('profesional_id', profesionalId);
        if (fechaDesde) params.append('fecha_desde', fechaDesde);
        if (fechaHasta) params.append('fecha_hasta', fechaHasta);
        if (params.toString()) url += '?' + params.toString();
        const res = await fetch(url);
        const turnos = await res.json();
        if (turnos.length === 0) {
            container.innerHTML = '<div class="mensaje-vacio"><h3>No hay turnos</h3></div>';
            return;
        }
        container.innerHTML = `<div class="contador-turnos"><h3>📊 Total</h3><div class="numero">${turnos.length}</div></div>
            <table class="turnos-admin-table"><thead><tr><th>#</th><th>Cliente</th><th>Profesional</th><th>Servicio</th><th>Fecha</th><th>Hora</th><th>Teléfono</th><th>Acciones</th></tr></thead><tbody>
            ${turnos.map(t => `<tr><td><strong>#${t.id}</strong></td><td>${t.cliente}</td><td>${t.profesional}</td><td>${t.servicio}</td>
            <td>${new Date(t.fecha).toLocaleDateString('es-ES')}</td><td><strong>${t.hora.substring(0,5)}</strong></td><td>${t.telefono || 'N/A'}</td>
            <td><div class="acciones"><button class="btn-editar" onclick="abrirModalEditar(${t.id})">✏️ Editar</button>
            <button class="btn-eliminar" onclick="eliminarTurno(${t.id})">🗑️ Eliminar</button></div></td></tr>`).join('')}</tbody></table>`;
    } catch (error) {
        container.innerHTML = `<p class="error">❌ Error</p>`;
    }
}

async function cargarProfesionalesFiltro() {
    const select = document.getElementById('filtro-profesional');
    if (!select) return;
    try {
        const res = await fetch('http://localhost:3000/api/usuarios/profesionales');
        const profesionales = await res.json();
        select.innerHTML = '<option value="">Todos</option>' + profesionales.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    } catch (error) { }
}

function limpiarFiltros() {
    document.getElementById('filtro-profesional').value = '';
    document.getElementById('filtro-fecha-desde').value = '';
    document.getElementById('filtro-fecha-hasta').value = '';
    cargarTodosLosTurnos();
}

async function abrirModalEditar(turnoId) {
    try {
        const res = await fetch(`http://localhost:3000/api/turnos/${turnoId}`);
        const turno = await res.json();
        document.getElementById('edit-turno-id').value = turno.id;
        document.getElementById('edit-cliente-nombre').value = turno.cliente;
        document.getElementById('edit-turno-fecha').value = turno.fecha.split('T')[0];
        await cargarServiciosModal();
        document.getElementById('edit-servicio-select').value = turno.servicio_id;
        await cargarProfesionalesModal(turno.servicio_id);
        document.getElementById('edit-profesional-select').value = turno.profesional_id;
        await cargarHorariosModal(turno.profesional_id, turno.fecha.split('T')[0], turno.id);
        document.getElementById('edit-turno-hora').value = turno.hora_inicio.substring(0,5);
        document.getElementById('modal-editar-turno').style.display = 'flex';
    } catch (error) {
        mostrarNotificacion('❌ Error', 'error');
    }
}

function cerrarModalEditar() {
    document.getElementById('modal-editar-turno').style.display = 'none';
}

async function cargarServiciosModal() {
    const select = document.getElementById('edit-servicio-select');
    if (!select) return;
    const res = await fetch('http://localhost:3000/api/servicios');
    const servicios = await res.json();
    select.innerHTML = '<option value="">Seleccionar...</option>' + servicios.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('');
    select.onchange = async (e) => { await cargarProfesionalesModal(e.target.value); };
}

async function cargarProfesionalesModal(servicioId) {
    const select = document.getElementById('edit-profesional-select');
    if (!servicioId || !select) return;
    const res = await fetch(`http://localhost:3000/api/profesionales/servicio/${servicioId}`);
    const profesionales = await res.json();
    select.innerHTML = '<option value="">Seleccionar...</option>' + profesionales.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    select.onchange = async () => {
        const fecha = document.getElementById('edit-turno-fecha').value;
        if (fecha) {
            const turnoId = document.getElementById('edit-turno-id').value;
            await cargarHorariosModal(select.value, fecha, turnoId);
        }
    };
}

async function cargarHorariosModal(profesionalId, fecha, turnoIdActual) {
    const select = document.getElementById('edit-turno-hora');
    if (!profesionalId || !fecha || !select) return;
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const fechaObj = new Date(fecha + 'T00:00:00');
    const diaSemana = diasSemana[fechaObj.getDay()];
    try {
        const resDisp = await fetch(`http://localhost:3000/api/disponibilidad/${profesionalId}/${diaSemana}`);
        const horariosDisp = await resDisp.json();
        const resOcup = await fetch(`http://localhost:3000/api/horarios-ocupados/${profesionalId}/${fecha}?excluir=${turnoIdActual}`);
        const horariosOcup = await resOcup.json();
        const horariosLibres = horariosDisp.filter(disp => {
            const horaDisp = disp.hora_inicio.substring(0, 5);
            return !horariosOcup.some(ocup => ocup.hora_inicio.substring(0, 5) === horaDisp);
        });
        select.innerHTML = '<option value="">Seleccionar...</option>' + horariosLibres.map(h => `<option value="${h.hora_inicio.substring(0, 5)}">${h.hora_inicio.substring(0, 5)}</option>`).join('');
    } catch (error) { }
}

document.getElementById('form-editar-turno')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const turnoId = document.getElementById('edit-turno-id').value;
    const servicioId = document.getElementById('edit-servicio-select').value;
    const profesionalId = document.getElementById('edit-profesional-select').value;
    const fecha = document.getElementById('edit-turno-fecha').value;
    const hora = document.getElementById('edit-turno-hora').value;
    if (!servicioId || !profesionalId || !fecha || !hora) {
        mostrarNotificacion('⚠️ Completa todos los campos', 'error');
        return;
    }
    try {
        const res = await fetch(`http://localhost:3000/api/turnos/${turnoId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicio_id: parseInt(servicioId), profesional_id: parseInt(profesionalId), fecha: fecha, hora_inicio: hora + ':00' })
        });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion('✅ Turno actualizado');
            cerrarModalEditar();
            cargarTodosLosTurnos();
        } else {
            mostrarNotificacion('❌ Error', 'error');
        }
    } catch (error) {
        mostrarNotificacion('❌ Error', 'error');
    }
});

async function eliminarTurno(turnoId) {
    if (!confirm('⚠️ ¿Eliminar este turno?')) return;
    try {
        const res = await fetch(`http://localhost:3000/api/turnos/${turnoId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion('✅ Eliminado');
            cargarTodosLosTurnos();
        } else {
            mostrarNotificacion('❌ Error', 'error');
        }
    } catch (error) {
        mostrarNotificacion('❌ Error', 'error');
    }
}

// ==========================================
// AGENDAR TURNO
// ==========================================
function llenarSelectServiciosRegistro() {
    const select = document.getElementById('prof-servicios');
    if (!select) return;
    select.innerHTML = servicios.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('');
}

function llenarSelectServicios() {
    const select = document.getElementById('servicio-select');
    if (!select) return;
    select.innerHTML = '<option value="">Seleccionar servicio...</option>' + 
        servicios.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('');
    select.onchange = (e) => cargarProfesionalesPorServicio(e.target.value);
}

async function cargarProfesionalesPorServicio(servicioId) {
    const selectPro  = document.getElementById('profesional-select');
    const inputFecha = document.getElementById('turno-fecha');
    const selectHora = document.getElementById('turno-hora');
    if (!servicioId || !selectPro) return;

    // Reset
    inputFecha.disabled = true;
    inputFecha.value    = '';
    selectHora.innerHTML = '<option value="">Primero seleccioná profesional...</option>';

    try {
        const res = await fetch(`http://localhost:3000/api/profesionales/servicio/${servicioId}`);
        const profesionales = await res.json();
        selectPro.disabled = false;
        selectPro.innerHTML = '<option value="">Seleccionar profesional...</option>' +
            profesionales.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

        selectPro.onchange = async () => {
            const profId = selectPro.value;
            if (profId) {
                await marcarFechasDisponibles(profId);
            } else {
                inputFecha.disabled = true;
                inputFecha.value    = '';
            }
        };
    } catch (e) {
        mostrarNotificacion('❌ Error al cargar profesionales', 'error');
    }
}

async function cargarHorariosDisponibles() {
    const profesionalId = document.getElementById('profesional-select').value;
    const fecha         = document.getElementById('turno-fecha').value;
    const selectHora    = document.getElementById('turno-hora');
    if (!profesionalId || !fecha) return;

    selectHora.innerHTML = '<option value="">Cargando...</option>';
    selectHora.disabled = true;

    try {
        // Nueva ruta: devuelve solo horas libres para esa fecha exacta
        const res = await fetch(`http://localhost:3000/api/disponibilidad/${profesionalId}/${fecha}`);
        const horas = await res.json();

        if (!Array.isArray(horas) || horas.length === 0) {
            selectHora.innerHTML = '<option value="">Sin horarios disponibles este día</option>';
            mostrarNotificacion('⚠️ No hay horarios disponibles para esta fecha', 'error');
            return;
        }

        selectHora.disabled = false;
        selectHora.innerHTML = '<option value="">Seleccionar hora...</option>' +
            horas.map(h => {
                const hora = h.hora_inicio.substring(0, 5);
                return `<option value="${hora}">${hora}</option>`;
            }).join('');
        mostrarNotificacion(`✅ ${horas.length} horarios disponibles`);
    } catch (error) {
        selectHora.innerHTML = '<option value="">Error al cargar</option>';
        mostrarNotificacion('❌ Error al cargar horarios', 'error');
        console.error(error);
    }
}

// Cargar fechas disponibles del profesional para marcar el input de fecha
async function marcarFechasDisponibles(profesionalId) {
    const inputFecha = document.getElementById('turno-fecha');
    const infoFechas = document.getElementById('info-fechas-disponibles');
    if (!inputFecha || !profesionalId) return;

    inputFecha.disabled = true;
    inputFecha.value = '';
    document.getElementById('turno-hora').innerHTML = '<option value="">Primero seleccioná una fecha...</option>';

    try {
        const res = await fetch(`http://localhost:3000/api/disponibilidad/rango/${profesionalId}`);
        const fechasDisp = await res.json(); // array de "YYYY-MM-DD"

        if (fechasDisp.length === 0) {
            inputFecha.disabled = true;
            if (infoFechas) infoFechas.textContent = '⚠️ Este profesional no tiene fechas disponibles';
            return;
        }

        // Guardar en dataset para validar al cambiar fecha
        inputFecha.dataset.fechasDisponibles = JSON.stringify(fechasDisp);
        inputFecha.min = fechasDisp[0];
        inputFecha.max = fechasDisp[fechasDisp.length - 1];
        inputFecha.disabled = false;

        if (infoFechas) {
            infoFechas.textContent = `📅 ${fechasDisp.length} fechas disponibles entre ${fechasDisp[0]} y ${fechasDisp[fechasDisp.length-1]}`;
        }

        // Validar fecha elegida contra las disponibles
        inputFecha.onchange = () => {
            const elegida = inputFecha.value;
            const disponibles = JSON.parse(inputFecha.dataset.fechasDisponibles || '[]');
            if (elegida && !disponibles.includes(elegida)) {
                mostrarNotificacion('⚠️ Ese día no tiene horarios disponibles. Elegí otra fecha.', 'error');
                inputFecha.value = '';
                document.getElementById('turno-hora').innerHTML = '<option value="">Elegí una fecha válida...</option>';
                return;
            }
            cargarHorariosDisponibles();
        };
    } catch (e) {
        console.error('Error cargando fechas:', e);
        inputFecha.disabled = false;
    }
}

document.getElementById('form-turno')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = obtenerUsuarioActual();
    const servicioId = document.getElementById('servicio-select').value;
    const profesionalId = document.getElementById('profesional-select').value;
    const fecha = document.getElementById('turno-fecha').value;
    const hora = document.getElementById('turno-hora').value;
    if (!servicioId || !profesionalId || !fecha || !hora) {
        mostrarNotificacion('⚠️ Completa todos los campos', 'error');
        return;
    }
    try {
        const res = await fetch('http://localhost:3000/api/turnos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cliente_id: parseInt(usuario.id),
                profesional_id: parseInt(profesionalId),
                servicio_id: parseInt(servicioId),
                fecha: fecha,
                hora_inicio: hora + ':00'
            })
        });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion('✅ Turno agendado');
            e.target.reset();
            showSection('mis-turnos-cliente');
        } else {
            mostrarNotificacion('❌ ' + (data.message || 'Error'), 'error');
        }
    } catch (error) {
        mostrarNotificacion('❌ Error al agendar', 'error');
    }
});

function prepararAgendado(id) {
    showSection('agendar');
    const select = document.getElementById('servicio-select');
    if (select) {
        select.value = id;
        cargarProfesionalesPorServicio(id);
    }
}

// ==========================================
// ESTADÍSTICAS (ADMIN)
// ==========================================
async function cargarEstadisticas() {
    try {
        const res = await fetch('http://localhost:3000/api/estadisticas');
        const stats = await res.json();
        document.getElementById('stat-turnos-hoy').textContent = stats.turnosHoy;
        document.getElementById('stat-ingresos').textContent = `$${stats.ingresosMes.toLocaleString()}`;
        document.getElementById('stat-clientes').textContent = stats.clientesUnicos;
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// =====================================================
// showSection — función única definitiva
// =====================================================
function showSection(sectionId) {
    const login = document.getElementById('login-screen');
    if (login) {
        login.style.display    = 'none';
        login.style.visibility = 'hidden';
        login.style.pointerEvents = 'none';
        login.style.zIndex    = '-1';
    }
    const mainApp = document.getElementById('main-app');
    if (mainApp) {
        mainApp.style.display    = 'block';
        mainApp.style.visibility = 'visible';
        mainApp.style.pointerEvents = 'auto';
    }
    document.querySelectorAll('.section').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.style.display = 'block';
    target.classList.add('active');

    const usuario = obtenerUsuarioActual();
    if (!usuario) return;

    if (sectionId === 'registrar-profesionales') llenarSelectServiciosRegistro();
    if (sectionId === 'editar-precios')          cargarEditorPrecios();
    if (sectionId === 'gestionar-horarios')      cargarGestionHorarios();
    if (sectionId === 'admin')                   cargarEstadisticas();

    if (sectionId === 'gestionar-turnos') {
        cargarTodosLosTurnos();
        cargarProfesionalesFiltro();
    }

    if (sectionId === 'mis-turnos-cliente') {
        cargarTurnosCliente();
    }

    if (sectionId === 'mis-turnos-profesional') {
        cargarTurnosProfesional();
    }
}
