// =====================================================
// CashFlow Frontend - Main Application
// =====================================================

// Configuration
const API_URL = 'http://localhost:5000/api';
let currentPage = 1;
let currentLimit = 10;
let currentFilters = {};
let balanceTrendChart = null;

// =====================================================
// Authentication
// =====================================================

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return !!localStorage.getItem('cashflow_token');
}

/**
 * Get stored JWT token
 */
function getToken() {
  return localStorage.getItem('cashflow_token');
}

/**
 * Get current user info from localStorage
 */
function getCurrentUser() {
  return JSON.parse(localStorage.getItem('cashflow_user') || '{}');
}

/**
 * API call helper with JWT
 */
async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);

    // Auto-logout on 401
    if (response.status === 401) {
      logout();
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/**
 * Format currency
 */
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Format date
 */
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// =====================================================
// Authentication Forms
// =====================================================

/**
 * Toggle between login and register forms
 */
function toggleForm(event) {
  event.preventDefault();
  document.getElementById('loginForm').classList.toggle('active');
  document.getElementById('registerForm').classList.toggle('active');
  clearErrors();
}

/**
 * Clear error messages
 */
function clearErrors() {
  document.getElementById('login-error').innerHTML = '';
  document.getElementById('login-error').classList.remove('show');
  document.getElementById('register-error').innerHTML = '';
  document.getElementById('register-error').classList.remove('show');
}

/**
 * Handle login
 */
async function handleLogin(event) {
  event.preventDefault();
  clearErrors();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const response = await apiCall('/auth/login', 'POST', { email, password });

    if (response && response.token) {
      // Store token and user info
      localStorage.setItem('cashflow_token', response.token);
      localStorage.setItem('cashflow_user', JSON.stringify({
        user_id: response.user_id,
        name: response.name,
        email: response.email,
        role_id: response.role_id,
        role_name: response.role_name,
      }));

      // Redirect to dashboard
      window.location.href = 'dashboard.html';
    }
  } catch (error) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.innerHTML = error.message;
    errorDiv.classList.add('show');
  }
}

/**
 * Handle registration
 */
async function handleRegister(event) {
  event.preventDefault();
  clearErrors();

  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;

  try {
    const response = await apiCall('/auth/register', 'POST', { name, email, password });

    if (response && response.token) {
      // Store token and user info
      localStorage.setItem('cashflow_token', response.token);
      localStorage.setItem('cashflow_user', JSON.stringify({
        user_id: response.user_id,
        name: response.name,
        email: response.email,
        role_id: 1,
        role_name: 'Customer',
      }));

      // Redirect to dashboard
      window.location.href = 'dashboard.html';
    }
  } catch (error) {
    const errorDiv = document.getElementById('register-error');
    errorDiv.innerHTML = error.message;
    errorDiv.classList.add('show');
  }
}

/**
 * Logout
 */
function logout() {
  localStorage.removeItem('cashflow_token');
  localStorage.removeItem('cashflow_user');
  window.location.href = 'index.html';
}

// =====================================================
// Dashboard Initialization
// =====================================================

/**
 * Check authentication and redirect
 */
function checkAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

/**
 * Initialize dashboard
 */
async function initDashboard() {
  if (!checkAuth()) return;

  const user = getCurrentUser();
  document.getElementById('user-name').textContent = user.name || 'User';
  document.getElementById('user-email').textContent = user.email || '';

  // Show audit link if admin
  if (user.role_id === 2 || user.role_name === 'Admin') {
    document.getElementById('audit-link').style.display = 'flex';
  }

  // Load dashboard data
  loadDashboardSummary();
  loadAccounts();
  loadRecentTransactions();
}

/**
 * Load dashboard summary
 */
