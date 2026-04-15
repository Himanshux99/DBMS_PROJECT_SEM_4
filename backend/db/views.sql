-- =====================================================
-- CashFlow DBMS - Database Views
-- Run this file ONCE in MySQL to create the views
-- =====================================================

-- Drop views if they already exist (for clean re-runs)
DROP VIEW IF EXISTS vw_account_summary;
DROP VIEW IF EXISTS vw_transaction_summary;
DROP VIEW IF EXISTS vw_user_financial_overview;

-- =====================================================
-- VIEW 1: vw_account_summary
-- Joins User + Account for a consolidated account view
-- Usage: SELECT * FROM vw_account_summary WHERE user_id = ?
-- =====================================================
CREATE VIEW vw_account_summary AS
SELECT
  a.account_id,
  a.user_id,
  u.name       AS user_name,
  u.email      AS user_email,
  a.account_type,
  a.balance,
  a.status,
  a.created_at AS account_created_at,
  (SELECT COUNT(*) FROM Transaction t
   WHERE t.from_account_id = a.account_id OR t.to_account_id = a.account_id
  ) AS total_transactions
FROM Account a
INNER JOIN User u ON a.user_id = u.user_id;

-- =====================================================
-- VIEW 2: vw_transaction_summary
-- Joins Transaction + Account (from and to) for readable history
-- Usage: SELECT * FROM vw_transaction_summary WHERE from_user_id = ?
-- =====================================================
CREATE VIEW vw_transaction_summary AS
SELECT
  t.transaction_id,
  t.amount,
  t.transaction_type,
  t.status,
  t.description,
  t.created_at,
  t.from_account_id,
  fa.user_id   AS from_user_id,
  fu.name      AS from_user_name,
  fa.account_type AS from_account_type,
  t.to_account_id,
  ta.user_id   AS to_user_id,
  tu.name      AS to_user_name,
  ta.account_type AS to_account_type
FROM Transaction t
LEFT JOIN Account fa ON t.from_account_id = fa.account_id
LEFT JOIN User fu    ON fa.user_id = fu.user_id
LEFT JOIN Account ta ON t.to_account_id = ta.account_id
LEFT JOIN User tu    ON ta.user_id = tu.user_id;

-- =====================================================
-- VIEW 3: vw_user_financial_overview
-- Per-user aggregated financial summary using GROUP BY
-- Usage: SELECT * FROM vw_user_financial_overview WHERE user_id = ?
-- =====================================================
CREATE VIEW vw_user_financial_overview AS
SELECT
  u.user_id,
  u.name,
  u.email,
  COUNT(DISTINCT a.account_id)  AS total_accounts,
  SUM(a.balance)                AS total_balance,
  AVG(a.balance)                AS average_balance,
  MAX(a.balance)                AS highest_account_balance,
  MIN(a.balance)                AS lowest_account_balance
FROM User u
LEFT JOIN Account a ON u.user_id = a.user_id AND a.status = 'Active'
GROUP BY u.user_id, u.name, u.email;
