const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',      
    password: '1234',  
    database: 'chamas_spa'
};

// Usuarios y sus contraseñas
const usuarios = [
    { email: 'admin@chamas.com', password: 'admin123' },
    { email: 'laura@chamas.com', password: 'prof123' },
    { email: 'cliente@test.com', password: 'cliente123' }
];

async function actualizarContraseñas() {
    console.log('🔐 Iniciando actualización de contraseñas con bcrypt...\n');
    
    let connection;
    
    try {
        // Conectar a la base de datos
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado a la base de datos\n');
        
        for (const usuario of usuarios) {
            console.log(`📝 Procesando: ${usuario.email}`);
            
            // Generar hash
            const hashedPassword = await bcrypt.hash(usuario.password, 10);
            console.log(`   Hash generado: ${hashedPassword.substring(0, 20)}...`);
            
            // Actualizar en la base de datos
            const [result] = await connection.query(
                'UPDATE usuarios SET password = ? WHERE email = ?',
                [hashedPassword, usuario.email]
            );
            
            if (result.affectedRows > 0) {
                console.log(`   ✅ Contraseña actualizada correctamente\n`);
            } else {
                console.log(`   ⚠️  Usuario no encontrado en la base de datos\n`);
            }
        }
        
        console.log('✅ Proceso completado exitosamente!');
        console.log('\n📋 Credenciales actualizadas:');
        console.log('   Admin: admin@chamas.com / admin123');
        console.log('   Prof: laura@chamas.com / prof123');
        console.log('   Cliente: cliente@test.com / cliente123');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión cerrada');
        }
    }
}

// Ejecutar el script
actualizarContraseñas();
