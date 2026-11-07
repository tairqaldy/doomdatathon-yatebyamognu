# Models, cost and latency

**Summary.** We evaluate with OpenAI **GPT-6 Luna** through the OpenAI API and transcribe calls with **NVIDIA Nemotron 3.5 Transcribe** through OpenRouter. Measured cost is **$0.00114 per dialog evaluation** (one model call, 65 DEV dialogs, prompt eval-v4) and **$0.041 for all 5 call recordings**. A batch evaluation takes about 15 s per dialog at p50, which is fine for QA that runs after the conversation, and cached results load instantly.

## Provider facts

| Model | Provider facts | Source |
|---|---|---|
| `gpt-6-luna` (OpenAI) | $0.10 input, $0.01 cached input, $0.50 output per 1M tokens; 1,050,000-token context; up to 128,000 output tokens; structured outputs supported. OpenAI describes it as its most efficient model for focused, high-volume tasks. | [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-6-luna) |
| `nvidia/nemotron-3.5-transcribe` (OpenRouter) | $0.000017 per second of audio via Prime Intellect, $0.000033 per second via DeepInfra (about $0.06 and $0.12 per audio hour). Can return word timestamps with `verbose_json` when the provider supports it. OpenRouter's page does not list languages or latency. | [OpenRouter model page](https://openrouter.ai/nvidia/nemotron-3.5-transcribe) |
| `anthropic/claude-haiku-5.5` (OpenRouter, tested, not default) | From $0.10 input / $0.50 output per 1M tokens for prompts up to 100k tokens | [models-and-metrics.md](models-and-metrics.md) |

Prices were read on 2026-11-07 and can change. Our client computes cost from the token usage of each response with the listed rates ([`lib/openai.js`](../../lib/openai.js), `PRICES`).

## What we measured

| Job | Run | Calls | Cost | Per item | Latency p50 / p95 | Errors |
|---|---|---|---|---|---|---|
| Evaluate, GPT-6 Luna, eval-v4, all DEV | `eval/runs/2026-11-07T13-16-16-814Z-DEV.json` | 44 fresh + 21 cached | $0.050 | **$0.00114 / eval** | 14.9 s / 25.8 s | 0 / 65 |
| Evaluate, GPT-6 Luna, eval-v1, all DEV | `eval/runs/2026-11-07T09-57-56-694Z-DEV.json` | 46 fresh + 19 cached | $0.048 | $0.00105 / eval | 13.3 s / 22.3 s | 0 / 65 |
| Evaluate, Claude Haiku 5.5, eval-v1, 19 gold | `eval/runs/2026-11-07T09-36-59-522Z-DEV.json` | 19 fresh | $0.034 | $0.00177 / eval | 13.4 s / 18.0 s | 0 / 19 |
| Transcribe 5 calls, Nemotron 3.5 | `eval/runs/2026-11-07T09-59-34-660Z-asr.json` | 5 | $0.041 | $0.005–0.012 / call | mean 14.6 s (9.9–17.6 s) | 0 / 5 |

Notes:
- One evaluation is one model call per dialog for all 8 criteria. Since the bounded-repair change (#18), a dialog whose answer fails validation gets one more call, and both are counted ([our-experiments.md](our-experiments.md) §6). The runs above were measured before that change.
- Latency p50/p95 is model time over fresh calls only, run 4 at a time ([`scripts/eval-run.mjs`](../../scripts/eval-run.mjs)). A cached answer returns in about 20 ms.
- ASR error rates (WER 35.5%, CER 24.4%) are agreement with organizer transcripts, not accuracy. See [our-experiments.md](our-experiments.md) §9.

## Projection (arithmetic, not a quote)

At the measured $0.00114 per evaluation: 1,000 dialogs ≈ $1.14; 100,000 dialogs ≈ $114 in model fees. Real cost depends on dialog length, repair calls and future price changes. Re-scoring after an appeal or a weight change costs $0, because points are computed in code from stored answers.

The organizers ask for the model name and approximate cost per evaluation in the README ([brief](../case/brief.md)). That line is: **OpenAI GPT-6 Luna, about $0.0011 per evaluation, all calls included.**

## Why these models

- **GPT-6 Luna** won on our gold set: higher agreement, lower total error and lower cost than Claude Haiku 5.5 with the same prompt ([DECISIONS](../DECISIONS.md), line 11; [our-experiments.md](our-experiments.md) §4).
- **Nemotron 3.5 Transcribe** was the cheapest working speech-to-text route on our existing OpenRouter key ([DECISIONS](../DECISIONS.md), line 13). Transcription is optional for the case: the organizers supply call transcripts.
- One router ([`lib/llm.js`](../../lib/llm.js)) means any OpenRouter model can be swapped in with `CQA_EVAL_MODEL`, and a local model could be added the same way. The organizers listed a diversity of architectures, local and cloud, as one of the things they look at ([telegram-qa.md](../case/telegram-qa.md)).

## Real-time voice is a different budget

The briefing mentioned a ~500 ms target for live voice. That applies to a voice agent talking to a customer, not to QA scoring. Our ASR call latency (10–18 s per recording) is batch transcription of full calls. The `/broker` push-to-talk path measured about 1.4–2 s per short clip ([TOOLING](../TOOLING.md) §4). We have not built or measured a 500 ms voice loop; see [models-and-metrics.md](models-and-metrics.md) for how it would be measured.

## Sources
- OpenAI, [GPT-6 Luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna).
- OpenRouter, [nvidia/nemotron-3.5-transcribe](https://openrouter.ai/nvidia/nemotron-3.5-transcribe).
- Repo run files under [`eval/runs/`](../../eval/runs/).
