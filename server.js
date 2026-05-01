/**
 * RawPrint9100 - WebSocket → TCP:9100 Bridge
 * Tarayıcıdan gelen WS mesajlarını ağdaki yazıcılara ham TCP olarak iletir.
 */

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const net   = require('net');
const { WebSocketServer } = require('ws');

const PORT    = process.env.PORT || 9191;
const PUBLIC  = path.join(__dirname, 'public');
const DEV     = process.argv.includes('--dev');

/* ── HTTP: statik dosya sunucu ─────────────────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
};

const httpServer = http.createServer((req, res) => {
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(PUBLIC, urlPath);

  /* Dizin dışına çıkma koruması */
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

/* ── WebSocket: WS → TCP köprüsü ───────────────────────────────────── */
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  log(`WS bağlandı: ${clientIp}`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); }
    catch { return wsSend(ws, { type: 'error', message: 'Geçersiz JSON paketi' }); }

    const { action } = msg;

    if (action === 'print') {
      handlePrint(ws, msg);
    } else if (action === 'ping') {
      handlePing(ws, msg);
    } else {
      wsSend(ws, { type: 'error', message: `Bilinmeyen aksiyon: ${action}` });
    }
  });

  ws.on('close', () => log(`WS kapandı: ${clientIp}`));
  ws.on('error', (e) => log(`WS hata (${clientIp}): ${e.message}`));
});

/* ── print: yazıcıya ham veri gönder ──────────────────────────────── */
function handlePrint(ws, msg) {
  const { ip, port = 9100, data, encoding = 'utf8', id } = msg;

  if (!ip)   return wsSend(ws, { type: 'error', id, message: 'Yazıcı IP adresi gerekli' });
  if (!data) return wsSend(ws, { type: 'error', id, message: 'Gönderilecek veri yok' });

  /* data: string (utf8/latin1) veya hex string "1B 40 ..." */
  let buffer;
  try {
    if (encoding === 'hex') {
      const hex = data.replace(/\s+/g, '');
      buffer = Buffer.from(hex, 'hex');
    } else if (encoding === 'base64') {
      buffer = Buffer.from(data, 'base64');
    } else {
      buffer = Buffer.from(data, encoding === 'latin1' ? 'latin1' : 'utf8');
    }
  } catch (e) {
    return wsSend(ws, { type: 'error', id, message: `Veri dönüştürme hatası: ${e.message}` });
  }

  log(`TCP bağlanıyor → ${ip}:${port}  (${buffer.length} byte, id=${id})`);

  const tcpStart = Date.now();
  const socket   = new net.Socket();
  let   received = Buffer.alloc(0);
  let   settled  = false;

  const settle = (result) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    const elapsed = Date.now() - tcpStart;
    wsSend(ws, { ...result, id, elapsed });
    log(`TCP bitti (${elapsed} ms): ${result.type}`);
  };

  socket.setTimeout(msg.timeout || 5000);

  socket.connect(port, ip, () => {
    log(`TCP bağlandı → ${ip}:${port}`);
    wsSend(ws, { type: 'connected', id, ip, port });
    socket.write(buffer);
    /* Yazıcıdan cevap gelmeyebilir; 800 ms bekle */
    setTimeout(() => settle({
      type: 'success',
      message: `${buffer.length} byte gönderildi`,
      response: received.length ? received.toString('hex') : null,
    }), 800);
  });

  socket.on('data', (chunk) => {
    received = Buffer.concat([received, chunk]);
  });

  socket.on('timeout', () => settle({
    type: 'error',
    message: `Bağlantı zaman aşımı (${ip}:${port})`,
  }));

  socket.on('error', (e) => settle({
    type: 'error',
    message: `TCP hata: ${e.message}`,
    code: e.code,
  }));
}

/* ── ping: yazıcıya TCP knock ─────────────────────────────────────── */
function handlePing(ws, msg) {
  const { ip, port = 9100, id } = msg;
  if (!ip) return wsSend(ws, { type: 'error', id, message: 'IP gerekli' });

  const t0     = Date.now();
  const socket = new net.Socket();
  let settled  = false;

  const settle = (ok, message) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    wsSend(ws, { type: ok ? 'pong' : 'error', id, ip, port, elapsed: Date.now() - t0, message });
  };

  socket.setTimeout(3000);
  socket.connect(port, ip, () => settle(true, 'Port açık'));
  socket.on('timeout', () => settle(false, 'Zaman aşımı'));
  socket.on('error',  (e) => settle(false, e.message));
}

/* ── yardımcılar ───────────────────────────────────────────────────── */
function wsSend(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 23);
  console.log(`[${ts}] ${msg}`);
}

/* ── başlat ─────────────────────────────────────────────────────────── */
httpServer.listen(PORT, () => {
  console.log('');
  console.log('  ██████╗  █████╗ ██╗    ██╗██████╗ ██████╗ ██╗███╗   ██╗████████╗');
  console.log('  ██╔══██╗██╔══██╗██║    ██║██╔══██╗██╔══██╗██║████╗  ██║╚══██╔══╝');
  console.log('  ██████╔╝███████║██║ █╗ ██║██████╔╝██████╔╝██║██╔██╗ ██║   ██║   ');
  console.log('  ██╔══██╗██╔══██║██║███╗██║██╔═══╝ ██╔══██╗██║██║╚██╗██║   ██║   ');
  console.log('  ██║  ██║██║  ██║╚███╔███╔╝██║     ██║  ██║██║██║ ╚████║   ██║   ');
  console.log('  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝     ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝   ╚═╝   ');
  console.log('');
  console.log(`  🖨  RawPrint9100  →  http://localhost:${PORT}`);
  console.log(`  📡  WS Köprüsü   →  ws://localhost:${PORT}`);
  console.log(`  🔧  Mod          :  ${DEV ? 'Geliştirme' : 'Üretim'}`);
  console.log('');
});
