const INTERVAL_KEY = 'refreshInterval';
let refreshMs = parseInt(localStorage.getItem(INTERVAL_KEY) || '12000', 10);
const STOCKLIST_KEY = 'stockList';
const NOTES_KEY = 'stockNotes';
const HOLDINGS_KEY = 'stockHoldings';
const COSTS_KEY = 'stockCosts';
const ITEMS_PER_PAGE_KEY = 'itemsPerPage';
const RECORD_TIME_KEY = 'recordTime';

const refreshIntervalSpan = document.getElementById('refresh-interval');
const lastUpdatedSpan = document.getElementById('last-updated');
const symbolsInput = document.getElementById('symbols-input');
const updateButton = document.getElementById('update-button');
const refreshNowButton = document.getElementById('refresh-now-button');
const tableBody = document.getElementById('stock-table-body');
const stockCardList = document.getElementById('stock-card-list');

let refreshTimer = null;

let currentPage = 1;
let itemsPerPage = parseInt(localStorage.getItem(ITEMS_PER_PAGE_KEY) || '10', 10);

const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageInfo = document.getElementById('page-info');
const itemsPerPageSelect = document.getElementById('items-per-page');
itemsPerPageSelect.value = itemsPerPage.toString();

let activeMobileCardSymbol = null;

function updateMobileCardStates(expandedSymbol) {
  if (!isMobileLayout()) {
    activeMobileCardSymbol = null;
    return;
  }

  activeMobileCardSymbol = expandedSymbol || null;

  const cards = stockCardList.querySelectorAll('.stock-card');
  cards.forEach((card) => {
    const isExpanded = activeMobileCardSymbol !== null && card.dataset.symbol === activeMobileCardSymbol;
    card.classList.toggle('is-expanded', isExpanded);
    card.classList.toggle('is-collapsed', !isExpanded);
  });
}

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    refreshDisplay();
  }
});

nextPageBtn.addEventListener('click', () => {
  currentPage++;
  refreshDisplay();
});

itemsPerPageSelect.addEventListener('change', (e) => {
  itemsPerPage = parseInt(e.target.value, 10);
  localStorage.setItem(ITEMS_PER_PAGE_KEY, itemsPerPage.toString());
  currentPage = 1;
  refreshDisplay();
});

const API_KEY_STORAGE = 'fugleApiKey';
const settingsButton = document.getElementById('settings-button');
const apiKeyModal = document.getElementById('api-key-modal');
const modalApiKeyInput = document.getElementById('modal-api-key-input');
const modalCancel = document.getElementById('modal-cancel');
const modalOk = document.getElementById('modal-ok');
let isApiKeyModalMandatory = false;
let appInitialized = false;

function showModal(modalElement) {
  modalElement.classList.remove('is-hidden');
}

function hideModal(modalElement) {
  modalElement.classList.add('is-hidden');
}

function showApiKeyModal({ mandatory }) {
  isApiKeyModalMandatory = mandatory;
  modalApiKeyInput.value = localStorage.getItem(API_KEY_STORAGE) || '';
  apiKeyModal.classList.toggle('is-mandatory', mandatory);
  showModal(apiKeyModal);
  modalApiKeyInput.focus();
}

function hideApiKeyModalIfAllowed() {
  if (isApiKeyModalMandatory) return;
  hideModal(apiKeyModal);
}

async function validateApiKey(apiKey) {
  if (!apiKey) {
    return { valid: false, message: '請輸入 Fugle API Key。' };
  }

  try {
    const res = await fetch('https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/2330', {
      headers: { 'X-API-KEY': apiKey }
    });

    if (!res.ok) {
      return { valid: false, message: 'API Key 驗證失敗，請確認輸入內容是否正確。' };
    }

    const data = await res.json();
    if (!data || !data.symbol) {
      return { valid: false, message: 'API Key 驗證失敗，請稍後再試。' };
    }

    return { valid: true, message: '' };
  } catch {
    return { valid: false, message: '無法連線驗證 API Key，請檢查網路後再試。' };
  }
}

