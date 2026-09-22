require('./backend/loadEnv');
const pool = require('./backend/database');
(async () => {
    const [r] = await pool.query('SELECT id, nombre, rol FROM usuarios WHERE nombre LIKE ? OR nombre LIKE ?', ['%Carmen%', '%Anahi%']);
    console.table(r);
    pool.end();
})().catch(e => { console.error(e); process.exit(1); });