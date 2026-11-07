# LESSONS

When something breaks or an assumption turns out wrong, add one line: `what happened → rule to avoid it`. Every agent reads this at session start.

- Nemotron transcripts of the 5 real calls contained first names that the organizer transcripts mask as [Имя скрыто] → never commit raw ASR text (data/transcripts/, eval/cache/asr/ are gitignored); commit metrics only.
- JS regex \b does not treat Cyrillic as word characters → use explicit (?:^|[\s,.!]) boundaries for RU/KZ patterns.
- Organizer audio_url is an HTML player page, not audio; its mp3 link expires after ~1h → always resolve via /api/audio or lib/audio.js.