function initializeAppIfNeeded() {
  if (appInitialized) return;
  appInitialized = true;
  refreshDisplay();
  startAutoRefresh();
}

settingsButton.addEventListener('click', () => {
  const hasStoredKey = !!(localStorage.getItem(API_KEY_STORAGE) || '').trim();
  showApiKeyModal({ mandatory: !hasStoredKey });
});

modalCancel.addEventListener('click', () => {
  hideApiKeyModalIfAllowed();
});

modalOk.addEventListener('click', async () => {
  const newKey = modalApiKeyInput.value.trim();
  const originalLabel = modalOk.textContent;
  modalOk.disabled = true;
  modalOk.textContent = '驗證中...';

  const result = await validateApiKey(newKey);

  modalOk.disabled = false;
  modalOk.textContent = originalLabel;

  if (!result.valid) {
    alert(result.message);
    modalApiKeyInput.focus();
    return;
  }

  localStorage.setItem(API_KEY_STORAGE, newKey);
  isApiKeyModalMandatory = false;
  apiKeyModal.classList.remove('is-mandatory');
  hideModal(apiKeyModal);
  initializeAppIfNeeded();
  refreshDisplay();
});

modalApiKeyInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    modalOk.click();
  }
});

function loadStockList() {
  try {
    const raw = localStorage.getItem(STOCKLIST_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch {}
  return [];
}

function saveStockList(list) {
  localStorage.setItem(STOCKLIST_KEY, JSON.stringify(list));
}

function getVisibleSymbols() {
  return loadStockList().filter((stock) => stock.visible).map((stock) => stock.id);
}

function loadField(key, symbol) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    return data[symbol] || '';
  } catch {
    return '';
  }
}

function saveField(key, symbol, value) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    data[symbol] = value;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function addOrToggleStock(symbol) {
  const normalized = symbol.trim();
  if (!normalized) return;

  const list = loadStockList();
  const existing = list.find((item) => item.id === normalized);

  if (existing) {
    existing.visible = !existing.visible;
  } else {
    list.push({ id: normalized, visible: true });
  }

  saveStockList(list);
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(value);
}

function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function getStatusClass(value) {
  return value === 0 ? 'status-neutral' : (value > 0 ? 'status-positive' : 'status-negative');
}

function bindStockInputs({ stock, costInput, holdingsInput, noteInput, returnCell, profitCell }) {
  function updateCalculations() {
    const costValue = parseFloat(costInput.value);
    const holdingsValue = parseFloat(holdingsInput.value);

    if (!isNaN(costValue) && costValue > 0) {
      const rate = ((stock.price - costValue) / costValue) * 100;
      returnCell.textContent = formatNumber(rate) + '%';
      returnCell.className = returnCell.className
        .split(' ')
        .filter((className) => !className.startsWith('status-'))
        .concat(getStatusClass(rate))
        .join(' ');

      if (!isNaN(holdingsValue) && holdingsValue > 0) {
        const profit = (stock.price - costValue) * holdingsValue;
        profitCell.textContent = formatNumber(profit);
        profitCell.className = profitCell.className
          .split(' ')
          .filter((className) => !className.startsWith('status-'))
          .concat(getStatusClass(profit))
          .join(' ');
      } else {
        profitCell.textContent = '-';
        profitCell.className = profitCell.className
          .split(' ')
          .filter((className) => !className.startsWith('status-'))
          .concat('status-neutral')
          .join(' ');
      }
    } else {
      returnCell.textContent = '-';
      returnCell.className = returnCell.className
        .split(' ')
        .filter((className) => !className.startsWith('status-'))
        .concat('status-neutral')
        .join(' ');
      profitCell.textContent = '-';
      profitCell.className = profitCell.className
        .split(' ')
        .filter((className) => !className.startsWith('status-'))
        .concat('status-neutral')
        .join(' ');
    }
  }

  costInput.addEventListener('input', updateCalculations);
  holdingsInput.addEventListener('input', updateCalculations);

  costInput.addEventListener('change', () => {
    saveField(COSTS_KEY, stock.symbol, costInput.value);
  });

  holdingsInput.addEventListener('change', () => {
    saveField(HOLDINGS_KEY, stock.symbol, holdingsInput.value);
  });

  noteInput.addEventListener('input', () => {
    autoResizeTextarea(noteInput);
  });

  noteInput.addEventListener('change', () => {
    saveField(NOTES_KEY, stock.symbol, noteInput.value);
  });

  autoResizeTextarea(noteInput);
  updateCalculations();
}

