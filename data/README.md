# data/

| Path | What |
|---|---|
| `datasets/DEV.json` | Organizers' DEV set, the raw API response saved 2026-11-07 unchanged except for pretty-printing. 65 records: 60 `agent chat` + 5 `voice call`; 35 RU / 15 KZ / 15 EN. Speakers: client, operator, bot, system. |
| `checklists/freedom-chat-v1.json` | Official 8-criterion checklist as data (see `docs/CONTRACTS.md` §2). |

Shape: `docs/CONTRACTS.md` §1. Read `data.records`. Transcript turn index (0-based) is our evidence anchor.

## Re-fetching / control set
The API link is **not committed** because it's a signed URL. Put it in `.env` as `CQA_API_URL` (without `group_id`), see `.env.example`. Then:

```bash
set -a; source .env; set +a
curl -s "$CQA_API_URL&group_id=DEV" -o data/datasets/DEV.json
```

At **T+23h** the organizers give a new `group_id` for the control set → save as `datasets/<GROUP_ID>.json` the same way and run the batch evaluation right away.

Voice calls have `audio_url` (signed organizer links, kept as-is for playback). Chats have `audio_url: null`. Call timestamps are ISO 8601 with timezone, chats are `MM:SS`.
