-- =====================================================
-- CashFlow DBMS - Database Schema (DDL)
-- =====================================================

-- Drop tables if they exist (for fresh setup)
DROP TABLE IF EXISTS Audit_Log;
DROP TABLE IF EXISTS Transaction;
DROP TABLE IF EXISTS Account;
DROP TABLE IF EXISTS User_Role;
DROP TABLE IF EXISTS User;
DROP TABLE IF EXISTS Role;

-- =====================================================
-- 1. Role Table
-- =====================================================
CREATE TABLE Role (
  role_id INT PRIMARY KEY AUTO_INCREMENT,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. User Table
-- =====================================================
CREATE TABLE User (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. User_Role Junction Table (Many-to-Many)
-- =====================================================
CREATE TABLE User_Role (
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES Role(role_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. Account Table
-- =====================================================
CREATE TABLE Account (
  account_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  account_type ENUM('Savings', 'Checking', 'Current') NOT NULL,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status ENUM('Active', 'Inactive', 'Frozen') NOT NULL DEFAULT 'Active',
  FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  CHECK (balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. Transaction Table
-- =====================================================
CREATE TABLE Transaction (
  transaction_id INT PRIMARY KEY AUTO_INCREMENT,
  from_account_id INT,
  to_account_id INT,
  amount DECIMAL(15, 2) NOT NULL,
  transaction_type ENUM('Transfer', 'Deposit', 'Withdrawal') NOT NULL,
  status ENUM('Pending', 'Completed', 'Failed') NOT NULL DEFAULT 'Pending',
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (from_account_id) REFERENCES Account(account_id) ON DELETE SET NULL,
  FOREIGN KEY (to_account_id) REFERENCES Account(account_id) ON DELETE SET NULL,
  INDEX idx_from_account (from_account_id),
  INDEX idx_to_account (to_account_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. Audit_Log Table
-- =====================================================
CREATE TABLE Audit_Log (
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  affected_table VARCHAR(50),
  affected_id INT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Seed Data: Insert Roles
-- =====================================================
INSERT INTO Role (role_name) VALUES ('Customer'), ('Admin');

-- =====================================================
-- Normalization Verification (3NF Compliance)
-- =====================================================
-- ✓ No non-key dependencies (all attributes depend on primary key)
-- ✓ No transitive dependencies (each attribute depends only on PK)
-- ✓ All tables properly normalized to 3NF
-- ✓ Foreign keys ensure referential integrity
-- ✓ Unique constraints on natural keys (email)
-- =====================================================