function createRow(stock) {
  const tr = document.createElement('tr');
  const note = loadField(NOTES_KEY, stock.symbol);
  const holdings = loadField(HOLDINGS_KEY, stock.symbol);
  const cost = loadField(COSTS_KEY, stock.symbol);
  const stockUrl = `https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${encodeURIComponent(stock.symbol)}`;

  tr.innerHTML = `
    <td><a class="stock-link" href="${stockUrl}" target="_blank" rel="noreferrer">${stock.symbol}</a></td>
    <td><a class="stock-link" href="${stockUrl}" target="_blank" rel="noreferrer">${stock.name || stock.symbol}</a></td>
    <td>${formatNumber(stock.price)}</td>
    <td class="${getStatusClass(stock.change)}">${formatNumber(stock.change)}</td>
    <td class="${getStatusClass(stock.changePercent)}">${formatNumber(stock.changePercent)}%</td>
    <td>${stock.volume ? stock.volume.toLocaleString('zh-TW') : '-'}</td>
    <td><input class="note-input" type="number" value="${cost}" placeholder="成本價"></td>
    <td class="return-rate-cell status-neutral">-</td>
    <td><input class="note-input" type="number" value="${holdings}" placeholder="股數"></td>
    <td class="profit-loss-cell status-neutral">-</td>
    <td><textarea class="note-input" rows="1" placeholder="輸入記錄">${note}</textarea></td>
  `;

  const costInput = tr.querySelector('td:nth-child(7) input');
  const returnCell = tr.querySelector('.return-rate-cell');
  const holdingsInput = tr.querySelector('td:nth-child(9) input');
  const profitCell = tr.querySelector('.profit-loss-cell');
  const noteInput = tr.querySelector('textarea');

  bindStockInputs({ stock, costInput, holdingsInput, noteInput, returnCell, profitCell });

  return tr;
}

