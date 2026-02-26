const mysql = require('mysql2/promise');
require('dotenv').config();

// ... calculateLoad function (unchanged) ...
function calculateLoad(currentHourAssignments, previousHourAssignments) {
    const load = new Array(60).fill(0);
    previousHourAssignments.forEach(a => {
        const start = a.start_minute;
        const end = start + 7;
        if (end > 60) {
            const spill = end - 60;
            for (let i = 0; i < spill; i++) {
                load[i]++;
            }
        }
    });
    currentHourAssignments.forEach(a => {
        const start = a.start_minute;
        for (let i = 0; i < 7; i++) {
            load[(start + i) % 60]++;
        }
    });
    return load;
}

// ... findBestSlot function (unchanged) ...
function findBestSlot(loadMap, minStartMinute = 0) {
    let minPeakLoad = Infinity;
    let candidates = [];

    // 1. Identify valid candidates with minimal peak load
    for (let start = minStartMinute; start < 60; start++) {
        let currentPeak = -1;

        // Circular check of 7 minutes
        for (let i = 0; i < 7; i++) {
            const minuteToCheck = (start + i) % 60;
            if (loadMap[minuteToCheck] > currentPeak) {
                currentPeak = loadMap[minuteToCheck];
            }
        }

        if (currentPeak < minPeakLoad) {
            minPeakLoad = currentPeak;
            candidates = [start];
        } else if (currentPeak === minPeakLoad) {
            candidates.push(start);
        }
    }

    if (candidates.length === 0) return minStartMinute;

    // Check if map is empty (Optimization)
    const totalAssignments = loadMap.reduce((a, b) => a + b, 0);
    if (totalAssignments === 0) {
        const randomIndex = Math.floor(Math.random() * candidates.length);
        return candidates[randomIndex];
    }

    const scoredCandidates = candidates.map(start => {
        let leftDist = 0;
        for (let i = 1; i < 60; i++) {
            const check = (start - i + 60) % 60;
            if (loadMap[check] > 0) break;
            leftDist++;
        }

        let rightDist = 0;
        for (let i = 0; i < 60; i++) {
            const check = (start + 7 + i) % 60;
            if (loadMap[check] > 0) break;
            rightDist++;
        }

        const score = Math.min(leftDist, rightDist);
        return { start, score };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);

    const bestScore = scoredCandidates[0].score;
    const bestOfBest = scoredCandidates.filter(c => c.score === bestScore);

    const randomIndex = Math.floor(Math.random() * bestOfBest.length);
    return bestOfBest[randomIndex].start;
}


async function assignPVD(pool, operatorId, timestamp = new Date()) {
    const loginTime = new Date(timestamp);
    const loginHour = loginTime.getHours();
    const loginMinute = loginTime.getMinutes();

    // Check constraints
    // 1. Scan full hour (0-59) for optimal slot.
    // If optimal slot < loginMinute -> Start NEXT hour.
    // logical flow:
    let targetHour = loginHour;
    let targetDate = new Date(loginTime); // Clone
    const dateStr = targetDate.toISOString().split('T')[0];

    // Prepare previous hour for load calculation
    const prevHour = (targetHour - 1 + 24) % 24;
    let prevDateStr = dateStr;
    if (targetHour === 0) {
        const d = new Date(targetDate);
        d.setDate(d.getDate() - 1);
        prevDateStr = d.toISOString().split('T')[0];
    }

    try {
        // ... (queries unchanged) ...
        const [rows] = await pool.query(
            `SELECT window_hour, start_minute, operator_id 
             FROM pvd_assignments 
             WHERE (date = ? AND window_hour = ?) OR (date = ? AND window_hour = ?)`,
            [dateStr, targetHour, prevDateStr, prevHour]
        );

        // Check if THIS operator already has an assignment in the target hour
        const [myRows] = await pool.query(
            `SELECT start_minute FROM pvd_assignments 
             WHERE operator_id = ? AND date = ? AND window_hour = ?`,
            [operatorId, dateStr, targetHour]
        );

        let assignedMinute;
        let startHour = targetHour;
        let startDate = new Date(targetDate);

        if (myRows.length > 0) {
            // Use existing assignment
            assignedMinute = myRows[0].start_minute;
            // No need to calculate load or find best slot
        } else {
            // New Assignment Calculation
            const currentAssignments = rows.filter(r => r.window_hour === targetHour);
            const prevAssignments = rows.filter(r => r.window_hour === prevHour);

            const loadMap = calculateLoad(currentAssignments, prevAssignments);
            // Find best slot in full hour (0-59)
            assignedMinute = findBestSlot(loadMap, 0);

            // If optimal slot is in the past for this login, push to next hour
            if (assignedMinute < loginMinute) {
                startHour++;
                if (startHour >= 24) {
                    startHour = 0;
                    startDate.setDate(startDate.getDate() + 1);
                }
            }
        }

        // *** RECURRENCE LOGIC ***
        // Insert for the next 10 hours (Shift duration safe upper bound)
        const shiftDuration = 10;

        let currentLoopDate = new Date(startDate);
        let currentLoopHour = startHour;

        for (let i = 0; i < shiftDuration; i++) {
            const dateString = currentLoopDate.toISOString().split('T')[0];

            await pool.query(
                `INSERT INTO pvd_assignments (operator_id, date, window_hour, start_minute) 
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE start_minute = start_minute`, // Idempotent
                [operatorId, dateString, currentLoopHour, assignedMinute]
            );

            // Increment hour
            currentLoopHour++;
            if (currentLoopHour >= 24) {
                currentLoopHour = 0;
                currentLoopDate.setDate(currentLoopDate.getDate() + 1);
            }
        }

        return {
            slot: assignedMinute,
            hour: startHour, // Return the actua start hour
            date: startDate.toISOString().split('T')[0]
        };

    } catch (err) {
        console.error("AssignPVD Error:", err);
        throw err;
    }
}

module.exports = { assignPVD, calculateLoad };
