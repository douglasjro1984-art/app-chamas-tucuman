const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('./loadEnv');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 4000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
};

const USUARIOS_NUEVOS = [
    {
        nombre: 'Carmen Puente',
        email: 'carmenpuenteopsu@gmail.com',
        password: 'admin123',
        rol: 'admin',
        telefono: null
    },
    {
        nombre: 'Anahi Urquiza',
        email: 'anahiurquiza84@gmail.com',
        password: '123456',
        rol: 'recepcionista',
        telefono: '3865437108'
    }
];

const IDS_A_ELIMINAR = [3, 30001, 90001, 120001, 120002, 180001];

async function migrar() {
    console.log('🔧 Migración: sistema de 2 usuarios (admin + recepcionista)\n');
    let conn;
    try {
        conn = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado a la base de datos\n');

        // 1. Crear tabla recuperaciones
        console.log('1️⃣  Creando tabla recuperaciones...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS recuperaciones (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                codigo VARCHAR(6) NOT NULL,
                expira_at TIMESTAMP NOT NULL,
                usado TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_usuario (usuario_id)
            )
        `);
        console.log('   ✅ Tabla recuperaciones lista\n');

        // 2. Desactivar FK para poder limpiar datos de prueba
        console.log('2️⃣  Desactivando verificación de FK...');
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');

        // 3. Limpiar datos de prueba que referencian usuarios viejos
        console.log('3️⃣  Limpiando datos de prueba...');
        const [ticketsBorrados] = await conn.query('DELETE FROM tickets WHERE turno_id IN (SELECT id FROM turnos)');
        const [turnosBorrados] = await conn.query('DELETE FROM turnos');
        const [profServBorrados] = await conn.query('DELETE FROM profesional_servicios');
        const [retirosBorrados] = await conn.query('DELETE FROM retiros');
        const [cajasBorradas] = await conn.query('DELETE FROM cajas');
        console.log(`   🗑️  Tickets: ${ticketsBorrados.affectedRows}, Turnos: ${turnosBorrados.affectedRows}, Prof.Serv: ${profServBorrados.affectedRows}, Retiros: ${retirosBorrados.affectedRows}, Cajas: ${cajasBorradas.affectedRows}`);

        // 4. Eliminar cuentas de prueba
        console.log('4️⃣  Eliminando cuentas de prueba...');
        for (const id of IDS_A_ELIMINAR) {
            const [r] = await conn.query('DELETE FROM usuarios WHERE id = ?', [id]);
            if (r.affectedRows > 0) console.log(`   🗑️  Usuario #${id} eliminado`);
        }

        // 5. Crear usuarios nuevos
        console.log('\n5️⃣  Creando usuarios nuevos...');
        for (const u of USUARIOS_NUEVOS) {
            const hashed = await bcrypt.hash(u.password, 10);
            const [existe] = await conn.query('SELECT id FROM usuarios WHERE email = ?', [u.email]);
            if (existe.length > 0) {
                await conn.query(
                    'UPDATE usuarios SET nombre=?, password=?, rol=?, telefono=? WHERE email=?',
                    [u.nombre, hashed, u.rol, u.telefono, u.email]
                );
                console.log(`   ✅ ${u.nombre} (${u.email}) — actualizado → rol ${u.rol}`);
            } else {
                await conn.query(
                    'INSERT INTO usuarios (nombre, email, password, rol, telefono, porcentaje_retiro) VALUES (?,?,?,?,?,0)',
                    [u.nombre, u.email, hashed, u.rol, u.telefono]
                );
                console.log(`   ✅ ${u.nombre} (${u.email}) — creado → rol ${u.rol}`);
            }
        }

        // 6. Reactivar FK
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('\n6️⃣  FK reactivadas\n');

        // 7. Verificar
        const [restantes] = await conn.query('SELECT id, nombre, email, rol FROM usuarios ORDER BY id');
        console.log('📋 Usuarios finales:');
        restantes.forEach(u => console.log(`   #${u.id} ${u.nombre} (${u.email}) — ${u.rol}`));
        console.log('\n✅ Migración completada');

    } catch (e) {
        console.error('❌ Error:', e.message);
        if (conn) await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        if (conn) await conn.end();
    }
}

migrar();