function createCard(stock) {
  const card = document.createElement('article');
  const note = loadField(NOTES_KEY, stock.symbol);
  const holdings = loadField(HOLDINGS_KEY, stock.symbol);
  const cost = loadField(COSTS_KEY, stock.symbol);
  const stockUrl = `https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${encodeURIComponent(stock.symbol)}`;
  const changePrefix = stock.change > 0 ? '+' : (stock.change < 0 ? '-' : '');
  const changePercentPrefix = stock.changePercent > 0 ? '+' : (stock.changePercent < 0 ? '-' : '');

  card.className = 'stock-card panel';
  card.dataset.symbol = stock.symbol;
  const isExpanded = isMobileLayout() && activeMobileCardSymbol === stock.symbol;
  if (isMobileLayout()) {
    card.classList.add(isExpanded ? 'is-expanded' : 'is-collapsed');
  }
  card.innerHTML = `
    <div class="stock-card-header">
      <div class="stock-card-title-group">
        <div class="stock-card-title-row">
          <a class="stock-link stock-card-symbol" href="${stockUrl}" target="_blank" rel="noreferrer">${stock.symbol}</a>
          <span class="stock-card-industry">${stock.industry || '-'}</span>
        </div>
        <p class="stock-card-name">${stock.name || stock.symbol}</p>
      </div>
      <div class="stock-card-price-group">
        <div class="stock-card-price-row">
          <span class="stock-card-volume">量 ${stock.volume ? stock.volume.toLocaleString('zh-TW') : '-'}</span>
          <strong class="stock-card-price">${formatNumber(stock.price)}</strong>
        </div>
        <span class="stock-card-change ${getStatusClass(stock.changePercent)}">${changePrefix}${formatNumber(Math.abs(stock.change))} / ${changePercentPrefix}${formatNumber(Math.abs(stock.changePercent))}%</span>
      </div>
    </div>
    <div class="stock-card-body">
      <div class="stock-card-column stock-card-column-left">
        <div class="stock-card-field">
          <span class="stock-card-label">成本價</span>
          <input class="note-input stock-card-input" type="text" inputmode="decimal" value="${cost}" placeholder="成本價">
        </div>
        <div class="stock-card-field">
          <span class="stock-card-label">現存股數</span>
          <input class="note-input stock-card-input" type="text" inputmode="numeric" value="${holdings}" placeholder="股數">
        </div>
      </div>
      <div class="stock-card-column stock-card-column-right">
        <div class="stock-card-field stock-card-metric">
          <span class="stock-card-label">報酬率</span>
          <span class="stock-card-value stock-card-metric-value return-rate-card status-neutral">-</span>
        </div>
        <div class="stock-card-field stock-card-metric">
          <span class="stock-card-label">損益</span>
          <span class="stock-card-value stock-card-metric-value profit-loss-card status-neutral">-</span>
        </div>
      </div>
    </div>
    <div class="stock-card-note-group">
      <span class="stock-card-label">我的記錄</span>
      <textarea class="note-input stock-card-note" rows="1" placeholder="輸入記錄">${note}</textarea>
    </div>
  `;

  const inputs = card.querySelectorAll('input');
  const costInput = inputs[0];
  const holdingsInput = inputs[1];
  const returnCell = card.querySelector('.return-rate-card');
  const profitCell = card.querySelector('.profit-loss-card');
  const noteInput = card.querySelector('textarea');

  bindStockInputs({ stock, costInput, holdingsInput, noteInput, returnCell, profitCell });

  if (isMobileLayout()) {
    card.addEventListener('click', (event) => {
      if (event.target.closest('a, input, textarea, button, select, label')) {
        return;
      }
      if (activeMobileCardSymbol === stock.symbol) {
        updateMobileCardStates(null);
      } else {
        updateMobileCardStates(stock.symbol);
      }
    });
  }

  return card;
}

function isMobileLayout() {
  return window.matchMedia('(max-width: 1081px)').matches;
}

function renderEmptyState(message) {
  tableBody.innerHTML = `<tr><td colspan="11">${message}</td></tr>`;
  stockCardList.innerHTML = `<div class="stock-card-empty panel">${message}</div>`;
}

