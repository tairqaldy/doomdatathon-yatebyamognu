# Product acceptance checklist

Use this as a shared testing guide, not a claim that the product already works. All items below are **not yet verified**. The official [brief](case/brief.md) and [checklist](case/checklist.md) are the sources of truth; judging criteria are still pending.

## What good looks like

A quality reviewer can understand an operator's score, inspect its evidence, challenge a result and see a reasoned final decision. A configurable checklist must work on new conversations without a code change.

## Must-pass checks

Record the date, conversation ID, language, checklist version, result and any issue link for each run. Test with representative Russian, Kazakh and English conversations. Avoid copying personal data or signed audio links into issues or presentations.

- [ ] **Choose and evaluate:** Load a conversation, choose a saved checklist and run the evaluation. The operator is graded; bot and system messages remain context.
- [ ] **Understand results:** For every criterion, show answer, points, weight, explanation and evidence. Show total and section scores where defined; show gross errors separately.
- [ ] **Evidence:** A link lands on and highlights the exact message. For a missing action, show the checked part of the conversation; for N/A, explain the condition. For a call, provide playback or a jump to the relevant audio.
- [ ] **N/A and scoring:** Use N/A only when permitted and justified. Its weight is redistributed across applicable criteria; total is rounded to two decimals. If no weighted criteria apply, show that the total cannot be calculated.
- [ ] **Appeal:** Select a criterion, enter a comment and save. The reviewer can see the disputed score, comment and relevant conversation fragment.
- [ ] **Decision:** Confirm or change the answer with a reason. Show the original result, decision and final result; a changed answer recalculates the total.
- [ ] **Live configuration:** Add or replace a criterion, set its text, weight, answer type, N/A setting and scale if applicable, save it through the interface and apply it to a conversation.
- [ ] **Usability:** A first-time reviewer can find the next action, understand loading/errors, and navigate the transcript and evidence without help. Check at a narrow iframe width around 800 px as well as a wider screen.
- [ ] **Run and handoff:** Follow the README from a clean setup. No sign-in should be needed for the demo. If a paid model is used, document its name and approximate cost per complete evaluation.

## Suggested test cases

1. **Evidence and omission:** Find a conversation where a required action is missing. Verify the result points to the relevant checked section, not an invented quote.
2. **N/A:** Find a conversation where identity verification is not needed. Check the explanation and total after redistribution. Compare with a case where verification was required but missing: that is “No,” not N/A.
3. **Appeal:** Change one scored answer through a review decision. Independently check the new total and confirm the original remains visible.
4. **Live criterion:** Add a clearly worded criterion in the editor, save, then evaluate a conversation. Confirm the new criterion appears in the result.
5. **Languages and channels:** Run representative RU, KZ and EN examples, plus a voice call. Verify evidence anchors and original timestamps; try audio playback.
6. **Failure and recovery:** Try an unavailable evaluation service or invalid input. The user should see an understandable error and a way to retry without losing the current work.

## Test log

| Date | Conversation / language | Checklist version | Check | Result | Issue |
|---|---|---|---|---|---|
| — | — | — | Not yet run | Not verified | — |

Prioritize broken required flows before optional dashboards, landing pages or speech recognition. The brief supplies transcripts, so speech recognition is optional.
