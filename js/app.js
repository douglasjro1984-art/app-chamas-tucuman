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
async function cargarEditorPrecios() {
    const lista = document.getElementById('lista-precios-editar');
    if (!lista) return;

    // Cargar TODOS los servicios (activos + pausados) para el editor
    let todosLosServicios = servicios;
    try {
        const r = await fetch('http://localhost:3000/api/servicios/todos');
        todosLosServicios = await r.json();
    } catch(e) {}

    const activos  = todosLosServicios.filter(s => s.activo);
    const pausados = todosLosServicios.filter(s => !s.activo);

    const renderServicio = (s) => `
        <div id="card-servicio-${s.id}" style="background:white;border-radius:12px;
             box-shadow:0 2px 10px rgba(0,0,0,0.08);padding:18px;
             display:grid;grid-template-columns:155px 1fr 130px;gap:18px;
             align-items:start;margin-bottom:14px;
             ${!s.activo ? 'border-left:4px solid #ff9800;background:#fffdf8;' : 'border-left:4px solid #C06C84;'}">
            <!-- Imagen clickeable -->
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
                <div style="position:relative;cursor:pointer;" onclick="abrirModalCambiarFoto(${s.id})" title="Click para cambiar foto">
                    <img id="prev-img-${s.id}" src="${s.imagen}" alt="${s.nombre}"
                         style="width:148px;height:115px;object-fit:cover;border-radius:10px;border:3px solid ${s.activo?'#e8d0da':'#ffcc80'};transition:opacity 0.2s;"
                         onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1"
                         onerror="this.style.display='none';document.getElementById('prev-icon-${s.id}').style.display='flex';">
                    <div id="prev-icon-${s.id}" style="width:148px;height:115px;border-radius:10px;background:linear-gradient(135deg,#f9e4ee,#C06C84);display:none;align-items:center;justify-content:center;font-size:2.5rem;">💆</div>
                    <div style="position:absolute;bottom:5px;right:5px;background:rgba(0,0,0,0.55);color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:0.8rem;">✏️</div>
                    ${!s.activo ? '<div style="position:absolute;top:5px;left:5px;background:#ff9800;color:white;border-radius:6px;padding:2px 7px;font-size:0.72rem;font-weight:700;">⏸ PAUSADO</div>' : ''}
                </div>
                <small style="color:${s.activo?'#C06C84':'#ff9800'};font-weight:600;font-size:0.78rem;">Click para cambiar</small>
            </div>
            <!-- Campos -->
            <div style="display:flex;flex-direction:column;gap:9px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">
                    <div><label style="font-weight:600;color:#555;font-size:0.8rem;display:block;margin-bottom:2px;">📝 Nombre</label>
                        <input type="text" id="edit-nombre-${s.id}" value="${s.nombre.replace(/"/g,'&quot;')}"
                               style="width:100%;padding:7px 9px;border:2px solid #e0e0e0;border-radius:7px;font-size:0.88rem;box-sizing:border-box;"></div>
                    <div><label style="font-weight:600;color:#555;font-size:0.8rem;display:block;margin-bottom:2px;">💰 Precio ($)</label>
                        <input type="number" id="edit-precio-${s.id}" value="${s.precio}" step="0.01"
                               style="width:100%;padding:7px 9px;border:2px solid #e0e0e0;border-radius:7px;font-size:0.88rem;box-sizing:border-box;"></div>
                </div>
                <div><label style="font-weight:600;color:#555;font-size:0.8rem;display:block;margin-bottom:2px;">📄 Descripción</label>
                    <textarea id="edit-desc-${s.id}" rows="2"
                              style="width:100%;padding:7px 9px;border:2px solid #e0e0e0;border-radius:7px;font-size:0.84rem;resize:vertical;font-family:inherit;box-sizing:border-box;">${s.descripcion||''}</textarea></div>
                <div><label style="font-weight:600;color:#555;font-size:0.8rem;display:block;margin-bottom:2px;">🖼️ URL imagen</label>
                    <input type="text" id="edit-imagen-${s.id}" value="${s.imagen||''}"
                           placeholder="https://... ó img/nombre.jpg"
                           oninput="prevImgEditor(${s.id},this.value)"
                           style="width:100%;padding:7px 9px;border:2px solid #e0e0e0;border-radius:7px;font-size:0.78rem;box-sizing:border-box;"></div>
            </div>
            <!-- Botones -->
            <div style="display:flex;flex-direction:column;gap:8px;">
                <button onclick="guardarCambiosServicioCompleto(${s.id})"
                        style="background:#C06C84;color:white;padding:10px;border:none;border-radius:7px;cursor:pointer;font-weight:700;width:100%;font-size:0.88rem;">
                    💾 Guardar</button>
                <button data-sid="${s.id}" data-activo="${s.activo?1:0}"
                        onclick="togglePausarServicio(this.dataset.sid, this.dataset.activo)"
                        style="background:${s.activo?'#ff9800':'#4CAF50'};color:white;padding:9px;border:none;border-radius:7px;cursor:pointer;font-weight:700;width:100%;font-size:0.85rem;">
                    ${s.activo ? '⏸ Pausar' : '▶️ Activar'}</button>
                <button onclick="eliminarServicio(${s.id}, '${s.nombre.replace(/'/g,"\'")}')"
                        style="background:#dc3545;color:white;padding:9px;border:none;border-radius:7px;cursor:pointer;font-weight:700;width:100%;font-size:0.85rem;">
                    🗑️ Eliminar</button>
                <button onclick="resetearCampos(${s.id})"
                        style="background:#f0f0f0;color:#555;padding:7px;border:none;border-radius:7px;cursor:pointer;font-size:0.78rem;width:100%;">
                    🔄 Restaurar</button>
            </div>
        </div>`;

    let html = '';

    // Botón Agregar Servicio
    html += `
        <div style="margin-bottom:20px;">
            <button onclick="abrirModalNuevoServicio()"
                    style="background:linear-gradient(135deg,#28a745,#1e7e34);color:white;padding:13px 24px;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:1rem;display:flex;align-items:center;gap:8px;">
                ➕ Agregar Nuevo Servicio
            </button>
        </div>`;

    // Servicios activos
    if (activos.length) {
        html += `<h3 style="color:#C06C84;margin:0 0 12px 0;padding-bottom:8px;border-bottom:2px solid #f0e0ea;">✅ Servicios Activos (${activos.length})</h3>`;
        html += activos.map(renderServicio).join('');
    }

    // Servicios pausados
    if (pausados.length) {
        html += `<h3 style="color:#ff9800;margin:24px 0 12px 0;padding-bottom:8px;border-bottom:2px solid #ffe0b2;">⏸ Servicios Pausados (${pausados.length})</h3>`;
        html += pausados.map(renderServicio).join('');
    }

    lista.innerHTML = html;
}

