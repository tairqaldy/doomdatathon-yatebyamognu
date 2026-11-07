// Organizer "audio_url" returns an HTML player page whose <source> is a ~1h SAS mp3 link on Dynamics storage.
// resolveAudio() fetches that page and returns a fresh direct mp3 URL. Cached in memory for 40 min.
const memo = new Map();

export async function resolveAudio(audioUrl) {
  const hit = memo.get(audioUrl);
  if (hit && hit.exp > Date.now()) return hit.url;
  const r = await fetch(audioUrl, { redirect: 'follow' });
  if (!r.ok) throw Object.assign(new Error(`audio page ${r.status}`), { status: 502 });
  const ctype = r.headers.get('content-type') || '';
  if (ctype.startsWith('audio/')) return audioUrl; // in case organizers switch to direct audio
  const html = await r.text();
  const m = html.match(/<source[^>]+src="([^"]+)"/i) || html.match(/src="(https:[^"]+\.(?:mp3|wav|m4a)[^"]*)"/i);
  if (!m) throw Object.assign(new Error('no audio source in player page'), { status: 502 });
  const url = m[1].replace(/&amp;/g, '&');
  memo.set(audioUrl, { url, exp: Date.now() + 40 * 60 * 1000 });
  return url;
}

export async function downloadBase64(url) {
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error(`audio download ${r.status}`), { status: 502 });
  const buf = Buffer.from(await r.arrayBuffer());
  return { base64: buf.toString('base64'), bytes: buf.length, type: r.headers.get('content-type') || 'audio/mpeg' };
}
