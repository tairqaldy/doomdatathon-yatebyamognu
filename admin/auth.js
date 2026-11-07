// Admin token handling + authorized fetch. A 401 anywhere sends the admin back to the login screen.
const KEY = 'cqa-admin-token';
export const token = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setToken = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch {} };

export async function login(passcode) {
  const r = await fetch('/api/admin-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode }) });
  if (r.status === 401) return { ok: false, error: 'Неверный код доступа' };
  if (!r.ok) return { ok: false, error: 'Сервер недоступен, попробуйте ещё раз' };
  const { token: t } = await r.json(); setToken(t); return { ok: true };
}
export async function validate() {
  if (!token()) return false;
  try { const r = await fetch('/api/admin-login', { headers: { Authorization: `Bearer ${token()}` } }); return r.ok; } catch { return false; }
}
export function logout(reason = '') {
  setToken('');
  dispatchEvent(new CustomEvent('cqa:logout', { detail: { reason } }));
}
/** POST JSON with the admin token. Throws { status, message }. */
export async function api(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) });
  if (r.status === 401) { logout('Сессия истекла. Войдите снова.'); throw Object.assign(new Error('Сессия истекла'), { status: 401 }); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || `Ошибка ${r.status}`), { status: r.status });
  return data;
}
