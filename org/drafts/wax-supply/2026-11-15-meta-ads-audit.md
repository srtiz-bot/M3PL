# Wax Supply: Meta ads audit

Date: 2026-11-15. Period: last 30 days. Account: "Wax Supply Back Up" (1582710910201479).
Sources: Meta Ads connector (read only), Wax Supply Shopify analytics.

## Answer

Meta ads are working, but less than Meta reports. Meta claims a 5.9x return; counting only
people who clicked an ad, it is about 3.1x, and store referral data suggests it could be as low
as about 1.3x. Whether that is profitable depends on product margin, which is not known yet.

## Evidence

### Campaigns (Meta, last 30 days)

| Campaign | Daily budget | Spent | Purchases (Meta default) | Purchase value | ROAS | Cost per purchase |
|---|---|---|---|---|---|---|
| Euro Clear 10 lb Bulk (EUROBULK) | $80 | $2,470.79 | 96 | $14,478.61 | 5.86 | $25.74 |
| Euro Clear 1 lb Sample | $25 | $131.99 | 7 | $71.75 | 0.54 | $18.86 |

Bulk campaign: 158,268 impressions, reach 34,714, frequency 4.56, CTR 1.29%, $1.60 per link click,
351 adds to cart, 294 checkouts.

### How much of the bulk campaign's credit is real

The bulk campaign counts a sale if someone clicked within 7 days or only saw the ad within 1 day.

| Counting method | Purchases | Cost per purchase |
|---|---|---|
| Meta default (7-day click + 1-day view) | 96 | $25.74 |
| Clicked within 7 days | 51 | $48.45 |
| Clicked within 1 day | 44 | $56.15 |
| Only viewed (within 1 day) | 45 | $54.91 |

Nearly half the credited sales come from people who only saw the ad.

Estimated click-only return (my calculation): 51 purchases x $150.82 average Meta-reported order
value = about $7,700, divided by $2,471 spend = about 3.1x.

### Cross-check with the store (Shopify, last 30 days)

- Whole store: 197 orders, $22,239.72 total sales, $108 average order. Previous 30 days:
  279 orders, $29,794.81. Store revenue is down 25%.
- Orders by referrer: direct/unknown 75 ($7,983), Google search 51 ($7,610), waxsupply 27 ($2,673),
  Facebook 23 ($1,886), Instagram 9 + 4 ($1,444).
- Facebook + Instagram referred orders: 36 orders, about $3,330. Against $2,603 Meta spend that is
  about 1.3x (my calculation). This undercounts Meta, because people who click an ad and come back
  later through Google or by typing the address show up under those sources.
- Euro Clear (the advertised product) sold $14,541 across 97 orders. Meta's claimed $14,479
  equals essentially all Euro Clear sales, which is not plausible on its own.
- Samples are a large funnel: 45 Ultra Black sample orders and 22 Euro Clear sample orders.

### Ads (Meta, last 30 days)

| Ad | Status | Spent | Purchases | ROAS | Cost per purchase | Frequency | Trend (Meta, last ~6 days) |
|---|---|---|---|---|---|---|---|
| A: Stop buying wax by the baggie | Active | $1,757 | 68 | 6.31 | $25.84 | 3.41 | ROAS down ~80%, CTR up |
| B: The math only works in bulk | Active | $388 | 18 | 5.87 | $21.56 | 3.49 | Improving on every metric |
| B9: The math only works in bulk (Stories/Reels) | Paused | $326 | 10 | 3.42 | $32.56 | 3.22 | |
| Sample: Melted Wax V2 | Active | $118 | 7 | 0.61 | $16.84 | 1.55 | CTR up |
| Sample: Sample Bag V2 | Active | $9.72 | 0 | n/a | n/a | 1.25 | |

### Meta's own context

- Industry benchmark: both ad sets' cost per purchase is 65% to 74% below similar advertisers.
  This uses Meta's default counting, so treat it as optimistic.
- Opportunity score: 86/100. Top suggestions: scale the bulk campaign; add vertical 9:16 video
  with audio for Reels (about 4% lower cost per purchase); mix video and image ads; "maximize
  value" goal (about 7% higher ROAS).

## Needs approval

Nothing in this audit changes the account. Proposed actions, for the owner to approve:

1. Hold the bulk campaign at $80/day until the margin is known, then decide on scaling against the
   click-only numbers. Expected effect: avoids scaling on inflated credit. Risk: none.
2. Brief the video producer for two new 9:16 Reels ads for the bulk offer, to refresh ad A
   (frequency 3.4, ROAS falling). New ads launch paused. Risk: production time only.
3. Keep the sample campaign at $25/day, and judge it by how many sample buyers later buy bulk,
   not by its own ROAS. Requires a customer-level Shopify check (read only).

## Gaps

- Product margin and break-even ROAS for Euro Clear 10 lb: unknown.
- Sample-to-bulk conversion: not yet measured.
- Google Ads (customer 4640153286) not audited yet; Google search is the store's second-largest
  order source.
- The main Wax Supply ad account (359087615546469) is disabled by Meta; all Meta spend now runs
  on the backup account.
- Why store revenue fell 25% is not explained by this audit.
