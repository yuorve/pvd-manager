const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugDB() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'db',
        user: process.env.DB_USER || 'user',
        password: process.env.DB_PASS || 'password',
        database: process.env.DB_NAME || 'pvd',
        dateStrings: true
    });

    try {
        console.log('--- Current Server Time ---');
        console.log(new Date().toString());
        console.log(new Date().toISOString());

        console.log('\n--- Checking pvd_asignaciones ---');
        const [rows] = await pool.query('SELECT * FROM pvd_asignaciones ORDER BY created_at DESC LIMIT 50');
        console.table(rows);

        console.log('\n--- Checking tracking for JUCAME ---');
        const [users] = await pool.query('SELECT * FROM tracking WHERE userID = "JUCAME" OR userID = "SECICA" OR userID = "YUORVE"');
        console.table(users);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

debugDB();