async function loadDashboardSummary() {
  try {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const response = await apiCall(`/dashboard/summary?month=${month}&year=${year}`);

    if (response) {
      // Update summary cards
      document.getElementById('total-balance').textContent = formatCurrency(response.summary.total_balance);
      document.getElementById('monthly-inflow').textContent = formatCurrency(response.cashflow.total_inflow);
      document.getElementById('monthly-outflow').textContent = formatCurrency(response.cashflow.total_outflow);
      document.getElementById('net-cashflow').textContent = formatCurrency(response.cashflow.net_cash_flow);

      // Update labels
      document.getElementById('inflow-label').textContent = `${month}/${year}`;
      document.getElementById('outflow-label').textContent = `${month}/${year}`;
      document.getElementById('net-label').textContent = `${month}/${year}`;

      // Load balance trend chart
      loadBalanceTrendChart();
    }
  } catch (error) {
    console.error('Failed to load dashboard summary:', error);
  }
}

/**
 * Load accounts
 */
async function loadAccounts() {
  try {
    const response = await apiCall('/accounts');

    if (response && response.accounts) {
      const gridContainer = document.getElementById('accounts-grid');
      gridContainer.innerHTML = '';

      response.accounts.forEach(account => {
        const card = document.createElement('div');
        card.className = 'account-card';
        card.innerHTML = `
          <p class="account-type">${account.account_type}</p>
          <p class="account-id">ID: ${account.account_id}</p>
          <p class="balance">${formatCurrency(account.balance)}</p>
          <span class="status ${account.status.toLowerCase()}">${account.status}</span>
        `;
        gridContainer.appendChild(card);
      });

      // Populate account selects in modals
      const accountSelects = ['deposit-account', 'withdraw-account', 'transfer-from', 'transfer-to', 'filter-account'];
      accountSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
          const currentValue = select.value;
          select.innerHTML = selectId.includes('filter') ? '<option value="">All Accounts</option>' : '<option value="">Choose an account</option>';
          response.accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.account_id;
            option.textContent = `${account.account_type} - ${formatCurrency(account.balance)}`;
            select.appendChild(option);
          });
          select.value = currentValue;
        }
      });
    }
  } catch (error) {
    console.error('Failed to load accounts:', error);
  }
}

/**
 * Load balance trend chart
 */
async function loadBalanceTrendChart() {
  try {
    const response = await apiCall('/dashboard/balance-trend');

    if (response && response.trend) {
      const ctx = document.getElementById('balanceTrendChart');
      if (!ctx) return;

      // Destroy existing chart
      if (balanceTrendChart) {
        balanceTrendChart.destroy();
      }

      const labels = response.trend.map(t => t.month_year);
      const data = response.trend.map(t => Math.round(t.balance * 100) / 100);

      balanceTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Balance Trend',
            data,
            borderColor: '#00d9ff',
            backgroundColor: 'rgba(0, 217, 255, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#00d9ff',
            pointBorderColor: '#0a0e27',
            pointRadius: 4,
            pointHoverRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: '#e0e6ff',
                font: {
                  family: "'Courier New', monospace",
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(42, 52, 82, 0.5)',
              },
              ticks: {
                color: '#a8afc7',
              },
            },
            x: {
              grid: {
                color: 'rgba(42, 52, 82, 0.5)',
              },
              ticks: {
                color: '#a8afc7',
              },
            },
          },
        },
      });
    }
  } catch (error) {
    console.error('Failed to load balance trend:', error);
  }
}

/**
 * Load recent transactions
 */
