const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'servicehub');
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyshp8ls2f-PTWGBaHveiAjDhhuOVxUhcdNjw7OWPVSfLyhSIwNAG4eGerwTH5SktRi/exec';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

function send(res, status, body, type='text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

async function relayGet(req, res) {
  const incoming = new URL(req.url, `http://${req.headers.host}`);
  const target = new URL(APPS_SCRIPT_URL);
  incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  try {
    const upstream = await fetch(target, { redirect: 'follow', cache: 'no-store' });
    const text = await upstream.text();
    send(res, upstream.status, text, upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  } catch (error) {
    send(res, 502, JSON.stringify({ success: false, error: 'Could not reach the existing Apps Script Web App: ' + error.message }), 'application/json; charset=utf-8');
  }
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const MAX = 45 * 1024 * 1024;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX) {
        reject(new Error('Request exceeds the 45 MB relay limit.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function relayPost(req, res) {
  try {
    const body = await readBody(req);
    const upstream = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const text = await upstream.text();
    send(res, upstream.status, text, upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  } catch (error) {
    send(res, 502, JSON.stringify({ success: false, error: 'Could not reach the existing Apps Script Web App: ' + error.message }), 'application/json; charset=utf-8');
  }
}

function serveFile(req, res) {
  const incoming = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(incoming.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname.startsWith('/apps-script')) return false;

  const safe = path.normalize(path.join(ROOT, pathname.replace(/^\/+/, '')));
  if (!safe.startsWith(ROOT + path.sep)) {
    send(res, 403, 'Forbidden');
    return true;
  }

  fs.stat(safe, (err, stat) => {
    if (err || !stat.isFile()) {
      send(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(safe).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    fs.createReadStream(safe).pipe(res);
  });
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/apps-script') {
    if (req.method === 'GET') return relayGet(req, res);
    if (req.method === 'POST') return relayPost(req, res);
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, 'Method not allowed');
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method not allowed');
  }

  serveFile(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ServiceHub running at http://127.0.0.1:${PORT}`);
  console.log('Using the existing Apps Script Web App ID; no new Apps Script project is created.');
});
