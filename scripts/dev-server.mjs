// Local dev server = Vercel layout: static files from repo root + /api/*.js handlers. No deps.
// npm run dev  → http://localhost:3000/admin/ (QA workspace, passcode «freedom» unless ADMIN_PASSCODE is set)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from './env.mjs';
loadEnv();
const PORT = Number(process.env.PORT || 3000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.md': 'text/plain; charset=utf-8' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === '/') url.pathname = '/landing-tair/index.html'; // mirrors the vercel.json rewrite
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
      const mod = await import(path.resolve('api', `${name}.js`) + `?t=${Date.now()}`);
      if (req.method === 'POST' || req.method === 'PUT') {
        const ch = []; for await (const c of req) ch.push(c);
        // same answer as Vercel for a broken body, not a stack trace
        try { req.body = JSON.parse(Buffer.concat(ch).toString() || '{}'); } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Invalid JSON' })); }
      }
      return mod.default(req, res);
    }
    let file = path.resolve('.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(path.resolve('.'))) { res.writeHead(403); return res.end(); }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' }); res.end(e.code === 'ENOENT' ? 'Not found' : String(e.stack || e));
  }
}).listen(PORT, () => console.log(`CQA dev server → http://localhost:${PORT}/admin/  (passcode ${process.env.ADMIN_PASSCODE ? 'from ADMIN_PASSCODE' : '«freedom»'}; landing /, prototype /prototype/; OpenRouter key ${process.env.OPENROUTER_API_KEY ? 'loaded' : 'MISSING'})`));
