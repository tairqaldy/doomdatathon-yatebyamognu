# Research index

What we read, what we measured, and how it shaped Freedom CQA. Every page has a short summary, the design decisions it supports, and a source list. Outside facts come with a link. If we could not verify a number, the page says so.

Research date: 2026-11-07 (hackathon day 1). Official case files in [`docs/case/`](../case/) override anything here. Organizer answers from Telegram are in [`docs/case/telegram-qa.md`](../case/telegram-qa.md).

## Pages

| Page | Question it answers |
|---|---|
| [organizer-rulings.md](organizer-rulings.md) | What did the organizers rule, and where does the product implement each ruling? |
| [our-experiments.md](our-experiments.md) | What did we try, what did we measure, what did we reject? Mock → Haiku 5.5 vs GPT-6 Luna → eval-v2/v3 rejected → eval-v4. Gold set, audit, ASR, cache, evidence guards, rounding fix. |
| [qa-and-speech-analytics.md](qa-and-speech-analytics.md) | How contact centers do QA today (sampling, scorecards, calibration) and why 100% automated coverage needs evidence. Freedom's scale. |
| [llm-as-judge.md](llm-as-judge.md) | How far can an LLM grader be trusted? Agreement with humans, known biases, why scoring stays deterministic and appeals stay human. |
| [languages-kz-ru-en.md](languages-kz-ru-en.md) | How well do current models handle Kazakh, Russian and code-switching, in text and in speech? |
| [trust-and-handoff.md](trust-and-handoff.md) | Do customers trust AI support? What makes a bot → human handoff work? Disclosure rules in Kazakhstan and the EU. |
| [models-cost-latency.md](models-cost-latency.md) | Prices, limits and our measured cost and latency for GPT-6 Luna and Nemotron 3.5 Transcribe. |
| [models-and-metrics.md](models-and-metrics.md) | Earlier candidate list for text, ASR and TTS models and the metric definitions (written before we measured anything). |
| [design-system.md](design-system.md) | Freedom design tokens reverse-engineered from fbroker.kz. |
| [navigation-references.md](navigation-references.md) | Visual references saved for the team (not used in the product). |

## Five findings that changed the product

1. **The organizers rank by per-criterion agreement with experts** on 10 unseen chats ([telegram-qa.md](../case/telegram-qa.md)). So we measure exactly that on our gold set: strict and lenient agreement per criterion and language ([our-experiments.md](our-experiments.md)).
2. **LLM graders agree with humans often, but not everywhere.** Agreement varies by task and property ([Bavaresco et al., ACL 2025](https://arxiv.org/abs/2406.18403)). We validate per criterion, keep arithmetic in code and keep a human appeal path ([llm-as-judge.md](llm-as-judge.md)).
3. **Kazakh is still low-resource.** Benchmarks show gaps against high-resource languages ([KazMMLU](https://arxiv.org/abs/2502.12829)), and zero-shot Kazakh ASR error rates are high ([Li et al., Interspeech 2024](https://arxiv.org/abs/2408.05554)). We report KZ separately and do not over-claim ([languages-kz-ru-en.md](languages-kz-ru-en.md)).
4. **Customers want a way to reach a human.** Gartner: 64% would prefer companies not use AI in service; the top worry is losing access to a person ([Gartner, 2024](https://www.gartner.com/en/newsroom/press-releases/2024-07-09-gartner-survey-finds-64-percent-of-customers-would-prefer-that-companies-didnt-use-ai-for-customer-service)). Our support assistant says it is AI, hands off honestly and tells the customer when to expect a reply ([trust-and-handoff.md](trust-and-handoff.md)).
5. **Evaluation is cheap enough to cover every dialog.** Measured $0.00114 per evaluation with GPT-6 Luna on all 65 DEV dialogs ([models-cost-latency.md](models-cost-latency.md)).
