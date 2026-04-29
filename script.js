const DEFAULT_INTERVAL_MINUTES = 0.6;
const SYMBOLS_KEY = 'favoriteStockSymbols';
const INTERVAL_KEY = 'stockRefreshInterval';
const refreshIntervalSpan = document.getElementById('refresh-interval');
const lastUpdatedSpan = document.getElementById('last-updated');
const symbolsInput = document.getElementById('symbols-input');
const updateButton = document.getElementById('update-button');
const saveButton = document.getElementById('save-button');
const tableBody = document.getElementById('stock-table-body');

let refreshMinutes = DEFAULT_INTERVAL_MINUTES;
let refreshTimer = null;

function loadSettings() {
  const storedSymbols = localStorage.getItem(SYMBOLS_KEY);
  const storedInterval = localStorage.getItem(INTERVAL_KEY);

  if (storedSymbols) {
    symbolsInput.value = storedSymbols;
  }

  if (storedInterval && !Number.isNaN(Number(storedInterval))) {
    refreshMinutes = Number(storedInterval);
    refreshIntervalSpan.textContent = refreshMinutes;
  }
}

function saveSettings() {
  localStorage.setItem(SYMBOLS_KEY, symbolsInput.value);
  localStorage.setItem(INTERVAL_KEY, refreshMinutes.toString());
  alert('設定已儲存，系統會依序更新股票清單。');
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function createRow(stock) {
  const tr = document.createElement('tr');
  let changeClass;
  
  if (stock.regularMarketChangePercent === 0) {
    changeClass = 'status-neutral';
  } else {
    changeClass = stock.regularMarketChange >= 0 ? 'status-positive' : 'status-negative';
  }

  tr.innerHTML = `
    <td>${stock.symbol}</td>
    <td>${stock.shortName || stock.longName || '-'}</td>
    <td>${formatNumber(stock.regularMarketPrice)}</td>
    <td class="${changeClass}">${formatNumber(stock.regularMarketChange)}</td>
    <td class="${changeClass}">${formatNumber(stock.regularMarketChangePercent)}%</td>
    <td>${stock.regularMarketVolume ? stock.regularMarketVolume.toLocaleString() : '-'}</td>
  `;

  return tr;
}

async function fetchStockData(symbols) {
  const endpoint = `/api/quote?symbols=${encodeURIComponent(symbols)}`;
  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`取得資料失敗：${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return data.quoteResponse?.result || [];
}

async function updateStocks() {
  const rawSymbols = symbolsInput.value.trim();
  if (!rawSymbols) {
    alert('請輸入至少一個股票代號。');
    return;
  }

  const symbols = rawSymbols.split(',').map((s) => s.trim()).filter(Boolean);
  if (symbols.length === 0) {
    alert('請輸入有效的股票代號。');
    return;
  }

  tableBody.innerHTML = '<tr><td colspan="6">讀取中…</td></tr>';

  try {
    const stocks = await fetchStockData(symbols.join(','));
    if (stocks.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6">找不到股票資料，請檢查代號是否正確。</td></tr>';
      return;
    }

    tableBody.innerHTML = '';
    stocks.forEach((stock) => tableBody.appendChild(createRow(stock)));
    lastUpdatedSpan.textContent = new Date().toLocaleString();
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="6">更新失敗：${error.message}</td></tr>`;
  }
}

function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  refreshTimer = setInterval(updateStocks, 36000);
}

updateButton.addEventListener('click', () => {
  updateStocks();
});

saveButton.addEventListener('click', () => {
  saveSettings();
});

loadSettings();
updateStocks();
startAutoRefresh();
