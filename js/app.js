// ==========================================
// app.js - Gestión de la Interfaz y Servicios
// ==========================================

// 1. CONFIGURACIÓN DE URL (Usa la variable de index.html)

const API_BASE = window.API_BASE; 
const URL_BASE = window.API_BASE;

// 2. VARIABLES GLOBALES
let servicios = [];
let _calendario_mes_actual = new Date();
let _calendario_dias_seleccionados = {};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Aplicación iniciada conectando a:", URL_BASE);
    const usuario = obtenerUsuarioActual();
    
    if (usuario) {
        // Si hay usuario, mostramos la App
        document.getElementById('main-app').style.display = 'block';
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('user-name').textContent = usuario.nombre;
        
        await cargarDatosDesdeAPI();
        
        // Si tienes la función de estadísticas en roles-funciones.js, la llama
        if (usuario.rol === 'admin' && typeof cargarEstadisticas === 'function') {
            cargarEstadisticas();
        }
    }
});

// --- FUNCIONES DE NAVEGACIÓN Y SESIÓN ---
function obtenerUsuarioActual() {
    const usuarioStr = localStorage.getItem('usuario');
    if (!usuarioStr) return null;
    try {
        return JSON.parse(usuarioStr);
    } catch (error) {
        localStorage.removeItem('usuario');
        return null;
    }
}

// --- CARGAR SERVICIOS DESDE EL BACKEND (CORREGIDO) ---
// --- CARGAR SERVICIOS DESDE EL BACKEND (CORREGIDO) ---
async function cargarDatosDesdeAPI() {
    try {
        console.log("📡 Intentando cargar servicios desde:", `${URL_BASE}/servicios`);
        const res = await fetch(`${URL_BASE}/servicios`);
        const data = await res.json();

        // Si data es un array directo lo usamos, si viene en .data también
        servicios = Array.isArray(data) ? data : (data.data || []);

        console.log("✅ Servicios cargados:", servicios.length);

        renderizarServicios();
        
        // --- CORRECCIÓN CRÍTICA AQUÍ ---
        // Cambiamos 'servicio-turno' por 'servicio-select' para que coincida con tu HTML
        const selectServicio = document.getElementById('servicio-select'); 
        
        if (selectServicio) {
            llenarSelectServicios(selectServicio);
        } else {
            console.warn("⚠️ No se encontró el elemento 'servicio-select' en el HTML");
        }
    
    } catch (error) {
        console.error("❌ Error al cargar servicios:", error);
    }
}

// FUNCIÓN NUEVA: Esta es la que hace que aparezcan en la tarjeta de agendar
function llenarSelectServicios(select) {
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleccionar servicio(s)...</option>';
    servicios.forEach(s => {
        
        if (s.activo !== false) { 
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = `${s.nombre} - $${s.precio}`;
            select.appendChild(option);
        }
    });
    console.log("🎯 Desplegable de servicios actualizado con éxito");
}

// --- REGISTRO DE PROFESIONALES / CAJA (ADMIN) ---
document.getElementById('form-registro-profesional')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = e.target.querySelector('button[type="submit"]');
    const rol = document.getElementById('prof-rol')?.value || 'profesional';
    const datos = {
        nombre: document.getElementById('prof-nombre').value.trim(),
        email: document.getElementById('prof-email').value.trim(),
        password: rol === 'recepcionista' ? document.getElementById('prof-password-recepcionista')?.value : undefined,
        telefono: document.getElementById('prof-telefono').value.trim(),
        rol: rol,
        servicios: rol === 'profesional'
            ? Array.from(document.getElementById('prof-servicios').selectedOptions).map(opt => parseInt(opt.value))
            : [],
        porcentaje_retiro: rol === 'profesional'
            ? parseFloat(document.getElementById('prof-porcentaje')?.value) || 70
            : undefined
    };

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const response = await fetch(`${URL_BASE}/usuarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        if (data.success) {
            alert(`✅ ${rol === 'recepcionista' ? 'Usuario de caja' : 'Profesional'} registrado con éxito`);
            e.target.reset();
            if (typeof llenarSelectServiciosRegistro === 'function') llenarSelectServiciosRegistro();
            else cargarListaProfesionalesAdmin();
        } else {
            alert('❌ ' + (data.message || 'Error al registrar'));
        }
    } catch (error) {
        alert('❌ Error de conexión con el servidor');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Registrar';
    }
});

// Muestra u oculta el selector de servicios según el tipo de usuario
function toggleRolUsuario() {
    const rol = document.getElementById('prof-rol')?.value;
    const grupo = document.getElementById('prof-servicios-grupo');
    const pctGrupo = document.getElementById('prof-porcentaje-grupo');
    const passGrupo = document.getElementById('prof-password-grupo');
    if (grupo) grupo.style.display = (rol === 'recepcionista') ? 'none' : 'block';
    if (pctGrupo) pctGrupo.style.display = (rol === 'recepcionista') ? 'none' : 'block';
    if (passGrupo) passGrupo.style.display = (rol === 'recepcionista') ? 'block' : 'none';
}

// Nota: Las funciones de calendario y edición de precios siguen igual, 
// asegúrate de que usen `${URL_BASE}/...` para sus fetch.

function renderizarServicios() {
    const grid = document.getElementById('servicios-grid');
    if (!grid) return;
    const usuario = obtenerUsuarioActual();
    const puedeAgendar = usuario && ['admin', 'cliente', 'profesional', 'recepcionista'].includes(usuario.rol);
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
                <div class="servicio-whatsapp"><button class="btn-whatsapp-mini" onclick="reservarPorWhatsApp(${s.id})">📲 WhatsApp</button></div>
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
        const r = await fetch(`${API_BASE}/servicios/todos`);
        if (r.ok) {
            todosLosServicios = await r.json();
        } else {
            // El server no tiene el endpoint /todos aún — cargar todos igualmente
            const r2 = await fetch(`${API_BASE}/servicios`);
            if (r2.ok) todosLosServicios = await r2.json();
        }
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
        const res = await fetch(`${API_BASE}/servicios`, {
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
    const activar = String(activoActual) === '0';
    const accion = activar ? 'activar' : 'pausar';
    if (!confirm(`¿Querés ${accion} este servicio?\n${activar ? 'Volverá a ser visible para agendar turnos.' : 'No aparecerá en el formulario de turnos.'}`)) return;
    try {
        // Leer campos actuales del formulario para que el PUT no rechace por "sin campos"
        const nombre    = document.getElementById(`edit-nombre-${id}`)?.value?.trim();
        const precio    = document.getElementById(`edit-precio-${id}`)?.value;
        const desc      = document.getElementById(`edit-desc-${id}`)?.value?.trim();
        const imagen    = document.getElementById(`edit-imagen-${id}`)?.value?.trim();
        const body = { activo: activar };
        if (nombre)  body.nombre      = nombre;
        if (precio)  body.precio      = parseFloat(precio);
        if (desc)    body.descripcion = desc;
        if (imagen)  body.imagen      = imagen;

        const res = await fetch(`${API_BASE}/servicios/${id}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success || res.ok) {
            mostrarNotificacion(activar ? '✅ Servicio activado' : '⏸ Servicio pausado');
            await cargarDatosDesdeAPI();
            await cargarEditorPrecios();
        } else { mostrarNotificacion('❌ '+(data.message||data.error||'Error al actualizar'),'error'); }
    } catch(e) { mostrarNotificacion('❌ Error de conexión','error'); }
}

