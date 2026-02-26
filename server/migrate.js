require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'pvd',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const fs = require('fs');
const path = require('path');

async function migrate() {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS \`pvd_asignaciones\` (
              \`id\` int(11) NOT NULL AUTO_INCREMENT,
              \`operador_id\` varchar(15) CHARACTER SET latin1 COLLATE latin1_spanish_ci NOT NULL,
              \`fecha\` date NOT NULL,
              \`hora_ventana\` tinyint(4) NOT NULL,
              \`minuto_inicio\` tinyint(4) NOT NULL,
              \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              UNIQUE KEY \`unique_assignment\` (\`operador_id\`, \`fecha\`, \`hora_ventana\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_spanish_ci;
        `;

        console.log('Running migration...');
        await pool.query(query);
        console.log('Migration successful: pvd_asignaciones table created/verified.');
        fs.writeFileSync(path.join(__dirname, 'migration_status.txt'), `Success: ${new Date().toISOString()}`);
    } catch (err) {
        console.error('Migration failed:', err);
        fs.writeFileSync(path.join(__dirname, 'migration_status.txt'), `Failed: ${err.message}`);
    }
}

migrate();
