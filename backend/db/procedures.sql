-- =====================================================
-- CashFlow DBMS - Stored Procedures
-- =====================================================

-- =====================================================
-- 1. TransferFunds Procedure (ACID Compliant)
-- Description: Atomically transfer funds between two accounts with rollback on failure
-- Parameters:
--   p_from_account_id: Source account ID
--   p_to_account_id: Destination account ID
--   p_amount: Amount to transfer
--   p_user_id: User ID for audit logging
-- Returns: 0 (success), 1 (failure)
-- =====================================================
DELIMITER $$

CREATE PROCEDURE TransferFunds(
  IN p_from_account_id INT,
  IN p_to_account_id INT,
  IN p_amount DECIMAL(15, 2),
  IN p_user_id INT,
  OUT p_status INT
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_status = 1;  -- Failure status
  END;

  START TRANSACTION;

  -- Validate: accounts exist and belong to user or are accessible
  IF NOT EXISTS (SELECT 1 FROM Account WHERE account_id = p_from_account_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Source account not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM Account WHERE account_id = p_to_account_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Destination account not found';
  END IF;

  -- Validate: sufficient balance
  IF (SELECT balance FROM Account WHERE account_id = p_from_account_id) < p_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient balance';
  END IF;

  -- Validate: account status
  IF (SELECT status FROM Account WHERE account_id = p_from_account_id) != 'Active' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Source account not active';
  END IF;

  IF (SELECT status FROM Account WHERE account_id = p_to_account_id) != 'Active' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Destination account not active';
  END IF;

  -- Deduct from source account
  UPDATE Account
  SET balance = balance - p_amount
  WHERE account_id = p_from_account_id;

  -- Add to destination account
  UPDATE Account
  SET balance = balance + p_amount
  WHERE account_id = p_to_account_id;

  -- Insert transaction record (status will be 'Completed' as triggers handle this)
  INSERT INTO Transaction (from_account_id, to_account_id, amount, transaction_type, status, description)
  VALUES (p_from_account_id, p_to_account_id, p_amount, 'Transfer', 'Completed', CONCAT('Transfer from Account ', p_from_account_id, ' to Account ', p_to_account_id));

  COMMIT;
  SET p_status = 0;  -- Success status

END$$

DELIMITER ;

-- =====================================================
-- 2. DepositFunds Procedure
-- Description: Deposit funds into an account
-- Parameters:
--   p_to_account_id: Destination account ID
--   p_amount: Amount to deposit
--   p_user_id: User ID for audit logging
-- Returns: 0 (success), 1 (failure)
-- =====================================================
DELIMITER $$

CREATE PROCEDURE DepositFunds(
  IN p_to_account_id INT,
  IN p_amount DECIMAL(15, 2),
  IN p_user_id INT,
  OUT p_status INT
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_status = 1;
  END;

  START TRANSACTION;

  -- Validate: account exists
  IF NOT EXISTS (SELECT 1 FROM Account WHERE account_id = p_to_account_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account not found';
  END IF;

  -- Validate: account status
  IF (SELECT status FROM Account WHERE account_id = p_to_account_id) != 'Active' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account not active';
  END IF;

  -- Add to account
  UPDATE Account
  SET balance = balance + p_amount
  WHERE account_id = p_to_account_id;

  -- Insert transaction record
  INSERT INTO Transaction (to_account_id, amount, transaction_type, status, description)
  VALUES (p_to_account_id, p_amount, 'Deposit', 'Completed', CONCAT('Deposit into Account ', p_to_account_id));

  COMMIT;
  SET p_status = 0;

END$$

DELIMITER ;

-- =====================================================
-- 3. WithdrawFunds Procedure
-- Description: Withdraw funds from an account
-- Parameters:
--   p_from_account_id: Source account ID
--   p_amount: Amount to withdraw
--   p_user_id: User ID for audit logging
-- Returns: 0 (success), 1 (failure)
-- =====================================================
DELIMITER $$

CREATE PROCEDURE WithdrawFunds(
  IN p_from_account_id INT,
  IN p_amount DECIMAL(15, 2),
  IN p_user_id INT,
  OUT p_status INT
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_status = 1;
  END;

  START TRANSACTION;

  -- Validate: account exists
  IF NOT EXISTS (SELECT 1 FROM Account WHERE account_id = p_from_account_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account not found';
  END IF;

  -- Validate: sufficient balance
  IF (SELECT balance FROM Account WHERE account_id = p_from_account_id) < p_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient balance';
  END IF;

  -- Validate: account status
  IF (SELECT status FROM Account WHERE account_id = p_from_account_id) != 'Active' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account not active';
  END IF;

  -- Deduct from account
  UPDATE Account
  SET balance = balance - p_amount
  WHERE account_id = p_from_account_id;

  -- Insert transaction record
  INSERT INTO Transaction (from_account_id, amount, transaction_type, status, description)
  VALUES (p_from_account_id, p_amount, 'Withdrawal', 'Completed', CONCAT('Withdrawal from Account ', p_from_account_id));

  COMMIT;
  SET p_status = 0;

END$$

DELIMITER ;

-- =====================================================
-- 4. GetCashFlowSummary Procedure
-- Description: Get monthly inflow, outflow, and net cash flow for a user
-- Parameters:
--   p_user_id: User ID
--   p_month: Month (1-12)
--   p_year: Year (YYYY)
-- Returns: inflow, outflow, net cash flow
-- =====================================================
DELIMITER $$

CREATE PROCEDURE GetCashFlowSummary(
  IN p_user_id INT,
  IN p_month INT,
  IN p_year INT
)
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN t.to_account_id IS NOT NULL THEN t.amount ELSE 0 END), 0) AS total_inflow,
    COALESCE(SUM(CASE WHEN t.from_account_id IS NOT NULL THEN t.amount ELSE 0 END), 0) AS total_outflow,
    COALESCE(SUM(CASE WHEN t.to_account_id IS NOT NULL THEN t.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.from_account_id IS NOT NULL THEN t.amount ELSE 0 END), 0) AS net_cash_flow,
    p_month AS month,
    p_year AS year,
    COUNT(t.transaction_id) AS total_transactions
  FROM Transaction t
  INNER JOIN Account a ON (t.to_account_id = a.account_id OR t.from_account_id = a.account_id)
  WHERE a.user_id = p_user_id
    AND t.status = 'Completed'
    AND MONTH(t.created_at) = p_month
    AND YEAR(t.created_at) = p_year;

END$$

DELIMITER ;

-- =====================================================
-- 5. GetBalanceTrend Procedure
-- Description: Get monthly balance trend for last 6 months
-- Parameters:
--   p_user_id: User ID
-- Returns: month, year, balance for each month
-- =====================================================
DELIMITER $$

CREATE PROCEDURE GetBalanceTrend(
  IN p_user_id INT
)
BEGIN
  WITH RECURSIVE months AS (
    SELECT DATE_SUB(CURDATE(), INTERVAL 5 MONTH) AS month
    UNION ALL
    SELECT DATE_ADD(month, INTERVAL 1 MONTH) FROM months
    WHERE month < CURDATE()
  ),
  monthly_balances AS (
    SELECT
      m.month,
      COALESCE(SUM(a.balance), 0) AS balance
    FROM months m
    CROSS JOIN Account a
    WHERE a.user_id = p_user_id
    GROUP BY YEAR(m.month), MONTH(m.month)
  )
  SELECT
    YEAR(month) AS year,
    MONTH(month) AS month,
    DATE_FORMAT(month, '%Y-%m') AS month_year,
    balance
  FROM monthly_balances
  ORDER BY month ASC;

END$$

DELIMITER ;
