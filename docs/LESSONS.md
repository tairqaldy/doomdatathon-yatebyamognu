# LESSONS

When something breaks or an assumption turns out wrong, add one line: `what happened → rule to avoid it`. Every agent reads this at session start.

- Requiring a quotation for a documented non-occurrence mixed evidence format with verdict correctness → classify N/A justification, source quality and publication risk separately; version legacy compatibility and never claim publishable-rate gains are model-accuracy gains.

- An absent transcript probe allowed the first candidate to confirm scores, and stricter evidence rules quarantined 61/65 old results → fail closed on missing provenance, report coverage explicitly, and reconcile quality-policy changes with existing contracts before integration.

- A transcript guard passed its own fixtures but rejected the real `data.records` envelope and matched `hi` inside `This` → test the actual export schema, word boundaries, roles and ASR uncertainty; never turn a heuristic miss into an automatic staff penalty.

- Nemotron transcripts of the 5 real calls contained first names that the organizer transcripts mask as [Имя скрыто] → never commit raw ASR text (data/transcripts/, eval/cache/asr/ are gitignored); commit metrics only.
- JS regex \b does not treat Cyrillic as word characters → use explicit (?:^|[\s,.!]) boundaries for RU/KZ patterns.
- Organizer audio_url is an HTML player page, not audio; its mp3 link expires after ~1h → always resolve via /api/audio or lib/audio.js.
- Live sessions in localStorage only exist in that browser; a phone on /support and a laptop on /admin never see each other → persist via Postgres `/api/sessions` when `DATABASE_URL` is set.
- The agent stalled after navigating: `requestAnimationFrame` never fires in a hidden or background tab → anything an agent awaits must have a `setTimeout` fallback.
- `preview_start` with a launch.json name started the dev server from the main checkout, not the worktree (404 on new folders) → in a worktree run `PORT=<n> node scripts/dev-server.mjs` yourself and open the URL.
- Stashing or switching branches in a working tree where other agents are writing can remove their files mid-task → never stash/switch in a shared tree; use `git worktree add ../<dir> <branch>` for side branches.
- The dev server re-imports `api/*.js` on each request but Node caches `lib/*.js` → after editing lib/, restart `npm run dev` before testing /api.
- gpt-audio-mini scored all 5 calls 7/10, then all 10/10 after a wording change, and when asked what it heard at 03:00–04:30 it invented phrases and a client's name on a fixed 10 s grid → before trusting an audio model, ask it to quote what is said at a known timestamp and compare with the transcript.
- Call transcript timestamps mark the END of each segment (a 23-word bot line is stamped 1.7 s after the previous one) → a turn is spoken between the previous timestamp and its own.
