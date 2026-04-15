# SQL Queries & Concepts Used in CashFlow DBMS Project

This document provides a comprehensive list of all the different types of SQL statements, clauses, and concepts implemented across the project (schema, controllers, procedures, and triggers).

---

## 1. DDL (Data Definition Language)
Used to define and manage database structures (`backend/db/schema.sql`, `procedures.sql`, `triggers.sql`).

* **`CREATE TABLE`**: Used to construct entities (`User`, `Account`, `Role`, `Transaction`, `Audit_Log`, `User_Role`).
* **`DROP TABLE IF EXISTS`**: Used for clean resets during schema initialization.
* **`CREATE PROCEDURE`**: Used to compile reusable routines (e.g., `TransferFunds`, `GetBalanceTrend`).
* **`CREATE TRIGGER`**: Used to attach automatic hooks to table events (e.g., `tr_update_to_account_balance`).
* **Constraints**: `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `CHECK` (e.g., `CHECK (balance >= 0)`).

---

## 2. DML (Data Manipulation Language)
Used by the JS controllers and triggers to manipulate row data.

* **`SELECT`**: Core fetching. 
  * *Example:* `SELECT account_id, user_id, balance FROM Account WHERE account_id = ?`
* **`INSERT INTO`**: Creating new records.
  * *Example:* `INSERT INTO Transaction (from_account_id, to_account_id, amount) VALUES (?, ?, ?)`
* **`UPDATE`**: Modifying existing records.
  * *Example:* `UPDATE Account SET status = ? WHERE account_id = ?`

> *Note: Explicit `DELETE` statements are minimal in JS controllers because records are generally marked as 'Inactive' (Soft Delete) or handled via `ON DELETE CASCADE` from the schema.*

---

## 3. TCL (Transaction Control Language)
Crucial for banking applications to maintain ACID compliance (Atomicity, Consistency, Isolation, Durability) if queries fail halfway. Used in `backend/db/procedures.sql`.

* **`START TRANSACTION`**: Begins a secure block of operations.
* **`COMMIT`**: Saves the transaction permanently once all checks pass.
* **`ROLLBACK`**: Reverts all changes in the current block if a `SQLEXCEPTION` occurs.

---

## 4. Advanced Joins & Relational Operations
Used heavily in dashboard metrics and audit logs to stitch related tables together.

* **`INNER JOIN`**: Finding matched rows.
  * *Example:* `FROM Transaction t INNER JOIN Account a ON t.from_account_id = a.account_id`
* **`LEFT JOIN`**: Fetching even if no relationship exists (auth roles).
  * *Example:* `FROM User u LEFT JOIN User_Role ur ON u.user_id = ur.user_id`
* **`CROSS JOIN`**: Used mathematically in `GetBalanceTrend` to map all accounts structurally against a generated list of months.

---

## 5. Aggregation & Grouping Expressions
Used heavily for Dashboard calculations (`dashboardController.js` & Procedures).

* **`COUNT(*)`**: Tallying rows (e.g., Total Accounts, Total Transactions).
* **`SUM(amount)`**: Aggregating money values (e.g., Total Inflow/Outflow).
* **`COALESCE(SUM(balance), 0)`**: Ensuring `NULL` values fallback to `0`.
* **`GROUP BY`**: Grouping rows by criteria (e.g., `GROUP BY YEAR(created_at), MONTH(...)`).
* **`ORDER BY`**: Sorting timestamps (`ORDER BY created_at DESC`).
* **`LIMIT / OFFSET`**: Implementing pagination in `transactionsController.js`.

---

## 6. Common Table Expressions (CTEs)
Advanced recursive queries to generate data on the fly rather than fetching static rows.

* **`WITH RECURSIVE`**: Used in `procedures.sql` to dynamically generate a continuous timeline of the last 6 months even if no transaction datasets exist on a given month.

---

## 7. Control Flow & Advanced Clauses

* **`CASE WHEN ... THEN ... ELSE`**: Inline if/else logic in queries.
  * *Example (Dashboard):* `SUM(CASE WHEN to_account_id = ? THEN amount ELSE 0 END)`
* **Inline Variables (`@status`)**: Receiving output values back from stored procedures in `transactionsController.js`.
* **`LIMIT 1`**: Restricting subquery sets.

---

## 8. Date & Time Functions
Handling chronological accounting periods.

* **`CURDATE()`, `NOW()`**: Fetching current runtime database timestamps.
* **`DATE_SUB()` / `DATE_ADD()`**: Calculating historical windows.
  * *Example:* `created_at >= DATE_SUB(CURDATE(), INTERVAL X MONTH)`
* **`YEAR()`, `MONTH()`**: Extracting specific identifiers from a timestamp.
* **`DATE_FORMAT()`**: Formatting timestamps for the JS frontend (e.g., `'%Y-%m'`).

---

## 9. Error Handling & Procedure Directives

* **`DELIMITER $$`**: Instructing MySQL engine to compile multi-line blocks.
* **`DECLARE EXIT HANDLER FOR SQLEXCEPTION`**: Try-Catch functionality native to SQL.
* **`SIGNAL SQLSTATE '45000'`**: Explicitly throwing custom SQL errors to halt a transaction.
  * *Example:* `SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account balance cannot be negative';` inside Triggers.

