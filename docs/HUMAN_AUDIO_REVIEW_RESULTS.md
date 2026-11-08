# Human audio observations and C01 revalidation

Recorded 2026-11-08 from the user's explicit report of manual listening. The assistant did not independently listen. Reviewer real name, actual review timestamp, audio offsets and numeric confidence were not supplied. Approximate words remain approximate; a supplied personal name is redacted in public artifacts. The original transcripts are unchanged.

| Call | Human observation | C01 follow-up |
|---|---|---|
| `p4-ru-002`, transcript message 2 | Recording beginning missing; greeting not verifiable | Keep provisional. Do not infer failure from the missing segment. |
| `p4-ru-005`, message 16 | Greeting confirmed; company wording sounds similar to “Welcome to Freedom Bank”; later greeting also reported. Personal introduction not confirmed. | Possible company-name ASR mismatch is separate from staff error. No automatic full pass; unconfirmed introduction is not proof of absence. First-response compliance remains unresolved. |
| `p4-ru-004`, message 14 | Approximate “Freedom Broker, hello, my name is [personal name withheld]”; speech fast or unclear. Greeting confirmed, personal introduction likely. | Preserve likely confidence; no automatic pass, failure or N/A. |

The audio observations concern an opening segment, not a verified exact word-to-message alignment. Transcript indices identify the previously disputed anchors. `verbatim_audio` and `corrected_transcript` stay null in both queues because no exact corrected transcript was supplied.

## Rules and decisions

Official C01 requires greeting in the client's language and personal introduction in the first response. [Organizer Q&A](case/telegram-qa.md) records N/A for calls without a recorded greeting (#2978). The base eight-criterion JSON has `c01.na_allowed=false`. That conflict requires an explicit call-policy/checklist application decision; this task does not modify criteria or silently turn C01 into N/A. Company-name ASR uncertainty alone establishes neither compliance nor a genuine operator mistake.

All three C01 assessments remain **needs_review**. No source result, gold answer, original transcript, total score or evidence quote was overwritten. Both audio queues now distinguish recorded human observations from pending final verdicts. Historical audit reports remain historical; these new artifacts supersede only their statement that no audio observations have been supplied.

## Validation and integration scope

`human-audio-validation-v1` is an optional overlay in the offline fairness candidate. It accepts transcript/checklist-bound human sidecars, adds transcription/verdict findings, preserves all previous findings and never returns a score or N/A override. Source or checklist changes invalidate the sidecar until re-reviewed.

Executed:

```text
node eval/fairness/revalidate-human-audio.mjs
node eval/fairness/revalidate-human-audio.mjs --ref origin/main
node --test eval/fairness/human-audio-review.test.mjs eval/fairness/candidate.test.mjs eval/fairness/validation.test.mjs eval/fairness/compatibility.test.mjs eval/fairness/review-cases.test.mjs eval/fairness/citation-audit.test.mjs
npm test
git diff --check
```

Main replay is pinned to `7552abff086751930871096565b74437282ee249`. Sidecar source bindings match all three calls. Main's saved C01 values are respectively `no`, `yes`, `yes`; the local v5.1 values are `no`, `no`, `yes`. None was changed or declared human-confirmed. The full older candidate validator marks main calls invalid because C09 is outside the base eight-criterion checklist. This compatibility finding stays visible separately from the C01 observation assessment; it is not a finding that the deployed application is broken.

Tests: **102/102 Node tests**, including 8 new audio-review tests, and **9/9 scoring tests**. No model calls or spending. Production evaluator, UI and backend do not import this overlay.

Artifacts: `eval/fairness/human-audio-findings.json`, both existing `transcript-*-audio-queue.json` files, and `eval/runs/human-audio-{revalidation,main-revalidation}.json`.

The legacy C08 security process remains **pending and separate**. These observations authorize neither its exception nor deployment. No commit, push or merge was performed.
