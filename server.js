const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PRINTER_NAME = 'POS-80C';

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Helper: Send JSON response with CORS
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Helper: Serve static files
function serveStaticFile(req, res, pathname) {
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  try {
    relativePath = decodeURIComponent(relativePath);
  } catch {
    res.writeHead(400);
    return res.end('Bad Request');
  }

  const safePath = path.normalize(path.join(ROOT_DIR, relativePath));

  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(safePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    let finalPath = safePath;
    if (stats.isDirectory()) {
      finalPath = path.join(safePath, 'index.html');
    }

    const ext = path.extname(finalPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(finalPath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found');
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    });
  });
}

const server = http.createServer((req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const parsedUrl = new URL(req.url, `http://${host}`);
  const pathname = parsedUrl.pathname;

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  // GET /api/status - Status API
  if (req.method === 'GET' && (pathname === '/api/status' || pathname.endsWith('/api/status'))) {
    return sendJson(res, 200, {
      status: 'online',
      printer: PRINTER_NAME,
      port: 'USB001',
      server: 'node-pos'
    });
  }

  // GET /api/qr - Dynamic / Static QR code image
  if (req.method === 'GET' && pathname.endsWith('/api/qr')) {
    const sampleQr = path.join(ROOT_DIR, 'ias bill', 'sample_qr.png');
    fs.readFile(sampleQr, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('QR code sample not found');
      }
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
    return;
  }

  // POST /api/print - Print API (Unified for both IAS and Chef bills)
  if (req.method === 'POST' && pathname.endsWith('/api/print')) {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', () => {
      let payload;
      try {
        payload = JSON.parse(body || '{}');
      } catch (e) {
        return sendJson(res, 400, { success: false, error: 'Invalid JSON payload' });
      }

      const referer = (req.headers.referer || '').toLowerCase();
      const isIas = Boolean(payload.invoice) || referer.includes('ias') || payload.type === 'ias';

      let psScript;
      let tempImgPath;
      let docTitle;

      if (isIas) {
        psScript = path.join(ROOT_DIR, 'ias bill', 'print_ias_bill.ps1');
        tempImgPath = path.join(ROOT_DIR, 'ias bill', 'temp_ias_print.png');
        docTitle = 'Food Invoice (IAS Bill)';
      } else {
        psScript = path.join(ROOT_DIR, 'chef bill', 'print_chief_bill.ps1');
        tempImgPath = path.join(ROOT_DIR, 'chef bill', 'temp_print.png');
        docTitle = 'Kitchen Order (Chief Bill)';
      }

      let imageData = payload.imageData;
      const args = ['-ExecutionPolicy', 'Bypass', '-File', psScript, '-PrinterName', PRINTER_NAME];

      if (imageData) {
        if (imageData.includes(',')) {
          imageData = imageData.split(',')[1];
        }

        try {
          fs.writeFileSync(tempImgPath, Buffer.from(imageData, 'base64'));
        } catch (writeErr) {
          return sendJson(res, 500, {
            success: false,
            error: `Failed to write image buffer: ${writeErr.message}`
          });
        }

        args.push('-ImagePath', tempImgPath);
      }

      console.log(`[Unified POS Print] Printing ${docTitle} on ${PRINTER_NAME}...`);
      execFile('powershell.exe', args, (err, stdout, stderr) => {
        if (err) {
          console.error(`[Print Process Error]`, stderr || stdout || err.message);
          return sendJson(res, 500, {
            success: false,
            error: `Printer Error: ${stderr || stdout || err.message}`
          });
        }

        console.log(`[Print Success] ${docTitle} successfully printed on ${PRINTER_NAME}!`);
        return sendJson(res, 200, {
          success: true,
          message: `${docTitle} printed successfully on ${PRINTER_NAME}!`,
          output: stdout
        });
      });
    });
    return;
  }

  // Fallback to static file serving
  if (req.method === 'GET') {
    return serveStaticFile(req, res, pathname);
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  Unified POS & Billing Studio Server (Node.js)`);
  console.log(`  Portal: http://localhost:${PORT}`);
  console.log(`  Chef Bill: http://localhost:${PORT}/chef%20bill/`);
  console.log(`  IAS Bill:  http://localhost:${PORT}/ias%20bill/`);
  console.log(`  Target Printer: ${PRINTER_NAME} (USB001)`);
  console.log(`====================================================`);
});
