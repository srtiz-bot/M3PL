# Wax Supply: Meta ads, Google Ads and site audit

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

---

# Addendum: Google Ads, site behaviour and stock (same day)

Sources: Google Ads connector, customer 4640153286 (read only); Microsoft Clarity "waxsupply";
Shopify inventory. Google period: 2026-10-16 to 2026-11-14.

## Answer

Two problems matter more than ad settings:

1. **Stock.** Most Euro Clear sizes are sold out, and site visitors keep tapping them. The 10 lb
   bag, which the Meta bulk campaign sells, has 37 units left after selling 70 in 30 days: about
   16 days of stock at that pace (my calculation).
2. **Google's main campaign stopped.** The Performance Max campaign that drove most Google
   revenue declined from late October and is now paused. Its replacement runs at $25/day instead
   of $80/day. Together with the stock-outs, this likely explains much of the 25% sales drop.
   That is a hypothesis; the data shows timing, not cause.

## Google Ads campaigns (2026-10-16 to 2026-11-14)

| Campaign | Type | Status | Daily budget | Spent | Conversions | Value | Return |
|---|---|---|---|---|---|---|---|
| Sales, Performance Max, New Creatives (30 Jan 2026) | PMax | Paused | $80 | $1,031.23 | 34.3 | $4,142.52 | 4.0x |
| Wax supply Branded campaign (25 Feb 2026) | Search | Enabled | $40 | $486.95 | 35.7 | $4,426.75 | 9.1x |
| PMax, Bulk Inventory Test | PMax | Enabled | $25 | $158.16 | 1 | $232.50 | 1.5x |

Returns are my calculation (value / spend), using Google's own conversion counting.

PMax New Creatives, weekly conversion value: Sep 28 week $2,884; Oct 5 $1,884; Oct 12 $1,493;
Oct 19 $2,795; Oct 26 $595; Nov 2 $372; Nov 9 $0 (paused). Spend stayed about $275 to $470 a week
until it was paused.

Branded campaign: 155 of 182 clicks are the exact search "wax supply". It shows for only 44% of
eligible searches, losing 56% on ad rank (not budget). Brand searchers often buy anyway, so its
9.1x overstates what it adds.

Conversion setup: Google reports 2,340 "all conversions" for PMax against 34 primary conversions.
Secondary actions (probably page views or similar) are being counted. Worth checking that only
purchases are used for bidding.

## Site behaviour (Clarity, mobile, last 7 days, 10 recordings touching the Euro Clear bulk page)

- 50 dead clicks and 7 rage clicks across the 10 sessions.
- Most-tapped dead targets: the price-per-pound label "$10.10 / lb" (12), "Sold out" (9),
  other per-pound prices, and sold-out sizes "2.2 lb", "11 lb", "22 lb".
- Reading: shoppers try to pick larger sizes, find them sold out, and tap the price labels
  expecting them to select a size.

## Euro Clear stock (Shopify, now)

| Variant | In stock | Sold last 30 days |
|---|---|---|
| 1 lb sample | 82 | 22 |
| 1 lb bag | 82 | 5 |
| 10 lb bulk bag | 37 | 70 |
| 2.2 lb bag | 0 | 13 |
| 11 lb (5 bags) | 0 | 6 |
| 22 lb (10 bags) | 0 | 8 |
| 44 lb, 66 lb, 99 lb | 0 | 2 each |

An older duplicate listing ("(Bulk) TT") also exists, with its own 10 lb (27 units) and sold-out sizes.

## Needs approval (addendum)

4. Restock Euro Clear, or hide sold-out sizes and point buyers to the 10 lb bag. Owner/ops decision.
5. Before scaling any Euro Clear ads, confirm the reorder date for the 10 lb bag; if stock will
   run out, cap Meta spend rather than paying for clicks to a sold-out page.
6. Decide on Google non-brand: either re-enable PMax New Creatives (4.0x over the period, but
   falling) once stock is back, or keep the $25/day test. Resuming would launch at the old $80/day.
7. Make the size options on the product page clearly tappable and show sold-out sizes as
   unavailable (theme change, needs approval).

## Gaps (addendum)

- Why PMax declined from late October (stock, feed disapprovals or creative) is not confirmed.
- Who paused PMax and when exactly: change history not yet read.
- Only 10 recordings reviewed.
