/* =============================================
   BUDGET TRACKER — app.js
   All data persisted via localStorage.
   Features:
     - Add / delete transactions
     - Income & expense tracking
     - Custom categories (on top of Needs/Wants/Goals)
     - Monthly summary view
     - Sort by amount or category
     - Highlight transactions over spending limit
     - Dark / light mode toggle
   ============================================= */

'use strict';

/* ── Storage Keys ── */
const KEY_TRANSACTIONS = 'bt_transactions';
const KEY_CATEGORIES   = 'bt_categories';
const KEY_LIMIT        = 'bt_limit';
const KEY_THEME        = 'bt_theme';

/* ── Default categories (cannot be deleted) ── */
const DEFAULT_CATEGORIES = ['Needs', 'Wants', 'Goals', 'Earning'];

/* ── State ── */
let transactions = [];
let categories   = [];
let spendingLimit = 0;

/* ── DOM references ── */
const totalBalanceEl  = document.getElementById('totalBalance');
const totalCard       = document.getElementById('totalCard');
const limitAlert      = document.getElementById('limitAlert');
const limitDisplay    = document.getElementById('limitDisplay');
const spendingLimitIn = document.getElementById('spendingLimit');
const setLimitBtn     = document.getElementById('setLimitBtn');
const sortSelect      = document.getElementById('sortSelect');
const monthFilter     = document.getElementById('monthFilter');
const categoryTags    = document.getElementById('categoryTags');
const newCategoryIn   = document.getElementById('newCategoryInput');
const addCategoryBtn  = document.getElementById('addCategoryBtn');
const txForm          = document.getElementById('transactionForm');
const txDescription   = document.getElementById('txDescription');
const txAmount        = document.getElementById('txAmount');
const txType          = document.getElementById('txType');
const txCategory      = document.getElementById('txCategory');
const txDate          = document.getElementById('txDate');
const txList          = document.getElementById('txList');
const summaryGrid     = document.getElementById('summaryGrid');
const summaryMonth    = document.getElementById('summaryMonth');
const themeToggle     = document.getElementById('themeToggle');
const themeIcon       = document.getElementById('themeIcon');

/* ─────────────────────────────────────────────
   INITIALISE
───────────────────────────────────────────── */
function init() {
  loadFromStorage();
  applyTheme();
  setDefaultDate();
  renderCategoryTags();
  renderCategorySelect();
  renderTransactions();
  renderSummary();
  updateOverview();
  restoreLimit();
}

/* ─────────────────────────────────────────────
   LOCAL STORAGE
───────────────────────────────────────────── */
function loadFromStorage() {
  transactions  = JSON.parse(localStorage.getItem(KEY_TRANSACTIONS) || '[]');
  categories    = JSON.parse(localStorage.getItem(KEY_CATEGORIES)   || JSON.stringify([...DEFAULT_CATEGORIES]));
  spendingLimit = parseFloat(localStorage.getItem(KEY_LIMIT) || '0');

  /* Ensure defaults are always present */
  DEFAULT_CATEGORIES.forEach(cat => {
    if (!categories.includes(cat)) categories.unshift(cat);
  });
}

function saveTransactions() {
  localStorage.setItem(KEY_TRANSACTIONS, JSON.stringify(transactions));
}

function saveCategories() {
  localStorage.setItem(KEY_CATEGORIES, JSON.stringify(categories));
}

function saveLimit() {
  localStorage.setItem(KEY_LIMIT, spendingLimit.toString());
}

/* ─────────────────────────────────────────────
   THEME — dark / light toggle
───────────────────────────────────────────── */
function applyTheme() {
  const saved = localStorage.getItem(KEY_THEME) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  themeIcon.textContent = saved === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  themeIcon.textContent = next === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(KEY_THEME, next);
});

/* ─────────────────────────────────────────────
   SPENDING LIMIT
───────────────────────────────────────────── */
function restoreLimit() {
  if (spendingLimit > 0) {
    spendingLimitIn.value = spendingLimit;
    showLimitDisplay();
    checkLimitAlert();
  }
}

function showLimitDisplay() {
  limitDisplay.textContent = `Active limit: ${formatRp(spendingLimit)}`;
  limitDisplay.classList.remove('hidden');
}

setLimitBtn.addEventListener('click', () => {
  const val = parseFloat(spendingLimitIn.value);
  if (isNaN(val) || val <= 0) {
    alert('Please enter a valid positive amount for the spending limit.');
    return;
  }
  spendingLimit = val;
  saveLimit();
  showLimitDisplay();
  renderTransactions();
  checkLimitAlert();
});

function checkLimitAlert() {
  const totalExp = getTotalExpense();
  if (spendingLimit > 0 && totalExp > spendingLimit) {
    limitAlert.classList.remove('hidden');
  } else {
    limitAlert.classList.add('hidden');
  }
}