function prevImgEditor(id, url) {
    const img = document.getElementById('prev-img-'+id);
    const icon = document.getElementById('prev-icon-'+id);
    if (!img||!icon) return;
    let r = (url||'').trim();
    if (r && !r.startsWith('http') && !r.startsWith('img/') && !r.startsWith('/')) r = 'img/'+r;
    if (r) { img.src=r; img.style.display='block'; icon.style.display='none'; img.onerror=()=>{img.style.display='none';icon.style.display='flex';}; }
    else { img.style.display='none'; icon.style.display='flex'; }
}

function abrirModalCambiarFoto(servicioId) {
    document.getElementById('modal-cambiar-foto')?.remove();
    const s = servicios.find(x=>x.id===servicioId) || { nombre:'', imagen:'', imagenBD:'' };
    const modal = document.createElement('div');
    modal.id = 'modal-cambiar-foto';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:34px;max-width:440px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="color:#C06C84;margin:0 0 5px 0;">🖼️ Cambiar foto — ${s.nombre}</h3>
            <p style="color:#888;font-size:0.86rem;margin:0 0 16px 0;">Pegá la URL o ruta de la nueva imagen</p>
            <div style="text-align:center;margin-bottom:14px;">
                <img id="modal-foto-prev" src="${s.imagen||''}" style="width:190px;height:140px;object-fit:cover;border-radius:10px;border:3px solid #e8d0da;" onerror="this.style.display='none'">
            </div>
            <input type="text" id="modal-foto-url" value="${s.imagen||''}" placeholder="https://... ó img/nombre.jpg"
                   oninput="let v=this.value.trim();if(v&&!v.startsWith('http')&&!v.startsWith('img/')&&!v.startsWith('/'))v='img/'+v;const p=document.getElementById('modal-foto-prev');p.src=v;p.style.display='block';"
                   style="width:100%;padding:10px 12px;border:2px solid #C06C84;border-radius:9px;font-size:0.9rem;box-sizing:border-box;margin-bottom:14px;">
            <div style="display:flex;gap:10px;">
                <button onclick="aplicarFoto(${servicioId})" style="flex:1;background:#C06C84;color:white;padding:12px;border:none;border-radius:9px;cursor:pointer;font-weight:700;">✅ Aplicar</button>
                <button onclick="document.getElementById('modal-cambiar-foto').remove();" style="flex:1;background:#f0f0f0;color:#555;padding:12px;border:none;border-radius:9px;cursor:pointer;font-weight:600;">✖ Cancelar</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.onclick = ev => { if(ev.target===modal) modal.remove(); };
    setTimeout(()=>document.getElementById('modal-foto-url')?.focus(), 80);
}

async function aplicarFoto(servicioId) {
    let url = (document.getElementById('modal-foto-url')?.value||'').trim();
    if (!url) { mostrarNotificacion('⚠️ Ingresá una URL','error'); return; }
    if (!url.startsWith('http')&&!url.startsWith('img/')&&!url.startsWith('/')) url='img/'+url;
    const inp = document.getElementById('edit-imagen-'+servicioId);
    if (inp) { inp.value=url; prevImgEditor(servicioId, url); }
    document.getElementById('modal-cambiar-foto').remove();
    mostrarNotificacion('✅ URL aplicada — guardá para confirmar');
}

// ── Agregar nuevo servicio ───────────────────────────────────
function abrirModalNuevoServicio() {
    document.getElementById('modal-nuevo-servicio')?.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-nuevo-servicio';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:36px;max-width:500px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="color:#28a745;margin:0 0 20px 0;">➕ Agregar Nuevo Servicio</h3>
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div>
                    <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">📝 Nombre del servicio *</label>
                    <input type="text" id="nuevo-nombre" placeholder="Ej: Tratamiento Capilar"
                           style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.95rem;box-sizing:border-box;">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div>
                        <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">💰 Precio ($) *</label>
                        <input type="number" id="nuevo-precio" placeholder="0.00" step="0.01" min="0"
                               style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.95rem;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">🖼️ URL imagen</label>
                        <input type="text" id="nuevo-imagen" placeholder="img/servicio.jpg"
                               oninput="let v=this.value.trim();if(v&&!v.startsWith('http')&&!v.startsWith('img/'))v='img/'+v;const p=document.getElementById('nuevo-img-prev');if(p){p.src=v;p.style.display=v?'block':'none';}"
                               style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.85rem;box-sizing:border-box;">
                    </div>
                </div>
                <div>
                    <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">📄 Descripción</label>
                    <textarea id="nuevo-desc" rows="2" placeholder="Breve descripción del servicio..."
                              style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.9rem;resize:vertical;font-family:inherit;box-sizing:border-box;"></textarea>
                </div>
                <div style="text-align:center;">
                    <img id="nuevo-img-prev" style="display:none;width:160px;height:120px;object-fit:cover;border-radius:10px;border:3px solid #e0e0e0;">
                </div>
                <div style="display:flex;gap:12px;margin-top:4px;">
                    <button onclick="confirmarNuevoServicio()"
                            style="flex:1;background:#28a745;color:white;padding:13px;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:1rem;">
                        ✅ Crear Servicio
                    </button>
                    <button onclick="document.getElementById('modal-nuevo-servicio').remove();"
                            style="flex:1;background:#f0f0f0;color:#555;padding:13px;border:none;border-radius:10px;cursor:pointer;font-weight:600;">
                        ✖ Cancelar
                    </button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.onclick = ev => { if(ev.target===modal) modal.remove(); };
    setTimeout(()=>document.getElementById('nuevo-nombre')?.focus(), 80);
}

async function confirmarNuevoServicio() {
    const nombre = (document.getElementById('nuevo-nombre')?.value||'').trim();
    const precio = document.getElementById('nuevo-precio')?.value;
    const desc   = (document.getElementById('nuevo-desc')?.value||'').trim();
    let imagen   = (document.getElementById('nuevo-imagen')?.value||'').trim();
    if (!nombre) { mostrarNotificacion('⚠️ El nombre es obligatorio','error'); return; }
    if (!precio || parseFloat(precio) <= 0) { mostrarNotificacion('⚠️ Ingresá un precio válido','error'); return; }
    if (imagen && !imagen.startsWith('http') && !imagen.startsWith('img/')) imagen = 'img/'+imagen;
    try {
        const res = await fetch('http://localhost:3000/api/servicios', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ nombre, descripcion: desc, precio: parseFloat(precio), imagen: imagen||'img/default.jpg' })
        });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion('✅ Servicio "'+nombre+'" creado correctamente');
            document.getElementById('modal-nuevo-servicio').remove();
            await cargarDatosDesdeAPI();
            cargarEditorPrecios();
        } else { mostrarNotificacion('❌ '+(data.message||'Error'),'error'); }
    } catch(e) { mostrarNotificacion('❌ Error de conexión','error'); }
}