// ── Eliminar servicio ───────────────────────────────────────
async function eliminarServicio(id, nombre) {
    if (!confirm(`⚠️ ¿Eliminar el servicio "${nombre}"?\n\nEsto es permanente. Si tiene turnos próximos, primero pausalo.`)) return;
    try {
        const res = await fetch(`${API_BASE}/servicios/${id}`, { method: 'DELETE' });
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
        const res = await fetch(`${API_BASE}/servicios/${id}`, {
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

    if (usuario.rol === 'admin' || usuario.rol === 'recepcionista') {
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
            <p><strong>⚙️ Gestión:</strong> Elegí un profesional para ver y editar sus horarios.</p>
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
        const res = await fetch(`${API_BASE}/usuarios/profesionales`);
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
        const res = await fetch(`${API_BASE}/disponibilidad_completa/${profesionalId}`);
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
        const res = await fetch(`${API_BASE}/disponibilidad/guardar-directas`, {
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
        const res = await fetch(`${API_BASE}/disponibilidad_completa/${profesionalId}`);
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
        const res = await fetch(`${API_BASE}/disponibilidad/eliminar-fecha`, {
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
            <p><strong>⚙️ Gestión:</strong> Elegí un profesional para ver y editar sus horarios.</p>
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
        const res = await fetch(`${API_BASE}/usuarios/profesionales`);
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
        const res   = await fetch(`${API_BASE}/disponibilidad_completa/${profesionalId}`);
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
        const res  = await fetch(`${API_BASE}/disponibilidad`, {
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
        const resTurnos = await fetch(`${API_BASE}/turnos/cliente/${usuario.id}`);
        const turnos = await resTurnos.json();

        // Obtener horarios disponibles de todos los profesionales
        const resProfs = await fetch(`${API_BASE}/usuarios/profesionales`);
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
            const resDisp = await fetch(`${API_BASE}/disponibilidad_completa/${prof.id}`);
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
                    💡 Elegí un servicio debajo y tocá "<strong>Agendar nuevo turno</strong>" para reservar
                </p>
            </div>
        `;

        // ===== SECCIÓN 2: TURNOS AGENDADOS / CITAS DE CLIENTES =====
        const esGestor = (usuario.rol === 'admin' || usuario.rol === 'recepcionista');

        if (esGestor) {
            // Admin y recepcionista: todas las citas de los clientes
            const resTodos = await fetch(`${API_BASE}/turnos/todos`);
            const turnosTodos = await resTodos.json();

            html += `
                <div style="background:white;padding:20px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.08);border-left:4px solid #4CAF50;margin-top:25px;">
                    <h3 style="color:#555;margin-top:0;">👥 Citas de Clientes <span style="color:#888;font-size:0.85rem;font-weight:normal;">(${Array.isArray(turnosTodos)?turnosTodos.length:0} turnos)</span></h3>
            `;

            if (!Array.isArray(turnosTodos) || turnosTodos.length === 0) {
                html += `<p style="color:#888;text-align:center;padding:20px;">📭 Aún no hay citas agendadas</p>`;
            } else {
                const porProf = {};
                turnosTodos.forEach(t => {
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
            }
            html += `</div>`;
        } else {
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
        }

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
            const resDisp = await fetch(`${API_BASE}/disponibilidad_completa/${usuario.id}`);
            disponibilidad = await resDisp.json();
        }

        // Turnos: admin ve todos, profesional ve los suyos
        let turnos = [];
        if (esAdmin) {
            const r = await fetch(`${API_BASE}/turnos/todos`);
            turnos = await r.json();
        } else {
            const resTurnos = await fetch(`${API_BASE}/turnos/profesional/${usuario.id}`);
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
        const res = await fetch(`${API_BASE}/usuarios/profesionales`);
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
        const res = await fetch(`${API_BASE}/turnos/${turnoId}`);
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
    const res = await fetch(`${API_BASE}/servicios`);
    const servicios = await res.json();
    select.innerHTML = '<option value="">Seleccionar...</option>' + servicios.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('');
    select.onchange = async (e) => { await cargarProfesionalesModal(e.target.value); };
}

async function cargarProfesionalesModal(servicioId) {
    const select = document.getElementById('edit-profesional-select');
    if (!servicioId || !select) return;
    const res = await fetch(`${API_BASE}/profesionales/servicio/${servicioId}`);
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
        const resDisp = await fetch(`${API_BASE}/disponibilidad/${profesionalId}/${diaSemana}`);
        const horariosDisp = await resDisp.json();
        const resOcup = await fetch(`${API_BASE}/horarios-ocupados/${profesionalId}/${fecha}?excluir=${turnoIdActual}`);
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
        const res = await fetch(`${API_BASE}/turnos/${turnoId}`, {
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
        const res = await fetch(`${API_BASE}/turnos/${turnoId}`, { method: 'DELETE' });
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
    select.innerHTML = '<option value="">Seleccionar servicio(s)...</option>' + 
        servicios.map(s => `<option value="${s.id}">${s.nombre} - $${s.precio}</option>`).join('');
    select.onchange = () => {
        const ids = Array.from(select.selectedOptions).map(o => o.value).filter(v => v);
        cargarProfesionalesPorServicios(ids.length ? ids : null);
    };
}

async function cargarProfesionalesPorServicios(servicioIds) {
    const selectPro  = document.getElementById('profesional-select');
    const inputFecha = document.getElementById('turno-fecha');
    const selectHora = document.getElementById('turno-hora');
    if (!selectPro) return;

    // Reset
    inputFecha.disabled = true;
    inputFecha.value    = '';
    selectHora.innerHTML = '<option value="">Primero seleccioná profesional...</option>';
    selectPro.disabled = true;
    selectPro.innerHTML = '<option value="">Primero seleccioná un servicio...</option>';

    if (!servicioIds || !servicioIds.length) return;

    try {
        let profesionales;
        if (servicioIds.length === 1) {
            const res = await fetch(`${API_BASE}/profesionales/servicio/${servicioIds[0]}`);
            profesionales = await res.json();
        } else {
            const res = await fetch(`${API_BASE}/profesionales/servicios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ servicios: servicioIds })
            });
            profesionales = await res.json();
        }
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
        const res = await fetch(`${API_BASE}/disponibilidad/${profesionalId}/${fecha}`);
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
        const res = await fetch(`${API_BASE}/disponibilidad/rango/${profesionalId}`);
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
    const clienteFechaNac = (document.getElementById('cliente-fecha-nacimiento')?.value || '').trim();
    const selectServ   = document.getElementById('servicio-select');
    const servicioIdsArr = Array.from(selectServ.selectedOptions).map(o => o.value).filter(v => v).map(Number);
    const profesionalId = document.getElementById('profesional-select').value;
    const fecha = document.getElementById('turno-fecha').value;
    const hora  = document.getElementById('turno-hora').value;
    if (!clienteNombre) { mostrarNotificacion('⚠️ Ingresá el Nombre Completo','error'); document.getElementById('cliente-nombre')?.focus(); return; }
    if (!servicioIdsArr.length || !profesionalId || !fecha || !hora) { mostrarNotificacion('⚠️ Completa todos los campos','error'); return; }
    try {
        const res = await fetch(`${API_BASE}/turnos`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ cliente_id: parseInt(usuario.id), cliente_nombre: clienteNombre,
                cliente_email: clienteEmail, cliente_telefono: clienteTelefono,
                cliente_fecha_nacimiento: clienteFechaNac, profesional_id: parseInt(profesionalId),
                servicios: servicioIdsArr, fecha, hora_inicio: hora+':00' })
        });
        const data = await res.json();
        if (data.success) {
            const sNom = Array.from(selectServ.selectedOptions).map(o => o.text).join(', ');
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
    if (!obtenerUsuarioActual()) { mostrarLoginVisitante(); return; }
    showSection('mis-turnos-cliente');
    const form = document.getElementById('form-turno');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!id) return;
    const select = document.getElementById('servicio-select');
    if (select) {
        Array.from(select.options).forEach(o => { o.selected = String(o.value) === String(id); });
        cargarProfesionalesPorServicios([id]);
    }
}

// ==========================================
// WHATSAPP — RESERVA DIRECTA Y ASISTENTE
// ==========================================

let _whatsappLocal = null; // número internacional del local, cacheado

// Obtiene el número de WhatsApp del local desde la config pública (formato internacional para wa.me)
async function obtenerWhatsappLocal() {
    if (_whatsappLocal) return _whatsappLocal;
    try {
        const res = await fetch(`${API_BASE}/caja/config/public`);
        if (!res.ok) return null;
        const cfg = await res.json();
        const tel = (cfg.local_telefono || '').replace(/[^\d]/g, '');
        if (!tel) return null;
        // Normalizar a formato internacional:
        //  - "011..." o "0..." → quitar el 0 y usar 54 + 9 (celular Argentina)
        //  - ya empieza con 54 → dejar igual
        let num = tel;
        if (num.startsWith('549')) { _whatsappLocal = num; return num; }
        if (num.startsWith('54')) { _whatsappLocal = num; return num; }
        if (num.startsWith('0')) num = num.slice(1);
        num = '549' + num;
        _whatsappLocal = num;
        return num;
    } catch (e) {
        return null;
    }
}

// Abre WhatsApp con un mensaje preformado para preguntar por un servicio
async function reservarPorWhatsApp(servicioId) {
    const num = await obtenerWhatsappLocal();
    if (!num) { mostrarNotificacion('⚠️ Configurá el teléfono del local en Caja → config', 'error'); return; }
    const s = servicios.find(x => String(x.id) === String(servicioId));
    const msj = encodeURIComponent(`Hola! Me gustaría hacer una reserva en *CHAMAS SPA*.\n💆 Servicio: ${s ? s.nombre : ''}\n📅 ¿Tenés turnos disponibles?`);
    window.open(`https://wa.me/${num}?text=${msj}`, '_blank');
}

// Asistente conversacional de reserva (paso a paso, estilo chat)
let _asistenteEstado = null; // estado de la conversación

function abrirAsistenteWhatsApp() {
    if (!obtenerUsuarioActual()) { mostrarLoginVisitante(); return; }
    document.getElementById('modal-asistente')?.remove();
    const serviciosActivos = servicios.filter(s => s.activo !== false);
    if (!serviciosActivos.length) { mostrarNotificacion('No hay servicios disponibles', 'error'); return; }

    _asistenteEstado = { paso: 'servicio' };
    const modal = document.createElement('div');
    modal.id = 'modal-asistente';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;max-width:420px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden;display:flex;flex-direction:column;height:560px;">
            <div style="background:linear-gradient(135deg,#25D366,#1ebea5);color:white;padding:14px 18px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.4rem;">📲</span>
                <div>
                    <strong style="display:block;">¿Cómo querés reservar?</strong>
                    <small style="opacity:0.9;">Asistente de reserva · CHAMAS SPA</small>
                </div>
                <button onclick="document.getElementById('modal-asistente').remove();" style="margin-left:auto;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-weight:700;">✖</button>
            </div>
            <div id="asistente-burbujas" style="flex:1;overflow-y:auto;padding:16px;background:#efe7dd;display:flex;flex-direction:column;gap:8px;"></div>
            <div id="asistente-input" style="padding:12px;background:white;border-top:1px solid #eee;"></div>
        </div>`;
    document.body.appendChild(modal);
    modal.onclick = ev => { if (ev.target === modal) modal.remove(); };
    _asistenteBurbuja('bot', '🙋‍♀️ ¡Hola! Soy el asistente de CHAMAS. Voy a ayudarte a reservar tu turno en pocos pasos. ¿Qué servicio querés?');
    // Mostrar servicios como opciones
    _asistenteBurbuja('opciones', serviciosActivos.map(s =>
        `<button onclick="asistenteElegirServicio(${s.id})" style="display:block;width:100%;padding:11px 14px;margin:4px 0;border:2px solid #25D366;background:white;color:#333;border-radius:10px;cursor:pointer;font-weight:600;text-align:left;">💆 ${s.nombre} · <strong>$${s.precio.toLocaleString()}</strong></button>`).join(''));
}

function asistenteBurbujaDom(tipo, contenidoHtml) {
    const cont = document.getElementById('asistente-burbujas');
    if (!cont) return;
    const d = document.createElement('div');
    if (tipo === 'bot' || tipo === 'opciones') {
        d.style.cssText = 'align-self:flex-start;background:#fff;border-radius:14px 14px 14px 4px;padding:10px 14px;max-width:85%;font-size:0.9rem;color:#333;box-shadow:0 1px 2px rgba(0,0,0,0.08);';
    } else {
        d.style.cssText = 'align-self:flex-end;background:#dcf8c6;border-radius:14px 14px 4px 14px;padding:10px 14px;max-width:85%;font-size:0.9rem;color:#333;';
    }
    d.innerHTML = contenidoHtml;
    cont.appendChild(d);
    cont.scrollTop = cont.scrollHeight;
}

function _asistenteBurbuja(tipo, html) { asistenteBurbujaDom(tipo, html); }

async function asistenteElegirServicio(id) {
    const s = servicios.find(x => String(x.id) === String(id));
    if (!s) return;
    _asistenteEstado.servicio = s;
    _asistenteBurbuja('user', `💆 ${s.nombre} ($${s.precio.toLocaleString()})`);
    _asistenteBurbuja('bot', '¿Con qué profesional querés el turno?');
    document.getElementById('asistente-input').innerHTML = '<p style="color:#888;text-align:center;font-size:0.85rem;">⏳ Cargando profesionales...</p>';
    try {
        const res = await fetch(`${API_BASE}/profesionales/servicio/${id}`);
        const profs = await res.json();
        document.getElementById('asistente-input').innerHTML = '';
        if (!profs.length) { _asistenteBurbuja('bot', '😕 No hay profesionales para ese servicio por ahora.'); return; }
        _asistenteBurbuja('opciones', profs.map(p =>
            `<button onclick="asistenteElegirProfesional(${p.id})" style="display:block;width:100%;padding:11px 14px;margin:4px 0;border:2px solid #25D366;background:white;color:#333;border-radius:10px;cursor:pointer;font-weight:600;text-align:left;">👩‍💼 ${p.nombre}</button>`).join(''));
    } catch (e) {
        document.getElementById('asistente-input').innerHTML = '';
        _asistenteBurbuja('bot', '😕 Error al cargar profesionales.');
    }
}

async function asistenteElegirProfesional(id) {
    const res = await fetch(`${API_BASE}/usuarios/profesionales`);
    const all = await res.json();
    const p = all.find(x => String(x.id) === String(id));
    if (!p) return;
    _asistenteEstado.profesional = p;
    _asistenteBurbuja('user', `👩‍💼 ${p.nombre}`);
    _asistenteBurbuja('bot', '¿Para qué día? Elegí una fecha disponible:');
    document.getElementById('asistente-input').innerHTML = '<p style="color:#888;text-align:center;font-size:0.85rem;">⏳ Cargando fechas...</p>';
    try {
        const rango = await fetch(`${API_BASE}/disponibilidad/rango/${id}`);
        const fechas = await rango.json(); // array YYYY-MM-DD
        document.getElementById('asistente-input').innerHTML = '';
        if (!fechas.length) { _asistenteBurbuja('bot', '😕 No hay fechas disponibles para esta profesional. Probá con otra.'); return; }
        _asistenteBurbuja('opciones', fechas.slice(0, 10).map(f => {
            const d = new Date(f + 'T00:00:00');
            const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            return `<button onclick="asistenteElegirFecha('${f}')" style="display:block;width:100%;padding:11px 14px;margin:4px 0;border:2px solid #25D366;background:white;color:#333;border-radius:10px;cursor:pointer;font-weight:600;text-align:left;">📅 ${label}</button>`;
        }).join('') + (fechas.length > 10 ? `<p style="color:#888;font-size:0.8rem;text-align:center;margin-top:6px;">y ${fechas.length - 10} más días disponibles</p>` : ''));
    } catch (e) {
        document.getElementById('asistente-input').innerHTML = '';
        _asistenteBurbuja('bot', '😕 Error al cargar fechas.');
    }
}

async function asistenteElegirFecha(fecha) {
    _asistenteEstado.fecha = fecha;
    const d = new Date(fecha + 'T00:00:00');
    _asistenteBurbuja('user', `📅 ${d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`);
    _asistenteBurbuja('bot', '¿A qué hora?');
    document.getElementById('asistente-input').innerHTML = '<p style="color:#888;text-align:center;font-size:0.85rem;">⏳ Cargando horarios...</p>';
    try {
        const res = await fetch(`${API_BASE}/disponibilidad/${_asistenteEstado.profesional.id}/${fecha}`);
        const horas = await res.json(); // array de horas "HH:MM" o {hora}
        document.getElementById('asistente-input').innerHTML = '';
        const lista = (Array.isArray(horas) ? horas : []).map(h => {
            const raw = typeof h === 'string' ? h : (h.hora || h.hora_inicio || '');
            return raw.length > 5 ? raw.substring(0, 5) : raw;
        });
        if (!lista.length) { _asistenteBurbuja('bot', '😕 No hay horarios libres ese día. Elegí otra fecha.'); return; }
        _asistenteBurbuja('opciones', lista.map(h =>
            `<button onclick="asistenteElegirHora('${h}')" style="display:inline-block;padding:10px 14px;margin:4px;border:2px solid #25D366;background:white;color:#333;border-radius:10px;cursor:pointer;font-weight:700;">🕐 ${h}</button>`).join(''));
    } catch (e) {
        document.getElementById('asistente-input').innerHTML = '';
        _asistenteBurbuja('bot', '😕 Error al cargar horarios.');
    }
}

async function asistenteElegirHora(hora) {
    _asistenteEstado.hora = hora;
    _asistenteBurbuja('user', `🕐 ${hora}`);
    _asistenteBurbuja('bot', '¡Perfecto! ¿Cuál es tu nombre?');
    document.getElementById('asistente-input').innerHTML =
        `<input type="text" id="asistente-nombre" placeholder="Ej: María González" style="width:100%;padding:12px;border:2px solid #25D366;border-radius:10px;box-sizing:border-box;font-size:1rem;">
         <button onclick="asistentePasoNombre()" style="width:100%;margin-top:8px;background:#25D366;color:white;padding:12px;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:1rem;">Siguiente →</button>`;
    setTimeout(() => document.getElementById('asistente-nombre')?.focus(), 80);
}

function asistentePasoNombre() {
    const nombre = document.getElementById('asistente-nombre')?.value.trim();
    if (!nombre) { mostrarNotificacion('⚠️ Ingresá tu nombre', 'error'); return; }
    _asistenteEstado.clienteNombre = nombre;
    _asistenteBurbuja('user', `👤 ${nombre}`);
    _asistenteBurbuja('bot', 'Y tu teléfono (para confirmarte por WhatsApp):');
    document.getElementById('asistente-input').innerHTML =
        `<input type="tel" id="asistente-telefono" placeholder="Ej: 3865437108" style="width:100%;padding:12px;border:2px solid #25D366;border-radius:10px;box-sizing:border-box;font-size:1rem;">
         <button onclick="asistentePasoTelefono()" style="width:100%;margin-top:8px;background:#25D366;color:white;padding:12px;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:1rem;">Finalizar →</button>`;
    setTimeout(() => document.getElementById('asistente-telefono')?.focus(), 80);
}

async function asistentePasoTelefono() {
    const telefono = document.getElementById('asistente-telefono')?.value.trim();
    if (!telefono) { mostrarNotificacion('⚠️ Ingresá tu teléfono', 'error'); return; }
    _asistenteEstado.clienteTelefono = telefono;
    _asistenteBurbuja('user', `📞 ${telefono}`);
    const e = _asistenteEstado;
    const usuario = obtenerUsuarioActual();
    _asistenteBurbuja('bot', `⏳ Confirmando tu turno...`);

    try {
        const res = await fetch(`${API_BASE}/turnos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cliente_id: usuario ? parseInt(usuario.id) : null,
                cliente_nombre: e.clienteNombre,
                cliente_telefono: e.clienteTelefono,
                profesional_id: parseInt(e.profesional.id),
                servicios: [parseInt(e.servicio.id)],
                fecha: e.fecha,
                hora_inicio: e.hora + ':00'
            })
        });
        const data = await res.json();
        if (data.success) {
            _asistenteBurbuja('user', `✅ Turno confirmado para ${e.profesional.nombre} el ${e.fecha} a las ${e.hora}. ¡Gracias ${e.clienteNombre}!`);
            const num = await obtenerWhatsappLocal();
            document.getElementById('asistente-input').innerHTML = num
                ? `<p style="color:#555;font-size:0.85rem;text-align:center;margin-bottom:8px;">📲 Podés enviarnos la confirmación por WhatsApp:</p>
                   <a href="https://wa.me/${num}?text=${encodeURIComponent(`Hola! Ya reservé: ${e.servicio.nombre} para el ${e.fecha} a las ${e.hora}. Soy ${e.clienteNombre}`)}" target="_blank" style="display:block;background:#25D366;color:white;text-align:center;padding:13px;border-radius:10px;text-decoration:none;font-weight:700;">📲 Enviar por WhatsApp</a>`
                : '<p style="color:#555;font-size:0.85rem;text-align:center;">✅ ¡Turno confirmado!</p>';
            if (usuario) { setTimeout(() => { cargarTurnosCaja(); if (document.getElementById('caja').style.display !== 'none') cargarEstadoCaja(); }, 400); }
        } else {
            _asistenteBurbuja('bot', '😕 ' + (data.message || 'No se pudo reservar. Probá con otro horario.'));
            document.getElementById('asistente-input').innerHTML = '';
        }
    } catch (e) {
        _asistenteBurbuja('bot', '😕 Error de conexión al reservar.');
        document.getElementById('asistente-input').innerHTML = '';
    }
}

