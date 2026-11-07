// Minimal .env loader (no deps). Values with quotes are unwrapped. Never logs values.
import { readFileSync, existsSync } from 'node:fs';
export function loadEnv(file = '.env') {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m || line.trim().startsWith('#')) continue;
    let v = m[2]; if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
    if (!(m[1] in process.env) && v) process.env[m[1]] = v;
  }
}
