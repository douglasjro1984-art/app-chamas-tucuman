// apiAuth.js - Interceptor global de fetch que agrega automáticamente
// el token JWT a todas las llamadas a la API del backend.
// Debe cargarse ANTES que los demás scripts que hagan fetch.

(function () {
    const fetchOriginal = window.fetch.bind(window);

    window.fetch = async function (input, init) {
        init = init || {};
        const url = typeof input === 'string' ? input : input.url;
        if (url && url.indexOf(window.API_BASE) === 0) {
            const token = localStorage.getItem('token');
            if (token) {
                const headers = new Headers(init.headers || {});
                if (!headers.has('Authorization')) {
                    headers.set('Authorization', 'Bearer ' + token);
                }
                init.headers = headers;
            }
        }
        return fetchOriginal(input, init);
    };
})();

// ==========================================
// FUNCIONES DE NAVEGACIÓN DE SECCIONES
// ==========================================
function showSection(sectionId) {
    const login = document.getElementById('login-screen');
    if (login) { login.style.display='none'; login.style.visibility='hidden'; login.style.pointerEvents='none'; login.style.zIndex='-1'; }
    const mainApp = document.getElementById('main-app');
    if (mainApp) { mainApp.style.display='block'; mainApp.style.visibility='visible'; mainApp.style.pointerEvents='auto'; }
    document.querySelectorAll('.section').forEach(s => { s.style.display='none'; s.classList.remove('active'); });
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.style.display='block';
    target.classList.add('active');
    const ediPreciosPanel = document.getElementById('editar-precios-panel');
    if (ediPreciosPanel) ediPreciosPanel.style.display='none';
}