async function loadRecentTransactions() {
  try {
    const response = await apiCall('/accounts');
    if (!response || !response.accounts || response.accounts.length === 0) return;

    const accountIds = response.accounts.map(a => a.account_id);
    const tbody = document.getElementById('recent-transactions-body');
    tbody.innerHTML = '';

    let allTransactions = [];

    // Fetch transactions for each account
    for (const accountId of accountIds) {
      try {
        const txnResponse = await apiCall(`/transactions/${accountId}?page=1&limit=5`);
        if (txnResponse && txnResponse.transactions) {
          allTransactions = allTransactions.concat(txnResponse.transactions);
        }
      } catch (err) {
        console.error(`Failed to load transactions for account ${accountId}:`, err);
      }
    }

    // Sort by date descending and take first 5
    allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    allTransactions = allTransactions.slice(0, 5);

    allTransactions.forEach(txn => {
      const row = document.createElement('tr');
      const isCredit = txn.to_account_id && !txn.from_account_id;
      row.className = isCredit ? 'credit' : 'debit';

      const amount = isCredit ? txn.amount : -txn.amount;
      row.innerHTML = `
        <td>${formatDate(txn.created_at)}</td>
        <td>${txn.transaction_type}</td>
        <td class="amount ${isCredit ? 'positive' : 'negative'}">${isCredit ? '+' : ''} ${formatCurrency(Math.abs(txn.amount))}</td>
        <td><span class="status ${txn.status.toLowerCase()}">${txn.status}</span></td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Failed to load recent transactions:', error);
  }
}

// =====================================================
// Modal Functions
// =====================================================

/**
 * Open modal
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
  }
}

/**
 * Close modal
 */
function closeModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
}

// Modal open functions
function openDepositModal() { openModal('depositModal'); loadAccounts(); }
function openWithdrawModal() { openModal('withdrawModal'); loadAccounts(); }
function openTransferModal() { openModal('transferModal'); loadAccounts(); }
function openCreateAccountModal() { openModal('createAccountModal'); }

// =====================================================
// Transaction Handlers
// =====================================================

/**
 * Handle deposit
 */
async function handleDeposit(event) {
  event.preventDefault();

  const toAccountId = document.getElementById('deposit-account').value;
  const amount = parseFloat(document.getElementById('deposit-amount').value);

  if (!toAccountId || !amount) {
    showError('deposit-error', 'Please fill out all fields');
    return;
  }

  try {
    const response = await apiCall('/transactions/deposit', 'POST', {
      to_account_id: parseInt(toAccountId),
      amount,
    });

    if (response) {
      closeModalById('depositModal');
      document.querySelector('#depositModal form').reset();
      loadDashboardSummary();
      loadAccounts();
      loadRecentTransactions();
      showSuccess('Deposit successful!');
    }
  } catch (error) {
    showError('deposit-error', error.message);
  }
}

/**
 * Handle withdrawal
 */
async function handleWithdraw(event) {
  event.preventDefault();

  const fromAccountId = document.getElementById('withdraw-account').value;
  const amount = parseFloat(document.getElementById('withdraw-amount').value);

  if (!fromAccountId || !amount) {
    showError('withdraw-error', 'Please fill out all fields');
    return;
  }

  try {
    const response = await apiCall('/transactions/withdraw', 'POST', {
      from_account_id: parseInt(fromAccountId),
      amount,
    });

    if (response) {
      closeModalById('withdrawModal');
      document.querySelector('#withdrawModal form').reset();
      loadDashboardSummary();
      loadAccounts();
      loadRecentTransactions();
      showSuccess('Withdrawal successful!');
    }
  } catch (error) {
    showError('withdraw-error', error.message);
  }
}

/**
 * Handle transfer
 */
async function handleTransfer(event) {
  event.preventDefault();

  const fromAccountId = document.getElementById('transfer-from').value;
  const toAccountId = document.getElementById('transfer-to').value;
  const amount = parseFloat(document.getElementById('transfer-amount').value);

  if (!fromAccountId || !toAccountId || !amount) {
    showError('transfer-error', 'Please fill out all fields');
    return;
  }

  if (fromAccountId === toAccountId) {
    showError('transfer-error', 'Cannot transfer to the same account');
    return;
  }

  try {
    const response = await apiCall('/transactions/transfer', 'POST', {
      from_account_id: parseInt(fromAccountId),
      to_account_id: parseInt(toAccountId),
      amount,
    });

    if (response) {
      closeModalById('transferModal');
      document.querySelector('#transferModal form').reset();
      loadDashboardSummary();
      loadAccounts();
      loadRecentTransactions();
      showSuccess('Transfer successful!');
    }
  } catch (error) {
    showError('transfer-error', error.message);
  }
}

/**
 * Handle create account
 */
async function handleCreateAccount(event) {
  event.preventDefault();

  const accountType = document.getElementById('account-type').value;
  const initialBalance = document.getElementById('initial-balance').value;

  if (!accountType) {
    showError('createAccount-error', 'Please select account type');
    return;
  }

  try {
    const response = await apiCall('/accounts', 'POST', {
      account_type: accountType,
      initial_balance: initialBalance ? parseFloat(initialBalance) : 0,
    });

    if (response) {
      closeModalById('createAccountModal');
      document.querySelector('#createAccountModal form').reset();
      loadAccounts();
      loadDashboardSummary();
      showSuccess('Account created successfully!');
    }
  } catch (error) {
    showError('createAccount-error', error.message);
  }
}

// =====================================================
// Transactions Page
// =====================================================

/**
 * Initialize transactions page
 */
async function initTransactionsPage() {
  if (!checkAuth()) return;

  const user = getCurrentUser();
  document.getElementById('user-name').textContent = user.name || 'User';
  document.getElementById('user-email').textContent = user.email || '';

  if (user.role_id === 2 || user.role_name === 'Admin') {
    document.getElementById('audit-link').style.display = 'flex';
  }

  loadAccounts();
  loadTransactions();
}

/**
 * Load transactions with pagination
 */
async function loadTransactions() {
  try {
    // Get first account
    const accountsResponse = await apiCall('/accounts');
    if (!accountsResponse || !accountsResponse.accounts || accountsResponse.accounts.length === 0) {
      document.getElementById('transactions-body').innerHTML = '<tr><td colspan="6">No accounts found</td></tr>';
      return;
    }

    const accountId = accountsResponse.accounts[0].account_id;

    const filters = new URLSearchParams();
    if (document.getElementById('filter-type')?.value) filters.append('type', document.getElementById('filter-type').value);
    if (document.getElementById('filter-status')?.value) filters.append('status', document.getElementById('filter-status').value);
    if (document.getElementById('filter-date-from')?.value) filters.append('date_from', document.getElementById('filter-date-from').value);
    if (document.getElementById('filter-date-to')?.value) filters.append('date_to', document.getElementById('filter-date-to').value);
    filters.append('page', currentPage);
    filters.append('limit', currentLimit);

    const response = await apiCall(`/transactions/${accountId}?${filters.toString()}`);

    if (response && response.transactions) {
      const tbody = document.getElementById('transactions-body');
      tbody.innerHTML = '';

      response.transactions.forEach(txn => {
        const row = document.createElement('tr');
        const isCredit = txn.to_account_id && !txn.from_account_id;
        row.className = isCredit ? 'credit' : 'debit';

        row.innerHTML = `
          <td>${formatDate(txn.created_at)}</td>
          <td>${txn.transaction_type}</td>
          <td class="amount ${isCredit ? 'positive' : 'negative'}">${isCredit ? '+' : ''} ${formatCurrency(Math.abs(txn.amount))}</td>
          <td>${txn.from_account_id || '-'}</td>
          <td>${txn.to_account_id || '-'}</td>
          <td><span class="status ${txn.status.toLowerCase()}">${txn.status}</span></td>
        `;
        tbody.appendChild(row);
      });

      // Update pagination
      document.getElementById('page-info').textContent = `Page ${currentPage} of ${response.pagination.pages}`;
      document.getElementById('prev-btn').disabled = currentPage === 1;
      document.getElementById('next-btn').disabled = currentPage === response.pagination.pages;
    }
  } catch (error) {
    console.error('Failed to load transactions:', error);
  }
}

/**
 * Apply filters to transactions
 */
function applyFilters() {
  currentPage = 1;
  loadTransactions();
}

/**
 * Reset transaction filters
 */
function resetFilters() {
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-date-from').value = '';
  document.getElementById('filter-date-to').value = '';
  currentPage = 1;
  loadTransactions();
}

/**
 * Navigate to previous page
 */
function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    loadTransactions();
    window.scrollTo(0, 0);
  }
}

/**
 * Navigate to next page
 */
function nextPage() {
  currentPage++;
  loadTransactions();
  window.scrollTo(0, 0);
}

// =====================================================
// Audit Page
// =====================================================

let currentAuditPage = 1;
let currentAuditLimit = 50;

/**
 * Initialize audit page
 */
async function initAuditPage() {
  if (!checkAuth()) return;

  const user = getCurrentUser();
  document.getElementById('user-name').textContent = user.name || 'User';
  document.getElementById('user-email').textContent = user.email || '';

  // Check if admin
  if (user.role_id !== 2 && user.role_name !== 'Admin') {
    document.getElementById('access-denied').style.display = 'block';
    return;
  }

  document.getElementById('filters-section').style.display = 'grid';
  document.getElementById('logs-table').style.display = 'block';
  document.getElementById('pagination').style.display = 'flex';
  document.getElementById('audit-stats').style.display = 'block';

  loadAuditLogs();
  loadAuditStats();
}

/**
 * Load audit logs
 */
async function loadAuditLogs() {
  try {
    const filters = new URLSearchParams();
    if (document.getElementById('filter-action')?.value) filters.append('action', document.getElementById('filter-action').value);
    if (document.getElementById('filter-date-from')?.value) filters.append('date_from', document.getElementById('filter-date-from').value);
    if (document.getElementById('filter-date-to')?.value) filters.append('date_to', document.getElementById('filter-date-to').value);
    filters.append('page', currentAuditPage);
    filters.append('limit', currentAuditLimit);

    const response = await apiCall(`/audit/logs?${filters.toString()}`);

    if (response && response.logs) {
      const tbody = document.getElementById('audit-logs-body');
      tbody.innerHTML = '';

      response.logs.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${formatDate(log.timestamp)}</td>
          <td>${log.name || 'System'}</td>
          <td>${log.email || '-'}</td>
          <td>${log.action}</td>
          <td style="max-width: 200px; word-break: break-word;">${log.description || '-'}</td>
          <td>${log.affected_table || '-'}</td>
        `;
        tbody.appendChild(row);
      });

      // Update pagination
      document.getElementById('page-info').textContent = `Page ${currentAuditPage} of ${response.pagination.pages}`;
      document.getElementById('prev-btn').disabled = currentAuditPage === 1;
      document.getElementById('next-btn').disabled = currentAuditPage === response.pagination.pages;
    }
  } catch (error) {
    console.error('Failed to load audit logs:', error);
  }
}

