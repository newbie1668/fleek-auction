# Fleek Auction House — judge demo script

- **Target length:** 3 minutes
- **Primary track:** [Agents & LLMs](https://luma.com/usntwjdw)
- **Live demo:** https://fleek-auction.vercel.app
- **Judging lenses from the founder briefing:** working demo, real problem, technical depth, ambition plus execution

## Demo posture

This is a customer-problem story followed by proof, not a tour of every screen.

Use one narrator and one silent driver. The narrator should face the judges; the driver should make the clicks as the relevant sentence is spoken. The engineer and second PM should hold Q&A and recovery rather than adding speaker handoffs during the three minutes.

Be explicit about what is real:

- seller inputs, validation, auction state, proxy pricing, reserve handling, Buy Now, activity and reset all run live;
- the rival is a clearly labelled simulation because the prototype is not connected to Fleek accounts;
- the current build is a single-browser prototype;
- no payment or production Fleek API is connected;
- the bounded proxy is the agentic proof; an LLM is not allowed to invent prices or settle money.

## Three-minute script

| Time | Driver action | Narrator script | Judging signal |
|---|---|---|---|
| 0:00–0:25 | Stay on **Seller**. Do not click yet. | **“Fleek has made messy secondhand inventory searchable. We want to make it liquid. The best wholesale price can still sit behind a conversation: one verified buyer saw an agreed price raised and waited two weeks for it to return, while Fleek's offer flow can wait up to 48 hours. The problem is repeated coordination and uncertain commitment.”** | Real customer problem |
| 0:25–0:40 | Point to the guidance range. | **“Fleek already has the harder advantage: marketplace history and pricing intelligence that can estimate where secondhand inventory should clear. But an estimate is not a transaction. Auction House turns prediction into live execution.”** | Why Fleek; ambition |
| 0:40–1:05 | Change **Starting bid** from £520 to **£540**. Pause so the Review card updates. Point to **£620 private reserve** and **£760 Buy Now**, then click **Publish auction**. | **“The seller states the rules once. I can change the opening price live; the summary updates immediately. The £620 reserve stays private, while £760 gives buyers instant certainty. The seller does not need to wake up and counter every message.”** | Working, non-canned interaction |
| 1:05–1:20 | On **Market**, point to the live first card. Click **View auction**. | **“The market now exposes one live exact lot at £540, whether the reserve has been met, and Buy Now. It never displays the seller's reserve amount.”** | Working state; privacy |
| 1:20–1:50 | In **Buyer**, leave the private maximum at **£690** and click **Approve maximum & start proxy**. Point to the price moving to **£620**, “You're leading,” and the activity log. | **“The buyer sets one private ceiling: £690. The bounded proxy bids only enough to make the buyer competitive, so the visible price moves to the reserve at £620—not to £690. The seller and other buyers never see the ceiling, and each action is recorded.”** | Agent behavior; trust |
| 1:50–2:15 | Open **Demo**. Click **Baseline path — Rival max £650**. Point to **£660** and **Primary buyer leads**. | **“This labelled control simulates a real rival bid because we are not connected to production Fleek accounts. The rival reaches £650. Without another buyer click, the proxy reacts and keeps our buyer leading at £660.”** | Agents & LLMs track; working reaction |
| 2:15–2:35 | Click **Advance to close**. Point to **Pending Fleek QC**. | **“The auction closes using deterministic rules covered by 39 tests: prices cannot move backwards, private limits cannot be breached, and the result is marked pending Fleek QC. No payment or physical QC is processed here.”** | Technical depth; safe execution |
| 2:35–2:50 | Stop clicking. Keep the completed state visible. | **“Everything you just changed—the inputs, validation, auction state and proxy calculation—ran live in this browser. The rival and Fleek integration are simulated; this is not yet a multi-buyer backend, payment system or live LLM.”** | Credibility; working-demo clarity |
| 2:50–3:00 | Face the judges. | **“Today proves the mechanism, not liquidity. Next we test opt-in auctions for exact, high-demand lots. Fleek made secondhand legible; Auction House can make it liquid.”** | Ambition plus execution |

## Optional 20-second proof

Only use this if the judges give you extra time or ask whether the result is canned:

1. Click **Alternate path — Rival max £710** and show that the rival leads at £700 because the primary buyer's £690 ceiling is respected.
2. Click **Instant path — Buy Now £760** to show the certainty path.

Say: **“Change the market input and the outcome changes, while the same boundaries still hold.”**

## Why this fits Agents & LLMs

The event track explicitly includes sourcing, pricing and negotiation. Our agentic contribution is not a chatbot pretending to haggle. It is a bounded proxy that:

1. receives an explicit private objective from its buyer;
2. observes a market-state change;
3. reacts without another buyer click;
4. remains inside a hard spending limit; and
5. leaves monetary rules to deterministic code.

If asked where the LLM is, say:

> **“We chose the Agents side of Agents & LLMs for the working proof. A production LLM can translate natural-language sourcing intent into an editable policy, but it should never invent the price, exceed the approved ceiling or settle money. Those remain deterministic.”**

## Ninety-second fallback

Use this if demos are cut short:

1. **0:00–0:15 — Problem:** “Better wholesale prices often sit behind messages; response can take up to 48 hours, and one verified buyer waited two weeks for an agreed price to return.”
2. **0:15–0:25 — Thesis:** “Fleek estimates where stock should clear. Auction House turns that estimate into a transaction.”
3. **0:25–0:40 — Seller:** Change £520 to £540; show £620 private reserve and £760 Buy Now; publish.
4. **0:40–0:55 — Buyer:** Approve £690; show visible price at £620.
5. **0:55–1:10 — Agent:** Run £650 rival; show the proxy leading at £660 without another buyer click.
6. **1:10–1:20 — Close:** Advance the auction; show **Pending Fleek QC**.
7. **1:20–1:30 — Thesis:** “Bounded agent, deterministic money rules, optional for exact high-demand lots. Fleek predicts the market; Auction House lets it clear.”

## Judge Q&A

### “Is this just Demand Hub?”

> “Demand Hub creates supply against demand. Agentic Sourcing finds inventory. Auction House clears demand against one finite, listed lot through time-bound competition, a private reserve and Buy Now. It is a complementary execution mechanism, not a replacement.”

### “Did customers ask for auctions?”

> “No—that would overstate the research. Customers show the symptoms: message-dependent prices, response delays and moving terms. The auction is our hypothesis for solving those coordination costs, and we would validate it against Fleek's internal offer funnel.”

### “Where is the AI?”

> “The buyer proxy is the agent: it holds a private goal, observes a rival event and acts within a hard boundary without another click. We deliberately keep monetary settlement deterministic. Natural-language mandate parsing is the next LLM layer, not something we fake in this demo.”

### “What is technically difficult here?”

> “Guaranteeing monotonic prices, reserve rules, buyer ceilings, Buy Now and repeatable settlement while modelling public and private views. This prototype uses one client-side state machine; production would enforce those projections server-side.”

### “Why will this work without liquidity?”

> “Liquidity is the make-or-break assumption. We would not auction every listing. We would pilot opt-in, scheduled auctions for exact, high-demand lots where Fleek can prove several qualified buyers are active in the same window.”

### “What would you measure?”

> “Completed GMV per eligible listing-day, median time to clear, qualified bidders per lot, reserve-hit rate, checkout completion, seller payout and disputes—plus how many offer messages and human touches we remove.”

## Do not say

- “Customers are asking Fleek for auctions.”
- “The LLM sets or predicts the price.”
- “This is already integrated with Fleek.”
- “The rival is a real customer.”
- “Payment or physical QC is complete.”
- “Auction House replaces chat, handpicks or Demand Hub.”

## Pre-demo checklist

- Open https://fleek-auction.vercel.app in a fresh tab and confirm **Seller** is showing.
- Keep browser zoom between 80% and 90% so the Review card and fields are visible together.
- Confirm defaults: £520 start, £620 reserve, £760 Buy Now and £690 buyer maximum.
- Rehearse changing only the starting bid to £540.
- Run Reset once, then rehearse baseline £660, alternate £700 and Buy Now £760.
- Close notifications and unrelated tabs.
- Keep a screen recording of the complete flow as a fallback, but lead with the live build.
- Do not open source code unless a judge asks a technical question.
