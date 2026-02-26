const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_me_in_prod';

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'pvd',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
});

// Init DB
async function initDB(attempts = 1) {
    try {
        // Auto-Migration: Rename table if exists
        const [tables] = await pool.query("SHOW TABLES LIKE 'pvd_asignaciones'");
        if (tables.length > 0) {
            console.log("Migrating pvd_asignaciones to pvd_assignments...");
            await pool.query("RENAME TABLE pvd_asignaciones TO pvd_assignments");
            await pool.query("ALTER TABLE pvd_assignments CHANGE fecha date DATE NOT NULL");
            await pool.query("ALTER TABLE pvd_assignments CHANGE hora_ventana window_hour INT NOT NULL");
            await pool.query("ALTER TABLE pvd_assignments CHANGE minuto_inicio start_minute INT NOT NULL");
            await pool.query("ALTER TABLE pvd_assignments CHANGE operador_id operator_id VARCHAR(50) NOT NULL");
            console.log("Migration complete.");
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS stations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                addressIP VARCHAR(45) NOT NULL UNIQUE,
                userID VARCHAR(50),
                stateID INT DEFAULT 0,
                timer VARCHAR(20) DEFAULT '00:00:00',
                timeSTAMP TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KeepAlive TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("DB Initialized: stations ready.");

        // Seed Stations if empty
        const [stations] = await pool.query("SELECT * FROM stations");
        if (stations.length === 0) {
            console.log("Seeding 20 initial stations...");
            for (let i = 1; i <= 20; i++) {
                // Determine subnet based on index or just flat?
                // Using 10.207.201.1XX pattern from existing code/knowledge or just generic
                // The frontend shows "10.207.201.101 -> 01", so let's use that pattern.
                const ipSuffix = 100 + i;
                const ip = `10.207.201.${ipSuffix}`;
                try {
                    await pool.query("INSERT INTO stations (addressIP, stateID) VALUES (?, 0)", [ip]);
                } catch (e) { console.error(e); }
            }
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS operator_activity (
                id INT AUTO_INCREMENT PRIMARY KEY,
                operator_id VARCHAR(50) NOT NULL,
                activity_type VARCHAR(50) NOT NULL,
                state_from INT,
                state_to INT,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_operator (operator_id),
                INDEX idx_created_at (created_at)
            )
        `);
        console.log("DB Initialized: operator_activity ready.");

        // Ensure assignments table exists (might be fresh DB)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pvd_assignments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                operator_id VARCHAR(50) NOT NULL,
                date DATE NOT NULL,
                window_hour INT NOT NULL,
                start_minute INT NOT NULL,
                UNIQUE KEY unique_assignment (operator_id, date, window_hour)
            )
        `);
        console.log("DB Initialized: pvd_assignments ready.");

        // Create Users Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('OPERATOR', 'SUPERVISOR') DEFAULT 'OPERATOR',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("DB Initialized: users ready.");

        // Seed/Migrate Users
        const [users] = await pool.query("SELECT * FROM users WHERE username = 'admin'");
        if (users.length === 0) {
            const adminHash = await bcrypt.hash('admin123', 10);
            await pool.query("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['admin', adminHash, 'SUPERVISOR']);
            console.log("Created default admin user.");
        }

        // Migrate existing operators from history (Activity Log + Assignments)
        const [opsActivity] = await pool.query("SELECT DISTINCT operator_id FROM operator_activity");
        // Ensure table exists (it should now)
        const [opsAssignments] = await pool.query("SELECT DISTINCT operator_id FROM pvd_assignments");

        const allOps = new Set([
            ...opsActivity.map(o => o.operator_id),
            ...opsAssignments.map(o => o.operator_id)
        ]);

        const defaultPassHash = await bcrypt.hash('1234', 10);

        for (const opId of allOps) {
            if (!opId) continue;
            try {
                await pool.query("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [opId, defaultPassHash, 'OPERATOR']);
                console.log(`Migrated user: ${opId}`);
            } catch (e) {
                // Ignore duplicate error
            }
        }

    } catch (err) {
        console.error(`DB Init Error (Attempt ${attempts}):`, err.message);
        if (attempts < 5) {
            console.log(`Retrying DB connection in 3 seconds...`);
            setTimeout(() => initDB(attempts + 1), 3000);
        }
    }
}
// initDB() called before app.listen

// Helper: Log Activity
async function logActivity(pool, operatorId, type, stateFrom, stateTo, details = '') {
    try {
        if (!operatorId) return; // Anonymous tracking?
        await pool.query(
            'INSERT INTO operator_activity (operator_id, activity_type, state_from, state_to, details) VALUES (?, ?, ?, ?, ?)',
            [operatorId, type, stateFrom, stateTo, details]
        );
    } catch (err) {
        console.error("Activity Log Error:", err);
    }
}

// Helper: Format seconds to HH:MM:SS (handles negative)
function formatTime(totalSeconds) {
    const isNegative = totalSeconds < 0;
    const absSeconds = Math.abs(totalSeconds);
    const hours = Math.floor(absSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((absSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (absSeconds % 60).toString().padStart(2, '0');
    return `${isNegative ? '-' : ''}${hours}:${minutes}:${seconds}`;
}

// Helper: Parse HH:MM:SS to seconds
function parseSeconds(timeString) {
    if (!timeString) return 0;
    const isNegative = timeString.startsWith('-');
    const cleanTime = isNegative ? timeString.substring(1) : timeString;
    const [h, m, s] = cleanTime.split(':').map(Number);
    const total = (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    return isNegative ? -total : total;
}

// Helper: Calculate dynamic timer based on state and elapsed time
function calculateRealTimer(row) {
    // row.elapsed is seconds since timeSTAMP (from DB query)
    const elapsed = parseInt(row.elapsed) || 0;

    if (row.stateID == 0) return '00:00:00';

    if (row.stateID == 1) {
        // Active: Count UP (starts at 0)
        return formatTime(elapsed);
    } else {
        // Limit states (PVD, Pause...): Count DOWN
        // row.timer has the initial duration (e.g., 00:07:00)
        const initialDuration = parseSeconds(row.timer);
        const remaining = initialDuration - elapsed; // Can be negative now
        return formatTime(remaining);
    }
}

// Helper: Get Station IP from header or request
function getStationIP(req) {
    // Prioritize custom header set by frontend
    if (req.headers['x-station-ip']) {
        return req.headers['x-station-ip'];
    }
    // Fallback to detected IP (legacy/dev support)
    return req.clientIp;
}

// Middleware: Authenticate Token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}


app.use(async (req, res, next) => {
    const ip = req.headers['x-real-ip'] || req.ip;
    const cleanIp = ip.replace(/^::ffff:/, '');
    req.clientIp = cleanIp;
    try {
        // We still keepalive based on physical connection for diagnostics
        await pool.query('UPDATE stations SET KeepAlive = NOW() WHERE addressIP = ?', [cleanIp]);
        next();
    } catch (err) {
        console.error('Database Error in Middleware:', err);
        next();
    }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// GET /api/station
app.get('/api/station', async (req, res) => {
    try {
        const stationIP = getStationIP(req);
        // Check time difference
        const [rows] = await pool.query(
            `SELECT *, TIMESTAMPDIFF(SECOND, timeSTAMP, NOW()) as elapsed 
             FROM stations WHERE addressIP = ?`,
            [stationIP]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Station not found', ip: stationIP });
        }
        const station = rows[0];

        // Use calculated timer
        const currentTimer = calculateRealTimer(station);

        // Fetch current PVD assignment if user is logged in
        let pvdAssignment = null;
        if (station.userID) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTotalMinutes = currentHour * 60 + currentMinute;
            const dateStr = now.toISOString().split('T')[0];

            // Fetch generic assignments for this user for current and next hour
            // Increased limit to find the *next* valid one if the first one is passed
            const [pvdRows] = await pool.query(
                'SELECT window_hour, start_minute FROM pvd_assignments WHERE operator_id = ? AND date = ? AND (window_hour = ? OR window_hour = ?) ORDER BY window_hour ASC, start_minute ASC LIMIT 5',
                [station.userID, dateStr, currentHour, (currentHour + 1) % 24]
            );

            // Iterate to find the "active" or "next" assignment
            for (const row of pvdRows) {
                const slotTotalMinutes = row.window_hour * 60 + row.start_minute;
                const endTotalMinutes = slotTotalMinutes + 7; // PVD lasts 7 mins

                // If currently in PVD (State 2), we prioritize the assignment that covers "now" or was just recent
                // But for simplicity/robustness match the user request: "When returns to active... show next".
                // So if State is 1 (Active), strictly filter out expired slots.

                if (station.stateID !== 2) {
                    // Active/Other: Show first slot that hasn't ended yet
                    if (endTotalMinutes > currentTotalMinutes) {
                        pvdAssignment = {
                            hour: row.window_hour,
                            slot: row.start_minute
                        };
                        break; // Found the next one
                    }
                } else {
                    // State 2 (PVD): Show the slot closest to current time, usually the one we are "in".
                    // Even if we overrun slightly, keep showing it?
                    // Let's accept if it ended within last 15 mins? Or just standard logic?
                    // To keep it simple and consistent: If in PVD, show the most relevant one (likely the first one that hasn't ended OR the one we just passed).

                    // Actually, if we are in PVD, we likely want to see the start time of the CURRENT PVD.
                    // So we accept a slot even if endTotalMinutes < currentTotalMinutes (overrun),
                    // provided it's "close enough" (e.g. started recently).

                    // Logic: If (now - start) < 20 mins?
                    const diff = currentTotalMinutes - slotTotalMinutes;
                    if (diff > -10 && diff < 20) {
                        pvdAssignment = {
                            hour: row.window_hour,
                            slot: row.start_minute
                        };
                        break;
                    }
                    // Fallback to next standard
                    if (endTotalMinutes > currentTotalMinutes) {
                        pvdAssignment = {
                            hour: row.window_hour,
                            slot: row.start_minute
                        };
                        break;
                    }
                }
            }
        }

        res.json({
            usuario: station.userID,
            pvdAssignment: pvdAssignment, // Return actual assignment
            stateID: station.stateID,
            timer: currentTimer,
            ip: station.addressIP,
            data: station
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Import PVD logic
const { assignPVD, calculateLoad } = require('./pvd');

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Missing credentials' });

    try {
        // 1. Verify Credentials
        const [users] = await pool.query("SELECT * FROM users WHERE username = ?", [login]);
        if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = users[0];
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(401).json({ error: 'Invalid credentials' });

        // 2. Generate JWT
        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });

        // 3. Update Tracking (Legacy Support + IP Binding for Station)
        const stationIP = getStationIP(req);
        // Reset state to Active (1) and timer to 0, update timestamp
        await pool.query(
            'UPDATE stations SET userID = ?, stateID = 1, timer = "00:00:00", timeSTAMP = NOW() WHERE addressIP = ?',
            [login, stationIP]
        );

        // PVD Assignment (Only for OPERATORS)
        let pvdResult = null;
        if (user.role === 'OPERATOR') {
            pvdResult = await assignPVD(pool, login, new Date());
        }

        // Log Login
        await logActivity(pool, login, 'LOGIN', null, 1, 'User logged in');

        res.json({ status: 'OK', token, role: user.role, pvd: pvdResult });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/pvd/schedule
// Returns the load map for the current hour (and maybe next hour?)
app.get('/api/pvd/schedule', async (req, res) => {
    try {
        const now = new Date();
        const hour = now.getHours();
        const dateStr = now.toISOString().split('T')[0];

        // We need previous hour for continuity
        const prevHour = (hour - 1 + 24) % 24;
        let prevDateStr = dateStr;
        if (hour === 0) {
            const d = new Date(now);
            d.setDate(d.getDate() - 1);
            prevDateStr = d.toISOString().split('T')[0];
        }

        const [rows] = await pool.query(
            `SELECT window_hour, start_minute 
             FROM pvd_assignments 
             WHERE (date = ? AND window_hour = ?) OR (date = ? AND window_hour = ?)`,
            [dateStr, hour, prevDateStr, prevHour]
        );

        const currentAssignments = rows.filter(r => r.window_hour === hour);
        const prevAssignments = rows.filter(r => r.window_hour === prevHour);

        // We need to export calculateLoad from pvd.js or duplicate it. 
        // I will update pvd.js to export it first.
        // Actually I already did in the previous step (I planned to).
        // Let's assume pvd.js exports it.

        // Wait, I need to check if I exported calculateLoad in pvd.js. 
        // In the write_to_file call for pvd.js, I only did `module.exports = { assignPVD };`.
        // I need to update pvd.js exports first.
        // But for now let's finish this endpoint assuming it will be there.

        // Note: calculateLoad logic is:
        // Input: two arrays of assignments. Output: Array[60].

        // If I can't import it yet, I will fail.
        // So I'll just write the endpoint structure and then update pvd.js to export the helper.

        // For now, let's just return the assignments and let frontend calculate? 
        // No, prompt says "Backend... calculate density".

        // So:
        const load = calculateLoad(currentAssignments, prevAssignments);
        res.json({ hour, load, assignments: currentAssignments.length });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/logout
app.post('/api/logout', async (req, res) => {
    try {
        const stationIP = getStationIP(req);

        // 1. Get User ID before clearing it
        const [rows] = await pool.query('SELECT userID, stateID FROM stations WHERE addressIP = ?', [stationIP]);

        if (rows.length > 0 && rows[0].userID) {
            const userID = rows[0].userID;
            const currentState = rows[0].stateID;
            const today = new Date().toISOString().split('T')[0];

            // 2. Delete PVD Assignments for this user BUT keep the first active/future one
            // This ensures if they log back in immediately, they get the same slot.
            const [assignments] = await pool.query(
                `SELECT id, date, window_hour, start_minute 
                 FROM pvd_assignments 
                 WHERE operator_id = ? 
                 ORDER BY date ASC, window_hour ASC, start_minute ASC`,
                [userID]
            );

            let keepId = null;
            const now = new Date();

            for (const r of assignments) {
                // Construct assignment end time
                const assignDate = new Date(r.date);
                assignDate.setHours(r.window_hour, r.start_minute + 7, 0, 0); // +7 mins duration

                if (assignDate > now) {
                    keepId = r.id;
                    break; // Found the first active or future assignment
                }
            }

            if (keepId) {
                await pool.query(
                    'DELETE FROM pvd_assignments WHERE operator_id = ? AND id != ?',
                    [userID, keepId]
                );
            } else {
                // No future assignments, delete all
                await pool.query(
                    'DELETE FROM pvd_assignments WHERE operator_id = ?',
                    [userID]
                );
            }

            // Log Logout
            await logActivity(pool, userID, 'LOGOUT', currentState, 0, 'User logged out');
        }

        // 3. Clear Tracking Session
        await pool.query(
            'UPDATE stations SET userID = NULL, stateID = 0, timer = "00:00:00", timeSTAMP = NOW() WHERE addressIP = ?',
            [stationIP]
        );
        res.json({ status: 'OK' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/command
app.post('/api/command', authenticateToken, async (req, res) => {
    const { c, t } = req.body;
    if (!c) return res.status(400).json({ error: 'Missing command' });

    // Ensure the token user matches the station user (Prevent spoofing)
    // Or just trust the token user is performing the action?
    // Let's trust the token user.
    const username = req.user.username;

    try {
        const stationIP = getStationIP(req);
        const [rows] = await pool.query('SELECT stateID, TIMESTAMPDIFF(SECOND, timeSTAMP, NOW()) as elapsed FROM stations WHERE addressIP = ?', [stationIP]);
        if (rows.length === 0) return res.status(404).json({ error: 'Station not found' });
        const currentState = rows[0].stateID;
        const elapsedSeconds = rows[0].elapsed;

        let newState = null;
        let newTimer = null;
        let shouldSave = false;

        // Define Logic
        if (c === 'activo') {
            if (currentState > 1) {
                newState = 1;
                newTimer = '00:00:00';
                shouldSave = true;
            }
        } else if (c === 'pvd' && currentState === 1) {
            newState = 2;
            newTimer = '00:07:00';
            shouldSave = true;
        } else if (c === 'pause' && currentState === 1) {
            newState = 3;
            newTimer = t ? `00:${t}:00` : '00:05:00';
            shouldSave = true;
        } else if (c === 'formacion' && currentState === 1) {
            newState = 4;
            newTimer = '00:15:00';
            shouldSave = true;
        } else if (c === 'gerencia' && currentState === 1) {
            newState = 5;
            newTimer = '00:30:00';
            shouldSave = true;
        } else if (c === 'suplencia' && currentState === 1) {
            newState = 6;
            newTimer = '00:55:00';
            shouldSave = true;
        }

        if (shouldSave) {
            // Update timestamp to NOW() so elapsed calc starts from 0
            await pool.query(
                'UPDATE stations SET stateID = ?, timer = ?, timeSTAMP = NOW() WHERE addressIP = ?',
                [newState, newTimer, stationIP]
            );

            // Log State Change
            // Fetch UserID first? 
            const [userRows] = await pool.query('SELECT userID FROM stations WHERE addressIP = ?', [stationIP]);
            if (userRows.length > 0 && userRows[0].userID) {
                let logDetails = `Command: ${c}`;

                // If switching BACK to Active (1) from a pause (state > 1), log the duration of that pause
                if (newState === 1 && currentState > 1) {
                    const durationStr = formatTime(elapsedSeconds);
                    logDetails += ` | Duration: ${durationStr}`;
                }

                await logActivity(pool, userRows[0].userID, 'STATE_CHANGE', currentState, newState, logDetails);
            }
        }

        res.json({ status: 'OK', state: newState });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/stations
app.get('/api/stations', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT *, TIMESTAMPDIFF(SECOND, timeSTAMP, NOW()) as elapsed FROM stations');

        const response = rows.map(row => ({
            id: row.id,
            login: row.userID,
            stateID: row.stateID,
            timer: calculateRealTimer(row), // Calculate dynamic timer
            ip: row.addressIP
        }));

        res.json(response);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/activity (Supervisor)
app.get('/api/activity', authenticateToken, async (req, res) => {
    // RBAC Check
    if (req.user.role !== 'SUPERVISOR') {
        return res.sendStatus(403);
    }

    try {
        const { date, operator } = req.query;
        let query = 'SELECT * FROM operator_activity WHERE 1=1';
        const params = [];

        if (date) {
            query += ' AND DATE(created_at) = ?';
            params.push(date);
        } else {
            // Default to today if no date? Or last 100?
            // Let's default to today to keep it snappy
            query += ' AND DATE(created_at) = CURDATE()';
        }

        if (operator) {
            query += ' AND operator_id LIKE ?';
            params.push(`%${operator}%`);
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/users (Supervisor)
app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'SUPERVISOR') return res.sendStatus(403);
    try {
        const [rows] = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/users (Supervisor)
app.post('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'SUPERVISOR') return res.sendStatus(403);
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const finalRole = role === 'SUPERVISOR' ? 'SUPERVISOR' : 'OPERATOR';
        await pool.query('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, finalRole]);
        res.json({ status: 'OK' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'User already exists' });
        }
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/change-password (Authenticated User)
app.post('/api/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });

    try {
        const username = req.user.username;
        // Verify current password
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = users[0];
        const validPass = await bcrypt.compare(currentPassword, user.password_hash);
        if (!validPass) return res.status(400).json({ error: 'La contraseña actual es incorrecta' });

        // Hash new password
        const newHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

        res.json({ status: 'OK' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE /api/users/:id (Supervisor)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'SUPERVISOR') return res.sendStatus(403);
    const userId = req.params.id;

    try {
        // Check if user is admin
        const [users] = await pool.query('SELECT username FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        if (users[0].username === 'admin') {
            return res.status(403).json({ error: 'Cannot delete admin user' });
        }

        await pool.query('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ status: 'OK' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});



// POST /api/stations (Supervisor)
app.post('/api/stations', authenticateToken, async (req, res) => {
    if (req.user.role !== 'SUPERVISOR') return res.sendStatus(403);
    const { ip } = req.body;

    // Basic IP Validation (Optional but good)
    // const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    // if (!ipRegex.test(ip)) return res.status(400).json({ error: 'Invalid IP format' });

    if (!ip) return res.status(400).json({ error: 'Missing IP' });

    try {
        await pool.query('INSERT INTO stations (addressIP, stateID) VALUES (?, 0)', [ip]);
        res.json({ status: 'OK' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Station IP already exists' });
        }
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE /api/stations/:id (Supervisor)
app.delete('/api/stations/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'SUPERVISOR') return res.sendStatus(403);
    const stationId = req.params.id;

    try {
        await pool.query('DELETE FROM stations WHERE id = ?', [stationId]);
        res.json({ status: 'OK' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});



// GET /api/assignments (Supervisor)
app.get('/api/assignments', authenticateToken, async (req, res) => {
    if (req.user.role !== 'SUPERVISOR') return res.sendStatus(403);
    const { date } = req.query;

    try {
        let query = 'SELECT * FROM pvd_assignments';
        const params = [];

        // Resolve target date
        const targetDateStr = date || new Date().toISOString().split('T')[0];

        query += ' WHERE date = ?';
        params.push(targetDateStr);

        // Order by time to ensure we iterate chronological
        query += ' ORDER BY window_hour ASC, start_minute ASC';

        const [rows] = await pool.query(query, params);

        // Filter: One per user (The next one)
        const now = new Date();
        const currentDateStr = now.toISOString().split('T')[0];
        const isToday = targetDateStr === currentDateStr;
        // Current time in minutes for comparison
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const userMap = new Map();

        for (const row of rows) {
            // If we already picked the "next" assignment for this user, skip others
            if (userMap.has(row.operator_id)) continue;

            if (isToday) {
                const rowMinutes = row.window_hour * 60 + row.start_minute;
                // If assignment is in the past, skip it.
                // Because of ORDER BY ASC, the first one we don't skip is the immediate next one.
                if (rowMinutes < currentMinutes) continue;
            }

            // Found the first valid one
            userMap.set(row.operator_id, row);
        }

        res.json(Array.from(userMap.values()));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

const PORT = 3000;

// Start Server strictly after DB Init
(async () => {
    await initDB();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
})();
