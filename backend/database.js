const mysql = require('mysql2/promise');

// Configuramos la conexión con tus datos actuales
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      
    password: '1234',  
    database: 'chamas_spa', 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verificación rápida en la terminal al arrancar
pool.getConnection()
    .then(conn => {
        console.log("✅ Conexión exitosa a MySQL");
        conn.release();
    })
    .catch(err => {
        console.error("❌ Error conectando a MySQL:", err.message);
    });

module.exports = pool;