---

## 10. HAVING Clause
Used in `analyticsController.js` (`getActiveAccounts`) to filter aggregated groups.

> Without `HAVING`, you cannot apply a condition to a grouped/aggregated result. `WHERE` runs before grouping; `HAVING` runs after.

```sql
-- File: backend/controllers/analyticsController.js
SELECT
  a.account_id,
  a.account_type,
  COUNT(t.transaction_id) AS transaction_count
FROM Account a
LEFT JOIN Transaction t ON (t.from_account_id = a.account_id OR t.to_account_id = a.account_id)
WHERE a.user_id = ?
GROUP BY a.account_id, a.account_type, a.balance, a.status
HAVING COUNT(t.transaction_id) >= ?    -- ← Filters groups AFTER aggregation
ORDER BY transaction_count DESC;
```

---

## 11. Database Views
Two SQL views are pre-defined in `backend/db/views.sql` and queried in `analyticsController.js` (`getAccountSummaryView`).

> A **VIEW** is a virtual table based on a stored `SELECT` query. Querying a view is identical to querying a table.

```sql
-- File: backend/db/views.sql

-- View 1: Joins User + Account for clean account summaries
CREATE VIEW vw_account_summary AS
SELECT a.account_id, a.user_id, u.name AS user_name, u.email AS user_email,
       a.account_type, a.balance, a.status,
       (SELECT COUNT(*) FROM Transaction t
        WHERE t.from_account_id = a.account_id OR t.to_account_id = a.account_id) AS total_transactions
FROM Account a
INNER JOIN User u ON a.user_id = u.user_id;

-- View 2: Aggregated per-user financial summary (uses GROUP BY internally)
CREATE VIEW vw_user_financial_overview AS
SELECT u.user_id, u.name, COUNT(DISTINCT a.account_id) AS total_accounts,
       SUM(a.balance) AS total_balance, AVG(a.balance) AS average_balance
FROM User u
LEFT JOIN Account a ON u.user_id = a.user_id AND a.status = 'Active'
GROUP BY u.user_id, u.name, u.email;

-- Usage in controller (as simple as querying a table):
SELECT * FROM vw_account_summary WHERE user_id = ?;
SELECT * FROM vw_user_financial_overview WHERE user_id = ?;
```

---

## 12. Subqueries (Scalar Subquery in WHERE)
Used in `analyticsController.js` (`getAboveAverageAccounts`) to compare each account against a dynamically computed average.

> A **scalar subquery** returns a single value and can be used anywhere a literal value would appear (in `SELECT`, `WHERE`, `HAVING`, etc.)

```sql
-- File: backend/controllers/analyticsController.js
SELECT
  a.account_id,
  a.account_type,
  a.balance,
  -- Scalar subquery in SELECT to show the average alongside each row:
  (SELECT AVG(balance) FROM Account WHERE user_id = ? AND status = 'Active') AS avg_balance,
  ROUND(a.balance - (SELECT AVG(balance) FROM Account WHERE user_id = ? AND status = 'Active'), 2) AS above_avg_by
FROM Account a
WHERE a.user_id = ?
  AND a.status = 'Active'
  -- Scalar subquery in WHERE clause:
  AND a.balance > (SELECT AVG(balance) FROM Account WHERE user_id = ? AND status = 'Active')
ORDER BY a.balance DESC;
```

---

## 13. Set Operations (UNION)
Used in `analyticsController.js` (`getUnifiedFeed`) to combine two separate result sets — one for credits (money IN) and one for debits (money OUT) — into a single ordered timeline.

> **`UNION`** merges two `SELECT` results into one. Both queries must have the same number and compatible column types. `UNION` removes duplicates; `UNION ALL` keeps them.

```sql
-- File: backend/controllers/analyticsController.js
-- Credits: transactions where money came INTO user's accounts
SELECT
  t.transaction_id, t.amount, t.transaction_type, t.status, t.created_at,
  'CREDIT' AS direction,          -- ← Custom literal column added
  t.to_account_id AS user_account_id,
  fu.name AS counterpart_name
FROM Transaction t
LEFT JOIN Account fa ON t.from_account_id = fa.account_id
LEFT JOIN User fu ON fa.user_id = fu.user_id
WHERE t.to_account_id IN (...)
  AND t.status = 'Completed'

UNION   -- ← SET OPERATION: stacks the two result sets vertically

-- Debits: transactions where money went OUT of user's accounts
SELECT
  t.transaction_id, t.amount, t.transaction_type, t.status, t.created_at,
  'DEBIT' AS direction,           -- ← Different literal on the same column
  t.from_account_id AS user_account_id,
  tu.name AS counterpart_name
FROM Transaction t
LEFT JOIN Account ta ON t.to_account_id = ta.account_id
LEFT JOIN User tu ON ta.user_id = tu.user_id
WHERE t.from_account_id IN (...)
  AND t.status = 'Completed'

ORDER BY created_at DESC
LIMIT 25;
```