// ==========================================
// ESTADÍSTICAS (ADMIN)
// ==========================================
async function cargarEstadisticas() {
    try {
        const res = await fetch(`${API_BASE}/estadisticas`);
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
        const rp=await fetch(`${API_BASE}/usuarios/profesionales`);
        const ps=await rp.json();
        const sel=document.getElementById('g-prof');
        ps.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.nombre;sel.appendChild(o);});
    } catch(e){}
    await calcG();
}

// =====================================================
// showSection — función única definitiva
// =====================================================
function mostrarEditorPrecios() {
    document.getElementById('editar-precios-panel').style.display = 'block';
    cargarEditorPrecios();
    document.getElementById('editar-precios-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function ocultarEditorPrecios() {
    document.getElementById('editar-precios-panel').style.display = 'none';
}

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

    const ediPreciosPanel = document.getElementById('editar-precios-panel');
    if (ediPreciosPanel) ediPreciosPanel.style.display = 'none';

    const usuario = obtenerUsuarioActual();
    if (!usuario) return;

    if (sectionId === 'admin') {
        llenarSelectServiciosRegistro();
        cargarListaProfesionalesAdmin();
        cargarEstadisticas();
    }
    if (sectionId === 'gestionar-horarios')      cargarGestionHorarios();

    if (sectionId === 'caja') {
        cargarEstadoCaja();
        cargarTurnosCaja();
        cargarRecordatorios();
        cargarRetiros();
        if (!window._intervaloRecordatorios) {
            window._intervaloRecordatorios = setInterval(() => {
                if (document.getElementById('caja') && document.getElementById('caja').style.display !== 'none') {
                    cargarRecordatorios();
                }
            }, 60000);
        }
    } else {
        if (window._intervaloRecordatorios) { clearInterval(window._intervaloRecordatorios); window._intervaloRecordatorios = null; }
    }

    if (sectionId === 'mis-turnos-cliente') {
        cargarTurnosCliente();
        cargarClientesFrecuentes();
        if (usuario.rol === 'admin') {
            cargarTodosLosTurnos();
            cargarProfesionalesFiltro();
        }
    }

    if (sectionId === 'cumpleanos') {
        cargarCumpleanos();
        cargarCupones();
        llenarSelectCupones();
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
        let url=`${API_BASE}/turnos/todos?`;
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
    const usuario = obtenerUsuarioActual();
    const esAdmin = !!(usuario && usuario.rol === 'admin');
    try {
        const profesionalId = document.getElementById('filtro-profesional')?.value || '';
        const fechaDesde = document.getElementById('filtro-fecha-desde')?.value || '';
        const fechaHasta = document.getElementById('filtro-fecha-hasta')?.value || '';
        let url = `${API_BASE}/turnos/todos`;
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
        const accionesHeader = esAdmin ? '<th style="padding:10px 8px;text-align:center;">Acciones</th>' : '';
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
                    ${accionesHeader}
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
                        ${esAdmin ? `<td style="padding:8px;white-space:nowrap;">
                            <div style="display:flex;gap:4px;justify-content:center;">
                                <button title="Editar" onclick="abrirModalEditar(${t.id})"
                                    style="background:#4CAF50;color:white;padding:7px 10px;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;">✏️</button>
                                <button title="Finalizar" onclick="abrirModalPago(${t.id},'${(t.cliente_nombre||t.cliente||'').replace(/'/g,"\\'")}','${(t.servicio||'').replace(/'/g,"\\'")}','${(t.hora_inicio||t.hora||'').substring(0,5)}','${t.fecha?t.fecha.split('T')[0]:''}')"
                                    style="background:#28a745;color:white;padding:7px 10px;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;">💳</button>
                                <button title="Eliminar" onclick="eliminarTurno(${t.id})"
                                    style="background:#dc3545;color:white;padding:7px 10px;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;">🗑️</button>
                            </div>
                        </td>` : ''}
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
        const res = await fetch(`${API_BASE}/turnos/${turnoId}`, {
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
        const res = await fetch(`${API_BASE}/usuarios/profesionales`);
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
                    <div style="display:flex;gap:8px;">
                    <button onclick="abrirModalEditarProfesional(${p.id})"
                            style="background:#f39c12;color:white;padding:7px 13px;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-size:0.85rem;">
                        ✏️ Editar
                    </button>
                    <button onclick="eliminarProfesional(${p.id},'${p.nombre.replace(/'/g,"\\'")}')"
                            style="background:#dc3545;color:white;padding:7px 13px;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-size:0.85rem;">
                        🗑️ Eliminar
                    </button>
                    </div>
                </div>`).join('')}
            </div>`;
    } catch(e) { container.innerHTML = '<p style="color:#dc3545;">❌ Error al cargar</p>'; }
}

// Modal para editar un profesional existente
async function abrirModalEditarProfesional(id) {
    document.getElementById('modal-editar-profesional')?.remove();
    try {
        const res = await fetch(`${API_BASE}/usuarios/${id}`);
        const data = await res.json();
        if (!data.success) { mostrarNotificacion('❌ ' + (data.message || 'Error'), 'error'); return; }
        const p = data.usuario;

        const modal = document.createElement('div');
        modal.id = 'modal-editar-profesional';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
        modal.innerHTML = `
            <div style="background:white;border-radius:20px;padding:30px;max-width:440px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;">
                <h3 style="color:#C06C84;margin:0 0 18px 0;">✏️ Editar Profesional</h3>
                <div style="display:flex;flex-direction:column;gap:14px;">
                    <div>
                        <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">👤 Nombre</label>
                        <input type="text" id="ep-nombre" value="${(p.nombre||'').replace(/"/g,'&quot;')}" required
                               style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.95rem;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">📧 Email</label>
                        <input type="email" id="ep-email" value="${(p.email||'').replace(/"/g,'&quot;')}" required
                               style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.95rem;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">📞 Teléfono</label>
                        <input type="tel" id="ep-telefono" value="${(p.telefono||'').replace(/"/g,'&quot;')}"
                               style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.95rem;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">💆 Servicios asignados (Ctrl/Cmd para varios)</label>
                        <select id="ep-servicios" multiple style="width:100%;min-height:120px;padding:8px;border:2px solid #e0e0e0;border-radius:9px;box-sizing:border-box;">
                            ${servicios.map(s => `<option value="${s.id}" ${(p.servicios||[]).includes(s.id) ? 'selected' : ''}>${s.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">💸 Porcentaje de retiro de la profesional (%)</label>
                        <input type="number" id="ep-porcentaje" value="${p.porcentaje_retiro ?? 70}" min="0" max="100" step="1"
                               style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.95rem;box-sizing:border-box;">
                    </div>
                </div>
                <div style="display:flex;gap:10px;margin-top:22px;">
                    <button onclick="guardarProfesional(${id})"
                            style="flex:1;background:#28a745;color:white;padding:13px;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:1rem;">✅ Guardar</button>
                    <button onclick="document.getElementById('modal-editar-profesional').remove();"
                            style="flex:1;background:#f0f0f0;color:#555;padding:13px;border:none;border-radius:10px;cursor:pointer;font-weight:600;">✖ Cancelar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.onclick = ev => { if (ev.target === modal) modal.remove(); };
    } catch (e) {
        mostrarNotificacion('❌ Error al cargar el profesional', 'error');
    }
}

async function guardarProfesional(id) {
    const nombre = document.getElementById('ep-nombre')?.value.trim();
    const email = document.getElementById('ep-email')?.value.trim();
    const telefono = document.getElementById('ep-telefono')?.value.trim();
    const serviciosSel = Array.from(document.getElementById('ep-servicios')?.selectedOptions || []).map(o => parseInt(o.value));

    if (!nombre || !email) { mostrarNotificacion('⚠️ Nombre y email son obligatorios', 'error'); return; }

    const body = { nombre, email, telefono, servicios: serviciosSel, porcentaje_retiro: parseFloat(document.getElementById('ep-porcentaje')?.value) || 0 };

    try {
        const res = await fetch(`${API_BASE}/usuarios/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('modal-editar-profesional')?.remove();
            mostrarNotificacion('✅ Profesional actualizado');
            cargarListaProfesionalesAdmin();
        } else {
            mostrarNotificacion('❌ ' + (data.message || 'Error'), 'error');
        }
    } catch (e) {
        mostrarNotificacion('❌ Error de conexión', 'error');
    }
}

async function eliminarProfesional(id, nombre) {
    if (!confirm(`¿Eliminar a "${nombre}"?\nEsto eliminará también sus horarios y disponibilidad.`)) return;
    try {
        const res = await fetch(`${API_BASE}/usuarios/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion(`🗑️ "${nombre}" eliminada`);
            cargarListaProfesionalesAdmin();
        } else { mostrarNotificacion('❌ '+(data.message||'Error'),'error'); }
    } catch(e) { mostrarNotificacion('❌ Error de conexión','error'); }
}

// ==========================================
// FUNCIONES DE TURNOS (NUEVAS)
// ==========================================

// Trae las horas ocupadas de un profesional en un día específico
async function obtenerHorasOcupadasAPI(profesionalId, fecha) {
    try {
        const response = await fetch(`${API_URL}/turnos?profesionalId=${profesionalId}&fecha=${fecha}`);
        const turnosOcupados = await response.json();
        // Devolvemos un array de horas: ["08:00", "12:00"]
        return Array.isArray(turnosOcupados) ? turnosOcupados.map(t => t.hora) : [];
    } catch (error) {
        console.error('❌ Error al obtener turnos ocupados:', error);
        return [];
    }
}
// --- FILTRADO DE HORARIOS DISPONIBLES ---
async function actualizarHorariosEnTarjeta(profesionalId, fecha) {
    // 1. Buscamos las horas que YA están reservadas
    const ocupadas = await obtenerHorasOcupadasAPI(profesionalId, fecha);
    
    // 2. Definimos las horas que el profesional atiende (ajusta esto según tu necesidad)
    const horasBase = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
    
    // 3. FILTRO: Solo dejamos las que NO están en la lista de ocupadas
    const disponibles = horasBase.filter(h => !ocupadas.includes(h));
    
    // 4. Buscamos el lugar donde se muestran las horas en tu HTML
    // NOTA: Revisa que el ID 'contenedor-horas' exista en tu index.html
    const contenedor = document.getElementById('edit-turno-hora') || document.getElementById('contenedor-horas');
    
    if (contenedor) {
        contenedor.innerHTML = '<option value="">Seleccionar hora...</option>' + 
            disponibles.map(h => `<option value="${h}">${h}</option>`).join('');
        console.log(`✅ Se cargaron ${disponibles.length} horarios libres para la fecha ${fecha}`);
    }
}

// ==========================================
// CONEXIÓN DE INTERFAZ PARA FILTRADO
// ==========================================

function conectarFiltrosDeTurnos() {
    const selectProfe = document.getElementById('servicio-profesional');
    const inputFecha = document.getElementById('servicio-fecha');

    if (selectProfe && inputFecha) {
        // Cada vez que cambie el profesional o la fecha, refrescamos las horas
        const actualizar = async () => {
            const profesionalId = selectProfe.value;
            const fecha = inputFecha.value;

            if (profesionalId && fecha) {
                console.log(`🔍 Filtrando horas para Profe: ${profesionalId} en Fecha: ${fecha}`);
                
                // Llamamos a la función que ya agregaste antes
                // Pero corregimos el ID del contenedor a 'servicio-turno-hora'
                const ocupadas = await obtenerHorasOcupadasAPI(profesionalId, fecha);
                const horasBase = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
                const disponibles = horasBase.filter(h => !ocupadas.includes(h));

                const selectHora = document.getElementById('servicio-turno-hora');
                if (selectHora) {
                    selectHora.innerHTML = '<option value="">Seleccionar hora...</option>' + 
                        disponibles.map(h => `<option value="${h}">${h}</option>`).join('');
                }
            }
        };

        selectProfe.addEventListener('change', actualizar);
        inputFecha.addEventListener('change', actualizar);
    }
}

// Ejecutamos la conexión cuando carga la página
document.addEventListener('DOMContentLoaded', conectarFiltrosDeTurnos);

// --- FUNCIÓN QUIRÚRGICA DE FILTRADO ---
async function filtrarHorariosOcupados() {
    // Buscamos los elementos por los IDs que realmente usas
    const selectProfe = document.getElementById('profesional-select');
    const inputFecha = document.getElementById('fecha-turno');
    const selectHora = document.getElementById('servicio-turno-hora');

    if (!selectProfe || !inputFecha || !selectHora) {
        console.error("❌ No se encuentran los IDs en el HTML");
        return;
    }

    const profeId = selectProfe.value;
    const fecha = inputFecha.value;

    if (profeId && fecha) {
        console.log(`🔍 Filtrando para: Profe ${profeId} - Fecha ${fecha}`);
        
        // 1. Pedimos los turnos que ya existen
        const ocupados = await obtenerHorasOcupadasAPI(profeId, fecha);
        
        // 2. Tus horarios base
        const horariosBase = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];

        // 3. El filtro real: Solo lo que NO está ocupado
        const disponibles = horariosBase.filter(h => !ocupados.includes(h));

        // 4. Actualizamos el selector visualmente
        selectHora.innerHTML = '<option value="">Seleccionar hora...</option>' + 
            disponibles.map(h => `<option value="${h}">${h}</option>`).join('');
        
        console.log("✅ Horarios libres cargados:", disponibles);
    }
}

// ESTO CONECTA EL HTML CON EL FILTRO DE FORMA FORZADA
document.addEventListener('change', (e) => {
    if (e.target.id === 'profesional-select' || e.target.id === 'fecha-turno') {
        filtrarHorariosOcupados();
    }
});

// =====================================================
// 💵 MÓDULO DE CAJA — turnos del día, cobro y ticket
// =====================================================

// =============================================
// 📲 RECORDATORIOS WHATSAPP (ADMIN / CAJA)
// =============================================
async function cargarRecordatorios() {
    const cont = document.getElementById('recordatorios-lista');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#888;">⏳ Cargando recordatorios...</p>';
    try {
        const res = await fetch(`${API_BASE}/recordatorios`);
        const turnos = await res.json();
        const maniana = new Date(); maniana.setDate(maniana.getDate() + 1);
        const manianaISO = maniana.toISOString().slice(0, 10);
        const fechaRaw = t => String(t.fecha || '').split('T')[0];

        // Solo clientes con turno MAÑANA (recordatorio 1 día antes)
        const turnosManiana = Array.isArray(turnos) ? turnos.filter(t => fechaRaw(t) === manianaISO) : [];

        if (!turnosManiana.length) {
            cont.innerHTML = '<p style="color:#888;">✅ No hay clientes con turno para mañana. Los recordatorios se envían 1 día antes.</p>';
            return;
        }

        const htmlTurno = (t) => {
            const f = new Date(fechaRaw(t) + 'T00:00:00');
            const fechaLabel = (f ? f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' }) : fechaRaw(t)) + ' (MAÑANA)';
            const tel = (t.cliente_telefono || '').replace(/[^\d]/g, '');
            let waNum = tel;
            if (waNum.startsWith('549')) { } else if (waNum.startsWith('54')) { } else if (waNum.startsWith('0')) waNum = '549' + waNum.slice(1); else waNum = '549' + waNum;
            const msj = encodeURIComponent(`Hola ${t.cliente_nombre || ''}! 👋 Te recordamos tu turno en *CHAMAS SPA*:\n📅 ${fechaLabel}\n🕐 ${t.hora_inicio}\n👩‍💼 ${t.profesional}\n\n¡Te esperamos mañana! 💆‍♀️`);
            return `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #eef2e6;flex-wrap:wrap;">
                    <div style="flex:1;min-width:220px;">
                        <strong>${t.cliente_nombre || 'Sin nombre'}</strong>
                        <small style="display:block;color:#888;">${fechaLabel} · ${t.hora_inicio} · ${t.profesional}</small>
                        <small style="display:block;color:#666;">📞 ${t.cliente_telefono || 'Sin teléfono'}</small>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        ${t.recordatorio_enviado
                            ? '<span style="color:#28a745;font-size:0.85rem;font-weight:700;">✅ Enviado</span>'
                            : (waNum
                                ? `<a href="https://wa.me/${waNum}?text=${msj}" target="_blank" onclick="marcarRecordatorioEnviado(${t.id})" style="background:#25D366;color:white;padding:10px 16px;border-radius:9px;text-decoration:none;font-weight:700;font-size:0.85rem;">📲 Enviar recordatorio</a>`
                                : '<span style="color:#888;font-size:0.85rem;">Sin teléfono</span>')}
                    </div>
                </div>`;
        };

        const enviados = turnosManiana.filter(t => t.recordatorio_enviado);
        const pendientes = turnosManiana.filter(t => !t.recordatorio_enviado);

        let html = '';

        if (pendientes.length) {
            html += `<div style="background:#fff3cd;border:2px solid #f1c40f;border-radius:12px;padding:14px;margin-bottom:16px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="font-size:1.3rem;">📆</span>
                    <strong style="color:#B7950B;">CLIENTES CON TURNO MAÑANA — enviar recordatorio hoy (1 día antes):</strong>
                </div>
                ${pendientes.map(t => htmlTurno(t)).join('')}
            </div>`;
        }

        if (enviados.length) {
            html += `<div style="background:#fff;border:2px solid #ddd;border-radius:12px;padding:14px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="font-size:1.3rem;">✅</span>
                    <strong style="color:#444;">Recordatorios ya enviados (${enviados.length}):</strong>
                </div>
                ${enviados.map(t => htmlTurno(t)).join('')}
            </div>`;
        }

        cont.innerHTML = html;
    } catch (e) {
        cont.innerHTML = '<p style="color:#c0392b;">❌ Error al cargar recordatorios.</p>';
    }
}

async function marcarRecordatorioEnviado(turnoId) {
    try {
        const res = await fetch(`${API_BASE}/recordatorios/${turnoId}/enviado`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion('✅ Recordatorio marcado como enviado');
            cargarRecordatorios();
        } else {
            mostrarNotificacion('❌ No se pudo marcar', 'error');
        }
    } catch (e) {
        mostrarNotificacion('❌ Error de conexión', 'error');
    }
}

// =============================================
// 💸 RETIROS DE PROFESIONALES
// =============================================
async function cargarRetiros() {
    const cont = document.getElementById('retiros-lista');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#888;">⏳ Cargando retiros...</p>';
    try {
        const res = await fetch(`${API_BASE}/caja/retiros`);
        const data = await res.json();
        const sugerencias = Array.isArray(data.sugerencias) ? data.sugerencias : [];
        const retiros = Array.isArray(data.retiros) ? data.retiros : [];

        let html = '';

        // Retiros ya registrados
        if (retiros.length) {
            html += `<div style="margin-bottom:16px;">
                <strong style="color:#555;">✅ Retiros registrados hoy:</strong>
                <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
                ${retiros.map(r => `
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:#fdf5f8;border-left:3px solid #C06C84;border-radius:8px;padding:10px 12px;flex-wrap:wrap;">
                        <div>
                            <strong>${r.profesional_nombre}</strong>
                            <small style="display:block;color:#888;">${r.metodo_retiro === 'transferencia' ? '🏦 Transferencia' : '💵 Efectivo'} · Bruto del día: $${parseFloat(r.monto_bruto).toFixed(2)} · Retira ${parseFloat(r.porcentaje_retiro)}% · Queda en estética: $${parseFloat(r.monto_estetica).toFixed(2)}</small>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <strong style="color:#C06C84;">-$${parseFloat(r.monto_retirado).toFixed(2)}</strong>
                            <span style="background:#C06C84;color:white;padding:3px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">NO ANULABLE</span>
                        </div>
                    </div>`).join('')}
                </div>
            </div>`;
        }

        // Sugerencias (profesionales con turnos cobrados hoy que aún no retiraron)
        const retiradosIds = new Set(retiros.map(r => r.profesional_id));
        const pendientes = sugerencias.filter(s => !retiradosIds.has(s.profesional_id));
        if (pendientes.length) {
            html += `<strong style="color:#555;">💡 Profesionales con cobros de hoy (sugerencia de retiro):</strong>
                <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
                ${pendientes.map(s => {
                    const montoMax = (parseFloat(s.cobrado_hoy) * (parseFloat(s.porcentaje_retiro)||70) / 100).toFixed(2);
                    const safeNom = (s.profesional_nombre||'').replace(/'/g,"\\'");
                    return `
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:#fff8e1;border-left:3px solid #ffc107;border-radius:8px;padding:10px 12px;flex-wrap:wrap;">
                        <div>
                            <strong>${s.profesional_nombre}</strong>
                            <small style="display:block;color:#888;">Cobrado hoy: $${parseFloat(s.cobrado_hoy).toFixed(2)} · ${s.turnos_cobrados} turno(s) · Retira ${parseFloat(s.porcentaje_retiro)}% = $${montoMax}</small>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <select id="metodo-retiro-${s.profesional_id}" style="padding:8px 10px;border:2px solid #e0e0e0;border-radius:8px;font-size:0.85rem;background:white;">
                                <option value="efectivo">💵 Efectivo</option>
                                <option value="transferencia">🏦 Transferencia</option>
                            </select>
                            <button onclick="registrarRetiro(${s.profesional_id},'${safeNom}',document.getElementById('metodo-retiro-${s.profesional_id}').value)" style="background:#C06C84;color:white;padding:8px 14px;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.85rem;">💸 Registrar retiro</button>
                        </div>
                    </div>`;
                }).join('')}
                </div>`;
        }

        if (!html) {
            html = '<p style="color:#888;">✅ No hay retiros pendientes. Los retiros aparecen acá cuando una profesional tenga turnos cobrados en el día.</p>';
        }
        cont.innerHTML = html;
    } catch (e) {
        console.error('❌ Error retiros:', e);
        cont.innerHTML = '<p style="color:#dc3545;">❌ Error al cargar retiros</p>';
    }
}

async function registrarRetiro(profesionalId, nombre, metodo) {
    if (!confirm(`¿Registrar el retiro de "${nombre}" por lo cobrado hoy?\nMétodo: ${metodo === 'transferencia' ? '🏦 Transferencia' : '💵 Efectivo'}.\nSe descontará de la caja de hoy y NO podrá anularse.`)) return;
    const btn = event?.target;
    const btnText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Registrando...'; }
    try {
        const res = await fetch(`${API_BASE}/caja/retiros`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profesional_id: profesionalId, metodo })
        });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion(data.mensaje || '✅ Retiro registrado');
            cargarRetiros();
            cargarEstadoCaja();
        } else {
            mostrarNotificacion('❌ ' + (data.message || 'Error'), 'error');
        }
    } catch (e) {
        mostrarNotificacion('❌ Error de conexión', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = btnText; }
    }
}

