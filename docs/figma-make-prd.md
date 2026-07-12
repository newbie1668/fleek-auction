# PRD: Fleek Auction House interactive prototype

**Status:** Hackathon MVP  
**Build target:** Figma Make  
**Visual source of truth:** The existing Fleek Auction House designs in the Figma file  
**Prototype type:** Self-contained, deterministic, client-side demo

## 1. Product summary

Fleek Auction House adds a time-bound auction and Buy Now mechanism to wholesale resale. Sellers set public auction terms and a private reserve once; buyers either buy immediately or give a private maximum to a proxy agent that bids only as much as needed.

The prototype should show how Fleek can replace slow chat-and-offer negotiation with immediate price discovery while preserving seller and buyer privacy.

This is an auction layer for specific inventory lots. It should be positioned as complementary to Fleek's existing marketplace and demand workflows, not as a replacement for them.

## 2. Problem statement

Wholesale buyers and sellers currently depend on messages, offers, counteroffers, and each person returning to the conversation. A negotiation can take hours or days, even when both parties already know their acceptable price range.

Sellers need a way to expose inventory without constantly responding to messages. Buyers need a way to express a private ceiling, let the market resolve the price automatically, and retain the option to buy immediately.

## 3. Prototype objective

Create a convincing, judge-ready prototype that demonstrates:

1. A seller can configure and publish an auction without waiting for buyer messages.
2. A buyer can approve a private maximum and let a proxy agent bid automatically.
3. A competing buyer changes the public price without exposing either buyer's maximum.
4. Buy Now provides an immediate alternative to waiting.
5. The auction closes at the correct price and moves to **Pending Fleek QC**.

The full story should be understandable and demonstrable in under three minutes.

## 4. Figma design instruction

The existing designs are authoritative. Use their current frames, components, typography, colours, spacing, illustrations, labels, and responsive intent.

Do not redesign the product, generate a new visual system, replace the garment artwork, or add generic dashboard patterns. Add only the interaction logic, state changes, validation, disabled states, and concise feedback required by this PRD.

If a functional requirement needs a UI element that is not already present, create the smallest possible element using the existing component language.

## 5. Target users

### Wholesale seller

Wants to list a specific lot once, protect a minimum acceptable price, and allow the market to transact without constant messaging.

### Wholesale buyer

Wants to secure stock at a sensible price without repeatedly monitoring messages or manually counterbidding.

### Hackathon presenter

Needs a clearly labelled, repeatable way to demonstrate baseline bidding, an alternate winner, Buy Now, and reset. Presenter-only controls must never look customer-facing.

## 6. Success criteria

- A first-time viewer can explain the seller and buyer value proposition after one walkthrough.
- The seller-to-market-to-buyer flow can be completed in under three minutes.
- The locked baseline always resolves to the primary buyer leading at **£660**.
- The alternate path always resolves to the rival leading at **£700**.
- Buy Now always closes once at **£760**.
- No public or opposing-party view exposes the private reserve or another buyer's maximum.
- Reloading or selecting Reset returns the prototype to a predictable starting state.

## 7. Locked demonstration data

| Field | Value |
|---|---:|
| Lot | 50-piece Grade AB Branded Sweatshirt Lot |
| Listing type | Exact bundle |
| Supplier | Thrift Kings Wholesale |
| Supplier status | Verified supplier · 4.8 ★ · 312 orders |
| Shipping | £48 fixed shipping |
| Market guidance | £560 low · £640 median · £720 high |
| Comparable source | Synthetic demo data · 12 sales |
| Starting bid | £520 |
| Private seller reserve | £620 |
| Buy Now | £760 |
| Bid increment | £10 |
| Demo duration | 90 seconds |
| Primary buyer maximum | £690 |
| Baseline rival maximum | £650 |
| Baseline visible result | Primary leads at £660 |
| Alternate rival maximum | £710 |
| Alternate visible result | Rival leads at £700 |
| Fulfilment state | Pending Fleek QC |

Shipping is always shown separately and is not included in bidding calculations.

## 8. P0 prototype scope

### 8.1 Seller view

The existing seller design must support:

- exact lot details and garment artwork;
- labelled market guidance using synthetic demo data;
- editable starting bid;
- editable private reserve;
- editable Buy Now price;
- a fixed 90-second demo duration;
- a live review summary that reflects the entered values;
- a clear explanation that the reserve remains private;
- Publish auction;
- field validation without losing the entered values.

Validation rules:

