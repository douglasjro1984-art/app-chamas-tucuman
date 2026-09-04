// apiAuth.js - Interceptor global de fetch que agrega automáticamente
// el token JWT a todas las llamadas a la API del backend.
// Debe cargarse ANTES que los demás scripts que hagan fetch.

(function () {
    const fetchOriginal = window.fetch.bind(window);

    window.fetch = async function (input, init) {
        init = init || {};

        // Solo agregar el token a llamadas hacia la API del backend
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
