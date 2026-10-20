const mysql = require('mysql2/promise');
require('./loadEnv');

// Configuración SSL: se habilita explícitamente mediante DB_SSL=true.
// Las credenciales SIEMPRE provienen de variables de entorno, nunca del código.
// NOTA: rejectUnauthorized:false desactiva la verificación del certificado y solo
// se recomienda para conexiones TiDB Cloud gestionadas. Idealmente configura un
// certificado CA para verificación completa.
const sslConfig = process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined;

const pool = mysql.createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     parseInt(process.env.DB_PORT) || 4000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: sslConfig,
    timezone: '-03:00',
    dateStrings: true
});

// Configurar zona horaria Argentina en cada conexión nueva
pool.on('connection', (connection) => {
    connection.query("SET time_zone = '-03:00'");
});

// Prueba la conexión al arrancar
pool.getConnection()
  .then(connection => {
    console.log('✅ Conexión a la base de datos establecida correctamente');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Error al conectar a la base de datos:', err.message);
  });

module.exports = pool;