/* ─────────────────────────────────────────────
   CATEGORIES
───────────────────────────────────────────── */
function renderCategoryTags() {
  categoryTags.innerHTML = '';
  categories.forEach(cat => {
    const tag = document.createElement('span');
    tag.className = `tag tag--${cat.toLowerCase()}`;
    tag.innerHTML = cat;

    /* Only custom categories can be deleted */
    if (!DEFAULT_CATEGORIES.includes(cat)) {
      const btn = document.createElement('button');
      btn.className  = 'tag__delete';
      btn.title      = `Remove "${cat}"`;
      btn.textContent = '✕';
      btn.addEventListener('click', () => removeCategory(cat));
      tag.appendChild(btn);
    }

    categoryTags.appendChild(tag);
  });
}

function renderCategorySelect() {
  /* Preserve current selection */
  const current = txCategory.value;
  txCategory.innerHTML = '';
  categories.forEach(cat => {
    const opt  = document.createElement('option');
    opt.value  = cat;
    opt.textContent = cat;
    txCategory.appendChild(opt);
  });
  if (current && categories.includes(current)) txCategory.value = current;
}

addCategoryBtn.addEventListener('click', () => {
  const name = newCategoryIn.value.trim();
  if (!name) return;
  if (categories.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
    alert('That category already exists.');
    return;
  }
  categories.push(name);
  saveCategories();
  renderCategoryTags();
  renderCategorySelect();
  newCategoryIn.value = '';
});

/* Allow pressing Enter in the category input */
newCategoryIn.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addCategoryBtn.click(); }
});

function removeCategory(cat) {
  /* Prevent deleting a category that still has transactions */
  const inUse = transactions.some(tx => tx.category === cat);
  if (inUse) {
    alert(`Cannot remove "${cat}" — it is used by existing transactions.`);
    return;
  }
  categories = categories.filter(c => c !== cat);
  saveCategories();
  renderCategoryTags();
  renderCategorySelect();
}

/* ─────────────────────────────────────────────
   ADD TRANSACTION
───────────────────────────────────────────── */
txForm.addEventListener('submit', e => {
  e.preventDefault();

  const desc   = txDescription.value.trim();
  const amount = parseFloat(txAmount.value);
  const type   = txType.value;
  const cat    = txCategory.value;
  const date   = txDate.value;

  if (!desc || isNaN(amount) || amount <= 0 || !date) {
    alert('Please fill in all fields correctly.');
    return;
  }

  const tx = {
    id:       Date.now().toString(),
    desc,
    amount,
    type,
    category: cat,
    date,
  };

  transactions.unshift(tx);
  saveTransactions();
  renderTransactions();
  renderSummary();
  updateOverview();
  checkLimitAlert();

  /* Reset form (keep date & category) */
  txDescription.value = '';
  txAmount.value      = '';
  txDescription.focus();
});

/* ─────────────────────────────────────────────
   DELETE TRANSACTION
───────────────────────────────────────────── */
function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  transactions = transactions.filter(tx => tx.id !== id);
  saveTransactions();
  renderTransactions();
  renderSummary();
  updateOverview();
  checkLimitAlert();
}

/* ─────────────────────────────────────────────
   SORT
───────────────────────────────────────────── */
function getSorted(list) {
  const mode = sortSelect.value;
  const copy = [...list];

  switch (mode) {
    case 'date-desc':
      return copy.sort((a, b) => new Date(b.date) - new Date(a.date));
    case 'date-asc':
      return copy.sort((a, b) => new Date(a.date) - new Date(b.date));
    case 'amount-desc':
      return copy.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':
      return copy.sort((a, b) => a.amount - b.amount);
    case 'category':
      return copy.sort((a, b) => a.category.localeCompare(b.category));
    default:
      return copy;
  }
}

sortSelect.addEventListener('change', renderTransactions);

/* ─────────────────────────────────────────────
   MONTHLY SUMMARY
───────────────────────────────────────────── */
monthFilter.addEventListener('change', renderSummary);

