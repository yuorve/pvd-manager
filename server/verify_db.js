const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDB() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'db',
            user: process.env.DB_USER || 'user',
            password: process.env.DB_PASS || 'password',
            database: process.env.DB_NAME || 'pvd',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log("Checking tables...");
        const [tables] = await pool.query("SHOW TABLES");
        console.log("Tables found:", tables.map(t => Object.values(t)[0]));

        console.log("\nChecking tracking table (Stations)...");
        try {
            const [stations] = await pool.query("SELECT * FROM tracking LIMIT 5");
            console.log(`Stations count: ${stations.length}`);
            if (stations.length > 0) console.log("Sample station:", stations[0]);
        } catch (e) {
            console.error("Error checking tracking:", e.message);
        }

        console.log("\nChecking users table...");
        try {
            const [users] = await pool.query("SELECT username, role, created_at FROM users");
            console.log(`Users count: ${users.length}`);
            console.log("Users:", users);
        } catch (e) {
            console.error("Error checking users:", e.message);
        }

        await pool.end();
    } catch (e) {
        console.error("DB Connection Error:", e);
    }
}

checkDB();
