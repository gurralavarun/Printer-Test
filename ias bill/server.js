const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = process.env.PORT || 3001;
const DIRECTORY = __dirname;
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

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function serveStaticFile(req, res, pathname) {
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  try {
    relativePath = decodeURIComponent(relativePath);
  } catch {
    res.writeHead(400);
    return res.end('Bad Request');
  }

  const safePath = path.normalize(path.join(DIRECTORY, relativePath));

  if (!safePath.startsWith(DIRECTORY)) {
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
  if (req.method === 'GET' && pathname === '/api/status') {
    return sendJson(res, 200, {
      status: 'online',
      template: 'IAS Food Invoice',
      printer: PRINTER_NAME,
      port: 'USB001'
    });
  }

  // GET /api/qr - Dynamic QR fallback endpoint
  if (req.method === 'GET' && pathname === '/api/qr') {
    const samplePath = path.join(DIRECTORY, 'sample_qr.png');
    fs.readFile(samplePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Sample QR code not found');
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

  // POST /api/print - Print Bill to POS-80C
  if (req.method === 'POST' && pathname === '/api/print') {
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

      let imageData = payload.imageData;
      if (imageData) {
        if (imageData.includes(',')) {
          imageData = imageData.split(',')[1];
        }

        const tempImgPath = path.join(DIRECTORY, 'temp_ias_print.png');

        try {
          fs.writeFileSync(tempImgPath, Buffer.from(imageData, 'base64'));
        } catch (writeErr) {
          return sendJson(res, 500, {
            success: false,
            error: `Failed to write image buffer: ${writeErr.message}`
          });
        }

        const psScript = path.join(DIRECTORY, 'print_ias_bill.ps1');
        const args = [
          '-ExecutionPolicy', 'Bypass',
          '-File', psScript,
          '-PrinterName', PRINTER_NAME,
          '-ImagePath', tempImgPath
        ];

        console.log(`[IAS Print Request] Printing on ${PRINTER_NAME}...`);
        execFile('powershell.exe', args, (err, stdout, stderr) => {
          if (err) {
            console.error(`[IAS Print Error]`, stderr || stdout || err.message);
            return sendJson(res, 500, {
              success: false,
              error: stderr || stdout || err.message
            });
          }

          console.log(`[IAS Print Success] Food Invoice printed successfully!`);
          return sendJson(res, 200, {
            success: true,
            message: `IAS Food Invoice printed successfully on ${PRINTER_NAME}!`,
            output: stdout
          });
        });
        return;
      }

      return sendJson(res, 400, { success: false, error: 'Missing imageData' });
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
  console.log(`  IAS Bill Studio Server (Node.js)`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Target Printer: ${PRINTER_NAME} (USB001)`);
  console.log(`====================================================`);
});