const industryCache = {};
async function fetchIndustry(symbolId) {
  if (industryCache[symbolId] !== undefined) return industryCache[symbolId];
  try {
    const res = await fetch(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&data_id=${symbolId}`);
    const data = await res.json();
    if (data.status === 200 && data.data && data.data.length > 0) {
      let category = data.data[0].industry_category || '';
      category = category.replace(/業$/, '');
      industryCache[symbolId] = category;
      return category;
    }
  } catch {}
  industryCache[symbolId] = '';
  return '';
}

async function fetchFugleQuote(symbolId, apiKey) {
  try {
    const res = await fetch(`https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/${symbolId}`, {
      headers: { 'X-API-KEY': apiKey }
    });
    if (!res.ok) return null;
    const data = await res.json();

    const price = data.lastPrice || data.closePrice || data.previousClose || 0;
    const change = data.change || 0;
    const changePercent = data.changePercent || 0;
    const volume = (data.total && data.total.tradeVolume) || 0;

    return {
      symbol: data.symbol || symbolId,
      name: data.name || symbolId,
      price,
      change,
      changePercent,
      volume,
      open: data.openPrice || 0,
      high: data.highPrice || 0,
      low: data.lowPrice || 0,
      yestClose: data.previousClose || 0,
      market: data.market || '',
      isRealtime: true,
    };
  } catch {
    return null;
  }
}

async function fetchQuotes(symbols) {
  const apiKey = localStorage.getItem(API_KEY_STORAGE) || '';
  if (!apiKey) {
    throw new Error('請先在上方輸入 Fugle API Key');
  }

  const promises = symbols.map(async (symbol) => {
    const [quote, industry] = await Promise.all([
      fetchFugleQuote(symbol, apiKey),
      fetchIndustry(symbol)
    ]);

    if (!quote) {
      return {
        symbol,
        name: symbol,
        industry,
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        open: 0,
        high: 0,
        low: 0,
        yestClose: 0,
        market: '',
        isRealtime: false,
      };
    }

    quote.industry = industry;
    return quote;
  });

  return Promise.all(promises);
}

async function refreshDisplay() {
  const allSymbols = getVisibleSymbols();
  allSymbols.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const mobileLayout = isMobileLayout();

  if (allSymbols.length === 0) {
    renderEmptyState('尚未新增任何股票，請輸入代號後按「立即新增」。');
    pageInfo.textContent = '第 1 頁 / 共 1 頁';
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
    return;
  }

  const totalPages = Math.ceil(allSymbols.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  if (mobileLayout) {
    pageInfo.textContent = `手機模式顯示全部 ${allSymbols.length} 筆`;
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
  } else {
    pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁 (總計 ${allSymbols.length} 筆)`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
  }

  const currentSymbols = mobileLayout
    ? allSymbols
    : allSymbols.slice((currentPage - 1) * itemsPerPage, (currentPage - 1) * itemsPerPage + itemsPerPage);

  renderEmptyState('讀取中…');

  try {
    const stocks = await fetchQuotes(currentSymbols);

    if (stocks.length === 0) {
      renderEmptyState('找不到股票資料，請檢查代號是否正確。');
      return;
    }

    tableBody.innerHTML = '';
    stockCardList.innerHTML = '';
    const stockMap = {};
    stocks.forEach((stock) => {
      stockMap[stock.symbol] = stock;
    });
    currentSymbols.forEach((symbol) => {
      if (stockMap[symbol]) {
        const stock = stockMap[symbol];
        tableBody.appendChild(createRow(stock));
        stockCardList.appendChild(createCard(stock));
      }
    });

    lastUpdatedSpan.textContent = new Date().toLocaleString();
  } catch (error) {
    renderEmptyState(`更新失敗：${error.message}`);
  }
}

async function refreshNow() {
  refreshNowButton.disabled = true;
  const originalLabel = refreshNowButton.textContent;
  refreshNowButton.textContent = '更新中...';

  try {
    await refreshDisplay();
  } finally {
    refreshNowButton.disabled = false;
    refreshNowButton.textContent = originalLabel;
  }
}

function isMarketOpen() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  return hours < 13 || (hours === 13 && minutes < 32);
}

function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  refreshTimer = setInterval(() => {
    if (isMarketOpen()) {
      refreshDisplay();
    } else {
      clearInterval(refreshTimer);
      refreshTimer = null;
      refreshIntervalSpan.textContent = '已收盤';
    }
  }, refreshMs);
}

updateButton.addEventListener('click', () => {
  const raw = symbolsInput.value.trim();
  if (!raw) {
    alert('請輸入股票代號。');
    return;
  }

  const ids = raw.split(',').map((symbol) => symbol.trim()).filter(Boolean);
  ids.forEach((id) => addOrToggleStock(id));
  symbolsInput.value = '';
  refreshDisplay();
});

refreshNowButton.addEventListener('click', () => {
  refreshNow();
});

symbolsInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    updateButton.click();
  }
});