// ── Pausar / Activar servicio ───────────────────────────────
async function togglePausarServicio(id, activoActual) {
    // activoActual = 1 (activo) o 0 (pausado) — queremos invertirlo
    const activar = String(activoActual) === '0'; // si está pausado (0), lo activamos
    const accion = activar ? 'activar' : 'pausar';
    if (!confirm(`¿Querés ${accion} este servicio?\n${activar ? 'Volverá a ser visible para agendar turnos.' : 'No aparecerá en el formulario de turnos.'}`)) return;
    try {
        const res = await fetch(`http://localhost:3000/api/servicios/${id}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ activo: activar })
        });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion(activar ? '✅ Servicio activado' : '⏸ Servicio pausado');
            await cargarDatosDesdeAPI();
            cargarEditorPrecios();
        } else { mostrarNotificacion('❌ '+(data.message||'Error'),'error'); }
    } catch(e) { mostrarNotificacion('❌ Error de conexión','error'); }
}

// ── Eliminar servicio ───────────────────────────────────────
async function eliminarServicio(id, nombre) {
    if (!confirm(`⚠️ ¿Eliminar el servicio "${nombre}"?\n\nEsto es permanente. Si tiene turnos próximos, primero pausalo.`)) return;
    try {
        const res = await fetch(`http://localhost:3000/api/servicios/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion('🗑️ Servicio "'+nombre+'" eliminado');
            await cargarDatosDesdeAPI();
            cargarEditorPrecios();
        } else { mostrarNotificacion('❌ '+(data.message||'Error al eliminar'),'error'); }
    } catch(e) { mostrarNotificacion('❌ Error de conexión','error'); }
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
    container.innerHTML = '<p style="text-align:center;color:#C06C84;padding:30px;">⏳ Cargando...</p>';
    const esAdmin = usuario.rol === 'admin';

    try {
        // Horarios: solo para profesional
        let disponibilidad = [];
        if (!esAdmin) {
            const resDisp = await fetch(`http://localhost:3000/api/disponibilidad_completa/${usuario.id}`);
            disponibilidad = await resDisp.json();
        }

        // Turnos: admin ve todos, profesional ve los suyos
        let turnos = [];
        if (esAdmin) {
            const r = await fetch('http://localhost:3000/api/turnos/todos');
            turnos = await r.json();
        } else {
            const resTurnos = await fetch(`http://localhost:3000/api/turnos/profesional/${usuario.id}`);
            turnos = await resTurnos.json();
        }

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
                <h3 style="color:#555;margin-top:0;">👥 Citas de Clientes <span style="color:#888;font-size:0.85rem;font-weight:normal;">(${Array.isArray(turnos)?turnos.length:0} turnos)</span></h3>
        `;

        if (!Array.isArray(turnos) || turnos.length === 0) {
            html += `<p style="color:#888;text-align:center;padding:20px;">📭 Aún no hay citas agendadas</p>`;
        } else if (esAdmin) {
            // Admin: agrupar por profesional
            const porProf = {};
            turnos.forEach(t => {
                const n = t.profesional || 'Sin asignar';
                if (!porProf[n]) porProf[n] = [];
                porProf[n].push(t);
            });
            html += Object.entries(porProf).map(([profNom, citas]) => `
                <div style="margin-bottom:20px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #f0e0ea;">
                        <span style="background:#C06C84;color:white;border-radius:50%;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;font-size:1rem;">👩‍💼</span>
                        <strong style="color:#C06C84;font-size:1rem;">${profNom}</strong>
                        <span style="background:#f9e4ee;color:#C06C84;padding:3px 10px;border-radius:20px;font-size:0.82rem;font-weight:700;">${citas.length} cita${citas.length!==1?'s':''}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        ${citas.map(t => `
                            <div style="display:flex;align-items:center;justify-content:space-between;background:#f9f9f9;padding:12px 16px;border-radius:10px;border-left:3px solid #4CAF50;flex-wrap:wrap;gap:8px;">
                                <div style="display:flex;align-items:center;gap:10px;min-width:150px;">
                                    <span style="font-size:1.3rem;">👤</span>
                                    <div>
                                        <strong style="color:#333;display:block;">${t.cliente_nombre||t.cliente||'N/A'}</strong>
                                        <small style="color:#888;">📞 ${t.telefono||'N/A'}</small>
                                    </div>
                                </div>
                                <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
                                    <span style="background:#e8f5e9;color:#2e7d32;padding:4px 11px;border-radius:20px;font-size:0.83rem;font-weight:600;">💆 ${t.servicio||'N/A'}</span>
                                    <span style="background:#e3f2fd;color:#1565C0;padding:4px 11px;border-radius:20px;font-size:0.83rem;font-weight:600;">📅 ${new Date(t.fecha).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'})}</span>
                                    <span style="background:#f3e5f5;color:#6a1b9a;padding:4px 11px;border-radius:20px;font-size:0.83rem;font-weight:700;">🕐 ${(t.hora_inicio||t.hora||'').substring(0,5)}</span>
                                </div>
                            </div>`).join('')}
                    </div>
                </div>`).join('');
        } else {
            // Profesional: sus propias citas como cards
            html += `<div style="display:flex;flex-direction:column;gap:8px;">
                ${turnos.map(t => `
                    <div style="display:flex;align-items:center;justify-content:space-between;background:#f9f9f9;padding:12px 16px;border-radius:10px;border-left:3px solid #4CAF50;flex-wrap:wrap;gap:8px;">
                        <div style="display:flex;align-items:center;gap:10px;min-width:150px;">
                            <span style="font-size:1.3rem;">👤</span>
                            <div>
                                <strong style="color:#333;display:block;">${t.cliente_nombre||t.cliente||'N/A'}</strong>
                                <small style="color:#888;">📞 ${t.telefono||'N/A'}</small>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
                            <span style="background:#e8f5e9;color:#2e7d32;padding:4px 11px;border-radius:20px;font-size:0.83rem;font-weight:600;">💆 ${t.servicio||'N/A'}</span>
                            <span style="background:#e3f2fd;color:#1565C0;padding:4px 11px;border-radius:20px;font-size:0.83rem;font-weight:600;">📅 ${new Date(t.fecha).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'})}</span>
                            <span style="background:#f3e5f5;color:#6a1b9a;padding:4px 11px;border-radius:20px;font-size:0.83rem;font-weight:700;">🕐 ${(t.hora_inicio||t.hora||'').substring(0,5)}</span>
                        </div>
                    </div>`).join('')}
            </div>`;
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
        document.getElementById('edit-cliente-nombre').value = turno.cliente_nombre || turno.cliente || '';
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
    const clienteNombre   = (document.getElementById('cliente-nombre')?.value   || '').trim();
    const clienteEmail    = (document.getElementById('cliente-email')?.value    || '').trim();
    const clienteTelefono = (document.getElementById('cliente-telefono')?.value || '').trim();
    const servicioId    = document.getElementById('servicio-select').value;
    const profesionalId = document.getElementById('profesional-select').value;
    const fecha = document.getElementById('turno-fecha').value;
    const hora  = document.getElementById('turno-hora').value;
    if (!clienteNombre) { mostrarNotificacion('⚠️ Ingresá el Nombre Completo','error'); document.getElementById('cliente-nombre')?.focus(); return; }
    if (!servicioId || !profesionalId || !fecha || !hora) { mostrarNotificacion('⚠️ Completa todos los campos','error'); return; }
    try {
        const res = await fetch('http://localhost:3000/api/turnos', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ cliente_id: parseInt(usuario.id), cliente_nombre: clienteNombre,
                cliente_email: clienteEmail, cliente_telefono: clienteTelefono,
                profesional_id: parseInt(profesionalId), servicio_id: parseInt(servicioId),
                fecha, hora_inicio: hora+':00' })
        });
        const data = await res.json();
        if (data.success) {
            const sNom = document.getElementById('servicio-select').options[document.getElementById('servicio-select').selectedIndex]?.text||'';
            const pNom = document.getElementById('profesional-select').options[document.getElementById('profesional-select').selectedIndex]?.text||'';
            const fFmt = new Date(fecha+'T00:00:00').toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
            mostrarConfirmacionTurno(clienteNombre, clienteTelefono, sNom, pNom, fFmt, hora, usuario.nombre);
            e.target.reset();
        } else { mostrarNotificacion('❌ '+(data.message||'Error'),'error'); }
    } catch(e2) { mostrarNotificacion('❌ Error al agendar','error'); }
});

function mostrarConfirmacionTurno(cn, tel, srv, prof, fecha, hora, regPor) {
    document.getElementById('modal-confirm-turno')?.remove();
    const m = document.createElement('div'); m.id='modal-confirm-turno';
    m.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
    m.innerHTML=`<div style="background:white;border-radius:20px;padding:34px;max-width:450px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="font-size:3.5rem;margin-bottom:10px;">🎉</div>
        <h2 style="color:#C06C84;margin:0 0 6px 0;">¡Turno Confirmado!</h2>
        <p style="color:#666;margin-bottom:18px;">La reserva fue registrada exitosamente</p>
        <div style="background:#f9e4ee;border-radius:12px;padding:16px;margin-bottom:16px;text-align:left;">
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #e8d0da;"><span>👤</span><div><small style="color:#888;display:block;">Cliente</small><strong>${cn}</strong></div></div>
            ${tel?`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #e8d0da;"><span>📞</span><div><small style="color:#888;display:block;">Teléfono</small><strong>${tel}</strong></div></div>`:''}
            ${regPor&&regPor!==cn?`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #e8d0da;"><span>🔑</span><div><small style="color:#888;display:block;">Registrado por</small><strong style="color:#777;font-size:0.9rem;">${regPor}</strong></div></div>`:''}
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #e8d0da;"><span>💆</span><div><small style="color:#888;display:block;">Servicio</small><strong>${srv}</strong></div></div>
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #e8d0da;"><span>👩‍💼</span><div><small style="color:#888;display:block;">Profesional</small><strong>${prof}</strong></div></div>
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #e8d0da;"><span>📅</span><div><small style="color:#888;display:block;">Fecha</small><strong>${fecha}</strong></div></div>
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;"><span>🕐</span><div><small style="color:#888;display:block;">Hora</small><strong style="color:#C06C84;font-size:1.2rem;">${hora}</strong></div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="imprimirComprobante('${cn.replace(/'/g,"\'")}','${tel}','${srv.replace(/'/g,"\'")}','${prof.replace(/'/g,"\'")}','${fecha}','${hora}','${regPor.replace(/'/g,"\'")}') "
                    style="flex:1;min-width:100px;background:#c0392b;color:white;padding:10px;border:none;border-radius:9px;cursor:pointer;font-weight:700;font-size:0.85rem;">🖨️ PDF</button>
            <button onclick="document.getElementById('modal-confirm-turno').remove();showSection('mis-turnos-cliente');"
                    style="flex:1;min-width:100px;background:#C06C84;color:white;padding:10px;border:none;border-radius:9px;cursor:pointer;font-weight:700;">📋 Ver</button>
            <button onclick="document.getElementById('modal-confirm-turno').remove();"
                    style="flex:1;min-width:50px;background:#f0f0f0;color:#555;padding:10px;border:none;border-radius:9px;cursor:pointer;">✖</button>
        </div>
    </div>`;
    document.body.appendChild(m);
    m.onclick=ev=>{if(ev.target===m)m.remove();};
}

function imprimirComprobante(cn,tel,srv,prof,fecha,hora,regPor) {
    const win=window.open('','_blank','width=500,height=700');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Comprobante</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;color:#333;max-width:420px;margin:0 auto;}
    h1{color:#C06C84;text-align:center;}.sub{text-align:center;color:#888;margin-bottom:22px;}
    .f{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f0e0ea;}
    .footer{text-align:center;margin-top:28px;color:#aaa;font-size:0.8rem;}@media print{body{padding:20px;}}</style></head><body>
    <h1>💅 CHAMAS SPA</h1><p class="sub">Comprobante de Turno Confirmado</p>
    <div class="f"><span>👤 Cliente</span><strong>${cn}</strong></div>
    ${tel?`<div class="f"><span>📞 Teléfono</span><strong>${tel}</strong></div>`:''}
    <div class="f"><span>💆 Servicio</span><strong>${srv}</strong></div>
    <div class="f"><span>👩‍💼 Profesional</span><strong>${prof}</strong></div>
    <div class="f"><span>📅 Fecha</span><strong>${fecha}</strong></div>
    <div class="f"><span>🕐 Hora</span><strong style="color:#C06C84;">${hora}</strong></div>
    <div class="f"><span>🔑 Registrado por</span><strong>${regPor}</strong></div>
    <div class="footer">Generado el ${new Date().toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
    win.document.close();
}

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
        const elH=document.getElementById('stat-turnos-hoy'); if(elH) elH.textContent=stats.turnosHoy||0;
        const elI=document.getElementById('stat-ingresos');   if(elI) elI.textContent='$'+(stats.ingresosMes||0).toLocaleString();
        const elC=document.getElementById('stat-clientes');   if(elC) elC.textContent=stats.clientesUnicos||0;
    } catch(e) { console.error('❌',e); }
    if (document.getElementById('panel-ganancias')) return;
    const section = document.getElementById('admin');
    if (!section) return;
    const hoy=new Date(), p1=new Date(hoy.getFullYear(),hoy.getMonth(),1).toISOString().split('T')[0], hoyS=hoy.toISOString().split('T')[0];
    const panel=document.createElement('div'); panel.id='panel-ganancias'; panel.style.marginTop='24px';
    panel.innerHTML=`
        <div style="background:white;border-radius:14px;padding:22px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,0.08);border-left:4px solid #C06C84;">
            <h3 style="color:#C06C84;margin:0 0 14px 0;">🔍 Análisis de Ganancias</h3>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
                <div><label style="font-weight:600;color:#555;font-size:0.82rem;display:block;margin-bottom:3px;">📅 Desde</label>
                    <input type="date" id="g-desde" value="${p1}" style="padding:8px 11px;border:2px solid #C06C84;border-radius:7px;font-size:0.88rem;"></div>
                <div><label style="font-weight:600;color:#555;font-size:0.82rem;display:block;margin-bottom:3px;">📅 Hasta</label>
                    <input type="date" id="g-hasta" value="${hoyS}" style="padding:8px 11px;border:2px solid #C06C84;border-radius:7px;font-size:0.88rem;"></div>
                <div><label style="font-weight:600;color:#555;font-size:0.82rem;display:block;margin-bottom:3px;">👩‍💼 Profesional</label>
                    <select id="g-prof" style="padding:8px 11px;border:2px solid #C06C84;border-radius:7px;font-size:0.88rem;min-width:170px;">
                        <option value="">Todas</option></select></div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button onclick="setG(1)"  style="background:#f9e4ee;color:#C06C84;padding:8px 11px;border:2px solid #C06C84;border-radius:7px;cursor:pointer;font-weight:700;font-size:0.82rem;">Hoy</button>
                    <button onclick="setG(7)"  style="background:#f9e4ee;color:#C06C84;padding:8px 11px;border:2px solid #C06C84;border-radius:7px;cursor:pointer;font-weight:700;font-size:0.82rem;">Semana</button>
                    <button onclick="setG(30)" style="background:#f9e4ee;color:#C06C84;padding:8px 11px;border:2px solid #C06C84;border-radius:7px;cursor:pointer;font-weight:700;font-size:0.82rem;">Mes</button>
                    <button onclick="calcG()"  style="background:#C06C84;color:white;padding:8px 16px;border:none;border-radius:7px;cursor:pointer;font-weight:700;">🔍 Calcular</button>
                </div>
            </div>
        </div>
        <div id="g-resultados"></div>`;
    section.appendChild(panel);
    try {
        const rp=await fetch('http://localhost:3000/api/usuarios/profesionales');
        const ps=await rp.json();
        const sel=document.getElementById('g-prof');
        ps.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.nombre;sel.appendChild(o);});
    } catch(e){}
    await calcG();
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

    if (sectionId === 'registrar-profesionales') { llenarSelectServiciosRegistro(); cargarListaProfesionalesAdmin(); }
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

// =====================================================
// PANEL DE GANANCIAS — funciones auxiliares
// =====================================================
function setG(dias) {
    const hoy=new Date(), d=new Date();
    d.setDate(d.getDate()-dias+1);
    document.getElementById('g-desde').value=d.toISOString().split('T')[0];
    document.getElementById('g-hasta').value=hoy.toISOString().split('T')[0];
    calcG();
}

async function calcG() {
    const desde=document.getElementById('g-desde')?.value||'';
    const hasta=document.getElementById('g-hasta')?.value||'';
    const profId=document.getElementById('g-prof')?.value||'';
    const profNom=profId?(document.getElementById('g-prof')?.options[document.getElementById('g-prof').selectedIndex]?.text||''):'Todas';
    const cont=document.getElementById('g-resultados'); if(!cont) return;
    cont.innerHTML='<p style="color:#888;text-align:center;padding:16px;">⏳ Calculando...</p>';
    try {
        let url='http://localhost:3000/api/turnos/todos?';
        if(desde) url+='fecha_desde='+desde+'&';
        if(hasta) url+='fecha_hasta='+hasta+'&';
        if(profId) url+='profesional_id='+profId+'&';
        const turnos=await (await fetch(url)).json();
        if(!Array.isArray(turnos)||!turnos.length){
            cont.innerHTML='<div style="background:white;border-radius:12px;padding:24px;text-align:center;color:#888;box-shadow:0 2px 8px rgba(0,0,0,0.06);">Sin turnos en ese período</div>';return;
        }
        const total=turnos.reduce((s,t)=>s+parseFloat(t.precio||0),0);
        const porProf={};
        turnos.forEach(t=>{
            const n=t.profesional||'Sin asignar';
            if(!porProf[n])porProf[n]={lista:[],total:0};
            porProf[n].lista.push(t);
            porProf[n].total+=parseFloat(t.precio||0);
        });
        cont.innerHTML=`
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;">
            <div style="background:white;padding:16px;border-radius:12px;text-align:center;border-left:4px solid #28a745;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <p style="margin:0;color:#555;font-size:0.82rem;">💰 Ingresos</p>
                <p style="margin:5px 0 0;font-size:1.7rem;font-weight:900;color:#28a745;">$${total.toLocaleString()}</p>
            </div>
            <div style="background:white;padding:16px;border-radius:12px;text-align:center;border-left:4px solid #1976D2;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <p style="margin:0;color:#555;font-size:0.82rem;">📋 Turnos</p>
                <p style="margin:5px 0 0;font-size:1.7rem;font-weight:900;color:#1976D2;">${turnos.length}</p>
            </div>
        </div>
        <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
                <h3 style="margin:0;color:#555;">📊 Por Profesional</h3>
                <button onclick="rptGeneral('${desde}','${hasta}','${profNom}')"
                        style="background:#c0392b;color:white;padding:8px 14px;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-size:0.85rem;">🖨️ Reporte General PDF</button>
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <thead style="background:#C06C84;color:white;">
                    <tr>
                        <th style="padding:9px 12px;text-align:left;">Profesional</th>
                        <th style="padding:9px 12px;text-align:center;">Turnos</th>
                        <th style="padding:9px 12px;text-align:right;">Ingresos</th>
                        <th style="padding:9px 12px;text-align:center;">Detalle</th>
                    </tr>
                </thead>
                <tbody>
                ${Object.entries(porProf).sort((a,b)=>b[1].total-a[1].total).map(([n,d],i)=>`
                    <tr style="background:${i%2===0?'white':'#fdf5f8'};border-bottom:1px solid #f0e0ea;">
                        <td style="padding:9px 12px;font-weight:600;">${n}</td>
                        <td style="padding:9px 12px;text-align:center;">${d.lista.length}</td>
                        <td style="padding:9px 12px;text-align:right;font-weight:700;color:#28a745;">$${d.total.toLocaleString()}</td>
                        <td style="padding:7px 12px;text-align:center;">
                            <button data-prof="${n}" data-desde="${desde}" data-hasta="${hasta}"
                                    data-turnos='${JSON.stringify(d.lista)}'
                                    onclick="rptProf(this.dataset.prof,JSON.parse(this.dataset.turnos),this.dataset.desde,this.dataset.hasta)"
                                    style="background:#C06C84;color:white;padding:5px 11px;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:700;">📄 Ver</button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    } catch(e){ cont.innerHTML='<p style="color:#dc3545;text-align:center;">❌ Error al cargar estadísticas</p>'; }
}

function rptGeneral(desde, hasta, prof) {
    const cont=document.getElementById('g-resultados');
    const tabla=cont?.querySelector('table')?.outerHTML||'';
    const win=window.open('','_blank','width=800,height=900');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;color:#333;}h1{color:#C06C84;}
    table{width:100%;border-collapse:collapse;}th{background:#C06C84;color:white;padding:9px 12px;text-align:left;}
    td{padding:9px 12px;border-bottom:1px solid #f0e0ea;}tr:nth-child(even){background:#fdf5f8;}
    .footer{margin-top:30px;color:#aaa;font-size:0.8rem;text-align:center;}@media print{body{padding:20px;}}</style></head><body>
    <h1>📊 Reporte de Ganancias — CHAMAS SPA</h1>
    <p>Período: <strong>${desde} → ${hasta}</strong> | Profesional: <strong>${prof}</strong></p>
    <p>Generado: ${new Date().toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
    ${tabla}<div class="footer">CHAMAS - Sistema de Gestión de Turnos</div>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`);
    win.document.close();
}

function rptProf(nombre, turnos, desde, hasta) {
    document.getElementById('modal-rpt-prof')?.remove();
    if (!Array.isArray(turnos)) { try { turnos=JSON.parse(turnos); } catch(e){ turnos=[]; } }
    const bruto=turnos.reduce((s,t)=>s+parseFloat(t.precio||0),0);
    const modal=document.createElement('div'); modal.id='modal-rpt-prof';
    modal.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);overflow-y:auto;';
    modal.innerHTML=`
        <div style="background:white;border-radius:18px;padding:32px;max-width:560px;width:95%;margin:20px auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="color:#C06C84;margin:0 0 4px 0;">📄 ${nombre}</h3>
            <p style="color:#888;margin:0 0 18px 0;font-size:0.86rem;">Período: ${desde} → ${hasta}</p>
            <div style="background:#f9f4ff;border:2px solid #C06C84;border-radius:11px;padding:16px;margin-bottom:18px;">
                <h4 style="color:#C06C84;margin:0 0 12px 0;">💼 Configurar Facturación</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                    <div><label style="font-size:0.8rem;font-weight:600;color:#555;display:block;margin-bottom:2px;">🏢 Espacio (%)</label>
                        <input type="number" id="pct-esp" value="20" min="0" oninput="calcFact(${bruto})"
                               style="width:100%;padding:7px;border:2px solid #e0e0e0;border-radius:7px;box-sizing:border-box;"></div>
                    <div><label style="font-size:0.8rem;font-weight:600;color:#555;display:block;margin-bottom:2px;">📦 Materiales (%)</label>
                        <input type="number" id="pct-mat" value="10" min="0" oninput="calcFact(${bruto})"
                               style="width:100%;padding:7px;border:2px solid #e0e0e0;border-radius:7px;box-sizing:border-box;"></div>
                    <div><label style="font-size:0.8rem;font-weight:600;color:#555;display:block;margin-bottom:2px;">🧾 IVA (%)</label>
                        <input type="number" id="pct-iva" value="21" min="0" oninput="calcFact(${bruto})"
                               style="width:100%;padding:7px;border:2px solid #e0e0e0;border-radius:7px;box-sizing:border-box;"></div>
                    <div><label style="font-size:0.8rem;font-weight:600;color:#555;display:block;margin-bottom:2px;">➕ Otros gastos ($)</label>
                        <input type="number" id="otros-g" value="0" min="0" oninput="calcFact(${bruto})"
                               style="width:100%;padding:7px;border:2px solid #e0e0e0;border-radius:7px;box-sizing:border-box;"></div>
                </div>
                <div id="resumen-fact" style="background:white;border-radius:8px;padding:12px;"></div>
            </div>
            <div style="max-height:200px;overflow-y:auto;margin-bottom:16px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.83rem;">
                    <thead style="background:#C06C84;color:white;position:sticky;top:0;">
                        <tr>
                            <th style="padding:7px 8px;">Cliente</th>
                            <th style="padding:7px 8px;">Servicio</th>
                            <th style="padding:7px 8px;">Fecha</th>
                            <th style="padding:7px 8px;text-align:right;">$</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${turnos.map((t,i)=>`
                        <tr style="background:${i%2===0?'white':'#fdf5f8'};border-bottom:1px solid #f0e0ea;">
                            <td style="padding:6px 8px;">${t.cliente_nombre||t.cliente||'N/A'}</td>
                            <td style="padding:6px 8px;">${t.servicio||'N/A'}</td>
                            <td style="padding:6px 8px;white-space:nowrap;">${new Date(t.fecha).toLocaleDateString('es-ES')}</td>
                            <td style="padding:6px 8px;text-align:right;font-weight:700;">$${parseFloat(t.precio||0).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="impRptProf('${nombre.replace(/'/g,"\\'")}','${desde}','${hasta}',${bruto})"
                        style="flex:1;background:#c0392b;color:white;padding:12px;border:none;border-radius:9px;cursor:pointer;font-weight:700;">🖨️ Imprimir PDF</button>
                <button onclick="document.getElementById('modal-rpt-prof').remove();"
                        style="flex:1;background:#f0f0f0;color:#555;padding:12px;border:none;border-radius:9px;cursor:pointer;font-weight:600;">✖ Cerrar</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.onclick=ev=>{if(ev.target===modal)modal.remove();};
    calcFact(bruto);
}

function calcFact(bruto) {
    const pE=parseFloat(document.getElementById('pct-esp')?.value||0)/100;
    const pM=parseFloat(document.getElementById('pct-mat')?.value||0)/100;
    const pI=parseFloat(document.getElementById('pct-iva')?.value||0)/100;
    const oG=parseFloat(document.getElementById('otros-g')?.value||0);
    const esp=bruto*pE, mat=bruto*pM, iva=bruto*pI, neto=bruto-esp-mat-iva-oG;
    const r=document.getElementById('resumen-fact'); if(!r) return;
    r.innerHTML=`<div style="font-size:0.87rem;display:flex;flex-direction:column;gap:5px;">
        <div style="display:flex;justify-content:space-between;"><span>💰 Ingresos brutos</span><strong>$${bruto.toLocaleString()}</strong></div>
        <div style="display:flex;justify-content:space-between;color:#e53935;"><span>🏢 Espacio</span><span>-$${esp.toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;color:#e53935;"><span>📦 Materiales</span><span>-$${mat.toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;color:#e53935;"><span>🧾 IVA</span><span>-$${iva.toLocaleString()}</span></div>
        ${oG>0?`<div style="display:flex;justify-content:space-between;color:#e53935;"><span>➕ Otros</span><span>-$${oG.toLocaleString()}</span></div>`:''}
        <div style="display:flex;justify-content:space-between;border-top:2px solid #C06C84;padding-top:7px;margin-top:4px;">
            <strong style="color:#C06C84;">✅ Neto profesional</strong>
            <strong style="color:#28a745;font-size:1.05rem;">$${neto.toLocaleString()}</strong>
        </div></div>`;
}

function impRptProf(nombre, desde, hasta, bruto) {
    const pE=parseFloat(document.getElementById('pct-esp')?.value||0)/100;
    const pM=parseFloat(document.getElementById('pct-mat')?.value||0)/100;
    const pI=parseFloat(document.getElementById('pct-iva')?.value||0)/100;
    const oG=parseFloat(document.getElementById('otros-g')?.value||0);
    const esp=bruto*pE, mat=bruto*pM, iva=bruto*pI, neto=bruto-esp-mat-iva-oG;
    const win=window.open('','_blank','width=600,height=800');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte ${nombre}</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;color:#333;max-width:480px;margin:0 auto;}
    h1{color:#C06C84;}.sub{color:#888;margin-bottom:20px;}
    .f{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f0e0ea;}
    .g{color:#e53935;}.n{color:#28a745;font-size:1.05rem;font-weight:bold;}
    .tot{border-top:3px solid #C06C84;padding-top:10px;margin-top:6px;}
    .footer{text-align:center;margin-top:30px;color:#aaa;font-size:0.8rem;}@media print{body{padding:20px;}}</style></head><body>
    <h1>📄 CHAMAS SPA — Reporte Individual</h1>
    <p class="sub">Profesional: <strong>${nombre}</strong><br>Período: ${desde} → ${hasta}</p>
    <div class="f"><span>💰 Ingresos brutos</span><strong>$${bruto.toLocaleString()}</strong></div>
    <div class="f g"><span>🏢 Espacio (${(pE*100).toFixed(1)}%)</span><span>-$${esp.toLocaleString()}</span></div>
    <div class="f g"><span>📦 Materiales (${(pM*100).toFixed(1)}%)</span><span>-$${mat.toLocaleString()}</span></div>
    <div class="f g"><span>🧾 IVA (${(pI*100).toFixed(1)}%)</span><span>-$${iva.toLocaleString()}</span></div>
    ${oG>0?`<div class="f g"><span>➕ Otros gastos</span><span>-$${oG.toLocaleString()}</span></div>`:''}
    <div class="f tot"><span class="n">✅ Neto profesional</span><span class="n">$${neto.toLocaleString()}</span></div>
    <div class="footer">Generado: ${new Date().toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}<br>CHAMAS - Sistema de Gestión de Turnos</div>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`);
    win.document.close();
}

// =====================================================
// GESTIONAR TURNOS — tabla mejorada con cliente_nombre
// =====================================================
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
        if (!turnos.length) {
            container.innerHTML = '<div class="mensaje-vacio"><h3>No hay turnos</h3></div>';
            return;
        }
        container.innerHTML = `
            <div class="contador-turnos"><h3>📊 Total de Turnos</h3><div class="numero">${turnos.length}</div></div>
            <div style="overflow-x:auto;margin-top:16px;">
            <table style="width:100%;border-collapse:collapse;font-size:0.86rem;min-width:650px;">
                <thead><tr style="background:#C06C84;color:white;">
                    <th style="padding:10px 8px;">#</th>
                    <th style="padding:10px 8px;">Cliente</th>
                    <th style="padding:10px 8px;">Registrado por</th>
                    <th style="padding:10px 8px;">Profesional</th>
                    <th style="padding:10px 8px;">Servicio</th>
                    <th style="padding:10px 8px;white-space:nowrap;">Fecha</th>
                    <th style="padding:10px 8px;white-space:nowrap;">Hora</th>
                    <th style="padding:10px 8px;text-align:center;">Acciones</th>
                </tr></thead>
                <tbody>
                ${turnos.map((t,i) => `
                    <tr style="background:${i%2===0?'white':'#fdf5f8'};border-bottom:1px solid #f0e0ea;">
                        <td style="padding:10px 8px;font-weight:700;color:#C06C84;">#${t.id}</td>
                        <td style="padding:10px 8px;">
                            <strong>${t.cliente_nombre||t.cliente||'N/A'}</strong>
                            ${t.telefono&&t.telefono!='N/A'?`<br><small style="color:#888;">📞 ${t.telefono}</small>`:''}
                        </td>
                        <td style="padding:10px 8px;font-size:0.8rem;color:#777;">
                            🔑 ${t.registrado_por||t.cliente||'N/A'}
                            ${t.email?`<br><span style="color:#aaa;">📧 ${t.email}</span>`:''}
                        </td>
                        <td style="padding:10px 8px;">${t.profesional||'N/A'}</td>
                        <td style="padding:10px 8px;">${t.servicio||'N/A'}</td>
                        <td style="padding:10px 8px;white-space:nowrap;">${new Date(t.fecha).toLocaleDateString('es-ES')}</td>
                        <td style="padding:10px 8px;font-weight:700;">${(t.hora_inicio||t.hora||'').substring(0,5)}</td>
                        <td style="padding:8px;white-space:nowrap;">
                            <div style="display:flex;gap:4px;justify-content:center;">
                                <button title="Editar" onclick="abrirModalEditar(${t.id})"
                                    style="background:#4CAF50;color:white;padding:7px 10px;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;">✏️</button>
                                <button title="Finalizar" onclick="abrirModalPago(${t.id},'${(t.cliente_nombre||t.cliente||'').replace(/'/g,"\\'")}','${(t.servicio||'').replace(/'/g,"\\'")}','${(t.hora_inicio||t.hora||'').substring(0,5)}','${t.fecha?t.fecha.split('T')[0]:''}')"
                                    style="background:#28a745;color:white;padding:7px 10px;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;">💳</button>
                                <button title="Eliminar" onclick="eliminarTurno(${t.id})"
                                    style="background:#dc3545;color:white;padding:7px 10px;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;">🗑️</button>
                            </div>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table></div>`;
    } catch (error) {
        container.innerHTML = `<p class="error">❌ Error</p>`;
    }
}

// =====================================================
// MODAL PAGO / FINALIZAR TURNO
// =====================================================
function abrirModalPago(turnoId, clienteNombre, servicio, hora, fecha) {
    document.getElementById('modal-pago')?.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-pago';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:34px;max-width:420px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="color:#28a745;margin:0 0 6px 0;">💳 Finalizar Turno #${turnoId}</h3>
            <p style="color:#888;margin:0 0 20px 0;font-size:0.88rem;">👤 ${clienteNombre} | 💆 ${servicio} | 📅 ${fecha} ${hora}</p>
            <div style="display:flex;flex-direction:column;gap:12px;">
                <div>
                    <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">💰 Monto cobrado ($)</label>
                    <input type="number" id="pago-monto" placeholder="0.00" step="0.01" min="0"
                           style="width:100%;padding:10px 12px;border:2px solid #28a745;border-radius:9px;font-size:1rem;box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">💳 Método de pago</label>
                    <select id="pago-metodo" style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.95rem;box-sizing:border-box;">
                        <option value="efectivo">💵 Efectivo</option>
                        <option value="transferencia">🏦 Transferencia</option>
                        <option value="debito">💳 Débito</option>
                        <option value="credito">💳 Crédito</option>
                    </select>
                </div>
                <div>
                    <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">📝 Notas (opcional)</label>
                    <input type="text" id="pago-notas" placeholder="Ej: pagó con descuento..."
                           style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.9rem;box-sizing:border-box;">
                </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button onclick="confirmarPago(${turnoId})"
                        style="flex:1;background:#28a745;color:white;padding:13px;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:1rem;">
                    ✅ Confirmar Pago
                </button>
                <button onclick="document.getElementById('modal-pago').remove();"
                        style="flex:1;background:#f0f0f0;color:#555;padding:13px;border:none;border-radius:10px;cursor:pointer;font-weight:600;">
                    ✖ Cancelar
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.onclick = ev => { if(ev.target===modal) modal.remove(); };
    setTimeout(()=>document.getElementById('pago-monto')?.focus(), 80);
}

async function confirmarPago(turnoId) {
    const monto  = document.getElementById('pago-monto')?.value;
    const metodo = document.getElementById('pago-metodo')?.value || 'efectivo';
    if (!monto || parseFloat(monto) <= 0) {
        mostrarNotificacion('⚠️ Ingresá el monto cobrado', 'error');
        return;
    }
    try {
        const res = await fetch(`http://localhost:3000/api/turnos/${turnoId}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ estado: 'finalizado', monto_pagado: parseFloat(monto), metodo_pago: metodo })
        });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion('✅ Turno finalizado correctamente');
            document.getElementById('modal-pago').remove();
            cargarTodosLosTurnos();
        } else { mostrarNotificacion('❌ '+(data.message||'Error'),'error'); }
    } catch(e) { mostrarNotificacion('❌ Error de conexión','error'); }
}

// =====================================================
// REGISTRAR PROFESIONALES — lista + eliminar
// =====================================================
async function cargarListaProfesionalesAdmin() {
    const container = document.getElementById('lista-profesionales-admin');
    if (!container) return;
    try {
        const res = await fetch('http://localhost:3000/api/usuarios/profesionales');
        const profs = await res.json();
        if (!profs.length) {
            container.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">No hay profesionales registrados aún.</p>';
            return;
        }
        container.innerHTML = `
            <h3 style="color:#C06C84;margin:0 0 14px 0;">👩‍💼 Profesionales Registradas (${profs.length})</h3>
            <div style="display:flex;flex-direction:column;gap:10px;">
            ${profs.map(p=>`
                <div style="display:flex;align-items:center;justify-content:space-between;background:white;padding:14px 18px;border-radius:10px;border-left:3px solid #C06C84;box-shadow:0 1px 6px rgba(0,0,0,0.07);">
                    <div>
                        <strong style="color:#333;">${p.nombre}</strong>
                        <small style="color:#888;display:block;">📧 ${p.email||'N/A'} &nbsp;📞 ${p.telefono||'N/A'}</small>
                    </div>
                    <button onclick="eliminarProfesional(${p.id},'${p.nombre.replace(/'/g,"\\'")}')"
                            style="background:#dc3545;color:white;padding:7px 13px;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-size:0.85rem;">
                        🗑️ Eliminar
                    </button>
                </div>`).join('')}
            </div>`;
    } catch(e) { container.innerHTML = '<p style="color:#dc3545;">❌ Error al cargar</p>'; }
}

async function eliminarProfesional(id, nombre) {
    if (!confirm(`¿Eliminar a "${nombre}"?\nEsto eliminará también sus horarios y disponibilidad.`)) return;
    try {
        const res = await fetch(`http://localhost:3000/api/usuarios/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion(`🗑️ "${nombre}" eliminada`);
            cargarListaProfesionalesAdmin();
        } else { mostrarNotificacion('❌ '+(data.message||'Error'),'error'); }
    } catch(e) { mostrarNotificacion('❌ Error de conexión','error'); }
}