function renderSummary() {
  const month = monthFilter.value; /* "YYYY-MM" or "" */

  if (!month) {
    summaryGrid.innerHTML = '<p class="empty-msg">Select a month above to see the summary.</p>';
    summaryMonth.textContent = '';
    return;
  }

  const filtered = transactions.filter(tx => tx.date.startsWith(month));

  /* Label */
  const [year, mon] = month.split('-');
  const label = new Date(year, mon - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  summaryMonth.textContent = `— ${label}`;

  if (filtered.length === 0) {
    summaryGrid.innerHTML = '<p class="empty-msg">No transactions for this month.</p>';
    return;
  }

  /* Aggregate by category */
  const byCat = {};
  let totalIn  = 0;
  let totalOut = 0;

  filtered.forEach(tx => {
    if (!byCat[tx.category]) byCat[tx.category] = { income: 0, expense: 0, count: 0 };
    byCat[tx.category][tx.type === 'income' ? 'income' : 'expense'] += tx.amount;
    byCat[tx.category].count++;
    if (tx.type === 'income') totalIn  += tx.amount;
    else                      totalOut += tx.amount;
  });

  /* Build cards */
  let html = '';

  Object.entries(byCat).forEach(([cat, data]) => {
    html += `
      <div class="summary-card">
        <span class="summary-card__cat">${escHtml(cat)}</span>
        ${data.expense > 0 ? `<span class="summary-card__amount">− ${formatRp(data.expense)}</span>` : ''}
        ${data.income  > 0 ? `<span class="summary-card__amount summary-card__amount--income">+ ${formatRp(data.income)}</span>` : ''}
        <span class="summary-card__count">${data.count} transaction${data.count !== 1 ? 's' : ''}</span>
      </div>`;
  });

  /* Net total card — shows the direct result only */
  const net = totalIn - totalOut;
  html += `
    <div class="summary-card summary-card--net">
      <span class="summary-card__cat">Net Total</span>
      <span class="summary-card__amount ${net >= 0 ? 'summary-card__amount--income' : ''}" style="font-size:1.25rem;">
        ${net < 0 ? '− ' : '+ '}${formatRp(net)}
      </span>
      <span class="summary-card__count">${filtered.length} transaction${filtered.length !== 1 ? 's' : ''} this month</span>
    </div>`;

  summaryGrid.innerHTML = html;
}

/* ─────────────────────────────────────────────
   RENDER TRANSACTIONS
───────────────────────────────────────────── */
function renderTransactions() {
  const sorted = getSorted(transactions);

  if (sorted.length === 0) {
    txList.innerHTML = '<li class="empty-msg">No transactions yet. Add one above!</li>';
    return;
  }

  txList.innerHTML = sorted.map(tx => {
    const isIncome   = tx.type === 'income';
    const overLimit  = !isIncome && spendingLimit > 0 && tx.amount > spendingLimit;
    const typeClass  = isIncome ? 'tx-item--income' : 'tx-item--expense';
    const limitClass = overLimit ? ' tx-item--over-limit' : '';
    const icon       = isIncome ? '💵' : getCategoryIcon(tx.category);
    const sign       = isIncome ? '+' : '−';
    const tagClass   = `tag tag--${tx.category.toLowerCase()}`;

    return `
      <li class="tx-item ${typeClass}${limitClass}" data-id="${tx.id}">
        <span class="tx-item__icon">${icon}</span>
        <div class="tx-item__body">
          <div class="tx-item__desc">${escHtml(tx.desc)}</div>
          <div class="tx-item__meta">
            <span class="${tagClass}" style="padding:0.15rem 0.55rem;font-size:0.72rem;">${escHtml(tx.category)}</span>
            &nbsp;${formatDate(tx.date)}
            ${overLimit ? '&nbsp;<span style="color:var(--warning);font-weight:700;">⚠ over limit</span>' : ''}
          </div>
        </div>
        <span class="tx-item__amount">${sign} ${formatRp(tx.amount)}</span>
        <button class="tx-item__delete" onclick="deleteTransaction('${tx.id}')" title="Delete transaction">🗑</button>
      </li>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   OVERVIEW TOTALS
───────────────────────────────────────────── */
function getTotalIncome() {
  return transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
}

function getTotalExpense() {
  return transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
}

function updateOverview() {
  const total = getTotalIncome() - getTotalExpense();

  totalBalanceEl.textContent = (total < 0 ? '− ' : '') + formatRp(total);

  /* Border and text color reflect positive / negative */
  totalCard.style.borderBottomColor = total < 0 ? 'var(--expense)' : 'var(--income)';
  totalBalanceEl.style.color        = total < 0 ? 'var(--expense)' : total === 0 ? 'var(--balance)' : 'var(--income)';
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function formatRp(amount) {
  return 'Rp ' + Math.abs(amount).toLocaleString('id-ID');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function setDefaultDate() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  txDate.value = `${y}-${m}-${d}`;

  /* Also pre-select current month in the summary filter */
  monthFilter.value = `${y}-${m}`;
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCategoryIcon(category) {
  const icons = {
    needs:   '🛒',
    wants:   '🎮',
    goals:   '🎯',
    earning: '💼',
  };
  return icons[category.toLowerCase()] || '📌';
}

/* ─────────────────────────────────────────────
   BOOT
───────────────────────────────────────────── */
init();
