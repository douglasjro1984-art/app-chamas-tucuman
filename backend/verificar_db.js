const mysql = require('mysql2/promise');

const dbConfig = {
    DB_HOST: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
    DB_USER: '32KigEkWVRSwsCK.root',      
    DB_PASSWORD: 'iCIQV3U87i7OTXmh',  
    DB_NAME: 'test',
    DB_PORT: 4000,
    ssl: {
        rejectUnauthorized: false
    }

};

async function verificarBaseDatos() {
    console.log('🔍 Verificando estado de la base de datos...\n');
    
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conexión exitosa a MySQL\n');
        
        // Verificar usuarios
        console.log('👥 USUARIOS EN LA BASE DE DATOS:');
        console.log('─'.repeat(80));
        const [usuarios] = await connection.query(
            'SELECT id, nombre, email, rol, LEFT(password, 10) as pass_preview FROM usuarios'
        );
        
        if (usuarios.length === 0) {
            console.log('⚠️  No hay usuarios registrados');
        } else {
            usuarios.forEach(u => {
                const bcryptIndicator = u.pass_preview.startsWith('$2b$') ? '✅' : '❌';
                console.log(`${bcryptIndicator} ID: ${u.id} | ${u.nombre.padEnd(20)} | ${u.email.padEnd(25)} | ${u.rol.padEnd(12)} | ${u.pass_preview}...`);
            });
        }
        
        console.log('\n📊 RESUMEN:');
        console.log(`   Total usuarios: ${usuarios.length}`);
        const conBcrypt = usuarios.filter(u => u.pass_preview.startsWith('$2b$')).length;
        const sinBcrypt = usuarios.length - conBcrypt;
        console.log(`   ✅ Con bcrypt: ${conBcrypt}`);
        console.log(`   ❌ Sin bcrypt: ${sinBcrypt}`);
        
        if (sinBcrypt > 0) {
            console.log('\n⚠️  ACCIÓN REQUERIDA:');
            console.log('   Ejecuta: node update_passwords.js');
            console.log('   Para actualizar las contraseñas sin hash bcrypt');
        }
        
        // Verificar servicios
        console.log('\n📦 SERVICIOS DISPONIBLES:');
        console.log('─'.repeat(80));
        const [servicios] = await connection.query(
            'SELECT id, nombre, precio, activo FROM servicios'
        );
        
        if (servicios.length === 0) {
            console.log('⚠️  No hay servicios registrados');
        } else {
            servicios.forEach(s => {
                const estado = s.activo ? '✅' : '❌';
                console.log(`${estado} ID: ${s.id} | ${s.nombre.padEnd(30)} | $${s.precio}`);
            });
        }
        
        // Verificar profesional_servicios
        console.log('\n👨‍💼 SERVICIOS ASIGNADOS A PROFESIONALES:');
        console.log('─'.repeat(80));
        const [asignaciones] = await connection.query(`
            SELECT u.nombre as profesional, s.nombre as servicio
            FROM profesional_servicios ps
            JOIN usuarios u ON ps.profesional_id = u.id
            JOIN servicios s ON ps.servicio_id = s.id
            ORDER BY u.nombre
        `);
        
        if (asignaciones.length === 0) {
            console.log('⚠️  No hay servicios asignados a profesionales');
        } else {
            let profActual = '';
            asignaciones.forEach(a => {
                if (a.profesional !== profActual) {
                    console.log(`\n   👨‍💼 ${a.profesional}:`);
                    profActual = a.profesional;
                }
                console.log(`      • ${a.servicio}`);
            });
        }
        
        // Verificar turnos
        console.log('\n\n📅 TURNOS AGENDADOS:');
        console.log('─'.repeat(80));
        const [turnos] = await connection.query(`
            SELECT COUNT(*) as total FROM turnos
        `);
        console.log(`   Total turnos: ${turnos[0].total}`);
        
        if (turnos[0].total > 0) {
            const [proximosTurnos] = await connection.query(`
                SELECT t.fecha, t.hora_inicio, c.nombre as cliente, p.nombre as profesional, s.nombre as servicio
                FROM turnos t
                JOIN usuarios c ON t.cliente_id = c.id
                JOIN usuarios p ON t.profesional_id = p.id
                JOIN servicios s ON t.servicio_id = s.id
                WHERE t.fecha >= CURDATE()
                ORDER BY t.fecha ASC, t.hora_inicio ASC
                LIMIT 5
            `);
            
            if (proximosTurnos.length > 0) {
                console.log('\n   📌 Próximos turnos:');
                proximosTurnos.forEach(t => {
                    console.log(`      ${t.fecha} ${t.hora_inicio} - ${t.cliente} con ${t.profesional} (${t.servicio})`);
                });
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('✅ Verificación completa');
        console.log('='.repeat(80) + '\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('\n💡 Verifica que el usuario y contraseña de MySQL sean correctos');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.log('\n💡 La base de datos "chamas_spa" no existe. Créala primero:');
            console.log('   mysql -u root -p -e "CREATE DATABASE chamas_spa;"');
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

verificarBaseDatos();
