# Kazakh, Russian, English: what models can and can't do

**Summary.** The DEV set is 35 RU, 15 KZ and 15 EN dialogs. Kazakh is a low-resource language for both text and speech models: benchmarks built from real Kazakh material still show clear gaps, and zero-shot Kazakh speech recognition error rates are high. Kazakh–Russian code-switching is common in everyday speech. On our small gold set the evaluator scores Kazakh dialogs close to the others, but that set has only 5 Kazakh dialogs, so we report languages separately and avoid broad claims.

## Text models

- **KazMMLU** is the first MMLU-style benchmark built for Kazakhstan: about 23,000 questions from local educational material in Kazakh and Russian, checked by native speakers. The authors tested Llama-3.1, Qwen-2.5, GPT-4 and DeepSeek V3 and found that even the best models fall well short of their results in high-resource languages ([Togmanov et al., ACL 2025](https://arxiv.org/abs/2502.12829)). The same paper notes that earlier Kazakh model evaluations relied mostly on machine-translated benchmarks.
- **ISSAI KAZ-LLM** (Nazarbayev University, December 2024) is an open Kazakh model in 8B and 70B sizes, built on Llama, supporting Kazakh, Russian and English. It is released under a non-commercial license ([ISSAI release](https://issai.nu.edu.kz/2024/12/10/official-release-of-the-issai-kaz-llm-open-source-model-is-available/)). A local model like this is an option for on-premise QA later. We did not test it.
- We found **no public benchmark for LLM grading of Kazakh customer-service conversations**. Our gold set is the only measurement we have for this task.

## Speech recognition

- **Kazakh Speech Corpus 2 (KSC2)** from ISSAI has about 1.2k hours of transcribed Kazakh speech and includes Kazakh–Russian code-switched utterances, which the authors describe as a common habit of Kazakh speakers ([Mussakhojayeva et al., Interspeech 2022](https://www.isca-archive.org/interspeech_2022/mussakhojayeva22_interspeech.html)).
- The first KSC (332 hours) reported 8.7% WER and 2.8% CER on its own test set with a model trained on it ([Khassanov et al., EACL 2021](https://arxiv.org/abs/2009.10334)). In-domain training matters.
- **Off-the-shelf multilingual ASR does much worse on Kazakh.** Whisper-large without adaptation had 43.58% WER on the FLEURS Kazakh test set; the authors cut it by more than 10 points absolute using unpaired Kazakh speech and text ([Li et al., Interspeech 2024](https://arxiv.org/abs/2408.05554)).
- **Nemotron 3.5 Transcribe**, the ASR model we use: a third-party catalog lists transcription in 40 languages ([LLMReference](https://www.llmreference.com/model/nemotron-3.5-transcribe/openrouter)). **We could not confirm from NVIDIA or OpenRouter whether Kazakh is among them.** All 5 DEV calls are in Russian, so our WER/CER numbers say nothing about Kazakh ([our-experiments.md](our-experiments.md) §9). In the `/broker` agent, Kazakh push-to-talk worked poorly on a synthetic macOS voice; it still needs a test with a real speaker ([STATUS, #14](../STATUS.md)).

## What we measured (eval-v4, 19 gold dialogs, 152 labels)

| Language | Dialogs | Labels | Strict | Lenient |
|---|---|---|---|---|
| RU | 9 (incl. 1 call) | 72 | 87.5% | 95.8% |
| EN | 5 | 40 | 97.5% | 97.5% |
| KZ | 5 | 40 | 92.5% | 97.5% |

Source: [`eval/runs/gpt-6-luna-eval-v4.metrics.json`](../../eval/runs/gpt-6-luna-eval-v4.metrics.json). With eval-v1, Kazakh was the weakest language (77.5% strict / 87.5% lenient), and both models tested missed the gross error in the Kazakh dialog `p1-kz-015`. The confidentiality rule added in later prompts (rule 13 in eval-v4) fixed that case. A difference of one label in a 40-label language moves its score by 2.5 points, so these per-language gaps are within noise.

## What this means for our design

- **Grade in the original language, explain in Russian.** The prompt tells the model to judge each dialog in its own language and write short explanations in Russian for the QA team ([`lib/evaluator.js`](../../lib/evaluator.js), rule 2). Evidence always shows the original transcript line, never a translation.
- **Write rules by meaning, not by keywords.** The mock evaluator missed Kazakh paid-offer phrasing because its regexes had no Kazakh patterns ([`eval/EVALUATOR_READINESS.md`](../../eval/EVALUATOR_READINESS.md) §4), and JavaScript `\b` does not treat Cyrillic as word characters ([LESSONS](../LESSONS.md)). The LLM prompt rules describe behaviour, not words.
- **Use organizer transcripts for grading calls**; treat our own ASR as optional ([organizer-rulings.md](organizer-rulings.md)).
- **Report per language** in every run and in the admin dashboard, so a weak language shows up instead of being averaged away.
- **Next step if this goes to production:** a Kazakh-heavy held-out set, real Kazakh call audio for ASR, and a check of KAZ-LLM or a fine-tuned Kazakh ASR model for on-premise use.

## Sources
- Togmanov et al., [KazMMLU: Evaluating Language Models on Kazakh, Russian, and Regional Knowledge of Kazakhstan](https://arxiv.org/abs/2502.12829), ACL 2025.
- ISSAI, [Official release of the ISSAI KAZ-LLM open-source model](https://issai.nu.edu.kz/2024/12/10/official-release-of-the-issai-kaz-llm-open-source-model-is-available/), 10 Dec 2024.
- Mussakhojayeva, Khassanov, Varol, [KSC2: An Industrial-Scale Open-Source Kazakh Speech Corpus](https://www.isca-archive.org/interspeech_2022/mussakhojayeva22_interspeech.html), Interspeech 2022.
- Khassanov et al., [A Crowdsourced Open-Source Kazakh Speech Corpus and Initial Speech Recognition Baseline](https://arxiv.org/abs/2009.10334), EACL 2021.
- Li et al., [Improving Whisper's Recognition Performance for Under-Represented Language Kazakh Leveraging Unpaired Speech and Text](https://arxiv.org/abs/2408.05554), Interspeech 2024.
- LLMReference, [Nemotron 3.5 Transcribe on OpenRouter](https://www.llmreference.com/model/nemotron-3.5-transcribe/openrouter) (third-party catalog).
