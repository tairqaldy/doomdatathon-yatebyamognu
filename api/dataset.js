// GET /api/dataset?group_id=XYZ → organizer dataset via server (avoids CORS; key/URL stays server-side). Cached hourly.
import { send, fail } from '../lib/http.js';
import { loadDataset } from '../lib/data.js';

export default async function handler(req, res) {
  try {
    const g = new URL(req.url, 'http://x').searchParams.get('group_id') || 'DEV';
    send(res, 200, await loadDataset(g));
  } catch (e) { fail(res, e); }
}
