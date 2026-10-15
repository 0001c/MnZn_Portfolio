const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const lan = process.argv.includes('--lan');
const host = process.env.HOST || (lan ? '0.0.0.0' : '127.0.0.1');
const root = process.argv.includes('--source') ? __dirname : path.join(__dirname, 'dist');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.json': 'application/json', '.md': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  if (lan) {
    const inside = directory => file.startsWith(path.join(root, directory) + path.sep);
    const permitted = file === path.join(root, 'index.html') || file === path.join(root, 'content/portfolio.json') || inside('assets') || inside('content') || inside('_workspace/editor') || file === path.join(root, '_workspace/docs/个人内容快速录入.md');
    if (!permitted) { res.writeHead(403).end('Forbidden'); return; }
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    const headers = { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': /\.[a-f0-9]{12}\.[^.]+$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache', 'Accept-Ranges': 'bytes' };
    headers.ETag = `"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
    if (!req.headers.range && req.headers['if-none-match'] === headers.ETag) { res.writeHead(304, headers).end(); return; }
    let start = 0, end = stat.size - 1, code = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return; }
      if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
      else start = Math.max(0, stat.size - Number(match[2]));
      if (start > end || start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return; }
      code = 206; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(code, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
}).listen(Number(process.env.PORT) || 4173, host, function () {
  const port = this.address().port;
  console.log(`Local: http://127.0.0.1:${port}/`);
  if (host === '0.0.0.0') {
    for (const addresses of Object.values(require('node:os').networkInterfaces())) for (const address of addresses) {
      if (address.family === 'IPv4' && !address.internal) console.log(`LAN: http://${address.address}:${port}/`);
    }
    if (process.argv.includes('--source')) console.log(`Editor: /_workspace/editor/content-editor.html`);
  }
});
