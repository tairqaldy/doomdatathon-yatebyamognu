# Model and metrics research

Research date: 2026-11-07. Prices and performance are provider information, not results measured on our data. Check access, current rates and language support before choosing. No model comparison has been run by this team.

## Recommendation

The [official brief](../case/brief.md) already supplies transcripts for calls. Build and verify transcript evaluation, evidence, appeals and the checklist editor first. Speech recognition and a live voice agent are optional. Compare text models on the same human-labeled Russian, Kazakh and English conversations before selecting one; no provider is proven best for our task.

## Models for evaluating conversations

| Candidate | Reason to test | Standard text input / output per million tokens | Limits |
|---|---|---|---|
| GPT-6 Luna | Provider positions it for focused, high-volume tasks. | $0.10 / $0.50 | Confirm availability, structured output and language quality. [OpenAI model catalog](https://developers.openai.com/api/docs/models) |
| Gemini 2.5 Flash | Supports structured output and long context; accepts audio too. | $0.30 / $2.50 | Thinking tokens count toward output; check quota and access. [Model](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash), [prices](https://ai.google.dev/gemini-api/docs/pricing) |
| Claude Haiku 5.5 | Provider positions it for extraction and classification. | From $0.10 / $0.50 for prompts up to 100k tokens | Verify access and schema support; token usage differs by model. [Model and rates](https://platform.claude.com/docs/en/models/haiku-5-5/overview) |

Illustration, not a measured cost: 5,000 input and 1,000 output tokens cost about $0.001 for Luna or Haiku at the rates shown, versus $0.004 for Gemini. Actual token counts, thinking, retries, calls, caching and tier affect cost. Record all calls for cost per evaluation. Use deterministic code for totals and validate evidence; valid structured output alone does not mean an answer is correct.

## Audio models: different jobs

**Speech recognition (ASR)** converts audio into text. **A language model** understands the text and creates a response. **Text-to-speech (TTS)** converts the response into audio. Whisper and ElevenLabs address different jobs and are optional for the supplied transcripts.

| Candidate | Role and reason to consider | Limitation |
|---|---|---|
| Open-source Whisper | Local multilingual recognition baseline; its language list includes English, Russian and Kazakh. [Code](https://github.com/openai/whisper), [languages](https://github.com/openai/whisper/blob/main/whisper/tokenizer.py) | Standard file transcription uses 30-second windows; streaming requires additional work. Language support does not guarantee accuracy. |
| OpenAI GPT-Live-Transcribe | Provider recommends it for live transcription. [Guide](https://developers.openai.com/api/docs/guides/transcription) | Test Kazakh and code-switching. Provider lists an estimated $0.017/minute; verify current pricing. [Pricing](https://platform.openai.com/pricing) |
| ElevenLabs Scribe v2 Realtime | Streaming recognition; provider reports ~150 ms median to committed transcript. [Methodology](https://elevenlabs.io/docs/eleven-api/concepts/latency-methodology) | Verify language coverage, price and actual performance. |
| Eleven v4 Turbo | Expressive streaming voice; provider lists English, Russian and Kazakh and ~100 ms server-side median. [Models](https://elevenlabs.io/docs/overview/models) | Test price, naturalness and latency from the demo location. |
| Eleven Flash v2.5 | Faster-cost-oriented TTS option; provider lists English and Russian, ~100 ms server-side median. | Kazakh is absent from its published language list. [Models](https://elevenlabs.io/docs/overview/models) |
| OpenAI GPT-Realtime-2.1 Mini / GPT-Live 1 | Speech-to-speech candidates. [Catalog](https://developers.openai.com/api/docs/models) | Test language quality, latency, interruption handling and cost. |

OpenAI's hosted `whisper-1` model is deprecated and scheduled to shut down on 2027-02-26. This differs from the open-source Whisper model run locally. [Transcription guide](https://developers.openai.com/api/docs/guides/transcription).

## 500 ms and human-like conversation

Define end-to-end latency as **when the user stops speaking to when the first response audio actually plays on the user's device**. It includes turn detection, recognition, response generation, speech synthesis, network and playback. Some stages overlap; instrument the pipeline instead of adding vendor medians.

Example budget only: 100 ms turn detection + 60 ms remaining transcription + 150 ms to useful model text + 100 ms synthesis + 90 ms network/playback = 500 ms. This is an ambitious target, not a measured result. ElevenLabs' ~100 ms is a warm-voice server-side median, excluding network, application and playback; it is not an end-to-end guarantee. [Latency methodology](https://elevenlabs.io/docs/eleven-api/concepts/latency-methodology).

Stream partial transcription, response text and generated audio; keep connections warm and measure on the demo network. Faster turn detection can cut people off. Human-like performance also needs correct answers, natural pronunciation, appropriate tone, interruption handling and an effective human handoff. Measure these independently.

## What to measure

### Required product

- **Criterion agreement:** matching model and human answers divided by labeled answers, broken down by language and criterion; report N/A separately.
- **Gross-error recall:** true gross errors found divided by actual gross errors, plus false positives and example counts.
- **Evidence quality:** valid transcript references and human judgment of whether cited passages support each answer; check missing-action ranges and N/A reasons.
- **Score difference:** average absolute difference between deterministic totals using model and human answers.
- **Reliability:** successful complete evaluations / attempts, failures and retries, median and 95th percentile latency, and actual cost per completed evaluation including retries.
- **Usability:** completion rate and time for evaluation → evidence → appeal → decision, with observed problems.

### If voice is built

- **Word error rate (WER):** (substitutions + deletions + insertions) / reference words. Lower is better; it can exceed 100%. [Google's explanation](https://docs.cloud.google.com/speech-to-text/docs/v1/speech-accuracy).
- **Character error rate (CER):** the same calculation at character level. Document normalization of case, punctuation, spaces and numbers; apply it consistently.
- **Latency:** report median (p50), 95th percentile (p95), sample count and percentage at or below 500 ms, measured from speech end to audible output.
- **Voice and conversation quality:** blind listener ratings for naturalness, intelligibility and pronunciation, plus counts of interruptions, incorrect answers, completed tasks and human handoffs.

Use identical audio and human-checked reference transcripts for each ASR model; split results by language, noise and code-switching. Check the supplied transcripts against audio before treating them as a reference. Five calls are too few to support broad accuracy claims.

## Practical test

1. Two reviewers independently label a small, diverse set of conversations, including all three languages, N/A, missing actions and gross errors. Resolve disagreements and set aside examples for comparison.
2. Test available text models on the same held-out examples and checklist. Record model and prompt versions, accuracy, evidence, latency, retries, tokens and cost.
3. If time remains, compare speech models on the same verified audio and measure the live voice path end to end on the actual device and network.
4. Report sample sizes and limitations. Do not claim 500 ms, accuracy or human-like quality without measurements.