- all prices must be positive whole-pound values for this prototype;
- starting bid must be less than or equal to reserve;
- reserve must be less than Buy Now;
- invalid terms do not publish and show a field-specific message.

On successful publish, the shared auction state becomes Live and the prototype moves to the Market view.

### 8.2 Market view

The existing market design must show:

- one stateful auction card for the sweatshirt lot;
- two static cards labelled **Demo listing** for visual context;
- live/draft/closed status;
- current public price;
- reserve met or reserve not met, without exposing the reserve amount;
- public bid count;
- Buy Now price;
- countdown or closed state;
- View auction action leading to the Buyer view.

The stateful market card must always reflect the same shared state as Seller, Buyer, and Demo views.

### 8.3 Buyer view

The existing buyer design must support:

- exact lot facts, supplier information, shipping, and garment artwork;
- current public price, reserve status, countdown, and bid count;
- a private maximum field defaulted to £690;
- **Approve maximum & start proxy**;
- clear explanation that the proxy bids only enough to keep the buyer leading;
- proxy status: inactive, active and leading, or stopped/outbid;
- Buy Now;
- public and private activity tabs;
- disabled bidding controls after close;
- closed outcome and Pending Fleek QC.

Approving £690 on a live auction moves the visible price from £520 to the £620 reserve and marks the buyer as leading. The maximum remains visible only in the buyer's private card and private activity.

### 8.4 Demo view

Use a separate view or clearly isolated tray labelled **Interactive prototype · Simulated rival**.

It must provide:

- **Baseline path — rival max £650:** primary buyer leads at £660;
- **Alternate path — rival max £710:** rival leads at £700;
- **Instant path — Buy Now £760:** auction closes immediately;
- **Advance to close:** closes a live auction at its current valid outcome;
- **Replay auction:** returns to the published £520 opening state;
- **Reset to seller setup:** returns to a draft and clears all bids.

These controls are for demonstration only. They must not appear to be actions available to a real seller or buyer.

## 9. Shared prototype state

Figma Make should implement one client-side state model shared by all views:

```text
status: draft | live | closed
startPrice: number
reservePrice: number
buyNowPrice: number
currentPrice: number
secondsRemaining: number
primaryMaximum: number | null
rivalMaximum: number | null
leader: none | primary | rival | buy-now
reserveMet: boolean
bidCount: number
closeReason: auction | buy-now | null
fulfilment: Pending Fleek QC | null
publicEvents: event[]
privateBuyerEvents: event[]
```

Use a deterministic reducer or state machine. Do not implement these outcomes as unrelated text swaps on individual frames.

The state may reset on a full page reload. No backend, account, database, or real-time service is required for this Figma Make prototype.

## 10. Auction behaviour

The proxy mechanic is the core product behaviour:

```text
visible price = the lower of:
1. the highest private maximum; or
2. the second-highest private maximum plus the £10 increment
```

Additional prototype rules:

- the visible price never falls below the starting bid;
- when the first valid maximum reaches the reserve, the visible price becomes the reserve;
- the visible price can never decrease;
- a buyer may raise but not lower an active maximum;
- repeating the same maximum does not create a second bid;
- a maximum at or above Buy Now should direct the buyer to Buy Now;
- Buy Now closes the auction once at £760;
- no bidding action is accepted after close;
- a close with reserve met produces Pending Fleek QC;
- a close below reserve ends without sale.

Locked outcomes:

1. Publish at £520.
2. Primary approves £690 → current price £620, primary leads, reserve met.
3. Rival £650 → current price £660, primary still leads.
4. Rival £710 instead → current price £700, rival leads.
5. Buy Now → closed at £760, Pending Fleek QC.

## 11. Activity behaviour

Public activity can show:

- auction published;
- reserve met;
- automatic bid placed and current public price;
- auction sold or ended;
- Buy Now close.

Private buyer activity can additionally show:

- the buyer's approved maximum;
- proxy activated;
- proxy retained the lead;
- proxy stopped at the approved maximum.

Do not show the rival's identity or private maximum in the Buyer view. A simulated rival amount may appear only inside the labelled Demo controls.

## 12. Required feedback and states

- Draft, Live, and Closed status badges.
- Reserve met and Reserve not met badges.
- Short confirmation feedback after publish, maximum approval, scenario selection, close, replay, and reset.
- Disabled actions must look disabled and must not mutate state.
- Invalid seller terms show the exact correction required.
- A buyer action attempted before publish explains that the auction is not live.
- Closing without reserve met shows **Auction ended · Reserve not met**.

