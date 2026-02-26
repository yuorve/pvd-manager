const { assignPVD } = require('./server/pvd');

// Mock Database State
const pvd_assignments = [];

// Mock Pool
const pool = {
    query: async (sql, params) => {
        const sqlLower = sql.toLowerCase();

        // 1. SELECT assignments
        if (sqlLower.includes('select') && sqlLower.includes('from pvd_assignments')) {
            // "SELECT ... WHERE (date = ? AND window_hour = ?) ..."
            // We can just return ALL relevant mock data for simplicity or filter if needed
            // The params usually are [date, hour, prevDate, prevHour] or [opId, date, hour]

            // Simple filter: return everything that matches the date/hour requested
            // But for the "Check ALREADY has" query:
            if (sqlLower.includes('operator_id = ?')) {
                const [opId, date, hour] = params;
                const found = pvd_assignments.filter(r =>
                    r.operator_id === opId && r.date === date && r.window_hour === hour
                );
                return [found];
            }

            // For the "Calculate Load" query:
            // "WHERE (date = ? AND window_hour = ?) OR ..."
            // We just return everything for now to let logic filter, or filter roughly
            return [pvd_assignments];
        }

        // 2. INSERT ... ON DUPLICATE KEY ...
        if (sqlLower.includes('insert into pvd_assignments')) {
            const [operator_id, date, window_hour, start_minute] = params;

            // Check duplicate (Composite key: op_id, date, hour)
            const idx = pvd_assignments.findIndex(r =>
                r.operator_id === operator_id && r.date === date && r.window_hour === window_hour
            );

            if (idx >= 0) {
                // Update (idempotent in this case)
                pvd_assignments[idx].start_minute = start_minute;
            } else {
                pvd_assignments.push({
                    operator_id, date, window_hour, start_minute
                });
            }
            return [{ insertId: 0 }];
        }

        return [[]];
    }
};

async function runSimulation() {
    console.log("--- Simulating PVD Assignment for 20 Operators ---");
    console.log("Conditions: Login at 08:00 (Grace period -> starts 08:30). Target Hour: 08:00 (or 09:00 if late).\n");

    const operators = Array.from({ length: 20 }, (_, i) => `OP_${i + 1}`);
    const loginTime = new Date();
    loginTime.setHours(8, 0, 0, 0); // 08:00

    const results = [];

    for (const op of operators) {
        // Simulate slightly different login minutes? Or all at once?
        // User said "simular la entrada de 20 operadores". 
        // Let's vary them slightly: 08:00 to 08:10
        const randomOffset = Math.floor(Math.random() * 10);
        const myLogin = new Date(loginTime);
        myLogin.setMinutes(randomOffset);

        try {
            const res = await assignPVD(pool, op, myLogin);
            results.push({
                Operator: op,
                Login: myLogin.toLocaleTimeString(),
                AssignedSlot: res.slot,
                Hour: res.hour
            });
        } catch (e) {
            console.error(`Error for ${op}:`, e);
        }
    }

    console.table(results);

    // Distribution visualization
    console.log("\n--- Timeline Distribution (Hour 8) ---");
    const timeline = new Array(60).fill('.');
    pvd_assignments
        .filter(r => r.window_hour === results[0].Hour) // Filter for the target hour
        .forEach(r => {
            if (timeline[r.start_minute] === '.') {
                timeline[r.start_minute] = 'X';
            } else {
                // Collision check (visual)
                const val = timeline[r.start_minute];
                timeline[r.start_minute] = val === 'X' ? '2' : String(Number(val) + 1);
            }
        });

    console.log(timeline.join(''));
    console.log("00       10        20        30        40        50        59");
}

runSimulation();
