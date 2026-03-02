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

async function diagnosticoHorarios() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DIAGNÓSTICO ESPECÍFICO - PROBLEMA DE HORARIOS');
    console.log('='.repeat(80) + '\n');
    
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado a MySQL\n');
        
        // 1. Verificar tabla disponibilidad_fechas
        console.log('1️⃣  VERIFICAR TABLA disponibilidad_fechas:');
        console.log('─'.repeat(80));
        
        try {
            const [columnas] = await connection.query(
                "DESCRIBE disponibilidad_fechas"
            );
            console.log('✅ Tabla existe con columnas:');
            columnas.forEach(col => {
                console.log(`   • ${col.Field} (${col.Type})`);
            });
        } catch (err) {
            if (err.code === 'ER_NO_SUCH_TABLE') {
                console.log('❌ PROBLEMA: La tabla disponibilidad_fechas NO EXISTE');
                console.log('\n   Necesitas crear la tabla:');
                console.log(`
CREATE TABLE disponibilidad_fechas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profesional_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_slot (profesional_id, fecha, hora_inicio),
    FOREIGN KEY (profesional_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
                `);
            } else {
                throw err;
            }
        }
        
        // 2. Contar registros en disponibilidad_fechas
        console.log('\n2️⃣  REGISTROS EN disponibilidad_fechas:');
        console.log('─'.repeat(80));
        
        const [countTotal] = await connection.query(
            'SELECT COUNT(*) as total FROM disponibilidad_fechas'
        );
        console.log(`Total registros: ${countTotal[0].total}`);
        
        if (countTotal[0].total === 0) {
            console.log('⚠️  PROBLEMA: No hay horarios guardados en la BD');
            console.log('   Esto significa que el POST a /api/disponibilidad no está funcionando');
        } else {
            // Mostrar distribución por profesional
            const [porProf] = await connection.query(`
                SELECT u.nombre, COUNT(*) as cantidad
                FROM disponibilidad_fechas df
                JOIN usuarios u ON df.profesional_id = u.id
                GROUP BY df.profesional_id
                ORDER BY u.nombre
            `);
            
            console.log('\n   📊 Horarios por profesional:');
            porProf.forEach(p => {
                console.log(`   • ${p.nombre.padEnd(20)} → ${p.cantidad} horarios`);
            });
            
            // Mostrar ejemplo de datos
            const [ejemplos] = await connection.query(`
                SELECT 
                    u.nombre,
                    df.fecha,
                    df.hora_inicio,
                    DAYNAME(df.fecha) as dia
                FROM disponibilidad_fechas df
                JOIN usuarios u ON df.profesional_id = u.id
                LIMIT 10
            `);
            
            console.log('\n   📌 Ejemplo de 10 registros:');
            ejemplos.forEach(e => {
                console.log(`   • ${e.nombre.padEnd(15)} ${e.fecha} (${e.dia}) ${e.hora_inicio}`);
            });
        }
        
        // 3. Verificar tabla profesional_servicios
        console.log('\n3️⃣  VERIFICAR PROFESIONALES CON SERVICIOS:');
        console.log('─'.repeat(80));
        
        const [profesionales] = await connection.query(`
            SELECT DISTINCT u.id, u.nombre
            FROM usuarios u
            WHERE u.rol = 'profesional'
            ORDER BY u.nombre
        `);
        
        if (profesionales.length === 0) {
            console.log('⚠️  No hay profesionales registrados en el sistema');
        } else {
            console.log(`✅ Hay ${profesionales.length} profesional(es):\n`);
            
            for (const prof of profesionales) {
                const [servicios] = await connection.query(`
                    SELECT s.nombre
                    FROM profesional_servicios ps
                    JOIN servicios s ON ps.servicio_id = s.id
                    WHERE ps.profesional_id = ?
                `, [prof.id]);
                
                console.log(`   👨‍💼 ${prof.nombre} (ID: ${prof.id})`);
                if (servicios.length === 0) {
                    console.log(`      ⚠️  Sin servicios asignados`);
                } else {
                    servicios.forEach(s => {
                        console.log(`      ✅ ${s.nombre}`);
                    });
                }
                
                // Contar horarios de este profesional
                const [countProf] = await connection.query(
                    'SELECT COUNT(*) as total FROM disponibilidad_fechas WHERE profesional_id = ?',
                    [prof.id]
                );
                console.log(`      📅 Horarios configurados: ${countProf[0].total}\n`);
            }
        }
        
        // 4. Verificar turnos agendados
        console.log('\n4️⃣  TURNOS AGENDADOS:');
        console.log('─'.repeat(80));
        
        const [countTurnos] = await connection.query(
            'SELECT COUNT(*) as total FROM turnos'
        );
        
        if (countTurnos[0].total === 0) {
            console.log('ℹ️  No hay turnos agendados aún (es normal al comenzar)');
        } else {
            const [turnos] = await connection.query(`
                SELECT 
                    t.fecha, t.hora_inicio,
                    p.nombre as profesional,
                    c.nombre as cliente,
                    s.nombre as servicio
                FROM turnos t
                JOIN usuarios p ON t.profesional_id = p.id
                JOIN usuarios c ON t.cliente_id = c.id
                JOIN servicios s ON t.servicio_id = s.id
                ORDER BY t.fecha DESC
                LIMIT 5
            `);
            
            console.log(`✅ Últimos 5 turnos:\n`);
            turnos.forEach(t => {
                console.log(`   📅 ${t.fecha} ${t.hora_inicio}`);
                console.log(`      Profesional: ${t.profesional}`);
                console.log(`      Cliente: ${t.cliente}`);
                console.log(`      Servicio: ${t.servicio}\n`);
            });
        }
        
        // 5. RESUMEN Y DIAGNÓSTICO
        console.log('\n' + '='.repeat(80));
        console.log('📋 DIAGNÓSTICO FINAL');
        console.log('='.repeat(80) + '\n');
        
        if (countTotal[0].total === 0) {
            console.log('❌ PROBLEMA IDENTIFICADO:');
            console.log('   Los horarios NO se están guardando en disponibilidad_fechas');
            console.log('\n🔧 SOLUCIÓN:');
            console.log('   1. Reemplaza horarios-adminc.js con la versión corregida');
            console.log('   2. Asegúrate que envía "desde" y "hasta" en el POST');
            console.log('   3. Abre DevTools (F12) → Network → busca POST /api/disponibilidad');
            console.log('   4. Verifica que el Request Payload incluya:');
            console.log('      { "profesional_id": X, "desde": "YYYY-MM-DD", "hasta": "YYYY-MM-DD", "horarios": [...] }');
        } else {
            console.log('✅ BUENAS NOTICIAS:');
            console.log(`   Los horarios SE ESTÁN guardando correctamente (${countTotal[0].total} registros)`);
            console.log('\n🔍 PROBLEMA PROBABLE:');
            console.log('   El issue está en cómo se MUESTRAN los horarios en la interfaz');
            console.log('   Verifica que renderHorariosPanel() esté mapeando fechas a días correctamente');
            console.log('\n🔧 ACCIÓN:');
            console.log('   Usa el código corregido en horarios-adminc-FIXED.js');
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('\n💡 Error de conexión a MySQL:');
            console.log('   Verifica usuario y contraseña en database.js');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.log('\n💡 Base de datos "chamas_spa" no existe');
            console.log('   Créala con: mysql -u root -p -e "CREATE DATABASE chamas_spa;"');
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar diagnóstico
diagnosticoHorarios();
