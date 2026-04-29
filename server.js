/**
 * ============================================================================
 * [備用 / BYPASSED]
 * 此 Node.js 伺服器目前已作為備用。
 * 專案已轉移回 SPA (Single Page Application) 架構。
 * 前端 (index.html) 已直接使用瀏覽器發送請求至 Fugle API 與 FinMind API，
 * 不再依賴此伺服器的 /api/quote 代理。
 * 保留此檔案與 package.json 僅供未來參考或備用時使用。
 * ============================================================================
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname);

// 讀取 .env 檔案
(function loadEnv() {
  try {
    var envPath = path.join(__dirname, '.env');
    var content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(function (line) {
      var match = line.match(/^\s*([\w]+)\s*=\s*(.+?)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    });
  } catch (e) {}
})();

var FUGLE_API_KEY = process.env.FUGLE_API_KEY || '';
if (!FUGLE_API_KEY) {
  console.error('錯誤：請在 .env 檔案中設定 FUGLE_API_KEY');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function sendResponse(res, statusCode, data, contentType) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
  });
  res.end(data);
}

function sendJson(res, obj) {
  sendResponse(res, 200, JSON.stringify(obj), 'application/json; charset=utf-8');
}

function sendNotFound(res) {
  sendResponse(res, 404, '404 Not Found', 'text/plain');
}

// 透過 Fugle API 取得單一股票即時報價
function fetchFugleQuote(symbolId) {
  return new Promise(function (resolve, reject) {
    var options = {
      hostname: 'api.fugle.tw',
      path: '/marketdata/v1.0/stock/intraday/quote/' + symbolId,
      method: 'GET',
      headers: {
        'X-API-KEY': FUGLE_API_KEY,
        'Accept': 'application/json',
      },
    };

    var request = https.request(options, function (proxyRes) {
      var body = '';
      proxyRes.setEncoding('utf8');
      proxyRes.on('data', function (chunk) { body += chunk; });
      proxyRes.on('end', function () {
        if (proxyRes.statusCode !== 200) {
          resolve(null);
          return;
        }

        try {
          var data = JSON.parse(body);

          var price = data.lastPrice || data.closePrice || data.previousClose || 0;
          var change = data.change || 0;
          var changePercent = data.changePercent || 0;
          var volume = (data.total && data.total.tradeVolume) || 0;

          resolve({
            symbol: data.symbol || symbolId,
            name: data.name || symbolId,
            price: price,
            change: change,
            changePercent: changePercent,
            volume: volume,
            open: data.openPrice || 0,
            high: data.highPrice || 0,
            low: data.lowPrice || 0,
            yestClose: data.previousClose || 0,
            market: data.market || '',
            isRealtime: true,
          });
        } catch (e) {
          resolve(null);
        }
      });
    });

    request.on('error', function (error) { resolve(null); });
    request.end();
  });
}

// 產業分類快取
var industryCache = {};

function fetchIndustry(symbolId) {
  return new Promise(function (resolve) {
    if (industryCache[symbolId] !== undefined) {
      resolve(industryCache[symbolId]);
      return;
    }

    var options = {
      hostname: 'api.finmindtrade.com',
      path: '/api/v4/data?dataset=TaiwanStockInfo&data_id=' + symbolId,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    };

    var request = https.request(options, function (proxyRes) {
      var body = '';
      proxyRes.setEncoding('utf8');
      proxyRes.on('data', function (chunk) { body += chunk; });
      proxyRes.on('end', function () {
        try {
          var data = JSON.parse(body);
          if (data.status === 200 && data.data && data.data.length > 0) {
            var cat = data.data[0].industry_category || '';
            // 去掉尾部的「業」字，精簡顯示
            cat = cat.replace(/業$/, '');
            industryCache[symbolId] = cat;
            resolve(cat);
            return;
          }
        } catch (e) {}
        industryCache[symbolId] = '';
        resolve('');
      });
    });

    request.on('error', function () { resolve(''); });
    request.end();
  });
}

// 批次取得多支股票即時報價（含產業分類）
function fetchAllQuotes(symbols) {
  return Promise.all(symbols.map(function (sym) {
    return Promise.all([fetchFugleQuote(sym), fetchIndustry(sym)])
      .then(function (results) {
        var quote = results[0];
        var industry = results[1];

        if (!quote) {
          return {
            symbol: sym,
            name: sym,
            industry: industry,
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
  }));
}

function serveStaticFile(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';

  var filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) {
    sendNotFound(res);
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      sendNotFound(res);
      return;
    }
    var ext = path.extname(filePath);
    var contentType = MIME_TYPES[ext] || 'application/octet-stream';
    sendResponse(res, 200, data, contentType);
  });
}

var server = http.createServer(function (req, res) {
  var requestUrl = new URL(req.url, 'http://' + req.headers.host);

  if (requestUrl.pathname === '/api/quote') {
    var symbols = requestUrl.searchParams.get('symbols') || '';
    if (!symbols) {
      sendJson(res, { error: '請提供 symbols 查詢參數。' });
      return;
    }

    var symbolList = symbols.split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    fetchAllQuotes(symbolList)
      .then(function (results) {
        sendJson(res, { data: results });
      })
      .catch(function (error) {
        sendJson(res, { error: error.message });
      });
    return;
  }

  serveStaticFile(req, res, requestUrl.pathname);
});

server.listen(PORT, function () {
  console.log('本機伺服器已啟動： http://localhost:' + PORT);
  console.log('即時報價來源：Fugle Market Data API（支援上市/上櫃/興櫃）');
});
