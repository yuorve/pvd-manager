CREATE DATABASE IF NOT EXISTS pvd;
USE pvd;

-- Stations Table (Renamed from Tracking)
CREATE TABLE IF NOT EXISTS stations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    addressIP VARCHAR(45) NOT NULL UNIQUE,
    userID VARCHAR(50),
    stateID INT DEFAULT 0,
    timer VARCHAR(20) DEFAULT '00:00:00',
    timeSTAMP TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KeepAlive TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Operator Activity Table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PVD Assignments Table
CREATE TABLE IF NOT EXISTS pvd_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operator_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    window_hour INT NOT NULL,
    start_minute INT NOT NULL,
    UNIQUE KEY unique_assignment (operator_id, date, window_hour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('OPERATOR', 'SUPERVISOR') DEFAULT 'OPERATOR',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Grant permissions
GRANT ALL PRIVILEGES ON pvd.* TO 'usuario'@'%';
FLUSH PRIVILEGES;

-- Initial Seeding (Stations 101-120)
INSERT IGNORE INTO stations (addressIP, stateID) VALUES 
('10.207.201.101', 0), ('10.207.201.102', 0), ('10.207.201.103', 0), ('10.207.201.104', 0),
('10.207.201.105', 0), ('10.207.201.106', 0), ('10.207.201.107', 0), ('10.207.201.108', 0),
('10.207.201.109', 0), ('10.207.201.110', 0), ('10.207.201.111', 0), ('10.207.201.112', 0),
('10.207.201.113', 0), ('10.207.201.114', 0), ('10.207.201.115', 0), ('10.207.201.116', 0),
('10.207.201.117', 0), ('10.207.201.118', 0), ('10.207.201.119', 0), ('10.207.201.120', 0);