// Carga los turnos del día para el panel de caja
// Estado de la caja del día (abierta/cerrada con totales)
async function cargarEstadoCaja() {
    const cont = document.getElementById('caja-estado');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#888;text-align:center;padding:16px;">⏳ Cargando estado de caja...</p>';
    try {
        const res = await fetch(`${API_BASE}/caja/estado`);
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        if (!data.abierta) {
            cont.innerHTML = `
                <div style="background:white;border-radius:14px;padding:22px;box-shadow:0 2px 10px rgba(0,0,0,0.06);margin-bottom:18px;border-left:4px solid #C06C84;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">
                    <div>
                        <h3 style="margin:0;color:#C06C84;">🔴 Caja Cerrada</h3>
                        <p style="margin:6px 0 0;color:#666;font-size:0.9rem;">Abrí la caja para registrar los cobros del día y poder cerrarla al final.</p>
                    </div>
                    <button onclick="abrirCajaModal()" style="background:#C06C84;color:white;padding:12px 24px;border:none;border-radius:10px;cursor:pointer;font-weight:700;">🔓 Abrir Caja</button>
                </div>`;
        } else {
            const c = data.caja;
            const totEf = parseFloat(c.total_efectivo || 0);
            const totTr = parseFloat(c.total_transferencia || 0);
            const totDb = parseFloat(c.total_debito || 0);
            const total = totEf + totTr + totDb;
            cont.innerHTML = `
                <div style="background:white;border-radius:14px;padding:22px;box-shadow:0 2px 10px rgba(0,0,0,0.06);margin-bottom:18px;border-left:4px solid #28a745;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">
                        <div>
                            <h3 style="margin:0;color:#28a745;">🟢 Caja Abierta</h3>
                            <p style="margin:6px 0 0;color:#666;font-size:0.9rem;">
                                Fondo inicial: <strong>$${c.monto_inicial ? parseFloat(c.monto_inicial).toFixed(2) : '0.00'}</strong>
                                · Cobrado hoy: <strong style="color:#28a745;">$${total.toFixed(2)}</strong>
                                ${c.cajero_nombre ? ' · 👤 ' + c.cajero_nombre : ''}
                            </p>
                        </div>
                        <button onclick="cerrarCajaModal()" style="background:#e74c3c;color:white;padding:12px 24px;border:none;border-radius:10px;cursor:pointer;font-weight:700;">🔒 Cerrar Caja</button>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:14px;">
                        <div style="background:#f9f9f9;border-radius:8px;padding:8px;text-align:center;"><small style="color:#888;">💵 Efectivo</small><br><strong>$${totEf.toFixed(2)}</strong></div>
                        <div style="background:#f9f9f9;border-radius:8px;padding:8px;text-align:center;"><small style="color:#888;">🏦 Transferencia</small><br><strong>$${totTr.toFixed(2)}</strong></div>
                        <div style="background:#f9f9f9;border-radius:8px;padding:8px;text-align:center;"><small style="color:#888;">💳 Débito</small><br><strong>$${totDb.toFixed(2)}</strong></div>
                    </div>
                </div>`;
        }
    } catch (e) {
        console.error('❌ Error estado caja:', e);
        cont.innerHTML = '<p style="color:#dc3545;text-align:center;padding:16px;">❌ Error al cargar el estado de la caja</p>';
    }
}

