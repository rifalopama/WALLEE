/* ==========================================================================
   WALLE — application logic
   Data lokal (localStorage), validasi, filter, CRUD transaksi, toast,
   dan grafik arus kas 6 bulan terakhir (canvas, tanpa dependensi).
   ========================================================================== */

(() => {
  'use strict';

  /* Nama kunci dipertahankan agar data transaksi lama tetap terbaca. */
  const STORAGE_KEY = 'myfinance:transactions:v1';
  const SAVINGS_KEY = 'walle:savings:v1';
  const MAX_AMOUNT = 1e12;
  const MAX_SAVINGS_NAME = 40;
  const CHART_MONTHS = 6;

  const CATEGORIES = {
    income: ['Gaji', 'Bonus', 'Investasi', 'Usaha', 'Hadiah', 'Lainnya'],
    expense: ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Kesehatan', 'Hiburan', 'Pendidikan', 'Lainnya'],
  };

  const ICONS = {
    income:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 7 7 17" /><path d="M17 17H7V7" /></svg>',
    expense:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>',
    edit:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>',
    trash:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>',
    wallet:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1" /><rect x="3" y="7" width="18" height="12" rx="2.5" /><path d="M16 13h.01" /></svg>',
    search:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>',
    target:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>',
    plus:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>',
  };

  const TOAST_ICONS = {
    success:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7" /></svg>',
    error:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5" /><path d="M12 16h.01" /></svg>',
    info:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5h.01" /></svg>',
  };

  const rp = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  });

  const shortDateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const longDateFormatter = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const monthFullFormatter = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  const monthShortFormatter = new Intl.DateTimeFormat('id-ID', { month: 'short' });

  const els = {};
  const state = {
    transactions: [],
    type: 'income',
    editId: null,
    deleteId: null,
    lastFocus: null,
    filters: { search: '', type: 'all', category: 'all' },
    savings: [],
    savingsEditId: null,
    savingsDeleteId: null,
    savingsFundId: null,
  };

  const chartState = { hovered: -1, geometry: [] };
  let chartFrame = 0;

  /* ------------------------------------------------------------------------
     Utilities
     ------------------------------------------------------------------------ */

  function $(id) {
    return document.getElementById(id);
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function uid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `tx-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function todayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }

  function isoFromTimestamp(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function isValidDateString(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  function parseISODate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function formatShortDate(value) {
    return isValidDateString(value) ? shortDateFormatter.format(parseISODate(value)) : '—';
  }

  function formatLongDate(value) {
    return isValidDateString(value) ? longDateFormatter.format(parseISODate(value)) : '—';
  }

  function compactRupiah(value) {
    if (!value) return 'Rp 0';
    const units = [
      [1e12, 'T'],
      [1e9, 'M'],
      [1e6, 'jt'],
      [1e3, 'rb'],
    ];
    for (const [size, suffix] of units) {
      if (Math.abs(value) >= size) {
        const scaled = value / size;
        const digits = Math.abs(scaled) < 10 ? 1 : 0;
        return `Rp ${scaled.toLocaleString('id-ID', { maximumFractionDigits: digits })} ${suffix}`;
      }
    }
    return `Rp ${value.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
  }

  function typeLabel(type) {
    return type === 'expense' ? 'Pengeluaran' : 'Pemasukan';
  }

  /* ------------------------------------------------------------------------
     Storage
     ------------------------------------------------------------------------ */

  function normalizeStored(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const type = raw.type === 'income' || raw.type === 'expense' ? raw.type : null;
    if (!type) return null;

    const amount = Number(raw.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;
    if (!isValidDateString(raw.date)) return null;

    const categories = CATEGORIES[type];
    const category =
      typeof raw.category === 'string' && categories.includes(raw.category.trim())
        ? raw.category.trim()
        : 'Lainnya';

    const note = typeof raw.note === 'string' ? raw.note.slice(0, 60) : '';
    const createdAt = Number(raw.createdAt);

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      type,
      amount: Math.round(amount),
      category,
      date: raw.date,
      note,
      createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
    };
  }

  function loadTransactions() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeStored).filter(Boolean);
    } catch (error) {
      console.warn('WALLE: gagal membaca data dari localStorage.', error);
      return [];
    }
  }

  function saveTransactions() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
      return true;
    } catch (error) {
      console.warn('WALLE: gagal menyimpan data ke localStorage.', error);
      return false;
    }
  }

  function normalizeSavings(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_SAVINGS_NAME) : '';
    if (!name) return null;

    const target = Number(raw.target);
    if (!Number.isFinite(target) || target <= 0 || target > MAX_AMOUNT) return null;

    const saved = Number(raw.saved);
    const createdAt = Number(raw.createdAt);

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      name,
      target: Math.round(target),
      saved: Number.isFinite(saved) && saved > 0 ? Math.min(Math.round(saved), MAX_AMOUNT) : 0,
      createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
    };
  }

  function loadSavings() {
    try {
      const raw = window.localStorage.getItem(SAVINGS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeSavings).filter(Boolean);
    } catch (error) {
      console.warn('WALLE: gagal membaca data tabungan dari localStorage.', error);
      return [];
    }
  }

  function saveSavings() {
    try {
      window.localStorage.setItem(SAVINGS_KEY, JSON.stringify(state.savings));
      return true;
    } catch (error) {
      console.warn('WALLE: gagal menyimpan data tabungan ke localStorage.', error);
      return false;
    }
  }

  /* ------------------------------------------------------------------------
     Toasts
     ------------------------------------------------------------------------ */

  function dismissToast(toast) {
    if (!toast.isConnected || toast.classList.contains('is-leaving')) return;
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 240);
  }

  function showToast(message, type = 'success') {
    if (!els.toastStack) return;

    while (els.toastStack.children.length >= 4) {
      els.toastStack.firstElementChild.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.innerHTML = TOAST_ICONS[type] || TOAST_ICONS.info;

    const text = document.createElement('span');
    text.textContent = message;

    toast.append(icon, text);
    els.toastStack.append(toast);
    window.setTimeout(() => dismissToast(toast), 3400);
  }

  /* ------------------------------------------------------------------------
     Categories & selects
     ------------------------------------------------------------------------ */

  function fillCategorySelect(select, type, selected = '') {
    if (!select) return;
    const list = CATEGORIES[type] || [];
    const value = list.includes(selected) ? selected : '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Pilih kategori';
    placeholder.disabled = true;
    placeholder.selected = value === '';

    const options = list.map((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      option.selected = category === value;
      return option;
    });

    select.replaceChildren(placeholder, ...options);
    select.value = value;
  }

  function buildCategoryFilter() {
    if (!els.categoryFilter) return;
    const unique = [...new Set([...CATEGORIES.income, ...CATEGORIES.expense])];

    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = 'Semua kategori';

    const options = unique.map((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      return option;
    });

    els.categoryFilter.replaceChildren(all, ...options);
    els.categoryFilter.value = 'all';
  }

  /* ------------------------------------------------------------------------
     Validation
     ------------------------------------------------------------------------ */

  function setFieldError(input, errorEl, message) {
    if (input) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
  }

  function clearFieldError(input, errorEl) {
    if (input) {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
    }
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  }

  function bindErrorClearing(input, errorEl) {
    if (!input) return;
    const handler = () => {
      if (errorEl && !errorEl.hidden) clearFieldError(input, errorEl);
    };
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
  }

  function validateTransactionForm(fields) {
    let valid = true;

    clearFieldError(fields.amount, fields.amountError);
    clearFieldError(fields.category, fields.categoryError);
    clearFieldError(fields.date, fields.dateError);

    const rawAmount = (fields.amount.value || '').trim();
    const amount = Number(rawAmount);

    if (!rawAmount) {
      setFieldError(fields.amount, fields.amountError, 'Nominal wajib diisi.');
      valid = false;
    } else if (!Number.isFinite(amount) || amount <= 0) {
      setFieldError(fields.amount, fields.amountError, 'Nominal harus lebih dari 0.');
      valid = false;
    } else if (!Number.isInteger(amount)) {
      setFieldError(fields.amount, fields.amountError, 'Nominal harus bilangan bulat (tanpa desimal).');
      valid = false;
    } else if (amount > MAX_AMOUNT) {
      setFieldError(fields.amount, fields.amountError, 'Nominal terlalu besar.');
      valid = false;
    }

    const category = fields.category.value;
    if (!category || !CATEGORIES[fields.type].includes(category)) {
      setFieldError(fields.category, fields.categoryError, 'Pilih kategori transaksi.');
      valid = false;
    }

    const date = fields.date.value;
    if (!date) {
      setFieldError(fields.date, fields.dateError, 'Tanggal wajib diisi.');
      valid = false;
    } else if (!isValidDateString(date)) {
      setFieldError(fields.date, fields.dateError, 'Tanggal tidak valid.');
      valid = false;
    } else {
      const year = Number(date.slice(0, 4));
      if (year < 1900 || year > 2100) {
        setFieldError(fields.date, fields.dateError, 'Tahun harus antara 1900 dan 2100.');
        valid = false;
      }
    }

    if (!valid) {
      const firstInvalid = [fields.amount, fields.category, fields.date].find((field) =>
        field.classList.contains('is-invalid')
      );
      if (firstInvalid) firstInvalid.focus();
    }

    return valid
      ? {
          type: fields.type,
          amount: Math.round(amount),
          category,
          date,
          note: (fields.note.value || '').trim().slice(0, 60),
        }
      : null;
  }

  /* ------------------------------------------------------------------------
     Modal helpers
     ------------------------------------------------------------------------ */

  function visibleModals() {
    return [...document.querySelectorAll('.modal')].filter((modal) => !modal.hidden);
  }

  function syncBodyLock() {
    document.body.classList.toggle('modal-open', visibleModals().length > 0);
  }

  function openModal(modal, focusTarget) {
    if (!modal) return;
    state.lastFocus = document.activeElement;
    modal.hidden = false;
    syncBodyLock();
    window.requestAnimationFrame(() => {
      const target =
        focusTarget ||
        modal.querySelector('[data-autofocus]') ||
        modal.querySelector('input, select, button');
      if (target) target.focus();
    });
  }

  function closeModal(modal) {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    syncBodyLock();

    if (modal === els.editModal) state.editId = null;
    if (modal === els.deleteModal) state.deleteId = null;
    if (modal === els.savingsModal) state.savingsEditId = null;
    if (modal === els.savingsFundModal) state.savingsFundId = null;
    if (modal === els.savingsDeleteModal) state.savingsDeleteId = null;

    const previous = state.lastFocus;
    state.lastFocus = null;
    if (previous && previous.isConnected && typeof previous.focus === 'function') {
      previous.focus();
    }
  }

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const modal = visibleModals()[0];
    if (!modal) return;

    const focusables = [...modal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((el) => el.offsetParent !== null || el === document.activeElement);

    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------------------------------------------------
     Stats
     ------------------------------------------------------------------------ */

  function renderStats() {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

    let totalIncome = 0;
    let totalExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;

    for (const transaction of state.transactions) {
      if (transaction.type === 'income') totalIncome += transaction.amount;
      else totalExpense += transaction.amount;

      if (transaction.date.slice(0, 7) === currentMonthKey) {
        if (transaction.type === 'income') monthIncome += transaction.amount;
        else monthExpense += transaction.amount;
      }
    }

    const balance = totalIncome - totalExpense;
    const monthNet = monthIncome - monthExpense;

    els.balanceValue.textContent = rp.format(balance);
    els.balanceValue.classList.toggle('is-negative', balance < 0);
    els.balanceNote.textContent = `Bulan ini · ${rp.format(monthNet)}`;

    els.incomeValue.textContent = rp.format(totalIncome);
    els.incomeNote.textContent = `Bulan ini · ${rp.format(monthIncome)}`;

    els.expenseValue.textContent = rp.format(totalExpense);
    els.expenseNote.textContent = `Bulan ini · ${rp.format(monthExpense)}`;
  }

  /* ------------------------------------------------------------------------
     Transaction list
     ------------------------------------------------------------------------ */

  function filteredTransactions() {
    const search = state.filters.search.trim().toLowerCase();
    const typeFilter = state.filters.type;
    const categoryFilter = state.filters.category;

    return state.transactions
      .filter((transaction) => {
        if (typeFilter !== 'all' && transaction.type !== typeFilter) return false;
        if (categoryFilter !== 'all' && transaction.category !== categoryFilter) return false;
        if (!search) return true;

        const haystack = [
          transaction.category,
          transaction.note,
          typeLabel(transaction.type),
          rp.format(transaction.amount),
          String(transaction.amount),
          transaction.amount.toLocaleString('id-ID'),
          formatShortDate(transaction.date),
          formatLongDate(transaction.date),
          transaction.date,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(search);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }

  function hasActiveFilters() {
    return (
      state.filters.search.trim() !== '' ||
      state.filters.type !== 'all' ||
      state.filters.category !== 'all'
    );
  }

  function buildTransactionItem(transaction) {
    const item = document.createElement('article');
    item.className = 'tx-item';
    item.dataset.id = transaction.id;

    const icon = document.createElement('span');
    icon.className = `tx-icon is-${transaction.type}`;
    icon.innerHTML = ICONS[transaction.type];

    const main = document.createElement('div');
    main.className = 'tx-main';

    const top = document.createElement('div');
    top.className = 'tx-top';

    const title = document.createElement('span');
    title.className = 'tx-title';
    title.textContent = transaction.category;

    const amount = document.createElement('span');
    amount.className = `tx-amount is-${transaction.type}`;
    amount.textContent = `${transaction.type === 'income' ? '+' : '−'} ${rp.format(transaction.amount)}`;

    top.append(title, amount);

    const meta = document.createElement('div');
    meta.className = 'tx-meta';

    const date = document.createElement('span');
    date.textContent = formatShortDate(transaction.date);
    meta.append(date);

    if (transaction.note) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      const note = document.createElement('span');
      note.className = 'tx-note';
      note.textContent = transaction.note;
      meta.append(dot, note);
    }

    main.append(top, meta);

    const actions = document.createElement('div');
    actions.className = 'tx-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'icon-btn';
    editButton.dataset.action = 'edit';
    editButton.setAttribute('aria-label', `Edit transaksi ${transaction.category} ${rp.format(transaction.amount)}`);
    editButton.innerHTML = ICONS.edit;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'icon-btn danger';
    deleteButton.dataset.action = 'delete';
    deleteButton.setAttribute('aria-label', `Hapus transaksi ${transaction.category} ${rp.format(transaction.amount)}`);
    deleteButton.innerHTML = ICONS.trash;

    actions.append(editButton, deleteButton);
    item.append(icon, main, actions);

    return item;
  }

  function buildEmptyState(iconMarkup, title, description) {
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';

    const icon = document.createElement('div');
    icon.className = 'empty-icon';
    icon.innerHTML = iconMarkup;

    const heading = document.createElement('h3');
    heading.textContent = title;

    const text = document.createElement('p');
    text.textContent = description;

    wrap.append(icon, heading, text);
    return wrap;
  }

  function renderHistory() {
    const transactions = filteredTransactions();
    const active = hasActiveFilters();

    els.historyCount.textContent = `${transactions.length} transaksi`;
    els.historySub.textContent = active
      ? `Menampilkan ${transactions.length} dari ${state.transactions.length} transaksi.`
      : 'Semua transaksi tersimpan di perangkat ini.';

    if (!transactions.length) {
      els.transactionList.replaceChildren(
        state.transactions.length
          ? buildEmptyState(
              ICONS.search,
              'Transaksi tidak ditemukan',
              'Coba ubah kata kunci pencarian atau filter yang kamu pilih.'
            )
          : buildEmptyState(
              ICONS.wallet,
              'Belum ada transaksi',
              'Mulai catat pemasukan atau pengeluaran pertamamu lewat formulir di samping.'
            )
      );
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const transaction of transactions) {
      fragment.append(buildTransactionItem(transaction));
    }
    els.transactionList.replaceChildren(fragment);
  }

  /* ------------------------------------------------------------------------
     Chart (canvas, 6 bulan terakhir)
     ------------------------------------------------------------------------ */

  function getMonthSeries() {
    const now = new Date();
    const months = [];
    const index = new Map();

    for (let offset = CHART_MONTHS - 1; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
      const entry = {
        key,
        label: monthShortFormatter.format(date),
        full: monthFullFormatter.format(date),
        income: 0,
        expense: 0,
      };
      months.push(entry);
      index.set(key, entry);
    }

    for (const transaction of state.transactions) {
      const entry = index.get(transaction.date.slice(0, 7));
      if (!entry) continue;
      if (transaction.type === 'income') entry.income += transaction.amount;
      else entry.expense += transaction.amount;
    }

    return months;
  }

  function getNiceScale(maxValue) {
    if (!Number.isFinite(maxValue) || maxValue <= 0) {
      return { max: 1, ticks: [0, 1] };
    }

    const rough = maxValue / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const normalized = rough / magnitude;

    let nice;
    if (normalized <= 1) nice = 1;
    else if (normalized <= 2) nice = 2;
    else if (normalized <= 2.5) nice = 2.5;
    else if (normalized <= 5) nice = 5;
    else nice = 10;

    const step = nice * magnitude;
    const max = Math.ceil(maxValue / step) * step;
    const ticks = [];
    for (let value = 0; value <= max + step / 2; value += step) {
      ticks.push(Number(value.toFixed(6)));
    }
    return { max, ticks };
  }

  function roundedTopRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height));
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
  }

  function hideChartTooltip() {
    if (els.chartTooltip) {
      els.chartTooltip.hidden = true;
      els.chartTooltip.replaceChildren();
    }
  }

  function tooltipRow(kind, label, value, isNet = false) {
    const row = document.createElement('div');
    row.className = `tooltip-row ${kind}${isNet ? ' net' : ''}`;

    const dot = document.createElement('i');
    if (isNet) dot.style.background = 'rgba(167, 176, 184, 0.7)';

    const name = document.createElement('span');
    name.textContent = label;

    const amount = document.createElement('strong');
    amount.textContent = rp.format(value);
    if (value < 0) amount.classList.add('negative');

    row.append(dot, name, amount);
    return row;
  }

  function showChartTooltip(month, clientX) {
    const tooltip = els.chartTooltip;
    const wrap = els.chartWrap;
    if (!tooltip || !wrap) return;

    const net = month.income - month.expense;

    const title = document.createElement('span');
    title.className = 'tooltip-title';
    title.textContent = month.full;

    tooltip.replaceChildren(
      title,
      tooltipRow('income', 'Pemasukan', month.income),
      tooltipRow('expense', 'Pengeluaran', month.expense),
      tooltipRow('net', 'Selisih', net, true)
    );

    tooltip.hidden = false;

    const wrapRect = wrap.getBoundingClientRect();
    const half = tooltip.offsetWidth / 2;
    const pointerX = clientX - wrapRect.left;
    const left = Math.max(half + 6, Math.min(wrapRect.width - half - 6, pointerX));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = '10px';
  }

  function drawChart() {
    const canvas = els.chart;
    const wrap = els.chartWrap;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    if (width < 20 || height < 20) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const series = getMonthSeries();
    const hasData = series.some((month) => month.income > 0 || month.expense > 0);

    els.chartEmpty.hidden = hasData;
    canvas.hidden = !hasData;
    chartState.geometry = [];

    if (!hasData) {
      hideChartTooltip();
      chartState.hovered = -1;
      return;
    }

    const compact = width < 460;
    const padding = {
      top: 16,
      right: 10,
      bottom: 28,
      left: compact ? 52 : 64,
    };
    const plotLeft = padding.left;
    const plotRight = width - padding.right;
    const plotTop = padding.top;
    const plotBottom = height - padding.bottom;
    const plotWidth = Math.max(plotRight - plotLeft, 1);
    const plotHeight = Math.max(plotBottom - plotTop, 1);

    const maxValue = Math.max(...series.map((month) => Math.max(month.income, month.expense)));
    const scale = getNiceScale(maxValue);

    /* Grid + label sumbu Y */
    ctx.font = '400 10px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;

    for (const tick of scale.ticks) {
      const y = plotBottom - (tick / scale.max) * plotHeight;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.065)';
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(plotLeft, Math.round(y) + 0.5);
      ctx.lineTo(plotRight, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#7b858e';
      ctx.fillText(compactRupiah(tick), plotLeft - 8, y);
    }

    const groupWidth = plotWidth / series.length;
    const barWidth = Math.max(4, Math.min(16, groupWidth * 0.26));
    const barGap = Math.max(2, Math.min(6, groupWidth * 0.1));
    const pairWidth = barWidth * 2 + barGap;

    const incomeGradient = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
    incomeGradient.addColorStop(0, 'rgba(125, 211, 252, 0.98)');
    incomeGradient.addColorStop(1, 'rgba(56, 189, 248, 0.45)');

    const expenseGradient = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
    expenseGradient.addColorStop(0, 'rgba(255, 112, 112, 0.95)');
    expenseGradient.addColorStop(1, 'rgba(255, 112, 112, 0.42)');

    series.forEach((month, index) => {
      const groupStart = plotLeft + groupWidth * index;

      if (chartState.hovered === index) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
        roundedTopRect(ctx, groupStart + 2, plotTop, groupWidth - 4, plotHeight, 8);
      }

      const bars = [
        { value: month.income, fill: incomeGradient, offset: 0 },
        { value: month.expense, fill: expenseGradient, offset: barWidth + barGap },
      ];

      const startX = groupStart + (groupWidth - pairWidth) / 2;

      for (const bar of bars) {
        if (bar.value <= 0) continue;
        const barHeight = Math.max(2, (bar.value / scale.max) * plotHeight);
        const x = startX + bar.offset;
        const y = plotBottom - barHeight;

        ctx.fillStyle = bar.fill;
        roundedTopRect(ctx, x, y, barWidth, barHeight, Math.min(5, barWidth / 2));
      }

      ctx.fillStyle = '#7b858e';
      ctx.font = '400 11px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(month.label, groupStart + groupWidth / 2, plotBottom + 9);

      chartState.geometry.push({
        x: groupStart,
        w: groupWidth,
        month,
      });
    });

    /* Baseline */
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotBottom + 0.5);
    ctx.lineTo(plotRight, plotBottom + 0.5);
    ctx.stroke();
  }

  function scheduleChartDraw() {
    if (chartFrame) window.cancelAnimationFrame(chartFrame);
    chartFrame = window.requestAnimationFrame(() => {
      chartFrame = 0;
      drawChart();
    });
  }

  function renderChart() {
    chartState.hovered = -1;
    hideChartTooltip();
    scheduleChartDraw();
  }

  function bindChartEvents() {
    const canvas = els.chart;
    if (!canvas) return;

    canvas.addEventListener('pointermove', (event) => {
      if (canvas.hidden) return;
      const geometry = chartState.geometry;
      if (!geometry.length) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const index = geometry.findIndex((group) => x >= group.x && x < group.x + group.w);

      if (index === -1) {
        if (chartState.hovered !== -1) {
          chartState.hovered = -1;
          drawChart();
        }
        hideChartTooltip();
        return;
      }

      const changed = chartState.hovered !== index;
      chartState.hovered = index;
      if (changed) drawChart();
      showChartTooltip(geometry[index].month, event.clientX);
    });

    canvas.addEventListener('pointerleave', () => {
      chartState.hovered = -1;
      hideChartTooltip();
      if (!canvas.hidden) drawChart();
    });

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => scheduleChartDraw());
      observer.observe(els.chartWrap);
    } else {
      window.addEventListener('resize', scheduleChartDraw);
    }
  }

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */

  function render() {
    renderStats();
    renderHistory();
    renderChart();
    renderSavings();
  }

  /* ------------------------------------------------------------------------
     Form: tambah transaksi
     ------------------------------------------------------------------------ */

  function setFormType(type, keepCategory = false) {
    state.type = type;
    els.form.dataset.type = type;

    for (const button of els.typeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.formType === type));
    }

    fillCategorySelect(
      els.categorySelect,
      type,
      keepCategory ? els.categorySelect.value : ''
    );
  }

  function clearAddFormErrors() {
    clearFieldError(els.amountInput, els.amountError);
    clearFieldError(els.categorySelect, els.categoryError);
    clearFieldError(els.dateInput, els.dateError);
  }

  function resetAddForm() {
    els.form.reset();
    els.dateInput.value = todayISO();
    fillCategorySelect(els.categorySelect, state.type);
    els.noteInput.value = '';
    clearAddFormErrors();
  }

  function handleAddSubmit(event) {
    event.preventDefault();

    const data = validateTransactionForm({
      type: state.type,
      amount: els.amountInput,
      amountError: els.amountError,
      category: els.categorySelect,
      categoryError: els.categoryError,
      date: els.dateInput,
      dateError: els.dateError,
      note: els.noteInput,
    });

    if (!data) {
      showToast('Periksa kembali data transaksi.', 'error');
      return;
    }

    state.transactions.push({
      id: uid(),
      ...data,
      createdAt: Date.now(),
    });

    const saved = saveTransactions();
    resetAddForm();
    render();

    showToast(
      saved
        ? `${typeLabel(data.type)} ${rp.format(data.amount)} berhasil ditambahkan.`
        : 'Transaksi ditambahkan, tetapi gagal disimpan ke localStorage.',
      saved ? 'success' : 'error'
    );

    els.amountInput.focus();
  }

  /* ------------------------------------------------------------------------
     Form: edit transaksi
     ------------------------------------------------------------------------ */

  function findTransaction(id) {
    return state.transactions.find((transaction) => transaction.id === id) || null;
  }

  function openEditModal(id) {
    const transaction = findTransaction(id);
    if (!transaction) {
      showToast('Transaksi tidak ditemukan.', 'error');
      return;
    }

    state.editId = transaction.id;
    els.editForm.dataset.type = transaction.type;

    for (const button of els.editTypeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.editType === transaction.type));
    }

    fillCategorySelect(els.editCategory, transaction.type, transaction.category);
    els.editAmount.value = String(transaction.amount);
    els.editDate.value = transaction.date;
    els.editNote.value = transaction.note;

    clearFieldError(els.editAmount, els.editAmountError);
    clearFieldError(els.editCategory, els.editCategoryError);
    clearFieldError(els.editDate, els.editDateError);

    openModal(els.editModal, els.editAmount);
  }

  function setEditType(type) {
    els.editForm.dataset.type = type;
    for (const button of els.editTypeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.editType === type));
    }
    fillCategorySelect(els.editCategory, type, els.editCategory.value);
  }

  function handleEditSubmit(event) {
    event.preventDefault();

    const transaction = findTransaction(state.editId);
    if (!transaction) {
      closeModal(els.editModal);
      showToast('Transaksi tidak ditemukan.', 'error');
      return;
    }

    const type = els.editForm.dataset.type === 'expense' ? 'expense' : 'income';

    const data = validateTransactionForm({
      type,
      amount: els.editAmount,
      amountError: els.editAmountError,
      category: els.editCategory,
      categoryError: els.editCategoryError,
      date: els.editDate,
      dateError: els.editDateError,
      note: els.editNote,
    });

    if (!data) {
      showToast('Periksa kembali data transaksi.', 'error');
      return;
    }

    Object.assign(transaction, data, { updatedAt: Date.now() });

    const saved = saveTransactions();
    closeModal(els.editModal);
    render();

    showToast(
      saved
        ? 'Perubahan transaksi berhasil disimpan.'
        : 'Perubahan tersimpan sementara, tetapi gagal ditulis ke localStorage.',
      saved ? 'success' : 'error'
    );
  }

  /* ------------------------------------------------------------------------
     Hapus transaksi
     ------------------------------------------------------------------------ */

  function openDeleteModal(id) {
    const transaction = findTransaction(id);
    if (!transaction) {
      showToast('Transaksi tidak ditemukan.', 'error');
      return;
    }

    state.deleteId = transaction.id;
    els.deleteSummary.textContent = `${transaction.category} · ${rp.format(transaction.amount)} · ${formatShortDate(transaction.date)}`;
    openModal(els.deleteModal, els.deleteModal.querySelector('[data-autofocus]'));
  }

  function handleDeleteConfirm() {
    const transaction = findTransaction(state.deleteId);
    if (!transaction) {
      closeModal(els.deleteModal);
      showToast('Transaksi tidak ditemukan.', 'error');
      return;
    }

    state.transactions = state.transactions.filter((item) => item.id !== transaction.id);
    const saved = saveTransactions();

    closeModal(els.deleteModal);
    render();

    showToast(
      saved
        ? `${transaction.category} ${rp.format(transaction.amount)} dihapus.`
        : 'Transaksi dihapus, tetapi perubahan gagal disimpan ke localStorage.',
      saved ? 'success' : 'error'
    );
  }

  /* ------------------------------------------------------------------------
     Tabungan
     ------------------------------------------------------------------------ */

  function findSavings(id) {
    return state.savings.find((goal) => goal.id === id) || null;
  }

  function savingsPercent(goal) {
    if (!goal.target) return 0;
    return (goal.saved / goal.target) * 100;
  }

  function savingsTotals() {
    let total = 0;
    let done = 0;
    for (const goal of state.savings) {
      total += goal.saved;
      if (goal.saved >= goal.target) done += 1;
    }
    return { total, done, active: state.savings.length - done };
  }

  function buildSavingsCard(goal) {
    const percent = savingsPercent(goal);
    const roundedPercent = Math.floor(percent);
    const barWidth = Math.max(0, Math.min(100, percent));
    const complete = goal.saved >= goal.target;
    const remaining = Math.max(0, goal.target - goal.saved);

    const card = document.createElement('article');
    card.className = `savings-card${complete ? ' is-complete' : ''}`;
    card.dataset.id = goal.id;

    const head = document.createElement('div');
    head.className = 'savings-card-head';

    const icon = document.createElement('span');
    icon.className = 'savings-icon';
    icon.innerHTML = ICONS.target;

    const titleWrap = document.createElement('div');
    titleWrap.className = 'savings-title-wrap';

    const name = document.createElement('h3');
    name.className = 'savings-name';
    name.textContent = goal.name;

    const date = document.createElement('p');
    date.className = 'savings-date';
    date.textContent = `Dibuat ${formatShortDate(isoFromTimestamp(goal.createdAt))}`;

    titleWrap.append(name, date);

    const actions = document.createElement('div');
    actions.className = 'savings-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'icon-btn';
    editButton.dataset.action = 'edit';
    editButton.setAttribute('aria-label', `Edit target tabungan ${goal.name}`);
    editButton.innerHTML = ICONS.edit;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'icon-btn danger';
    deleteButton.dataset.action = 'delete';
    deleteButton.setAttribute('aria-label', `Hapus target tabungan ${goal.name}`);
    deleteButton.innerHTML = ICONS.trash;

    actions.append(editButton, deleteButton);
    head.append(icon, titleWrap, actions);

    const figures = document.createElement('div');
    figures.className = 'savings-figures';

    const savedValue = document.createElement('span');
    savedValue.className = 'savings-saved';
    savedValue.textContent = rp.format(goal.saved);

    const targetValue = document.createElement('span');
    targetValue.className = 'savings-target';
    targetValue.textContent = `dari ${rp.format(goal.target)}`;

    figures.append(savedValue, targetValue);

    const progress = document.createElement('div');
    progress.className = 'progress';
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', `Progres tabungan ${goal.name}`);
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', '100');
    progress.setAttribute('aria-valuenow', String(roundedPercent));
    progress.setAttribute('aria-valuetext', `${roundedPercent}% dari target tercapai`);

    const fill = document.createElement('span');
    fill.className = 'progress-fill';
    fill.style.width = `${barWidth}%`;
    progress.append(fill);

    const metaRow = document.createElement('div');
    metaRow.className = 'savings-meta-row';

    const percentBadge = document.createElement('span');
    percentBadge.className = 'savings-percent';
    percentBadge.textContent = `${roundedPercent}% tercapai`;

    const remainingText = document.createElement('span');
    remainingText.className = 'savings-remaining';
    if (complete) {
      remainingText.innerHTML = 'Target <strong>tercapai</strong>';
    } else {
      remainingText.innerHTML = `Sisa <strong>${rp.format(remaining)}</strong>`;
    }

    metaRow.append(percentBadge, remainingText);

    const fundButton = document.createElement('button');
    fundButton.type = 'button';
    fundButton.className = 'savings-fund-btn';
    fundButton.dataset.action = 'fund';
    fundButton.setAttribute('aria-label', `Tambah dana tabungan ${goal.name}`);
    fundButton.innerHTML = `${ICONS.plus}<span>Tambah dana</span>`;

    card.append(head, figures, progress, metaRow, fundButton);
    return card;
  }

  function renderSavings() {
    if (!els.savingsList) return;

    const totals = savingsTotals();
    els.savingsTotalValue.textContent = rp.format(totals.total);
    els.savingsActiveValue.textContent = `${totals.active} target`;
    els.savingsDoneValue.textContent = `${totals.done} target`;

    if (!state.savings.length) {
      els.savingsList.replaceChildren(
        buildEmptyState(
          ICONS.target,
          'Belum ada target tabungan',
          'Tambahkan target pertamamu, lalu catat dana yang kamu sisihkan secara berkala.'
        )
      );
      return;
    }

    const goals = [...state.savings].sort((a, b) => b.createdAt - a.createdAt);
    const fragment = document.createDocumentFragment();
    for (const goal of goals) fragment.append(buildSavingsCard(goal));
    els.savingsList.replaceChildren(fragment);
  }

  function validateSavingsForm() {
    let valid = true;

    clearFieldError(els.savingsName, els.savingsNameError);
    clearFieldError(els.savingsTarget, els.savingsTargetError);
    clearFieldError(els.savingsSaved, els.savingsSavedError);

    const name = (els.savingsName.value || '').trim().slice(0, MAX_SAVINGS_NAME);
    if (!name) {
      setFieldError(els.savingsName, els.savingsNameError, 'Nama target wajib diisi.');
      valid = false;
    }

    const rawTarget = (els.savingsTarget.value || '').trim();
    const target = Number(rawTarget);
    if (!rawTarget) {
      setFieldError(els.savingsTarget, els.savingsTargetError, 'Nominal target wajib diisi.');
      valid = false;
    } else if (!Number.isFinite(target) || target <= 0) {
      setFieldError(els.savingsTarget, els.savingsTargetError, 'Nominal target harus lebih dari 0.');
      valid = false;
    } else if (!Number.isInteger(target)) {
      setFieldError(els.savingsTarget, els.savingsTargetError, 'Nominal target harus bilangan bulat.');
      valid = false;
    } else if (target > MAX_AMOUNT) {
      setFieldError(els.savingsTarget, els.savingsTargetError, 'Nominal target terlalu besar.');
      valid = false;
    }

    const rawSaved = (els.savingsSaved.value || '').trim();
    const savedValue = rawSaved === '' ? 0 : Number(rawSaved);
    if (rawSaved !== '') {
      if (!Number.isFinite(savedValue) || savedValue < 0) {
        setFieldError(els.savingsSaved, els.savingsSavedError, 'Dana ditabung tidak boleh negatif.');
        valid = false;
      } else if (!Number.isInteger(savedValue)) {
        setFieldError(els.savingsSaved, els.savingsSavedError, 'Dana ditabung harus bilangan bulat.');
        valid = false;
      } else if (savedValue > MAX_AMOUNT) {
        setFieldError(els.savingsSaved, els.savingsSavedError, 'Nominal terlalu besar.');
        valid = false;
      }
    }

    if (!valid) {
      const firstInvalid = [els.savingsName, els.savingsTarget, els.savingsSaved].find((field) =>
        field.classList.contains('is-invalid')
      );
      if (firstInvalid) firstInvalid.focus();
      return null;
    }

    return { name, target: Math.round(target), saved: Math.round(savedValue) };
  }

  function openSavingsModal(goal) {
    state.savingsEditId = goal ? goal.id : null;

    els.savingsForm.reset();
    clearFieldError(els.savingsName, els.savingsNameError);
    clearFieldError(els.savingsTarget, els.savingsTargetError);
    clearFieldError(els.savingsSaved, els.savingsSavedError);

    els.savingsModalTitle.textContent = goal ? 'Edit target tabungan' : 'Target tabungan baru';
    els.savingsModalSub.textContent = goal
      ? 'Perbarui nama, nominal target, atau dana yang sudah terkumpul.'
      : 'Tentukan nama target dan nominal yang ingin kamu capai.';

    els.savingsName.value = goal ? goal.name : '';
    els.savingsTarget.value = goal ? String(goal.target) : '';
    els.savingsSaved.value = goal ? String(goal.saved) : '';

    openModal(els.savingsModal, els.savingsName);
  }

  function handleSavingsSubmit(event) {
    event.preventDefault();

    const data = validateSavingsForm();
    if (!data) {
      showToast('Periksa kembali data target tabungan.', 'error');
      return;
    }

    const editing = state.savingsEditId ? findSavings(state.savingsEditId) : null;

    if (editing) {
      Object.assign(editing, data, { updatedAt: Date.now() });
    } else {
      state.savings.push({ id: uid(), ...data, createdAt: Date.now() });
    }

    const saved = saveSavings();
    closeModal(els.savingsModal);
    renderSavings();

    showToast(
      saved
        ? editing
          ? `Target ${data.name} berhasil diperbarui.`
          : `Target ${data.name} berhasil ditambahkan.`
        : 'Target tersimpan sementara, tetapi gagal ditulis ke localStorage.',
      saved ? 'success' : 'error'
    );
  }

  function openSavingsFundModal(id) {
    const goal = findSavings(id);
    if (!goal) {
      showToast('Target tabungan tidak ditemukan.', 'error');
      return;
    }

    state.savingsFundId = goal.id;

    els.savingsFundForm.reset();
    clearFieldError(els.savingsFundAmount, els.savingsFundError);
    els.savingsFundCurrent.textContent = rp.format(goal.saved);
    els.savingsFundSub.textContent = `Target ${goal.name} · ${rp.format(goal.target)}`;

    openModal(els.savingsFundModal, els.savingsFundAmount);
  }

  function handleSavingsFundSubmit(event) {
    event.preventDefault();

    const goal = findSavings(state.savingsFundId);
    if (!goal) {
      closeModal(els.savingsFundModal);
      showToast('Target tabungan tidak ditemukan.', 'error');
      return;
    }

    clearFieldError(els.savingsFundAmount, els.savingsFundError);

    const raw = (els.savingsFundAmount.value || '').trim();
    const amount = Number(raw);

    let message = '';
    if (!raw) message = 'Nominal wajib diisi.';
    else if (!Number.isFinite(amount) || amount <= 0) message = 'Nominal harus lebih dari 0.';
    else if (!Number.isInteger(amount)) message = 'Nominal harus bilangan bulat.';
    else if (amount > MAX_AMOUNT) message = 'Nominal terlalu besar.';

    if (message) {
      setFieldError(els.savingsFundAmount, els.savingsFundError, message);
      els.savingsFundAmount.focus();
      showToast('Periksa kembali nominal tabungan.', 'error');
      return;
    }

    goal.saved = Math.min(goal.saved + Math.round(amount), MAX_AMOUNT);
    goal.updatedAt = Date.now();

    const saved = saveSavings();
    const complete = goal.saved >= goal.target;
    closeModal(els.savingsFundModal);
    renderSavings();

    showToast(
      saved
        ? complete
          ? `Selamat! Target ${goal.name} tercapai.`
          : `${rp.format(amount)} ditambahkan ke tabungan ${goal.name}.`
        : 'Dana tabungan bertambah, tetapi gagal disimpan ke localStorage.',
      saved ? 'success' : 'error'
    );
  }

  function openSavingsDeleteModal(id) {
    const goal = findSavings(id);
    if (!goal) {
      showToast('Target tabungan tidak ditemukan.', 'error');
      return;
    }

    state.savingsDeleteId = goal.id;
    els.savingsDeleteSummary.textContent = `${goal.name} · ${rp.format(goal.saved)} dari ${rp.format(goal.target)}`;
    openModal(els.savingsDeleteModal, els.savingsDeleteModal.querySelector('[data-autofocus]'));
  }

  function handleSavingsDeleteConfirm() {
    const goal = findSavings(state.savingsDeleteId);
    if (!goal) {
      closeModal(els.savingsDeleteModal);
      showToast('Target tabungan tidak ditemukan.', 'error');
      return;
    }

    state.savings = state.savings.filter((item) => item.id !== goal.id);
    const saved = saveSavings();

    closeModal(els.savingsDeleteModal);
    renderSavings();

    showToast(
      saved
        ? `Target ${goal.name} dihapus.`
        : 'Target dihapus, tetapi perubahan gagal disimpan ke localStorage.',
      saved ? 'success' : 'error'
    );
  }

  /* ------------------------------------------------------------------------
     Filter & pencarian
     ------------------------------------------------------------------------ */

  function syncFilters() {
    state.filters.search = els.searchInput.value;
    state.filters.type = els.typeFilter.value;
    state.filters.category = els.categoryFilter.value;
    renderHistory();
  }

  /* ------------------------------------------------------------------------
     Event binding & init
     ------------------------------------------------------------------------ */

  function cacheElements() {
    els.todayChip = $('todayChip');
    els.balanceValue = $('balanceValue');
    els.balanceNote = $('balanceNote');
    els.incomeValue = $('incomeValue');
    els.incomeNote = $('incomeNote');
    els.expenseValue = $('expenseValue');
    els.expenseNote = $('expenseNote');

    els.form = $('transactionForm');
    els.typeButtons = [...document.querySelectorAll('[data-form-type]')];
    els.amountInput = $('amountInput');
    els.amountError = $('amountError');
    els.categorySelect = $('categorySelect');
    els.categoryError = $('categoryError');
    els.dateInput = $('dateInput');
    els.dateError = $('dateError');
    els.noteInput = $('noteInput');

    els.historySub = $('historySub');
    els.historyCount = $('historyCount');
    els.searchInput = $('searchInput');
    els.typeFilter = $('typeFilter');
    els.categoryFilter = $('categoryFilter');
    els.transactionList = $('transactionList');

    els.chart = $('cashflowChart');
    els.chartWrap = $('chartWrap');
    els.chartTooltip = $('chartTooltip');
    els.chartEmpty = $('chartEmpty');

    els.editModal = $('editModal');
    els.editForm = $('editForm');
    els.editTypeButtons = [...document.querySelectorAll('[data-edit-type]')];
    els.editAmount = $('editAmount');
    els.editAmountError = $('editAmountError');
    els.editCategory = $('editCategory');
    els.editCategoryError = $('editCategoryError');
    els.editDate = $('editDate');
    els.editDateError = $('editDateError');
    els.editNote = $('editNote');

    els.deleteModal = $('deleteModal');
    els.deleteSummary = $('deleteSummary');
    els.confirmDeleteBtn = $('confirmDeleteBtn');

    els.addSavingsBtn = $('addSavingsBtn');
    els.savingsList = $('savingsList');
    els.savingsTotalValue = $('savingsTotalValue');
    els.savingsActiveValue = $('savingsActiveValue');
    els.savingsDoneValue = $('savingsDoneValue');

    els.savingsModal = $('savingsModal');
    els.savingsForm = $('savingsForm');
    els.savingsModalTitle = $('savingsModalTitle');
    els.savingsModalSub = $('savingsModalSub');
    els.savingsName = $('savingsName');
    els.savingsNameError = $('savingsNameError');
    els.savingsTarget = $('savingsTarget');
    els.savingsTargetError = $('savingsTargetError');
    els.savingsSaved = $('savingsSaved');
    els.savingsSavedError = $('savingsSavedError');

    els.savingsFundModal = $('savingsFundModal');
    els.savingsFundForm = $('savingsFundForm');
    els.savingsFundAmount = $('savingsFundAmount');
    els.savingsFundError = $('savingsFundError');
    els.savingsFundCurrent = $('savingsFundCurrent');
    els.savingsFundSub = $('savingsFundSub');

    els.savingsDeleteModal = $('savingsDeleteModal');
    els.savingsDeleteSummary = $('savingsDeleteSummary');
    els.confirmSavingsDeleteBtn = $('confirmSavingsDeleteBtn');

    els.toastStack = $('toastStack');
  }

  function bindEvents() {
    /* Tanggal hari ini */
    els.todayChip.textContent = longDateFormatter.format(new Date());

    /* Jenis transaksi (form tambah) */
    for (const button of els.typeButtons) {
      button.addEventListener('click', () => {
        if (button.dataset.formType === state.type) return;
        setFormType(button.dataset.formType, true);
        clearFieldError(els.categorySelect, els.categoryError);
      });
    }

    /* Validasi realtime */
    bindErrorClearing(els.amountInput, els.amountError);
    bindErrorClearing(els.categorySelect, els.categoryError);
    bindErrorClearing(els.dateInput, els.dateError);
    bindErrorClearing(els.editAmount, els.editAmountError);
    bindErrorClearing(els.editCategory, els.editCategoryError);
    bindErrorClearing(els.editDate, els.editDateError);

    /* Submit tambah */
    els.form.addEventListener('submit', handleAddSubmit);

    /* Filter & pencarian */
    els.searchInput.addEventListener('input', syncFilters);
    els.typeFilter.addEventListener('change', syncFilters);
    els.categoryFilter.addEventListener('change', syncFilters);

    /* Aksi pada riwayat */
    els.transactionList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const item = button.closest('[data-id]');
      if (!item) return;

      if (button.dataset.action === 'edit') openEditModal(item.dataset.id);
      else if (button.dataset.action === 'delete') openDeleteModal(item.dataset.id);
    });

    /* Jenis transaksi (form edit) */
    for (const button of els.editTypeButtons) {
      button.addEventListener('click', () => {
        const type = button.dataset.editType;
        if (type === els.editForm.dataset.type) return;
        setEditType(type);
        clearFieldError(els.editCategory, els.editCategoryError);
      });
    }

    /* Submit edit */
    els.editForm.addEventListener('submit', handleEditSubmit);

    /* Konfirmasi hapus */
    els.confirmDeleteBtn.addEventListener('click', handleDeleteConfirm);

    /* Navigasi bagian */
    const navLinks = [...document.querySelectorAll('.topnav-link')];
    for (const link of navLinks) {
      link.addEventListener('click', () => {
        for (const item of navLinks) item.classList.toggle('is-active', item === link);
      });
    }

    /* Tabungan: tambah target */
    els.addSavingsBtn.addEventListener('click', () => openSavingsModal(null));

    /* Tabungan: validasi realtime */
    bindErrorClearing(els.savingsName, els.savingsNameError);
    bindErrorClearing(els.savingsTarget, els.savingsTargetError);
    bindErrorClearing(els.savingsSaved, els.savingsSavedError);
    bindErrorClearing(els.savingsFundAmount, els.savingsFundError);

    /* Tabungan: submit form target */
    els.savingsForm.addEventListener('submit', handleSavingsSubmit);

    /* Tabungan: submit tambah dana */
    els.savingsFundForm.addEventListener('submit', handleSavingsFundSubmit);

    /* Tabungan: konfirmasi hapus */
    els.confirmSavingsDeleteBtn.addEventListener('click', handleSavingsDeleteConfirm);

    /* Tabungan: aksi pada kartu target */
    els.savingsList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const card = button.closest('[data-id]');
      if (!card) return;

      if (button.dataset.action === 'edit') openSavingsModal(findSavings(card.dataset.id));
      else if (button.dataset.action === 'delete') openSavingsDeleteModal(card.dataset.id);
      else if (button.dataset.action === 'fund') openSavingsFundModal(card.dataset.id);
    });

    /* Tutup modal (tombol + backdrop) */
    document.addEventListener('click', (event) => {
      const closer = event.target.closest('[data-close-modal]');
      if (closer) {
        closeModal(closer.closest('.modal'));
        return;
      }

      if (event.target.classList.contains('modal') && !event.target.hidden) {
        closeModal(event.target);
      }
    });

    /* Keyboard: Esc + focus trap */
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const modal = visibleModals().pop();
        if (modal) {
          event.preventDefault();
          closeModal(modal);
        }
        return;
      }
      trapFocus(event);
    });

    bindChartEvents();
  }

  function init() {
    cacheElements();

    const today = todayISO();
    els.dateInput.value = today;
    els.editDate.value = today;

    buildCategoryFilter();
    setFormType('income');
    fillCategorySelect(els.editCategory, 'income');

    state.transactions = loadTransactions();
    state.savings = loadSavings();

    bindEvents();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