function exportDataToObject() {
  return {
    [STOCKLIST_KEY]: localStorage.getItem(STOCKLIST_KEY),
    [NOTES_KEY]: localStorage.getItem(NOTES_KEY),
    [HOLDINGS_KEY]: localStorage.getItem(HOLDINGS_KEY),
    [COSTS_KEY]: localStorage.getItem(COSTS_KEY),
    [INTERVAL_KEY]: localStorage.getItem(INTERVAL_KEY),
    [ITEMS_PER_PAGE_KEY]: localStorage.getItem(ITEMS_PER_PAGE_KEY),
    [RECORD_TIME_KEY]: localStorage.getItem(RECORD_TIME_KEY)
  };
}

function importDataFromObject(data) {
  if (data[STOCKLIST_KEY]) localStorage.setItem(STOCKLIST_KEY, data[STOCKLIST_KEY]);
  if (data[NOTES_KEY]) localStorage.setItem(NOTES_KEY, data[NOTES_KEY]);
  if (data[HOLDINGS_KEY]) localStorage.setItem(HOLDINGS_KEY, data[HOLDINGS_KEY]);
  if (data[COSTS_KEY]) localStorage.setItem(COSTS_KEY, data[COSTS_KEY]);
  if (data[INTERVAL_KEY]) {
    localStorage.setItem(INTERVAL_KEY, data[INTERVAL_KEY]);
    refreshMs = parseInt(data[INTERVAL_KEY], 10);
  }
  if (data[ITEMS_PER_PAGE_KEY]) {
    localStorage.setItem(ITEMS_PER_PAGE_KEY, data[ITEMS_PER_PAGE_KEY]);
    itemsPerPage = parseInt(data[ITEMS_PER_PAGE_KEY], 10);
    itemsPerPageSelect.value = itemsPerPage.toString();
  }
  if (data[RECORD_TIME_KEY]) {
    localStorage.setItem(RECORD_TIME_KEY, data[RECORD_TIME_KEY]);
    const recordTimeInput = document.getElementById('modal-github-record-time');
    if (recordTimeInput) recordTimeInput.value = data[RECORD_TIME_KEY];
  }
  refreshIntervalSpan.textContent = (refreshMs / 1000) + ' 秒';
  startAutoRefresh();
  currentPage = 1;
  refreshDisplay();
}

const exportButton = document.getElementById('export-button');
exportButton.addEventListener('click', () => {
  const data = exportDataToObject();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `daily_stock_backup_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

const importButton = document.getElementById('import-button');
const importFileInput = document.getElementById('import-file-input');

importButton.addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      importDataFromObject(data);
      alert('資料匯入成功！');
    } catch {
      alert('匯入失敗：檔案格式錯誤。');
    }
    importFileInput.value = '';
  };
  reader.readAsText(file);
});

const GITHUB_TOKEN_STORAGE = 'githubToken';
const GITHUB_GIST_ID_STORAGE = 'githubGistId';
const githubSyncButton = document.getElementById('github-sync-button');
const githubSyncModal = document.getElementById('github-sync-modal');
const modalGithubTokenInput = document.getElementById('modal-github-token-input');
const modalGithubGistIdInput = document.getElementById('modal-github-gist-id-input');
const modalGithubCancel = document.getElementById('modal-github-cancel');
const modalGithubUpload = document.getElementById('modal-github-upload');
const modalGithubDownload = document.getElementById('modal-github-download');
const modalGithubRecordTime = document.getElementById('modal-github-record-time');

githubSyncButton.addEventListener('click', () => {
  const storedToken = localStorage.getItem(GITHUB_TOKEN_STORAGE) || '';
  const storedGistId = localStorage.getItem(GITHUB_GIST_ID_STORAGE) || '';
  const storedRecordTime = localStorage.getItem(RECORD_TIME_KEY) || '';
  modalGithubTokenInput.value = storedToken;
  modalGithubGistIdInput.value = storedGistId;
  modalGithubRecordTime.value = storedRecordTime;
  modalGithubGistIdInput.readOnly = !!storedGistId;
  showModal(githubSyncModal);
});

modalGithubCancel.addEventListener('click', () => {
  hideModal(githubSyncModal);
});

function saveGithubSettings() {
  const token = modalGithubTokenInput.value.trim();
  const gistId = modalGithubGistIdInput.value.trim();
  localStorage.setItem(GITHUB_TOKEN_STORAGE, token);
  localStorage.setItem(GITHUB_GIST_ID_STORAGE, gistId);
  return { token, gistId };
}

function getFormattedRecordTime() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `[${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}]`;
}

modalGithubUpload.addEventListener('click', async () => {
  const { token, gistId } = saveGithubSettings();
  if (!token) return alert('請輸入 GitHub Token');

  const newTime = getFormattedRecordTime();
  localStorage.setItem(RECORD_TIME_KEY, newTime);
  if (modalGithubRecordTime) modalGithubRecordTime.value = newTime;

  const dataStr = JSON.stringify(exportDataToObject(), null, 2);
  const payload = {
    files: {
      'stock_dashboard_data.json': {
        content: dataStr
      }
    }
  };

  try {
    modalGithubUpload.textContent = '上傳中...';
    modalGithubUpload.disabled = true;

    let url = 'https://api.github.com/gists';
    let method = 'POST';

    if (gistId) {
      url = `https://api.github.com/gists/${gistId}`;
      method = 'PATCH';
      payload.description = 'Updated by Stock Dashboard';
    } else {
      payload.description = 'Stock Dashboard Backup';
      payload.public = false;
    }

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`API 錯誤: ${res.status}`);
    const result = await res.json();

    if (!gistId) {
      localStorage.setItem(GITHUB_GIST_ID_STORAGE, result.id);
      modalGithubGistIdInput.value = result.id;
      modalGithubGistIdInput.readOnly = true;
      alert('建立 Gist 並上傳成功！');
    } else {
      alert('上傳更新 Gist 成功！');
    }
  } catch (err) {
    alert('上傳失敗：' + err.message);
  } finally {
    modalGithubUpload.textContent = '☁️ 上傳';
    modalGithubUpload.disabled = false;
  }
});