// Modal para abrir la caja del día
function abrirCajaModal() {
    const modal = document.createElement('div');
    modal.id = 'modal-abrir-caja';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:32px;max-width:400px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="color:#C06C84;margin:0 0 6px 0;">🔓 Abrir Caja del Día</h3>
            <p style="color:#888;margin:0 0 20px 0;font-size:0.88rem;">Registrá el dinero con el que se abre la caja (fondo de cambio).</p>
            <div style="display:flex;flex-direction:column;gap:12px;">
                <div>
                    <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">💰 Fondo inicial ($)</label>
                    <input type="number" id="abrir-caja-monto" value="0" step="0.01" min="0"
                           style="width:100%;padding:10px 12px;border:2px solid #C06C84;border-radius:9px;font-size:1rem;box-sizing:border-box;">
                </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button onclick="confirmarAbrirCaja()" style="flex:1;background:#28a745;color:white;padding:13px;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:1rem;">✅ Abrir Caja</button>
                <button onclick="document.getElementById('modal-abrir-caja').remove();" style="flex:1;background:#f0f0f0;color:#555;padding:13px;border:none;border-radius:10px;cursor:pointer;font-weight:600;">✖ Cancelar</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.onclick = ev => { if (ev.target === modal) modal.remove(); };
    setTimeout(() => document.getElementById('abrir-caja-monto')?.focus(), 80);
}

