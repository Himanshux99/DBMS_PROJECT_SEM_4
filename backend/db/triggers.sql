-- =====================================================
-- CashFlow DBMS - Database Triggers
-- =====================================================

-- =====================================================
-- TRIGGER 1: Update Account Balance on Transaction (To Account)
-- Description: After a transaction is inserted, update the receiving account's balance
-- =====================================================
DELIMITER $$

CREATE TRIGGER tr_update_to_account_balance
AFTER INSERT ON Transaction
FOR EACH ROW
BEGIN
  IF NEW.to_account_id IS NOT NULL AND NEW.status = 'Completed' THEN
    UPDATE Account
    SET balance = balance + NEW.amount
    WHERE account_id = NEW.to_account_id;
  END IF;
END$$

DELIMITER ;

-- =====================================================
-- TRIGGER 2: Update Account Balance on Transaction (From Account)
-- Description: After a transaction is inserted, deduct from the sending account's balance
-- =====================================================
DELIMITER $$

CREATE TRIGGER tr_update_from_account_balance
AFTER INSERT ON Transaction
FOR EACH ROW
BEGIN
  IF NEW.from_account_id IS NOT NULL AND NEW.status = 'Completed' THEN
    UPDATE Account
    SET balance = balance - NEW.amount
    WHERE account_id = NEW.from_account_id;
  END IF;
END$$

DELIMITER ;

-- =====================================================
-- TRIGGER 3: Auto-Insert Audit Log on Transaction
-- Description: After a transaction is inserted, automatically log the action to Audit_Log
-- =====================================================
DELIMITER $$

CREATE TRIGGER tr_audit_transaction_insert
AFTER INSERT ON Transaction
FOR EACH ROW
BEGIN
  DECLARE v_user_id INT;
  DECLARE v_action VARCHAR(100);
  DECLARE v_description TEXT;

  -- Determine the user (from the from_account or to_account)
  IF NEW.from_account_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id FROM Account WHERE account_id = NEW.from_account_id;
  ELSEIF NEW.to_account_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id FROM Account WHERE account_id = NEW.to_account_id;
  END IF;

  -- Build audit action and description
  IF NEW.transaction_type = 'Transfer' THEN
    SET v_action = 'TRANSFER_FUNDS';
    SET v_description = CONCAT(
      'Transfer of ', NEW.amount, ' from Account ', NEW.from_account_id, 
      ' to Account ', NEW.to_account_id, ' - Status: ', NEW.status
    );
  ELSEIF NEW.transaction_type = 'Deposit' THEN
    SET v_action = 'DEPOSIT_FUNDS';
    SET v_description = CONCAT(
      'Deposit of ', NEW.amount, ' into Account ', NEW.to_account_id, 
      ' - Status: ', NEW.status
    );
  ELSEIF NEW.transaction_type = 'Withdrawal' THEN
    SET v_action = 'WITHDRAW_FUNDS';
    SET v_description = CONCAT(
      'Withdrawal of ', NEW.amount, ' from Account ', NEW.from_account_id, 
      ' - Status: ', NEW.status
    );
  END IF;

  -- Insert audit log record
  IF v_user_id IS NOT NULL THEN
    INSERT INTO Audit_Log (user_id, action, description, affected_table, affected_id)
    VALUES (v_user_id, v_action, v_description, 'Transaction', NEW.transaction_id);
  END IF;
END$$

DELIMITER ;

-- =====================================================
-- TRIGGER 4: Audit Log on User Registration
-- Description: After a user is inserted, log the registration action
-- =====================================================
DELIMITER $$

CREATE TRIGGER tr_audit_user_register
AFTER INSERT ON User
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, description, affected_table, affected_id)
  VALUES (NEW.user_id, 'USER_REGISTERED', CONCAT('User registered: ', NEW.email), 'User', NEW.user_id);
END$$

DELIMITER ;

-- =====================================================
-- TRIGGER 5: Audit Log on Account Creation
-- Description: After an account is created, log the action
-- =====================================================
DELIMITER $$

CREATE TRIGGER tr_audit_account_created
AFTER INSERT ON Account
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, description, affected_table, affected_id)
  VALUES (NEW.user_id, 'ACCOUNT_CREATED', CONCAT('Account created: ', NEW.account_type, ' Account - ID: ', NEW.account_id), 'Account', NEW.account_id);
END$$

DELIMITER ;

-- =====================================================
-- TRIGGER 6: Prevent Negative Balance
-- Description: Before updating an account, ensure balance doesn't go negative
-- =====================================================
DELIMITER $$

CREATE TRIGGER tr_prevent_negative_balance
BEFORE UPDATE ON Account
FOR EACH ROW
BEGIN
  IF NEW.balance < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account balance cannot be negative';
  END IF;
END$$

DELIMITER ;

-- =====================================================
-- TRIGGER 7: Prevent Transactions on Frozen/Inactive Accounts
-- Description: Before inserting a transaction, check if accounts are active
-- =====================================================
DELIMITER $$

CREATE TRIGGER tr_prevent_frozen_account_transaction
BEFORE INSERT ON Transaction
FOR EACH ROW
BEGIN
  IF NEW.from_account_id IS NOT NULL THEN
    IF (SELECT status FROM Account WHERE account_id = NEW.from_account_id) != 'Active' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot perform transaction on frozen/inactive account';
    END IF;
  END IF;

  IF NEW.to_account_id IS NOT NULL THEN
    IF (SELECT status FROM Account WHERE account_id = NEW.to_account_id) != 'Active' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot perform transaction on frozen/inactive account';
    END IF;
  END IF;
END$$

DELIMITER ;

-- =====================================================
-- TRIGGER 8: Audit Account Status Change
-- Description: After account status is updated, log the change
-- =====================================================
DELIMITER $$

CREATE TRIGGER tr_audit_account_status_change
AFTER UPDATE ON Account
FOR EACH ROW
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO Audit_Log (user_id, action, description, affected_table, affected_id)
    VALUES (NEW.user_id, 'ACCOUNT_STATUS_CHANGED', CONCAT('Account status changed from ', OLD.status, ' to ', NEW.status), 'Account', NEW.account_id);
  END IF;
END$$

DELIMITER ;
