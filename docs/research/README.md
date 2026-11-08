# Research index

What we read, what we measured, and how it shaped Freedom CQA. Every page has a short summary, the design decisions it supports, and a source list. Outside facts come with a link. If we could not verify a number, the page says so.

Research date: 2026-11-07 (hackathon day 1). Official case files in [`docs/case/`](../case/) override anything here. Organizer answers from Telegram are in [`docs/case/telegram-qa.md`](../case/telegram-qa.md). The illustrated summary for the jury is in the [README](../../README.md#research-findings).

## Pages

| Page | Question it answers |
|---|---|
| [organizer-rulings.md](organizer-rulings.md) | What did the organizers rule, and where does the product implement each ruling? |
| [our-experiments.md](our-experiments.md) | What did we try, measure and reject from the mock to eval-v4? Gold set, audit, Haiku 5.5 vs GPT-6 Luna, eval-v2/v3 rejected, evidence guards, rounding fix, ASR, cache. |
| [qa-and-speech-analytics.md](qa-and-speech-analytics.md) | How contact centers do QA today (sampling, scorecards, calibration) and why 100% automated coverage needs evidence. Freedom's scale. |
| [llm-as-judge.md](llm-as-judge.md) | How far can an LLM grader be trusted? Agreement with humans, known biases, why scoring stays deterministic and appeals stay human. |
| [languages-kz-ru-en.md](languages-kz-ru-en.md) | How well do current models handle Kazakh, Russian and code-switching, in text and in speech? |
| [trust-and-handoff.md](trust-and-handoff.md) | Do customers trust AI support? What makes a bot → human handoff work? Disclosure rules in Kazakhstan and the EU. |
| [models-cost-latency.md](models-cost-latency.md) | Prices, limits and our measured cost and latency for GPT-6 Luna and Nemotron 3.5 Transcribe (eval-v4 era; eval-v5.1 numbers are in the v5 report below). |
| [models-and-metrics.md](models-and-metrics.md) | Earlier candidate list for text, ASR and TTS models and the metric definitions (written before we measured anything). |
| [freedom-app.md](freedom-app.md) | What the live Freedom Broker iOS app looks like, and where AIM fits in its support flow. |
| [call-tone.md](call-tone.md) | Why we score tone of voice on calls (c09), what it measures, its limits (no expert labels), emotion-recognition ethics, ready answers for the jury. |
| [design-system.md](design-system.md) | Freedom design tokens reverse-engineered from fbroker.kz. |
| [navigation-references.md](navigation-references.md) | Visual references saved for the team (not used in the product). |

Related pages outside this folder:

| Page | What it adds |
|---|---|
| [eval-v5 report](../../eval/runs/2026-11-07T15-15-00Z-v5-report.md) | The current evaluator: facts-first prompt, 3-sample vote, held-out and blind results, cost and latency, eval-v5.2 rejected |
| [scoring playbook](../playbook/scoring-playbook.md) | Per-criterion decision procedures with RU / KZ / EN cues, the research behind the evaluator design (§5) |
| [gold split](../playbook/split.md) · [gold set](../../eval/gold/README.md) · [blind labels](../../eval/blind/blind-24.json) | How we measure accuracy and guard against fitting our own labels |
| [transcript fairness](../TRANSCRIPT_FAIRNESS.md) · [validation](../TRANSCRIPT_VALIDATION.md) · [N/A and cache](../NA_CACHE_COMPATIBILITY.md) | Offline audits of ASR-related unfairness on calls and of result validation (not wired into production) |

## Five findings that changed the product

1. **The organizers rank by per-criterion agreement with experts** on 10 unseen chats ([telegram-qa.md](../case/telegram-qa.md)). So we measure exactly that: strict and lenient agreement per criterion and language on 19 gold dialogs, checked on a frozen held-out split and against two blind labelers. eval-v5.1: 96.1% strict on all gold, 94.6% on held-out, 96.8% against the blind consensus ([v5 report](../../eval/runs/2026-11-07T15-15-00Z-v5-report.md)).
2. **LLM graders agree with humans often, but not everywhere, and not consistently.** Agreement varies by task and property ([Bavaresco et al., ACL 2025](https://arxiv.org/abs/2406.18403)); a majority over 3 runs beats a single run ([Rating Roulette](https://arxiv.org/pdf/2510.27106)). We validate per criterion, fill facts before verdicts, vote over 3 samples, keep arithmetic in code and keep a human appeal path ([llm-as-judge.md](llm-as-judge.md), [playbook §5](../playbook/scoring-playbook.md)).
3. **Kazakh is still low-resource.** Benchmarks show gaps against high-resource languages ([KazMMLU](https://arxiv.org/abs/2502.12829)), and zero-shot Kazakh ASR error rates are high ([Li et al., Interspeech 2024](https://arxiv.org/abs/2408.05554)). We report KZ separately and do not over-claim ([languages-kz-ru-en.md](languages-kz-ru-en.md)).
4. **Customers want a way to reach a human.** Gartner: 64% would prefer companies not use AI in service; the top worry is losing access to a person ([Gartner, 2024](https://www.gartner.com/en/newsroom/press-releases/2024-07-09-gartner-survey-finds-64-percent-of-customers-would-prefer-that-companies-didnt-use-ai-for-customer-service)). Our support assistant says it is AI, hands off honestly and tells the customer when to expect a reply ([trust-and-handoff.md](trust-and-handoff.md)).
5. **Evaluation is cheap enough to cover every dialog.** eval-v4 cost $0.00114 per evaluation; eval-v5.1 with 3 samples costs $0.0070 (chats $0.0061), measured on all 65 DEV dialogs ([models-cost-latency.md](models-cost-latency.md), [v5.1 run summary](../../eval/runs/2026-11-07T15-00-49-475Z-v51-dev-DEV.json)).
