# Gold split for evaluator tuning (frozen 2026-11-07, before any eval-v5 run)

The 19 reviewed gold dialogs (`eval/gold/*.json`) are split once, **before** tuning, so prompt changes are judged on dialogs they were not written against. Tune only on the tuning set; report the held-out set separately. Do not move dialogs between sets after seeing results.

Stratified by language and by case family (identification done / connection lost / off-company offer / disclosure before identification / missing greeting / client left / insult / partial or wrong answer). Both sets contain gross errors and N/A cases.

| Set | Dialogs | RU | KZ | EN | Gross errors (c08=yes) | Criteria with gold N/A |
|---|---|---|---|---|---|---|
| tuning (12) | p1-en-006, p1-en-013, p1-en-015, p1-kz-011, p1-kz-013, p1-kz-015, p1-ru-003, p1-ru-006, p1-ru-009, p1-ru-012, p1-ru-018, p4-ru-001 | 5 chats + 1 call | 3 | 3 | 4 (en-013, kz-013, kz-015, ru-009) | 17 |
| held-out (7) | p1-en-009, p1-en-014, p1-kz-003, p1-kz-008, p1-ru-022, p1-ru-025, p1-ru-029 | 3 | 2 | 2 | 3 (en-014, ru-022, ru-029) | 11 |

Family coverage (tuning / held-out):
- identification done: en-006, ru-006 / kz-003
- connection lost: kz-011, ru-012 / en-009
- off-company paid offer: en-013, kz-013 / ru-022
- account data before identification: kz-015, ru-009 / en-014
- missing greeting or introduction: en-015 / kz-008
- partial or wrong answer: ru-003, ru-018 / –
- client left before asking: – / ru-025
- insult: – / ru-029
- voice call: p4-ru-001 / – (the control set is chats only)

Caveat: eval-v4 was written while looking at all 19 dialogs, so v4's held-out numbers are in-sample for v4 and flatter it. v5 must therefore at least match v4 on held-out to be adopted.

```bash
TUNE=p1-en-006,p1-en-013,p1-en-015,p1-kz-011,p1-kz-013,p1-kz-015,p1-ru-003,p1-ru-006,p1-ru-009,p1-ru-012,p1-ru-018,p4-ru-001
HELD=p1-en-009,p1-en-014,p1-kz-003,p1-kz-008,p1-ru-022,p1-ru-025,p1-ru-029
npm run eval -- --group DEV --only $TUNE --no-app-data
node eval/accuracy.ts <run file> --reviewed-only --verbose   # the harness scores only dialogs present in the run
```