/**
 * Load audit statistics
 */
async function loadAuditStats() {
  try {
    const response = await apiCall('/audit/stats');
    if (response) {
      document.getElementById('stats-24h').textContent = response.last_24_hours;
    }
  } catch (error) {
    console.error('Failed to load audit stats:', error);
  }
}

/**
 * Apply audit filters
 */
function applyAuditFilters() {
  currentAuditPage = 1;
  loadAuditLogs();
}

/**
 * Reset audit filters
 */
function resetAuditFilters() {
  document.getElementById('filter-action').value = '';
  document.getElementById('filter-date-from').value = '';
  document.getElementById('filter-date-to').value = '';
  currentAuditPage = 1;
  loadAuditLogs();
}

/**
 * Navigate to previous audit page
 */
function previousAuditPage() {
  if (currentAuditPage > 1) {
    currentAuditPage--;
    loadAuditLogs();
    window.scrollTo(0, 0);
  }
}

/**
 * Navigate to next audit page
 */
function nextAuditPage() {
  currentAuditPage++;
  loadAuditLogs();
  window.scrollTo(0, 0);
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Show error message
 */
function showError(elementId, message) {
  const errorEl = document.getElementById(elementId);
  if (errorEl) {
    errorEl.innerHTML = message;
    errorEl.classList.add('show');
  }
}

/**
 * Show success message
 */
function showSuccess(message) {
  // Simple alert for now, can be enhanced with toast notifications
  alert(message);
}

// =====================================================
// Page Load Initialization
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  const currentPage = window.location.pathname.split('/').pop();

  if (currentPage === 'index.html' || currentPage === '') {
    // Login/Register page - already initialized
  } else if (currentPage === 'dashboard.html') {
    initDashboard();
  } else if (currentPage === 'transactions.html') {
    initTransactionsPage();
  } else if (currentPage === 'audit.html') {
    initAuditPage();
  }

  // Close modals when clicking outside
  window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
      event.target.classList.remove('show');
    }
  };
});
