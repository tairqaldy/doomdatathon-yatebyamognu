# Human review actions

2026-11-08: the user confirmed a **$0.50 maximum paid A/B budget** and supplied manual audio observations for all three calls. These are recorded in [human-audio-findings.json](../eval/fairness/human-audio-findings.json). Exact wording, review timestamp, audio offsets and reviewer real name were not supplied; none were invented. Observations are recorded, while final C01 decisions and the separate C08 policy approval remain pending. No paid calls have been made.

## Listen and record a decision

Open each original recording. Compare its beginning and the indicated transcript message, including surrounding speech. Do not infer words from the ASR text. If the recording is insufficient, record uncertainty rather than guessing. Preserve original transcripts.

| Conversation | Transcript message to investigate | Original audio | Status |
|---|---:|---|---|
| p4-ru-002 | 2 | [Listen](https://freedom-cqa.vercel.app/api/audio?id=p4-ru-002) | Human: beginning missing; C01 provisional |
| p4-ru-005 | 16 | [Listen](https://freedom-cqa.vercel.app/api/audio?id=p4-ru-005) | Human: greeting confirmed; personal introduction unconfirmed |
| p4-ru-004 | 14 | [Listen](https://freedom-cqa.vercel.app/api/audio?id=p4-ru-004) | Human: greeting confirmed; personal introduction likely |

For any follow-up, the remaining metadata and final decision can be supplied using this form:

```text
Conversation:
Reviewer name:
Reviewed at (with timezone):
Audio time range:
Recording includes full beginning: yes / no / uncertain
Actually spoken words (mask personal names):
Greeting present: yes / no / uncertain
Agent introduction present: yes / no / uncertain
Company introduction present: yes / no / uncertain
Proposed C01: yes / no / na / needs_review
Reason, including applicable official rule:
```

Score impact will be computed deterministically after the reviewed verdict is recorded. No C01 answer is changed by this template.

## Decide legacy C08 policy

The question is whether historical **C08=no without an original transcript anchor** may pass with a visible compatibility warning. Risk: the absence of an anchor does not establish that serious violations were absent. Positive C08 and identity-verification evidence requirements remain unchanged. Automated validation must never be labeled human verification.

```text
Decision maker name and QA/security role:
Decision timestamp (with timezone):
Decision: reject exception / approve with conditions
Applicable versions and scope:
Required conditions and visible warnings:
Reason:
Production deployment separately authorized: yes / no
```

Pending a supplied decision, [legacy-security-approval.json](../eval/fairness/legacy-security-approval.json) stays pending and no deployment is authorized.

## Controlled comparison

Configure `OPENAI_API_KEY` in local `.env` or the process environment; do not send a key in chat. The OpenRouter transcription model page is not a credential and is not the scoring model. Before inference, freeze the intended baseline (the original proposal used v5.1; current main uses v5.3), provider settings, paired inputs and cost limits. The $0.50 cap covers the whole approved comparison including retries. A full-population prompt manifest is not permission to evaluate all 65 pairs.

An independent test also needs genuinely new human-labeled RU/KZ/EN conversations with documented provenance and consent, frozen after prompt development. Existing gold and AI-labeled blind examples cannot supply this requirement.
