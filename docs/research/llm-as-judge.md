# LLM as a judge: how far to trust it

**Summary.** Strong LLMs can agree with human raters about as often as humans agree with each other, but only on some tasks, and they have measurable biases. The research points to the same safeguards: validate against human labels per task, make the model show evidence before its verdict, keep it away from arithmetic, and route hard or disputed cases to people. Freedom CQA does all four.

## What the research says

**Agreement can match human-human agreement.** In the MT-Bench / Chatbot Arena study, GPT-4 as a judge agreed with human preferences over 80% of the time, about the same as humans agree with each other ([Zheng et al., NeurIPS 2023](https://arxiv.org/abs/2306.05685)). That study compared chatbot answers, not QA checklists, so it shows what is possible, not what we get.

**It varies a lot by task.** JUDGE-BENCH tested 11 LLMs against human annotations on 20 NLP datasets. Agreement swung widely with the property being judged, the expertise of the human raters and the type of text. The authors conclude that LLMs must be validated against human judgments before they are used as evaluators ([Bavaresco et al., ACL 2025](https://arxiv.org/abs/2406.18403)). For us that means per-criterion numbers, not one overall figure.

**Known biases.**
- *Position bias:* the order in which candidates appear can flip a judge's ranking. In one setup, Vicuna beat ChatGPT on 66 of 80 questions purely because of answer order ([Wang et al., ACL 2024](https://arxiv.org/abs/2305.17926)).
- *Verbosity and self-enhancement bias:* judges can prefer longer answers and their own outputs ([Zheng et al.](https://arxiv.org/abs/2306.05685)).
- *Limited reasoning:* judges can be wrong on items that need careful reasoning (same source).

**Mitigations that work.** Wang et al. reduced bias by asking the model to write its evidence and explanation before the score, aggregating across orderings, and sending the hardest cases to a human. A broad survey treats reliability as the central open problem and catalogs ways to improve and measure it ([Gu et al., "A Survey on LLM-as-a-Judge", 2024–2025](https://arxiv.org/abs/2411.15594)). In contact-center QA specifically, prompting models to find evidence in the conversation, reason over it, then answer helped smaller models ([Ingle et al., EMNLP 2024 Industry](https://aclanthology.org/2024.emnlp-industry.60)).

## How these risks map onto our task

Our task differs from chatbot ranking. The model answers one categorical question per criterion about one conversation; there are no two candidates to order. So pairwise position bias does not apply directly. The risks that do apply:

| Risk | Where it could hit us | Our safeguard |
|---|---|---|
| Invented evidence | Citing a line that doesn't exist or doesn't say that | Indices checked, quotes matched against the cited line, real text shown in the UI, one repair call, then an error ([`lib/evaluator.js`](../../lib/evaluator.js) `normalize()`) |
| Arithmetic mistakes | Weights, N/A redistribution, rounding | The model never computes points. [`prototype/scoring.js`](../../prototype/scoring.js) does, with self-tests (`npm test`) |
| Bias toward long or polite operator replies | C5 empathy, C6 dialog management | Measured per criterion on gold; C6 is our weakest (57.9% strict on eval-v4), so it gets reviewer attention first |
| Over-flagging | A false gross error on a real operator | Gross-error false positives tracked separately; eval-v3 was rejected for two false flags on real calls ([our-experiments.md](our-experiments.md)) |
| Drift between runs | Same dialog, different answer | Temperature 0, strict JSON schema, prompt version in every result, answers cached by model + prompt + input |
| Disagreement with a reasonable human | Borderline labels (C2 N/A vs yes, C7 after a lost connection) | `also_acceptable` in gold; appeal → reviewer decision in the product; original, decision and final score all kept |

## What this means for our design decisions

- **The LLM picks answers and evidence; code computes the score** ([DECISIONS](../DECISIONS.md), line 23). Totals are reproducible and re-scoring after an appeal costs nothing.
- **Evidence first.** The schema asks for evidence with every answer, and an answer without a transcript reference is rejected ([CONTRACTS](../CONTRACTS.md) §3).
- **Validate per criterion before trusting** ([our-experiments.md](our-experiments.md)). Report gross-error recall separately from lenient agreement, because lenient can hide a missed violation.
- **Humans keep control.** Freedom's own slide says so; the research agrees. Appeals and reviewer decisions are first-class, and the checklist can be changed without code.

## Sources
- Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685), NeurIPS 2023 Datasets and Benchmarks.
- Wang et al., [Large Language Models are not Fair Evaluators](https://arxiv.org/abs/2305.17926), ACL 2024.
- Bavaresco et al., [LLMs instead of Human Judges? A Large Scale Empirical Study across 20 NLP Evaluation Tasks](https://arxiv.org/abs/2406.18403), ACL 2025.
- Gu et al., [A Survey on LLM-as-a-Judge](https://arxiv.org/abs/2411.15594), arXiv 2024, revised 2025.
- Ingle et al., [Probing the Depths of Language Models' Contact-Center Knowledge for Quality Assurance](https://aclanthology.org/2024.emnlp-industry.60), EMNLP 2024 Industry Track.