async function confirmarAbrirCaja() {
    const monto = parseFloat(document.getElementById('abrir-caja-monto')?.value || 0);
    try {
        const res = await fetch(`${API_BASE}/caja/abrir`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monto_inicial: isNaN(monto) ? 0 : monto })
        });
        const data = await res.json();
        document.getElementById('modal-abrir-caja')?.remove();
        if (data.success) {
            mostrarNotificacion('✅ Caja abierta correctamente');
            cargarEstadoCaja();
        } else {
            mostrarNotificacion('❌ ' + (data.message || 'Error'), 'error');
            cargarEstadoCaja();
        }
    } catch (e) {
        mostrarNotificacion('❌ Error al abrir la caja', 'error');
    }
}

// Modal para cerrar la caja del día (conteo real de efectivo)
function cerrarCajaModal() {
    const modal = document.createElement('div');
    modal.id = 'modal-cerrar-caja';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:32px;max-width:400px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="color:#C06C84;margin:0 0 6px 0;">🔒 Cerrar Caja del Día</h3>
            <p style="color:#888;margin:0 0 20px 0;font-size:0.88rem;">Ingresá el dinero real que hay en la caja (incluido el fondo inicial). Se calcula la diferencia contra lo esperado.</p>
            <div style="display:flex;flex-direction:column;gap:12px;">
                <div>
                    <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">💵 Dinero contado en caja ($)</label>
                    <input type="number" id="cerrar-caja-monto" value="0" step="0.01" min="0"
                           style="width:100%;padding:10px 12px;border:2px solid #C06C84;border-radius:9px;font-size:1rem;box-sizing:border-box;">
                </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button onclick="confirmarCerrarCaja()" style="flex:1;background:#e74c3c;color:white;padding:13px;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:1rem;">✅ Cerrar Caja</button>
                <button onclick="document.getElementById('modal-cerrar-caja').remove();" style="flex:1;background:#f0f0f0;color:#555;padding:13px;border:none;border-radius:10px;cursor:pointer;font-weight:600;">✖ Cancelar</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.onclick = ev => { if (ev.target === modal) modal.remove(); };
    setTimeout(() => document.getElementById('cerrar-caja-monto')?.focus(), 80);
}