## 13. Privacy requirements

- Seller reserve is visible in Seller only.
- Primary maximum is visible in the primary buyer's private UI only.
- Market never displays either private value.
- Seller never sees buyer maxima.
- Buyer never sees the reserve amount or rival maximum.
- Activity tabs must not reveal hidden events when switching between public and private views.

Privacy labels should use the existing **Public** and **Private to you** treatments.

## 14. Responsive and accessibility requirements

- Preserve the existing desktop layout as the primary presentation.
- Below approximately 980 px, stack multi-column layouts into one column.
- Navigation and demo controls may wrap but must remain usable.
- No fixed 1180 px minimum width.
- Buttons and inputs require visible keyboard focus.
- Every input needs a persistent label.
- Status must not rely on colour alone.
- Respect reduced-motion preferences.

## 15. Out of scope

- Fleek production APIs or authentication;
- real buyers or separate browser synchronization;
- payments, checkout, deposits, credits, or refunds;
- database persistence;
- real comparable-sales data;
- fraud, notifications, logistics, customs, or physical QC implementation;
- more than one live, stateful auction;
- production-grade auction concurrency;
- an autonomous model deciding bid amounts, winners, or settlement.

## 16. P1, only if already represented in the designs

If an existing frame includes buyer sourcing intent, support this fixed input:

> I want Grade AB branded sweatshirts and I prefer getting a deal over buying immediately.

Return a clearly labelled simulated structured result:

- Category: Branded sweatshirts
- Minimum grade: AB
- Preference: Auction
- Explanation: Matched branded sweatshirts at Grade AB or better.

The buyer must confirm this result separately from entering £690. Never imply that an LLM chose the maximum, calculated the winning price, or placed an unrestricted bid.

If this UI is not already designed, omit it from the Figma Make prototype rather than redesigning the current screens.

## 17. Acceptance criteria

- [ ] Existing frames and components remain visually recognisable and are reused.
- [ ] Seller inputs update the review summary.
- [ ] Valid seller terms publish the lot and update Market and Buyer.
- [ ] Invalid seller terms do not publish.
- [ ] Market shows one shared-state lot and two static Demo listings.
- [ ] Buyer can approve a private £690 maximum.
- [ ] Approval moves the public price to £620 and marks reserve met.
- [ ] Baseline rival path produces £660 with primary leading.
- [ ] Alternate rival path produces £700 with rival leading.
- [ ] Re-approving £690 after the £710 rival path does not lower £700 or flip the leader.
- [ ] Buy Now closes once at £760.
- [ ] Closed controls are disabled.
- [ ] Successful close shows Pending Fleek QC.
- [ ] Public activity never contains private reserve or maximum values.
- [ ] Replay and Reset return to their documented states.
- [ ] The core demo works at laptop and narrow mobile widths.

## 18. Recommended Figma Make build sequence

1. Inspect and reuse the selected existing frames and components.
2. Create the shared auction state and reducer.
3. Connect Seller fields and Publish.
4. Connect the stateful Market card.
5. Connect Buyer maximum, proxy status, Buy Now, and activity tabs.
6. Add the isolated Demo scenarios and reset controls.
7. Add validation, disabled states, and feedback.
8. Test every acceptance criterion before changing visual details.

## 19. Presenter walkthrough

1. Open Seller and explain the £560–£720 guidance range.
2. Show the £620 private reserve and £760 Buy Now, then publish.
3. Open Market and show that the exact lot is now live at £520.
4. Open Buyer, approve the private £690 maximum, and show the price move to £620.
5. Run the £650 rival path and show the proxy keep the buyer leading at £660.
6. Advance to close and show Pending Fleek QC.
7. Replay and run the £710 alternate path to show the rival lead at £700.
8. Reset and demonstrate Buy Now closing immediately at £760.

## 20. Questions to validate with Fleek after the prototype

- Where should Auction House sit relative to existing marketplace and Demand Hub flows?
- Which suppliers and lot types should be eligible for auction?
- Can Fleek provide completed-sale data for market guidance, and at what aggregation level?
- What seller values may be private, and who inside Fleek may access them?
- How should payment authorization, buyer credit, cancellation, and non-payment work?
- At what point does Fleek QC occur, and when is a sale considered binding?
- Which real-time events or marketplace APIs could a production version consume?
- Are proxy bidding and Buy Now compatible with current marketplace policies and terms?
