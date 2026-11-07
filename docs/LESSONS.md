# LESSONS

When something breaks or an assumption turns out wrong, add one line: `what happened → rule to avoid it`. Every agent reads this at session start.

- Nemotron transcripts of the 5 real calls contained first names that the organizer transcripts mask as [Имя скрыто] → never commit raw ASR text (data/transcripts/, eval/cache/asr/ are gitignored); commit metrics only.
- JS regex \b does not treat Cyrillic as word characters → use explicit (?:^|[\s,.!]) boundaries for RU/KZ patterns.
- Organizer audio_url is an HTML player page, not audio; its mp3 link expires after ~1h → always resolve via /api/audio or lib/audio.js.
- Live sessions in localStorage only exist in that browser; a phone on /support and a laptop on /admin never see each other → persist via Postgres `/api/sessions` when `DATABASE_URL` is set.
- The agent stalled after navigating: `requestAnimationFrame` never fires in a hidden or background tab → anything an agent awaits must have a `setTimeout` fallback.
- `preview_start` with a launch.json name started the dev server from the main checkout, not the worktree (404 on new folders) → in a worktree run `PORT=<n> node scripts/dev-server.mjs` yourself and open the URL.
