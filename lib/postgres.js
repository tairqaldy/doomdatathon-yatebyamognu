// Zero-dep Postgres client. Neon/Vercel Postgres → SQL-over-HTTP; anything else → frontend protocol over TCP/TLS.
// Env: DATABASE_URL or POSTGRES_URL (never log the value).
import net from 'node:net';
import tls from 'node:tls';
import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

export function databaseUrl() {
  return String(process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
}
export function configured() { return Boolean(databaseUrl()); }

export function parseDatabaseUrl(raw = databaseUrl()) {
  if (!raw) throw Object.assign(new Error('DATABASE_URL is not set'), { status: 503 });
  const u = new URL(raw.replace(/^postgres(ql)?:/i, 'http:'));
  const database = decodeURIComponent((u.pathname || '/').replace(/^\//, '') || 'postgres');
  const sslmode = (u.searchParams.get('sslmode') || '').toLowerCase();
  const host = u.hostname;
  const neon = /\.(neon\.tech|neon\.build)$/i.test(host);
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const ssl = sslmode === 'disable' || sslmode === 'allow' ? false : neon || sslmode === 'require' || sslmode === 'verify-full' || !local;
  return {
    raw, host, port: Number(u.port || 5432),
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''),
    database, ssl, sslmode, neon, params: Object.fromEntries(u.searchParams),
  };
}

export async function query(text, params = []) {
  const cfg = parseDatabaseUrl();
  if (cfg.neon) return neonQuery(cfg, text, params);
  return tcpQuery(cfg, text, params);
}

export async function ping() {
  if (!configured()) return { ok: false, configured: false, transport: null };
  const started = Date.now();
  const cfg = parseDatabaseUrl();
  const r = await query('SELECT 1 AS ok');
  const ok = Number(r.rows?.[0]?.ok) === 1;
  return { ok, configured: true, transport: cfg.neon ? 'neon-http' : 'tcp', latency_ms: Date.now() - started, database: cfg.database };
}

async function neonQuery(cfg, text, params) {
  const endpoint = `https://${cfg.host}/sql`;
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': cfg.raw,
    },
    body: JSON.stringify({ query: text, params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j.message || j.error || `Postgres HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: 502, code: j.code });
  }
  return { command: j.command, rowCount: j.rowCount ?? (j.rows?.length || 0), fields: j.fields || [], rows: j.rows || [] };
}

// --- TCP frontend/backend protocol (v3), enough for parameterized queries ---

const SSL_REQUEST = 80877103;

async function tcpQuery(cfg, text, params) {
  const socket = await connect(cfg);
  try {
    await startup(socket, cfg);
    return await extendedQuery(socket, text, params);
  } finally {
    socket.destroy();
  }
}

function connect(cfg) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: cfg.host, port: cfg.port });
    sock.once('error', reject);
    sock.setNoDelay(true);
    sock.once('connect', () => {
      sock.removeListener('error', reject);
      if (!cfg.ssl) return resolve(wrap(sock));
      sock.write(Buffer.concat([u32(8), u32(SSL_REQUEST)]));
      sock.once('data', (chunk) => {
        if (chunk.toString('utf8', 0, 1) !== 'S') {
          sock.destroy();
          return reject(new Error('Postgres server refused TLS'));
        }
        const tlsSock = tls.connect({ socket: sock, servername: cfg.host, rejectUnauthorized: cfg.sslmode === 'verify-full' });
        tlsSock.once('error', reject);
        tlsSock.once('secureConnect', () => { tlsSock.removeListener('error', reject); resolve(wrap(tlsSock)); });
      });
    });
  });
}

function wrap(sock) {
  let buf = Buffer.alloc(0);
  const q = [];
  sock.on('data', (c) => { buf = Buffer.concat([buf, c]); drain(); });
  sock.on('error', (e) => { while (q.length) q.shift().rej(e); });
  sock.on('end', () => { while (q.length) q.shift().rej(new Error('Postgres connection closed')); });
  function drain() {
    while (q.length && buf.length >= 5) {
      const len = buf.readUInt32BE(1);
      if (buf.length < 1 + len) break;
      const type = String.fromCharCode(buf[0]);
      const payload = buf.subarray(5, 1 + len);
      buf = buf.subarray(1 + len);
      q.shift().ok({ type, payload });
    }
  }
  return {
    sock,
    destroy() { sock.destroy(); },
    write(buf) { sock.write(buf); },
    read() { return new Promise((ok, rej) => { q.push({ ok, rej }); drain(); }); },
  };
}

async function startup(c, cfg) {
  const payload = Buffer.concat([
    u32(196608),
    cstr('user'), cstr(cfg.user),
    cstr('database'), cstr(cfg.database),
    cstr('client_encoding'), cstr('UTF8'),
    Buffer.from([0]),
  ]);
  c.write(Buffer.concat([u32(4 + payload.length), payload]));
  for (;;) {
    const m = await c.read();
    if (m.type === 'Z') return;
    if (m.type === 'E') throw pgError(m.payload);
    if (m.type !== 'R') continue;
    const code = m.payload.readInt32BE(0);
    if (code === 0) continue;
    if (code === 3) { c.write(passwordMessage(cfg.password)); continue; }
    if (code === 5) {
      const salt = m.payload.subarray(4, 8);
      const inner = createHash('md5').update(cfg.password + cfg.user).digest('hex');
      const outer = createHash('md5').update(Buffer.concat([Buffer.from(inner, 'utf8'), salt])).digest('hex');
      c.write(passwordMessage('md5' + outer));
      continue;
    }
    if (code === 10) {
      const mechs = m.payload.subarray(4).toString('utf8').split('\0').filter(Boolean);
      if (!mechs.includes('SCRAM-SHA-256')) throw new Error(`Unsupported SASL: ${mechs.join(',')}`);
      const nonce = randomBytes(18).toString('base64');
      const firstBare = `n=${saslName(cfg.user)},r=${nonce}`;
      const first = `n,,${firstBare}`;
      c.write(saslInitial('SCRAM-SHA-256', first));
      const cont = await c.read();
      if (cont.type !== 'R' || cont.payload.readInt32BE(0) !== 11) throw new Error('SCRAM continue missing');
      const serverFirst = cont.payload.subarray(4).toString('utf8');
      const final = scramFinal(cfg.password, nonce, firstBare, serverFirst);
      c.write(saslResponse(final.clientFinal));
      const fin = await c.read();
      if (fin.type !== 'R' || fin.payload.readInt32BE(0) !== 12) throw new Error('SCRAM final missing');
      const verifier = String(fin.payload.subarray(4)).split('v=')[1];
      if (!verifier || !timingSafeEqual(Buffer.from(verifier, 'base64'), final.serverSignature)) {
        throw new Error('SCRAM server signature mismatch');
      }
      continue;
    }
    throw new Error(`Unsupported Postgres auth ${code}`);
  }
}

async function extendedQuery(c, text, params) {
  const p = Array.isArray(params) ? params : [];
  c.write(Buffer.concat([
    parseMsg(text),
    bindMsg(p),
    msg('D', Buffer.concat([Buffer.from([80]), cstr('')])), // Describe portal
    msg('E', Buffer.concat([cstr(''), u32(0)])),
    msg('S', Buffer.alloc(0)),
  ]));
  const rows = [];
  let fields = [];
  let command = '';
  let rowCount = 0;
  for (;;) {
    const m = await c.read();
    if (m.type === '1' || m.type === '2' || m.type === 'n' || m.type === 'N' || m.type === 'A' || m.type === 'S' || m.type === '3') continue;
    if (m.type === 'T') { fields = parseFields(m.payload); continue; }
    if (m.type === 'D') { rows.push(parseRow(fields, m.payload)); continue; }
    if (m.type === 'C') {
      const tag = cstrRead(m.payload, 0);
      const parts = tag.split(' ');
      command = parts[0];
      const n = Number(parts.at(-1));
      if (Number.isFinite(n)) rowCount = n;
      continue;
    }
    if (m.type === 'E') throw pgError(m.payload);
    if (m.type === 'Z') return { command, rowCount: rowCount || rows.length, fields, rows };
  }
}

function parseFields(buf) {
  let o = 0;
  const n = buf.readUInt16BE(o); o += 2;
  const fields = [];
  for (let i = 0; i < n; i++) {
    const name = cstrRead(buf, o); o += Buffer.byteLength(name) + 1;
    o += 6; // table oid + attr
    const dataTypeID = buf.readInt32BE(o); o += 4;
    o += 8; // typlen + typmod + format
    fields.push({ name, dataTypeID });
  }
  return fields;
}

function parseRow(fields, buf) {
  let o = 0;
  const n = buf.readUInt16BE(o); o += 2;
  const row = {};
  for (let i = 0; i < n; i++) {
    const len = buf.readInt32BE(o); o += 4;
    const name = fields[i]?.name || String(i);
    if (len < 0) { row[name] = null; continue; }
    const raw = buf.subarray(o, o + len).toString('utf8'); o += len;
    row[name] = decodeValue(fields[i]?.dataTypeID, raw);
  }
  return row;
}

function decodeValue(oid, raw) {
  if (oid === 16) return raw === 't'; // bool
  if (oid === 20 || oid === 21 || oid === 23) return Number(raw);
  if (oid === 114 || oid === 3802) { try { return JSON.parse(raw); } catch { return raw; } }
  return raw;
}

function parseMsg(sql) {
  return msg('P', Buffer.concat([cstr(''), cstr(sql), u16(0)]));
}
function bindMsg(params) {
  const parts = [cstr(''), cstr(''), u16(0), u16(params.length)];
  for (const p of params) {
    if (p == null) { parts.push(u32(0xffffffff)); continue; }
    const s = typeof p === 'string' ? p : typeof p === 'object' ? JSON.stringify(p) : String(p);
    const b = Buffer.from(s, 'utf8');
    parts.push(u32(b.length), b);
  }
  parts.push(u16(0));
  return msg('B', Buffer.concat(parts));
}

function passwordMessage(password) { return msg('p', cstr(password)); }
function saslInitial(mech, first) {
  const f = Buffer.from(first, 'utf8');
  return msg('p', Buffer.concat([cstr(mech), u32(f.length), f]));
}
function saslResponse(final) { return msg('p', Buffer.from(final, 'utf8')); }

function scramFinal(password, clientNonce, firstBare, serverFirst) {
  const attrs = Object.fromEntries(serverFirst.split(',').map((p) => [p[0], p.slice(2)]));
  if (!String(attrs.r || '').startsWith(clientNonce)) throw new Error('SCRAM nonce mismatch');
  const salt = Buffer.from(attrs.s, 'base64');
  const iter = Number(attrs.i);
  const salted = pbkdf2Sync(password, salt, iter, 32, 'sha256');
  const clientKey = hmac(salted, 'Client Key');
  const storedKey = sha256(clientKey);
  const withoutProof = `c=biws,r=${attrs.r}`;
  const auth = `${firstBare},${serverFirst},${withoutProof}`;
  const clientSig = hmac(storedKey, auth);
  const proof = xor(clientKey, clientSig);
  const serverKey = hmac(salted, 'Server Key');
  return { clientFinal: `${withoutProof},p=${proof.toString('base64')}`, serverSignature: hmac(serverKey, auth) };
}

function pgError(payload) {
  const f = {};
  let o = 0;
  while (o < payload.length && payload[o] !== 0) {
    const k = String.fromCharCode(payload[o]); o += 1;
    const v = cstrRead(payload, o); o += Buffer.byteLength(v) + 1;
    f[k] = v;
  }
  return Object.assign(new Error(f.M || 'Postgres error'), { status: 502, code: f.C, detail: f.D });
}

function msg(type, payload) {
  return Buffer.concat([Buffer.from(type, 'ascii'), u32(4 + payload.length), payload]);
}
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; }
function cstr(s) { return Buffer.from(String(s) + '\0', 'utf8'); }
function cstrRead(buf, o) {
  let e = o; while (e < buf.length && buf[e] !== 0) e++;
  return buf.toString('utf8', o, e);
}
function hmac(key, data) { return createHmac('sha256', key).update(data).digest(); }
function sha256(data) { return createHash('sha256').update(data).digest(); }
function xor(a, b) { const o = Buffer.alloc(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] ^ b[i]; return o; }
function saslName(s) { return String(s).replace(/=/g, '=3D').replace(/,/g, '=2C'); }
