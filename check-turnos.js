require('./backend/loadEnv');
const pool = require('./backend/database');
(async () => {
    const [r] = await pool.query("SELECT COUNT(*) as c FROM turnos WHERE estado='cobrado'");
    console.log('Turnos cobrados en BD:', r[0].c);
    const [r2] = await pool.query('SELECT id, fecha, estado, profesional_id, precio FROM turnos ORDER BY id DESC LIMIT 5');
    console.table(r2);
    pool.end();
})().catch(e => { console.error(e); process.exit(1); });