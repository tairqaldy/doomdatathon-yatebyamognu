# Contact-center QA and speech analytics

**Summary.** Classic contact-center QA has an analyst score a small sample of conversations against a scorecard and hold calibration sessions so analysts score alike. Automated QA can score every conversation, but it is only as good as its scorecard and its validation against human scores. Freedom asked for exactly this: regular analysis at volume, explained, with a human keeping the final say. Freedom Broker's brokerage business grew to about 858,000 accounts in a year, so sampling by hand covers less and less of it.

## What the practice looks like

**Scorecards.** A QA form is a list of yes/no and scaled items with weights, often grouped into sections (greeting, discovery, compliance, resolution, closing). Freedom's 8-criterion checklist follows this shape: four sections, weights summing to 100, N/A rules and a separate gross-error flag ([checklist](../case/checklist.md)).

**Manual sampling.** Vendor sources put manual review at a few percent of interactions: Aircall says under 5% of calls (2–5% in its table), Enthu.AI says a typical 2%, 2–5% in its table. Both describe automated QA as applying the same scorecard to every interaction ([Aircall](https://aircall.io/blog/ai-quality-assurance-call-center/), [Enthu.AI](https://enthu.ai/blog/ai-reduces-manual-qa/)). **We could not find an independent, non-vendor benchmark for this percentage.** Treat it as directional. The organizers made the same point in their own words: one manual check isn't enough, volume is large and people read the metrics differently ([briefing notes](../case/briefing-notes.md)).

**Calibration.** QA teams regularly have several evaluators score the same conversation and then discuss the items where they differ. SQM Group, a QA consultancy, gives the target as keeping scores within 5% variance ([SQM Group, call calibration guide](https://sqmgroup.com/resources/library/blog/call-calibration-comprehensive-guide)). This is a target, not a measured industry average. The organizers said the same about grading: experts disagree too, and they look at closeness and reasonableness ([telegram-qa.md](../case/telegram-qa.md)).

**Validation of automated scoring.** Even vendors that sell AI QA say to validate it first: Aircall suggests having an experienced analyst score the same 20–30 calls as the AI and refining the criteria where they differ ([Aircall](https://aircall.io/blog/ai-quality-assurance-call-center/)). Peer-reviewed work on LLMs for contact-center QA is thin. The closest study benchmarks eight language models on yes/no QA questions about agent conversations. Larger models did better, and a "find evidence, reason, then answer" prompt structure helped smaller ones ([Ingle et al., EMNLP 2024 Industry](https://aclanthology.org/2024.emnlp-industry.60)). We did not read its full result tables.

## What Freedom showed us

At the opening ceremony Freedom described speech analytics in four steps: **conversation → understanding (reason, operator actions, outcome) → evaluation (criteria, violations, explanations) → action (review, feedback, a human's decision)**. Their slide on trust said the score needs the reason it was lowered, the exact line and moment in the recording, and a way to dispute it ([opening-ceremony.md](../case/opening-ceremony.md)).

## Freedom's scale (public figures)

| Fact | Value | Source |
|---|---|---|
| Brokerage customer accounts, 31 Mar 2026 | about 858,000 (683,000 a year earlier) | [Freedom Holding FY2026 results, 1 Jun 2026](https://ir.freedomholdingcorp.com/press-releases/detail/99/) |
| Banking customers, 31 Mar 2026 | 5,026,000 (2,515,000 a year earlier) | same release |
| Employees, 31 Mar 2026 | 11,846 | same release |
| Listing | NASDAQ: FRHC; regulated by the US SEC | [company deck](../case/freedom-company.md) |

The company deck given to us says 874 thousand brokerage accounts; it is undated, so we quote the FY2026 release instead. **We found no public figure for Freedom's support contact volume, number of operators or current QA sample rate.** Any "hours saved" number would be invented, so we don't give one. What we can say: at our measured $0.00114 per evaluation, scoring 10,000 conversations costs about $11 in model fees (arithmetic, not a quote; see [models-cost-latency.md](models-cost-latency.md)).

## What this means for our design

- **Score every conversation, show the evidence.** The card shows answer, points, weight, explanation and the exact line for each criterion; the list shows the main deduction per dialog ([DECISIONS](../DECISIONS.md), line 14: UI follows Freedom's QA workspace slide).
- **Keep the scorecard as data.** QA teams change forms; the checklist is JSON and editable in the UI ([DECISIONS](../DECISIONS.md), line 24).
- **Calibrate the machine like an analyst.** Our gold set plays the role of a calibration session: humans label, the model is scored against them, and disagreements are listed per criterion ([our-experiments.md](our-experiments.md)).
- **Make disagreement cheap.** Appeal and reviewer decision are built in, and the total is recomputed from the reviewer's answer (must-haves 5–6).
- **Aggregate for managers.** `/admin/` shows average score, points lost by criterion and the most common deduction reasons, which is the "regular analysis" the briefing asked for.

## Sources
- SQM Group, [Call calibration: a comprehensive guide](https://sqmgroup.com/resources/library/blog/call-calibration-comprehensive-guide) (QA consultancy).
- Aircall, [AI quality assurance in the call center](https://aircall.io/blog/ai-quality-assurance-call-center/) (vendor).
- Enthu.AI, [AI reduces manual QA](https://enthu.ai/blog/ai-reduces-manual-qa/) (vendor).
- Ingle et al., [Probing the Depths of Language Models' Contact-Center Knowledge for Quality Assurance](https://aclanthology.org/2024.emnlp-industry.60), EMNLP 2024 Industry Track.
- Freedom Holding Corp., [FY2026 results press release](https://ir.freedomholdingcorp.com/press-releases/detail/99/), 1 June 2026.
- Case files: [brief](../case/brief.md), [checklist](../case/checklist.md), [briefing notes](../case/briefing-notes.md), [opening ceremony](../case/opening-ceremony.md), [company deck](../case/freedom-company.md).