async function confirmarCerrarCaja() {
    const monto = parseFloat(document.getElementById('cerrar-caja-monto')?.value || 0);
    try {
        const res = await fetch(`${API_BASE}/caja/cerrar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monto_real: isNaN(monto) ? 0 : monto })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('modal-cerrar-caja')?.remove();
            const r = data.resumen;
            mostrarResumenCierre(r);
            cargarEstadoCaja();
        } else {
            document.getElementById('modal-cerrar-caja')?.remove();
            mostrarNotificacion('❌ ' + (data.message || 'Error'), 'error');
        }
    } catch (e) {
        mostrarNotificacion('❌ Error al cerrar la caja', 'error');
    }
}

// Muestra el resumen del cierre (y permite imprimirlo)
function mostrarResumenCierre(r) {
    const modal = document.createElement('div');
    modal.id = 'modal-resumen-cierre';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:32px;max-width:400px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="color:#C06C84;margin:0 0 16px 0;text-align:center;">🧾 Cierre de Caja</h3>
            <div style="background:#f9f9f9;border-radius:12px;padding:16px;font-size:0.92rem;">
                <div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="color:#888;">Fondo inicial</span><strong>$${r.monto_inicial.toFixed(2)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="color:#888;">💵 Efectivo</span><strong>$${r.total_efectivo.toFixed(2)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="color:#888;">🏦 Transferencia</span><strong>$${r.total_transferencia.toFixed(2)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="color:#888;">💳 Débito</span><strong>$${r.total_debito.toFixed(2)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-top:1px dashed #ccc;margin-top:4px;"><span style="color:#555;font-weight:700;">Total ventas</span><strong style="color:#28a745;">$${r.total_ventas.toFixed(2)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="color:#888;">💸 Retiros de profesionales</span><strong style="color:#C06C84;">-$${(r.total_retiros||0).toFixed(2)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="color:#888;">Debería haber</span><strong>$${r.dinero_en_caja_esperado.toFixed(2)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="color:#888;">Dinero contado</span><strong>$${r.dinero_contado.toFixed(2)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:8px 0 0;border-top:2px solid #C06C84;margin-top:4px;">
                    <span style="font-weight:800;color:#C06C84;">Diferencia</span>
                    <strong style="color:${r.diferencia === 0 ? '#28a745' : (r.diferencia < 0 ? '#dc3545' : '#f39c12')};">
                        ${r.diferencia > 0 ? '+' : ''}$${r.diferencia.toFixed(2)}
                    </strong>
                </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button onclick="abrirModalPlanillaCierre('${JSON.stringify(r).replace(/'/g, "\\'")}')" style="flex:1;background:#C06C84;color:white;padding:12px;border:none;border-radius:10px;cursor:pointer;font-weight:700;">🖨️ Imprimir Planilla</button>
                <button onclick="document.getElementById('modal-resumen-cierre').remove();" style="flex:1;background:#f0f0f0;color:#555;padding:12px;border:none;border-radius:10px;cursor:pointer;font-weight:600;">✖ Cerrar</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.onclick = ev => { if (ev.target === modal) modal.remove(); };
}

// Imprime una planilla de cierre (formato térmico 80mm)
function abrirModalPlanillaCierre(json) {
    let r;
    try { r = JSON.parse(json); } catch(e) { return; }
    const win = window.open('', '_blank', 'width=360,height=640');
    win.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Planilla de Cierre</title>
<style>
  body{font-family:'Courier New',Courier,monospace;width:80mm;margin:0 auto;color:#000;font-size:12px;}
  .center{text-align:center;}.bold{font-weight:700;}
  hr{border:none;border-top:1px dashed #000;margin:6px 0;}
  .row{display:flex;justify-content:space-between;padding:2px 0;}
  @media print{ body{width:80mm;} }
</style></head><body>
  <div class="center">
    <h2 style="margin:4px 0;">PLANILLA DE CIERRE</h2>
    <p style="margin:2px 0;">${new Date().toLocaleString('es-AR')}</p>
  </div>
  <hr>
  <div class="row"><span>Fondo inicial</span><span>$${r.monto_inicial.toFixed(2)}</span></div>
  <div class="row"><span>Efectivo</span><span>$${r.total_efectivo.toFixed(2)}</span></div>
  <div class="row"><span>Transferencia</span><span>$${r.total_transferencia.toFixed(2)}</span></div>
  <div class="row"><span>Débito</span><span>$${r.total_debito.toFixed(2)}</span></div>
  <div class="row"><span>Total ventas</span><span>$${r.total_ventas.toFixed(2)}</span></div>
  <div class="row"><span>💸 Retiros</span><span>-$${(r.total_retiros||0).toFixed(2)}</span></div>
  <hr>
  <div class="row"><span>Debería haber</span><span>$${r.dinero_en_caja_esperado.toFixed(2)}</span></div>
  <div class="row"><span>Dinero contado</span><span>$${r.dinero_contado.toFixed(2)}</span></div>
  <div class="row bold"><span>DIFERENCIA</span><span>$${r.diferencia.toFixed(2)}</span></div>
  <hr>
  <div class="center"><p>Firma cajero: ______________</p></div>
  <script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
    win.document.close();
    win.focus();
}

async function cargarTurnosCaja() {
    const container = document.getElementById('caja-turnos-dia');
    if (!container) return;
    container.innerHTML = '<p style="color:#888;text-align:center;padding:24px;">⏳ Cargando turnos del día...</p>';
    try {
        const res = await fetch(`${API_BASE}/caja/dia`);
        if (!res.ok) throw new Error('Error');
        const turnos = await res.json();
        if (!Array.isArray(turnos) || !turnos.length) {
            container.innerHTML = '<div style="background:white;border-radius:14px;padding:28px;text-align:center;color:#888;box-shadow:0 2px 10px rgba(0,0,0,0.06);">📭 No hay turnos para hoy.</div>';
            return;
        }

        const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const pendientes = turnos.filter(t => (t.estado || 'pendiente') !== 'cobrado');
        const cobrados = turnos.filter(t => (t.estado || '') === 'cobrado');

        const tarjeta = (t, esCobrado) => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:white;padding:14px 18px;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,0.07);border-left:4px solid ${esCobrado ? '#28a745' : '#C06C84'};flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                    <div style="display:flex;flex-direction:column;align-items:center;background:${esCobrado ? '#eafaf1' : '#fdf0f4'};padding:6px 12px;border-radius:8px;min-width:60px;">
                        <strong style="color:#C06C84;font-size:1.1rem;">${t.hora_inicio}</strong>
                    </div>
                    <div>
                        <strong style="color:#333;">${t.cliente_nombre || 'Cliente'}</strong>
                        <small style="color:#888;display:block;">💆 ${t.servicio}${parseInt(t.cant_items||1) > 1 ? ` <span style="background:#fdf0f4;color:#C06C84;border-radius:6px;padding:1px 6px;font-weight:700;">+${parseInt(t.cant_items)-1}</span>` : ''} · 👩‍💼 ${t.profesional || 'Sin profesional'}${t.cliente_telefono ? ' · 📞 ' + t.cliente_telefono : ''}</small>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <strong style="color:#28a745;font-size:1.15rem;">$${parseFloat(t.precio || 0).toFixed(2)}</strong>
                    ${esCobrado
                        ? '<span style="background:#28a745;color:white;padding:6px 12px;border-radius:8px;font-weight:700;font-size:0.85rem;">✔ Cobrado</span>'
                        : `<button onclick="abrirModalCobro(${t.id},'${(t.cliente_nombre||'').replace(/'/g,"\\'")}','${(t.servicio||'').replace(/'/g,"\\'")}',${t.precio||0})" style="background:#28a745;color:white;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;font-weight:700;">💳 Cobrar</button>`}
                </div>
            </div>`;

        container.innerHTML = `
            <div style="background:white;border-radius:14px;padding:18px;box-shadow:0 2px 10px rgba(0,0,0,0.06);margin-bottom:18px;">
                <h3 style="margin:0;color:#C06C84;text-transform:capitalize;">📅 ${hoy}</h3>
                <p style="margin:6px 0 0;color:#666;font-size:0.9rem;">${pendientes.length} pendientes · ${cobrados.length} cobrados</p>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
                ${pendientes.map(t => tarjeta(t, false)).join('')}
                ${cobrados.map(t => tarjeta(t, true)).join('')}
            </div>`;
    } catch (e) {
        console.error('❌ Error caja:', e);
        container.innerHTML = '<p style="color:#dc3545;text-align:center;padding:20px;">❌ Error al cargar los turnos del día</p>';
    }
}

// Estado interno del modal de cobro: items del turno disponibles para agregar/quitar
let _turnoItemsActivos = [];

// Modal de cobro: lista items multi-servicio y permite agregar/quitar servicios
async function abrirModalCobro(turnoId, cliente, servicio, precio) {
    document.getElementById('modal-cobro')?.remove();
    const precioBase = (parseFloat(precio) || 0).toFixed(2);
    const modal = document.createElement('div');
    modal.id = 'modal-cobro';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:28px;max-width:440px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;">
            <h3 style="color:#C06C84;margin:0 0 6px 0;">💵 Cobrar Turno #${turnoId}</h3>
            <p style="color:#888;margin:0 0 14px 0;font-size:0.88rem;">👤 ${cliente}</p>
            <div style="margin-bottom:10px;">
                <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:6px;">🗂️ Servicios del turno</label>
                <div id="cobro-items" style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">
                    <p style="color:#888;font-size:0.85rem;">Cargando servicios...</p>
                </div>
                <div style="display:flex;gap:8px;">
                    <select id="cobro-servicio-extra" style="flex:1;padding:8px 10px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.9rem;box-sizing:border-box;">
                        <option value="">➕ Agregar servicio...</option>
                    </select>
                    <button onclick="agregarServicioAlTurno(${turnoId})" style="background:#C06C84;color:white;padding:8px 14px;border:none;border-radius:9px;cursor:pointer;font-weight:700;">Agregar</button>
                </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">
                <div>
                    <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">💰 Monto a cobrar ($)</label>
                    <input type="number" id="cobro-monto" value="${precioBase}" step="0.01" min="0"
                           style="width:100%;padding:10px 12px;border:2px solid #C06C84;border-radius:9px;font-size:1rem;box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-weight:600;color:#555;font-size:0.85rem;display:block;margin-bottom:4px;">💳 Método de pago</label>
                    <select id="cobro-metodo" style="width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:9px;font-size:0.95rem;box-sizing:border-box;">
                        <option value="efectivo">💵 Efectivo</option>
                        <option value="transferencia">🏦 Transferencia</option>
                        <option value="debito">💳 Débito</option>
                    </select>
                </div>
                <label style="display:flex;align-items:center;gap:8px;color:#555;font-size:0.88rem;cursor:pointer;">
                    <input type="checkbox" id="cobro-print" checked> 🖨️ Imprimir ticket al confirmar
                </label>
            </div>
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button onclick="confirmarCobro(${turnoId})"
                        style="flex:1;background:#28a745;color:white;padding:13px;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:1rem;">
                    ✅ Confirmar Cobro
                </button>
                <button onclick="document.getElementById('modal-cobro').remove();"
                        style="flex:1;background:#f0f0f0;color:#555;padding:13px;border:none;border-radius:10px;cursor:pointer;font-weight:600;">
                    ✖ Cancelar
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.onclick = ev => { if (ev.target === modal) modal.remove(); };

    // Cargar items y servicios disponibles
    await cargarItemsModalCobro(turnoId);
    llenarServiciosExtraModal();
    setTimeout(() => document.getElementById('cobro-monto')?.focus(), 80);
}

// Carga los items (servicios) del turno dentro del modal
async function cargarItemsModalCobro(turnoId) {
    const cont = document.getElementById('cobro-items');
    if (!cont) return;
    try {
        const res = await fetch(`${API_BASE}/turnos/${turnoId}/items`);
        const items = await res.json();
        _turnoItemsActivos = Array.isArray(items) ? items : [];
        if (!_turnoItemsActivos.length) {
            cont.innerHTML = '<p style="color:#888;font-size:0.85rem;">Sin servicios registrados</p>';
            return;
        }
        const total = _turnoItemsActivos.reduce((s, it) => s + parseFloat(it.precio || 0), 0);
        const montoInput = document.getElementById('cobro-monto');
        if (montoInput) montoInput.value = total.toFixed(2);
        cont.innerHTML = _turnoItemsActivos.map(it => `
            <div style="display:flex;justify-content:space-between;align-items:center;background:#f9f9f9;border-radius:8px;padding:8px 10px;">
                <span style="font-size:0.9rem;">${it.nombre}</span>
                <span style="display:flex;align-items:center;gap:8px;">
                    <strong style="color:#28a745;font-size:0.9rem;">$${parseFloat(it.precio || 0).toFixed(2)}</strong>
                    <button onclick="quitarServicioDelTurno(${turnoId}, ${it.id})" title="Quitar servicio"
                        style="background:#fff0f0;border:none;color:#dc3545;border-radius:6px;width:24px;height:24px;cursor:pointer;font-weight:700;">✖</button>
                </span>
            </div>`).join('');
    } catch (e) {
        cont.innerHTML = '<p style="color:#dc3545;font-size:0.85rem;">Error al cargar servicios</p>';
    }
}

// Select de servicios extras disponibles (los que no están en el turno)
function llenarServiciosExtraModal() {
    const select = document.getElementById('cobro-servicio-extra');
    if (!select) return;
    const idsTurno = new Set(_turnoItemsActivos.map(it => String(it.servicio_id)));
    select.innerHTML = '<option value="">➕ Agregar servicio...</option>' +
        servicios.filter(s => s.activo !== false && !idsTurno.has(String(s.id)))
            .map(s => `<option value="${s.id}">${s.nombre} - $${s.precio}</option>`).join('');
    select.disabled = false;
}

async function agregarServicioAlTurno(turnoId) {
    const select = document.getElementById('cobro-servicio-extra');
    const svId = select?.value;
    if (!svId) { mostrarNotificacion('⚠️ Elegí un servicio para agregar', 'error'); return; }
    try {
        const res = await fetch(`${API_BASE}/turnos/${turnoId}/servicios`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicio_id: parseInt(svId) })
        });
        const data = await res.json();
        if (data.success) {
            // El select queda con el placeholder por defecto
            if (select) { select.value = ''; }
            await cargarItemsModalCobro(turnoId);
            llenarServiciosExtraModal();
            mostrarNotificacion('✅ Servicio agregado al turno');
        } else {
            mostrarNotificacion('❌ ' + (data.message || 'Error'), 'error');
        }
    } catch (e) {
        mostrarNotificacion('❌ Error al agregar servicio', 'error');
    }
}

async function quitarServicioDelTurno(turnoId, itemId) {
    if (!confirm('¿Quitar este servicio del turno?')) return;
    try {
        const res = await fetch(`${API_BASE}/turnos/${turnoId}/servicios/${itemId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            await cargarItemsModalCobro(turnoId);
            llenarServiciosExtraModal();
        } else {
            mostrarNotificacion('❌ ' + (data.message || 'Error'), 'error');
        }
    } catch (e) {
        mostrarNotificacion('❌ Error al quitar servicio', 'error');
    }
}

// Confirma el cobro: marca el turno cobrado + genera el ticket
async function confirmarCobro(turnoId) {
    const monto = document.getElementById('cobro-monto')?.value;
    const metodo = document.getElementById('cobro-metodo')?.value || 'efectivo';
    const imprimir = !!document.getElementById('cobro-print')?.checked;
    if (!monto || parseFloat(monto) <= 0) {
        mostrarNotificacion('⚠️ Ingresá el monto a cobrar', 'error');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/caja/turnos/${turnoId}/cerrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monto: parseFloat(monto), metodo_pago: metodo })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('modal-cobro')?.remove();
            mostrarNotificacion('✅ Turno cobrado correctamente');
            if (imprimir && data.ticket) imprimirTicket(data.ticket);
            cargarTurnosCaja();
            cargarEstadoCaja();
        } else {
            mostrarNotificacion('❌ ' + (data.message || 'Error'), 'error');
        }
    } catch (e) {
        mostrarNotificacion('❌ Error de conexión', 'error');
    }
}