modalGithubDownload.addEventListener('click', async () => {
  const { token, gistId } = saveGithubSettings();
  if (!token || !gistId) return alert('請輸入 GitHub Token 與 Gist ID');

  try {
    modalGithubDownload.textContent = '下載中...';
    modalGithubDownload.disabled = true;

    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) throw new Error(`API 錯誤: ${res.status}`);
    const result = await res.json();
    const fileContent = result.files['stock_dashboard_data.json']?.content;

    if (!fileContent) throw new Error('找不到 stock_dashboard_data.json');

    const parsedData = JSON.parse(fileContent);
    importDataFromObject(parsedData);
    alert('從 Gist 下載資料並更新成功！');
    hideModal(githubSyncModal);
  } catch (err) {
    alert('下載失敗：' + err.message);
  } finally {
    modalGithubDownload.textContent = '☁️ 下載';
    modalGithubDownload.disabled = false;
  }
});

refreshIntervalSpan.textContent = (refreshMs / 1000) + ' 秒';

document.querySelectorAll('.interval-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const ms = parseInt(e.target.getAttribute('data-ms'), 10);
    refreshMs = ms;
    localStorage.setItem(INTERVAL_KEY, ms.toString());
    refreshIntervalSpan.textContent = (ms / 1000) + ' 秒';
    startAutoRefresh();
  });
});

if (loadStockList().length === 0) {
  saveStockList([
    { id: '2330', visible: true },
    { id: '2454', visible: true },
    { id: '2317', visible: true },
  ]);
}

const hasStoredApiKey = !!(localStorage.getItem(API_KEY_STORAGE) || '').trim();
if (hasStoredApiKey) {
  initializeAppIfNeeded();
} else {
  showApiKeyModal({ mandatory: true });
}

window.addEventListener('resize', () => {
  refreshDisplay();
});

[apiKeyModal, githubSyncModal].forEach((modalElement) => {
  modalElement.addEventListener('click', (event) => {
    if (event.target === modalElement) {
      if (modalElement === apiKeyModal && isApiKeyModalMandatory) return;
      hideModal(modalElement);
    }
  });
});
