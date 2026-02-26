-- ==========================================================
-- ARCHIVO: example.sql
-- PROPÓSITO: Inyectar carga de 15 operadores para el Demo Day
-- ==========================================================

-- 1. Crear usuarios MOCK en la tabla de usuarios
INSERT IGNORE INTO users (username, password_hash, role) VALUES 
('MOCK_01', 'demo', 'OPERATOR'),
('MOCK_02', 'demo', 'OPERATOR'),
('MOCK_03', 'demo', 'OPERATOR'),
('MOCK_04', 'demo', 'OPERATOR'),
('MOCK_05', 'demo', 'OPERATOR'),
('MOCK_06', 'demo', 'OPERATOR'),
('MOCK_07', 'demo', 'OPERATOR'),
('MOCK_08', 'demo', 'OPERATOR'),
('MOCK_09', 'demo', 'OPERATOR'),
('MOCK_10', 'demo', 'OPERATOR'),
('MOCK_11', 'demo', 'OPERATOR'),
('MOCK_12', 'demo', 'OPERATOR'),
('MOCK_13', 'demo', 'OPERATOR'),
('MOCK_14', 'demo', 'OPERATOR'),
('MOCK_15', 'demo', 'OPERATOR');

-- 2. Conectar a los operadores a las primeras 15 estaciones
UPDATE stations SET userID = 'MOCK_01', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 1;
UPDATE stations SET userID = 'MOCK_02', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 2;
UPDATE stations SET userID = 'MOCK_03', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 3;
UPDATE stations SET userID = 'MOCK_04', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 4;
UPDATE stations SET userID = 'MOCK_05', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 5;
UPDATE stations SET userID = 'MOCK_06', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 6;
UPDATE stations SET userID = 'MOCK_07', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 7;
UPDATE stations SET userID = 'MOCK_08', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 8;
UPDATE stations SET userID = 'MOCK_09', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 9;
UPDATE stations SET userID = 'MOCK_10', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 10;
UPDATE stations SET userID = 'MOCK_11', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 11;
UPDATE stations SET userID = 'MOCK_12', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 12;
UPDATE stations SET userID = 'MOCK_13', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 13;
UPDATE stations SET userID = 'MOCK_14', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 14;
UPDATE stations SET userID = 'MOCK_15', stateID = 1, timer = '00:00:00', timeSTAMP = NOW() WHERE id = 15;

-- 3. Crear asignaciones de PVD dispersas en la hora actual
-- Nota: PVD Manager lee pvd_assignments para calcular la densidad
INSERT INTO pvd_assignments (operator_id, date, window_hour, start_minute) VALUES 
('MOCK_01', CURDATE(), HOUR(NOW()), 2),
('MOCK_02', CURDATE(), HOUR(NOW()), 6),
('MOCK_03', CURDATE(), HOUR(NOW()), 10),
('MOCK_04', CURDATE(), HOUR(NOW()), 14),
('MOCK_05', CURDATE(), HOUR(NOW()), 18),
('MOCK_06', CURDATE(), HOUR(NOW()), 22),
('MOCK_07', CURDATE(), HOUR(NOW()), 26),
('MOCK_08', CURDATE(), HOUR(NOW()), 30),
('MOCK_09', CURDATE(), HOUR(NOW()), 34),
('MOCK_10', CURDATE(), HOUR(NOW()), 38),
('MOCK_11', CURDATE(), HOUR(NOW()), 42),
('MOCK_12', CURDATE(), HOUR(NOW()), 46),
('MOCK_13', CURDATE(), HOUR(NOW()), 50),
('MOCK_14', CURDATE(), HOUR(NOW()), 54),
('MOCK_15', CURDATE(), HOUR(NOW()), 58)
ON DUPLICATE KEY UPDATE start_minute = VALUES(start_minute);

-- También insertamos para la SIGUIENTE hora, por si la demo dura bastante o transiciona de hora
INSERT INTO pvd_assignments (operator_id, date, window_hour, start_minute) VALUES 
('MOCK_01', CURDATE(), (HOUR(NOW()) + 1) % 24, 2),
('MOCK_02', CURDATE(), (HOUR(NOW()) + 1) % 24, 6),
('MOCK_03', CURDATE(), (HOUR(NOW()) + 1) % 24, 10),
('MOCK_04', CURDATE(), (HOUR(NOW()) + 1) % 24, 14),
('MOCK_05', CURDATE(), (HOUR(NOW()) + 1) % 24, 18),
('MOCK_06', CURDATE(), (HOUR(NOW()) + 1) % 24, 22),
('MOCK_07', CURDATE(), (HOUR(NOW()) + 1) % 24, 26),
('MOCK_08', CURDATE(), (HOUR(NOW()) + 1) % 24, 30),
('MOCK_09', CURDATE(), (HOUR(NOW()) + 1) % 24, 34),
('MOCK_10', CURDATE(), (HOUR(NOW()) + 1) % 24, 38),
('MOCK_11', CURDATE(), (HOUR(NOW()) + 1) % 24, 42),
('MOCK_12', CURDATE(), (HOUR(NOW()) + 1) % 24, 46),
('MOCK_13', CURDATE(), (HOUR(NOW()) + 1) % 24, 50),
('MOCK_14', CURDATE(), (HOUR(NOW()) + 1) % 24, 54),
('MOCK_15', CURDATE(), (HOUR(NOW()) + 1) % 24, 58)
ON DUPLICATE KEY UPDATE start_minute = VALUES(start_minute);
