---
name: daily-check-in
description: Quick daily status across all brands, done by the Chief of Staff alone without delegating. Use when the owner says good morning, asks "what's going on today", "anything urgent", or wants a fast daily pulse.
---

# Daily check-in

Fast and cheap: the Chief reads the data itself. Do not call the leads.
Compare yesterday with the same weekday last week. Use `org/accounts.md` to pick the right account per brand.

1. **Orders and sales:** yesterday's orders and revenue per store (Starpil and Nova via their team
   connectors, Wax Supply via Shopify). Flag any store down more than 25%.
2. **Customers waiting:** missed calls on the Quo lines (per brand), and open urgent tickets if
   Gorgias is connected to that brand.
3. **Today's calendar:** meetings and deadlines.
4. **Inbox:** threads from customers, suppliers or partners that need the owner, at most five.
5. **Pending approvals:** anything in `org/drafts/` still waiting on the owner.

Output, at most 15 lines:
- **Needs you today** (at most three items, each with a suggested action)
- One line per brand
- Gaps (what couldn't be checked)

Read only. Nothing gets sent or changed.