// Genera e imprime el ticket (comprobante NO fiscal, formato térmico 80mm).
// Dejado preparado para la futura integración con ARCA (ex AFIP): cuando la
// herramienta esté homologada, este mismo bloque usará el WSFEv1 para obtener
// el CAE y reemplazar/complementar el contenido por el comprobante oficial.
function imprimirTicket(t) {
    const itemsHtml = (t.items || []).map(it =>
        `<tr><td style="padding:2px 0;">${it.servicio}</td><td style="padding:2px 0;text-align:right;">$${parseFloat(it.importe).toFixed(2)}</td></tr>`
    ).join('');

    const cuitLine = t.local_cuit ? `<p style="margin:2px 0;">CUIT: ${t.local_cuit}</p>` : '';
    const direccionLine = t.local_direccion ? `<p style="margin:2px 0;">${t.local_direccion}</p>` : '';
    const telLine = t.local_telefono ? `<p style="margin:2px 0;">Tel: ${t.local_telefono}</p>` : '';

    const win = window.open('', '_blank', 'width=360,height=640');
    win.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Ticket ${t.numero}</title>
<style>
  body{font-family:'Courier New',Courier,monospace;width:80mm;margin:0 auto;color:#000;font-size:12px;}
  .center{text-align:center;} .bold{font-weight:700;}
  table{width:100%;border-collapse:collapse;} th{border-top:1px dashed #000;border-bottom:1px dashed #000;}
  hr{border:none;border-top:1px dashed #000;margin:6px 0;}
  .footer{text-align:center;font-size:11px;margin-top:8px;}
  @media print{ body{width:80mm;} }
</style></head><body>
  <div class="center">
    <h2 style="margin:4px 0;">${t.local_nombre}</h2>
    ${cuitLine}${direccionLine}${telLine}
    <p style="margin:2px 0;">Punto de Venta: ${t.punto_venta}</p>
    <p style="margin:2px 0;">TICKET N° ${String(t.numero).padStart(6,'0')}</p>
    <p style="margin:2px 0;">${t.fecha_emision}</p>
  </div>
  <hr>
  <p>${t.cliente_nombre ? 'Cliente: ' + t.cliente_nombre : ''}</p>
  ${t.cliente_telefono ? '<p>Tel: ' + t.cliente_telefono + '</p>' : ''}
  ${t.profesional ? '<p>Profesional: ' + t.profesional + '</p>' : ''}
  <table>
    <thead><tr><th align="left">Detalle</th><th align="right">Importe</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <hr>
  <div style="text-align:right;">
    <p style="margin:2px 0;">Subtotal: $${parseFloat(t.subtotal).toFixed(2)}</p>
    ${t.descuento ? '<p style="margin:2px 0;">Descuento: -$' + parseFloat(t.descuento).toFixed(2) + '</p>' : ''}
    <p class="bold" style="margin:2px 0;font-size:14px;">TOTAL: $${parseFloat(t.total).toFixed(2)}</p>
  </div>
  <hr>
  <p style="margin:2px 0;">Método de pago: ${t.metodo_pago}</p>
  <div class="footer">
    <p>Comprobante NO FISCAL</p>
    <p>Gracias por su visita. ¡Vuelva pronto!</p>
  </div>
  <script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
    win.document.close();
    win.focus();
}

// =====================================================
// 🎂 CLIENTES FRECUENTES, CUMPLEAÑOS Y CUPONES
// =====================================================
let clientesFrecuentes = [];

function formatearFechaNacimiento(fn) {
    if (!fn) return '';
    try {
        const fechaStr = String(fn).includes('T') ? String(fn).split('T')[0] : String(fn);
        const [y, m, d] = fechaStr.split('-');
        return `${d}/${m}/${y}`;
    } catch (e) { return String(fn || ''); }
}

function fechaCumpleLabel(fn, diaCumple) {
    if (!fn) return '';
    const partes = String(fn).split('-');
    const d = partes[2] || diaCumple;
    try {
        return new Date(`${partes[1]}-${d}`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    } catch (e) { return 'Día ' + d; }
}

async function cargarClientesFrecuentes() {
    const datalist = document.getElementById('datalist-clientes-frecuentes');
    if (!datalist) return;
    try {
        const res = await fetch(`${API_BASE}/clientes`);
        const data = await res.json();
        clientesFrecuentes = Array.isArray(data) ? data : [];
        datalist.innerHTML = clientesFrecuentes.map(c =>
            `<option value="${(c.nombre || '').replace(/"/g, '&quot;')}">📞 ${c.telefono || 'sin tel'}${c.fecha_nacimiento ? ' · 🎂 ' + formatearFechaNacimiento(c.fecha_nacimiento) : ''}</option>`
        ).join('');
    } catch (e) { console.error('❌ No se pudieron cargar clientes frecuentes:', e.message); }
}

function autocompletarClienteFrecuente() {
    const nombreInput = document.getElementById('cliente-nombre');
    if (!nombreInput) return;
    const nombre = (nombreInput.value || '').trim();
    const cliente = clientesFrecuentes.find(c => (c.nombre || '').trim().toLowerCase() === nombre.toLowerCase());
    if (!cliente) return;
    const emailEl  = document.getElementById('cliente-email');
    const telEl    = document.getElementById('cliente-telefono');
    const fechaEl  = document.getElementById('cliente-fecha-nacimiento');
    if (cliente.email && emailEl && !emailEl.value)  emailEl.value  = cliente.email;
    if (cliente.telefono && telEl && !telEl.value)    telEl.value    = cliente.telefono;
    if (cliente.fecha_nacimiento && fechaEl && !fechaEl.value) fechaEl.value = String(cliente.fecha_nacimiento).split('T')[0];
}

async function cargarCumpleanos() {
    const cont = document.getElementById('cumpleanos-lista');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#888;">⏳ Cargando cumpleaños...</p>';
    try {
        const res = await fetch(`${API_BASE}/cumpleanos`);
        const cumples = await res.json();
        if (!Array.isArray(cumples) || !cumples.length) {
            cont.innerHTML = '<p style="color:#888;">🎂 Nadie cumple años este mes.</p>';
            return;
        }
        cont.innerHTML = cumples.map(c => {
            const tel = (c.telefono || '').replace(/[^\d]/g, '');
            let waNum = tel;
            if (waNum.startsWith('549')) {} else if (waNum.startsWith('54')) {} else if (waNum.startsWith('0')) waNum = '549' + waNum.slice(1); else waNum = '549' + waNum;
            const msj = encodeURIComponent(`Hola ${c.nombre}! 🎂🎉 *CHAMAS SPA* te desea un feliz cumpleaños 💅💆‍♀️✨\n\nTe esperamos para consentirte. ¡Felicidades! 🥳`);
            return `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #f3e3ec;flex-wrap:wrap;${c.cumple_hoy ? 'background:#fff3cd;border-radius:9px;padding:11px;' : ''}">
                    <div style="flex:1;min-width:220px;">
                        <strong>${c.nombre || 'Sin nombre'}</strong>
                        ${c.cumple_hoy ? '<span style="color:#B7950B;font-weight:700;margin-left:6px;">🎂 CUMPLE HOY</span>' : ''}
                        <small style="display:block;color:#888;">🎂 ${fechaCumpleLabel(c.fecha_nacimiento, c.dia_cumple)}</small>
                        <small style="display:block;color:#666;">📞 ${c.telefono || 'Sin teléfono'}</small>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        ${waNum
                            ? `<a href="https://wa.me/${waNum}?text=${msj}" target="_blank" style="background:#25D366;color:white;padding:9px 14px;border-radius:9px;text-decoration:none;font-weight:700;font-size:0.85rem;">📲 Felicitar</a>`
                            : '<span style="color:#888;font-size:0.85rem;">Sin WhatsApp</span>'}
                    </div>
                </div>`;
        }).join('');
    } catch (e) {
        cont.innerHTML = '<p style="color:#c0392b;">❌ Error al cargar cumpleaños.</p>';
    }
}

async function autorizarCupon() {
    const clienteSel = document.getElementById('cupon-cliente-select');
    const servicioSel = document.getElementById('cupon-servicio-select');
    const clienteId = clienteSel ? clienteSel.value : '';
    const servicioId = servicioSel ? servicioSel.value : '';
    if (!clienteId || !servicioId) {
        mostrarNotificacion('⚠️ Seleccioná cliente y servicio para el cupón', 'error');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/cupones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente_id: parseInt(clienteId), servicio_id: parseInt(servicioId) })
        });
        const data = await res.json();
        if (data.success) {
            mostrarNotificacion('🎁 Cupón autorizado correctamente', 'success');
            cargarCupones();
        } else {
            mostrarNotificacion('❌ ' + (data.message || 'Error al autorizar'), 'error');
        }
    } catch (e) {
        mostrarNotificacion('❌ Error de conexión', 'error');
    }
}

async function cargarCupones() {
    const cont = document.getElementById('cupones-lista');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#888;">⏳ Cargando cupones...</p>';
    try {
        const res = await fetch(`${API_BASE}/cupones`);
        const cupones = await res.json();
        if (!Array.isArray(cupones) || !cupones.length) {
            cont.innerHTML = '<p style="color:#888;">🎁 No hay cupones aún.</p>';
            return;
        }
        cont.innerHTML = cupones.map(cp => {
            const tel = (cp.cliente_telefono || '').replace(/[^\d]/g, '');
            let waNum = tel;
            if (waNum.startsWith('549')) {} else if (waNum.startsWith('54')) {} else if (waNum.startsWith('0')) waNum = '549' + waNum.slice(1); else waNum = '549' + waNum;
            const msj = encodeURIComponent(`Hola ${cp.cliente_nombre || ''}! 🎁 *CHAMAS SPA* te regala *${cp.servicio_nombre || 'un servicio'}* GRATIS 🎉\n\nPresentá este mensaje para reservar tu cupón. ¡Felicidades por tu cumpleaños! 💅💆‍♀️`);
            const esEnviado = cp.estado === 'enviado';
            return `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #eee;flex-wrap:wrap;">
                    <div style="flex:1;min-width:220px;">
                        <strong>${cp.cliente_nombre || 'Cliente'}</strong> — <span style="color:#6A1B9A;">🎁 ${cp.servicio_nombre || 'Servicio'}</span>
                        <small style="display:block;color:#888;">${esEnviado ? 'Enviado ' + (cp.fecha_envio ? new Date(cp.fecha_envio).toLocaleString('es-AR') : '') : 'Autorizado ' + new Date(cp.fecha_autorizado).toLocaleString('es-AR')}</small>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        ${esEnviado
                            ? '<span style="color:#28a745;font-size:0.85rem;font-weight:700;">✅ Enviado</span>'
                            : (waNum
                                ? `<a href="https://wa.me/${waNum}?text=${msj}" target="_blank" onclick="marcarCuponEnviado(${cp.id})" style="background:#25D366;color:white;padding:9px 14px;border-radius:9px;text-decoration:none;font-weight:700;font-size:0.85rem;">📲 Enviar cupón</a>`
                                : '<span style="color:#888;font-size:0.85rem;">Sin WhatsApp</span>')}
                    </div>
                </div>`;
        }).join('');
    } catch (e) {
        cont.innerHTML = '<p style="color:#c0392b;">❌ Error al cargar cupones.</p>';
    }
}

async function marcarCuponEnviado(id) {
    try {
        await fetch(`${API_BASE}/cupones/${id}/enviado`, { method: 'POST' });
        cargarCupones();
        cargarCumpleanos();
    } catch (e) { console.error('❌ Error al marcar cupón enviado:', e.message); }
}

async function llenarSelectCupones() {
    const cliSel = document.getElementById('cupon-cliente-select');
    const srvSel = document.getElementById('cupon-servicio-select');
    if (!cliSel && !srvSel) return;
    try {
        const [cli, srv] = await Promise.all([
            fetch(`${API_BASE}/cumpleanos`).then(r => r.json()),
            fetch(`${API_BASE}/servicios`).then(r => r.json())
        ]);
        if (cliSel) {
            cliSel.innerHTML = '<option value="">Seleccionar cliente...</option>' +
                (Array.isArray(cli) ? cli.map(c =>
                    `<option value="${c.id}">${c.nombre || 'Sin nombre'} — cumple ${fechaCumpleLabel(c.fecha_nacimiento, c.dia_cumple)}</option>`
                ).join('') : '');
        }
        if (srvSel) {
            srvSel.innerHTML = '<option value="">Seleccionar servicio...</option>' +
                (Array.isArray(srv) ? srv.map(s =>
                    `<option value="${s.id}">${s.nombre} — $${parseFloat(s.precio || 0).toLocaleString()}</option>`
                ).join('') : '');
        }
    } catch (e) {
        console.error('❌ Error al llenar selects de cupones:', e.message);
    }
}