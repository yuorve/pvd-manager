-- ==========================================================
-- ARCHIVO: cleanup.sql
-- PROPÓSITO: Limpiar los datos generados por example.sql
-- ==========================================================

-- 1. Eliminar asignaciones de la tabla PVD
DELETE FROM pvd_assignments WHERE operator_id LIKE 'MOCK_%';

-- 2. Desconectar a los operadores mock de las estaciones
-- Reseteamos las estaciones donde estuvieran conectados los operadores MOCK
UPDATE stations SET userID = NULL, stateID = 0, timer = '00:00:00', timeSTAMP = NOW() WHERE userID LIKE 'MOCK_%';

-- 3. Eliminar los usuarios mock de la base de datos de usuarios
DELETE FROM users WHERE username LIKE 'MOCK_%';

-- 4. Opcional: Eliminar rastro del log de actividad si hubiera alguno
DELETE FROM operator_activity WHERE operator_id LIKE 'MOCK_%';
