// loadEnv.js - Carga las variables de entorno desde un archivo .env
// sin necesidad de dependencias externas. Se lee backend/.env si existe.

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

try {
    if (fs.existsSync(envPath)) {
        const contenido = fs.readFileSync(envPath, 'utf-8');
        contenido.split(/\r?\n/).forEach(linea => {
            const limpia = linea.trim();
            if (!limpia || limpia.startsWith('#')) return; // saltar vacías y comentarios
            const idx = limpia.indexOf('=');
            if (idx === -1) return;
            const clave = limpia.slice(0, idx).trim();
            const valor = limpia.slice(idx + 1).trim();
            // No sobrescribir variables que ya estén definidas en el entorno
            if (!process.env[clave]) {
                process.env[clave] = valor;
            }
        });
    }
} catch (err) {
    // Si no se puede leer el .env, continuar con las variables del entorno real
}

module.exports = process.env;
