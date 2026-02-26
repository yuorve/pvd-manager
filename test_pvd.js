const { assignPVD, calculateLoad } = require('./server/pvd');

// Mock Pool
const mockPool = {
    assignments: [],
    query: async (sql, params) => {
        if (sql.includes('SELECT')) {
            // Simulate SELECT
            // params: [dateStr, targetHour, prevDateStr, prevHour]
            const [date, hour, prevDate, prevHour] = params;
            return [mockPool.assignments.filter(a =>
                (a.fecha === date && a.hora_ventana === hour) ||
                (a.fecha === prevDate && a.hora_ventana === prevHour)
            )];
        } else if (sql.includes('INSERT')) {
            // Simulate INSERT
            // params: [operatorId, dateStr, targetHour, assignedMinute]
            const [id, date, hour, minute] = params;
            // Check duplicate
            const exists = mockPool.assignments.find(a => a.operador_id === id && a.fecha === date && a.hora_ventana === hour);
            if (exists) {
                const err = new Error('Dup');
                err.code = 'ER_DUP_ENTRY';
                throw err;
            }
            mockPool.assignments.push({
                operador_id: id,
                fecha: date,
                hora_ventana: hour,
                minuto_inicio: minute
            });
            return [{ insertId: 1 }];
        }
        return [[]];
    }
};

async function runTests() {
    console.log('--- Starting PVD Logic Tests ---');

    // TEST 1: Basic Assignment
    console.log('\nTest 1: Basic Assignment (Empty Schedule)');
    mockPool.assignments = [];
    const t1 = await assignPVD(mockPool, 'USER1', new Date('2026-02-14T10:00:00'));
    console.log('Result:', t1);
    if (t1.hour === 10 && t1.slot >= 30) console.log('PASS: Correct hour and grace period compliance');
    else console.error('FAIL');

    // TEST 2: High Load at 30-35
    console.log('\nTest 2: High Load Avoidance');
    mockPool.assignments = [];
    // Manually fill mins 30-36 for hour 10
    // Load generation: 10 operators assigned at min 30
    for (let i = 0; i < 10; i++) {
        mockPool.assignments.push({ operador_id: `BOT${i}`, fecha: '2026-02-14', hora_ventana: 10, minuto_inicio: 30 });
    }

    // User login at 10:00 -> Min start 30.
    // Algorithm should avoid 30-37 range if possible?
    // Wait, pause is 7 mins.
    // If 10 ppl start at 30, then [30-36] has load 10.
    // If I start at 30, load becomes 11.
    // If I start at 37, load is 0 (assuming empty otherwise).

    const t2 = await assignPVD(mockPool, 'USER2', new Date('2026-02-14T10:00:00'));
    console.log('Result:', t2);
    // Expect something NOT in 30
    if (t2.slot !== 30) console.log('PASS: Avoided peak at 30');
    else console.warn('WARN: Picked 30 (maybe random or logic issue?)');

    // TEST 3: Next Hour Spillover
    console.log('\nTest 3: Grace Period -> Next Hour');
    // Login at 10:45 -> 30 min grace -> 11:15
    const t3 = await assignPVD(mockPool, 'USER3', new Date('2026-02-14T10:45:00'));
    console.log('Result:', t3);
    if (t3.hour === 11 && t3.slot >= 15) console.log('PASS: Wrapped to next hour correctly');
    else console.error('FAIL');

    // TEST 4: Previous Hour Spillover Impact
    console.log('\nTest 4: Previous Hour Spillover');
    mockPool.assignments = [];
    // Previous hour (9) has massive assignments at 55 -> Spills to 10:00, 10:01
    for (let i = 0; i < 20; i++) {
        mockPool.assignments.push({ operador_id: `PREV${i}`, fecha: '2026-02-14', hora_ventana: 9, minuto_inicio: 55 });
    }
    // Login at 10:00 -> Min start 30 (Grace period makes Spillover checking less relevant for THIS user, but checks logic)
    // Let's force a login at 09:30 -> Min start 00 of 10:00? 
    // No, 9:30 -> 10:00 start.
    // Algorithm for 10:00 checks load.
    // Load at 00, 01 should be 20.
    // Load at 10 should be 0.

    // We can't verify calculateLoad directly via assignPVD easily without return value inspection or looking at logs.
    // But we know spillover logic is in calculateLoad.

    const assignments9 = mockPool.assignments.filter(a => a.hora_ventana === 9);
    const load = calculateLoad([], assignments9);
    console.log('Load at min 0:', load[0]);
    console.log('Load at min 1:', load[1]);
    console.log('Load at min 2:', load[2]); // 55+7 = 62 -> Spills 0, 1. Min 2 should be 0.

    if (load[0] === 20 && load[1] === 20 && load[2] === 0) console.log('PASS: Spillover logic correct');
    else console.error('FAIL: Load map incorrect');

    // TEST 5: Distribution Logic (Avoid Hugging)
    console.log('\nTest 5: Distribution (Avoid hugging)');
    mockPool.assignments = [];
    // User 1 at 57. Occupies 57, 58, 59.
    mockPool.assignments.push({ operador_id: 'USER1', fecha: '2026-02-14', hora_ventana: 10, minuto_inicio: 57 });

    // User 2 logs in. Min start 0.
    // If logic works, it should pick something far from 57 (e.g. 20-30), NOT 50.
    const t5 = await assignPVD(mockPool, 'USER2', new Date('2026-02-14T09:30:00')); // 9:30 -> 10:00 start
    console.log('Result:', t5);

    // Dist from 57:
    // Slot 50: -7 diff.
    // Slot 25: -32 diff.
    // Slot 0: -57 diff.
    // 0 is far left. 
    // Left dist for 0: 0 (boundary). Right dist: 57-7=50. Score 0 (limited by boundary).
    // Slot 25: Left 25. Right 57-32=25. Score 25.
    // Slot 50: Left 50. Right 0. Score 0.

    // Ideally 25 (center) is best.
    if (t5.slot >= 20 && t5.slot <= 35) console.log('PASS: Distributed to center');
    else console.warn(`WARN: Slot ${t5.slot} picked. Check if it's better than 50.`);

}

runTests();
