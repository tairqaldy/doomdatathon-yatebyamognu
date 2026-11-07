// Server-side data access: bundled datasets/checklists + live organizer API (control set at T+23h).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cached } from './cache.js';

const dataDir = () => path.join(process.cwd(), 'data');

export async function loadDataset(group = 'DEV') {
  const safe = String(group).replace(/[^A-Za-z0-9_-]/g, '');
  try {
    return JSON.parse(await readFile(path.join(dataDir(), 'datasets', `${safe}.json`), 'utf8'));
  } catch {
    return fetchDataset(safe);
  }
}

/** Live fetch through the organizers' API (URL in env CQA_API_URL, without &group_id). Cached per group. */
export async function fetchDataset(group) {
  const base = process.env.CQA_API_URL;
  if (!base) throw Object.assign(new Error('CQA_API_URL is not set'), { status: 503 });
  const { value } = await cached('dataset', [group, new Date().toISOString().slice(0, 13)], async () => {
    const r = await fetch(`${base}&group_id=${encodeURIComponent(group)}`);
    const j = await r.json();
    if (!j.isSuccess) throw Object.assign(new Error(j.error || 'dataset API error'), { status: 502 });
    return j;
  });
  return value;
}

export async function findConversation(id, group = 'DEV') {
  const ds = await loadDataset(group);
  return ds.data.records.find((r) => r.conversation_id === id) || null;
}

export async function loadChecklist(name = 'freedom-chat-v1') {
  const safe = String(name).replace(/[^A-Za-z0-9_.-]/g, '');
  return JSON.parse(await readFile(path.join(dataDir(), 'checklists', `${safe}.json`), 'utf8'));
}
