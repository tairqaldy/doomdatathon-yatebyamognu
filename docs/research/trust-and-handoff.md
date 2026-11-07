# Trust in AI support and the bot → human handoff

**Summary.** Many customers would rather not deal with AI in customer service, and their main worry is losing access to a person. Regulators in finance have documented "doom loops" where a chatbot gives no way out. Disclosure that a bot is a bot is now law in Kazakhstan and the EU. So an assistant for a broker has to say it is AI, be honest about its limits, hand off to a human with full context, and tell the customer when to expect an answer. The QA side then checks that the human finished the job.

## What the evidence says

**Customers worry about losing the human.** In a Gartner survey of 5,728 customers (December 2023), 64% said they would prefer companies not use AI for customer service, and 53% said they would consider switching to a competitor over it ([Gartner press release, 9 July 2024](https://www.gartner.com/en/newsroom/press-releases/2024-07-09-gartner-survey-finds-64-percent-of-customers-would-prefer-that-companies-didnt-use-ai-for-customer-service)). Coverage of the same survey lists "it will be harder to reach a person" as the top concern. A 2026 Gartner survey of 3,566 customers reports that 87% consider it essential to have an option to reach a human agent when a company uses generative AI for service ([Gartner press release, 4 Aug 2026](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0)). *Gartner's site blocked our fetcher (HTTP 403), so these figures come from the press-release titles and search-indexed text, not a full read.*

**Finance regulators see the same failure.** The US CFPB's issue spotlight on chatbots in consumer finance (June 2023) describes customers stuck in loops of scripted answers with no route to a human, and states that chatbots must follow the same consumer financial laws as the processes they replace ([CFPB, Chatbots in Consumer Finance](https://files.consumerfinance.gov/f/documents/cfpb_chatbot-issue-spotlight_2023-06.pdf); [press release](https://www.consumerfinance.gov/archive/newsroom/cfpb-issue-spotlight-analyzes-artificial-intelligence-chatbots-in-banking/)).

**Disclosure has a cost, and it is still required.** In a field experiment with more than 6,200 customers receiving outbound sales calls, disclosing a chatbot before the conversation cut purchase rates by 79.7%; undisclosed bots performed about as well as proficient human agents. Customers rated a disclosed bot as less knowledgeable and less empathetic ([Luo, Tong, Fang, Qu, Marketing Science 2019](https://doi.org/10.1287/mksc.2019.1192)). Hiding the bot is not an option, though:
- **Kazakhstan:** Law No. 230-VIII "On Artificial Intelligence", signed 17 November 2025, in force from 18 January 2026, requires informing users when goods or services are provided with AI, according to [PwC](https://www.pwc.com/kz/en/pwc-news/ta-reports/tax-legal-alert-fy19/278-december-2025.html) and [EY](https://www.ey.com/en_kz/technical/tax-alerts/2025/12/law-on-artificial-intelligence-kazakhstan) summaries. *We did not read the law text itself.*
- **EU:** Article 50(1) of the AI Act requires that people be informed they are interacting with an AI system unless that is obvious; it applies from 2 August 2026 ([Regulation (EU) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)). Freedom operates in Europe as well as Kazakhstan.

So the assistant has to earn trust after disclosing itself: give correct answers and keep a visible path to a person.

**Handoff with context is standard in the target platform.** Microsoft Copilot Studio can hand a conversation to a live agent in Dynamics 365 Customer Service together with the full conversation history and variables, so the agent sees the transcript ([Microsoft Learn: Hand off to a live agent](https://learn.microsoft.com/microsoft-copilot-studio/advanced-hand-off)). Dynamics 365 is the host Freedom named for our UI ([brief](../case/brief.md)).

**Freedom's own example.** At the opening ceremony Freedom showed the line «Я передам вопрос специалистам» with the note that the client still doesn't know when to expect an answer ([opening-ceremony.md](../case/opening-ceremony.md)). The briefing asked for a handoff that feels human and warm ([briefing-notes.md](../case/briefing-notes.md)).

**Could not verify:** blog and aggregator pages attribute "74% are frustrated when they must repeat information" to Zendesk's CX Trends 2026. We could not reach the Zendesk report, so we don't use the number.

## What we built from this

| Practice | Where |
|---|---|
| The assistant (AIM) never pretends to be human and doesn't invent tariffs, numbers, dates or links | [`lib/support-bot.js`](../../lib/support-bot.js), rules 1 and 4 |
| Questions about a specific account, money, withdrawals or blocks go to a human; so do unhappy customers and anyone who asks | `lib/support-bot.js`, rules 2–3; "talk to a person" chip in [`support/support.js`](../../support/support.js) |
| The handoff card says the specialist will see the whole conversation, so no need to repeat; it gives an expected reply time; after 90 s without an operator it says honestly that everyone is busy | `support/support.js` (`handoff_seen`, `handoff_eta`, `QUEUE_NOTICE_MS`), in RU, KZ and EN |
| The operator gets the full session live, with a short brief, in `/admin/#/live` | [`shared/live-store.js`](../../shared/live-store.js), [`admin/live.js`](../../admin/live.js) |
| The navigation agent in `/broker/` explains steps first and acts only after the client says yes; money and order buttons can only be highlighted, never pressed | [`broker/agent.js`](../../broker/agent.js), [`lib/nav-agent.js`](../../lib/nav-agent.js) |
| After the chat closes, the operator's part is evaluated against the checklist, so handoff quality feeds QA | `/api/evaluate` from `/support/` |
| QA rule: passing a question to specialists earns full consultation points only if the operator collected the data and told the client what happens next | [`lib/evaluator.js`](../../lib/evaluator.js), rule 11 |

## What this means for our decisions
- The product loop is landing → `/support/` (AIM with honest handoff) → automatic QA → `/admin/` ([DECISIONS](../DECISIONS.md), line 6), because it answers the briefing's "people don't trust AI" point end to end.
- **Production gap:** the "usually within 2 minutes" text is a fixed demo string. In production it must come from real queue data, or it becomes the same broken promise Freedom's slide warns about.

## Sources
- Gartner, [Survey finds 64% of customers would prefer that companies didn't use AI for customer service](https://www.gartner.com/en/newsroom/press-releases/2024-07-09-gartner-survey-finds-64-percent-of-customers-would-prefer-that-companies-didnt-use-ai-for-customer-service), 9 July 2024.
- Gartner, [Survey finds 87% of customers say companies using GenAI for customer service must provide access to a human agent](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0), 4 Aug 2026.
- CFPB, [Chatbots in Consumer Finance (issue spotlight, PDF)](https://files.consumerfinance.gov/f/documents/cfpb_chatbot-issue-spotlight_2023-06.pdf), June 2023.
- Luo, Tong, Fang, Qu, [Machines vs. Humans: The Impact of Artificial Intelligence Chatbot Disclosure on Customer Purchases](https://doi.org/10.1287/mksc.2019.1192), Marketing Science 38(6), 2019.
- PwC Kazakhstan, [Tax & Legal Alert, special edition 278](https://www.pwc.com/kz/en/pwc-news/ta-reports/tax-legal-alert-fy19/278-december-2025.html), December 2025; EY Kazakhstan, [Law on Artificial Intelligence](https://www.ey.com/en_kz/technical/tax-alerts/2025/12/law-on-artificial-intelligence-kazakhstan), December 2025.
- [Regulation (EU) 2024/1689 (AI Act)](https://eur-lex.europa.eu/eli/reg/2024/1689/oj), Article 50.
- Microsoft Learn, [Hand off to a live agent (Copilot Studio)](https://learn.microsoft.com/microsoft-copilot-studio/advanced-hand-off).
