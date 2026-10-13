---
title: Two-photo environment and twenty-message scene cost estimate
audience: product-engineering
status: planning-estimate
canonical_for: parallax-scene-api-cost-estimate
last_reviewed: 2026-10-13
---

# Two photos and twenty Spatial Assistant messages

Estimated OpenAI API cost is **USD0.01–0.03 using Luna throughout**.
A possible hybrid using Sol for photo reconstruction and Luna for twenty edits
is **USD0.05–0.07**. Allow USD0.05 or USD0.10 respectively for ordinary corrections.
The hybrid is a planning option, not an accepted model-routing or reconstruction-quality result.

## Assumptions and breakdown

One reconstruction sends both photographs together. Each of twenty messages
produces one proposal. Assistant edits use bounded semantic room/scene context;
they do not resend the photographs. Assume 3,000–6,000 input tokens and
300–900 billed output tokens per edit, with low reasoning. Billed output
already includes reasoning tokens. The range assumes input at the full
cache-write rate, without depending on cache hits. These are planning token
assumptions for a furnished scene, not a measured twenty-message journey.

| Component                          | Luna throughout | Sol reconstruction, Luna edits | Sol throughout |
| ---------------------------------- | --------------: | -----------------------------: | -------------: |
| One two-photo reconstruction       | $0.0015–$0.0020 |                   About $0.042 |   About $0.042 |
| Twenty edits                       | $0.0105–$0.0240 |                $0.0105–$0.0240 |    $0.21–$0.48 |
| Estimated total                    |   $0.012–$0.026 |                  $0.053–$0.066 |    $0.25–$0.52 |
| Planning allowance for corrections |           $0.05 |                          $0.10 |          $0.75 |

The photo figures use recorded token usage from initial real-photo generations.
Provider completion and charged token usage did **not** establish successful
room admission: geometry was rejected in those runs. More reconstruction
attempts add cost; a completed, closely matching one/two-photo room journey
is still unqualified. Recent Sol timeouts have unknown billing and remain
conservatively reserved in task accounting. Do not count them as successful
reconstruction or an exactly settled provider charge.

Earlier compact synthetic text-edit studies were cheaper than the furnished-scene
allowance above. Their historical ledger amounts use the older conservative
pricing revision and remain original evidence, rather than being relabeled
exact OpenAI invoices.

## Pricing and calculation

Standard short-context rates checked on 2026-10-13, per million tokens:

| Model       | Ordinary input | Cache read | Cache write | Output |
| ----------- | -------------: | ---------: | ----------: | -----: |
| GPT-6 Luna  |          $0.10 |      $0.01 |      $0.125 |  $0.50 |
| GPT-6.1 Sol |          $2.00 |      $0.10 |       $2.50 | $10.00 |

Sources: [Luna pricing](https://developers.openai.com/api/docs/models/gpt-6-luna),
[Sol pricing](https://developers.openai.com/api/docs/models/gpt-6.1-sol), and
[cache accounting](https://developers.openai.com/api/docs/guides/prompt-caching).
Input categories are exclusive: ordinary input equals total input minus cache
reads minus cache writes. Charge each category at its own rate, then add output.
Cache writing is not an additional ordinary-input charge. Images contribute
input tokens; the exact multimodal count endpoint is used before generation.

New reservations use accounting revision `openai-standard-text-2026-10-13-v2`.
Historical reservations retain their pinned arithmetic for idempotent replay;
existing balances and original evidence are not silently rewritten. Reservation
ceilings are controls, not estimates of actual provider charges.

At the current normal limits of 12,000 input and 4,000 output tokens per request,
21 requests have token-cost upper bounds of $0.0735 all-Luna, $0.14 hybrid,
and $1.47 all-Sol, before extra attempts. The development photo study's
8,000-output-token allowance increases those bounds to $0.0755, $0.18 and $1.51
when only the reconstruction receives that larger allowance.

## Scope

These figures cover OpenAI generation usage only, before taxes or provider
account-specific adjustments. Manual editing, local preview, timeline playback
and canonical scene rendering do not generate OpenAI calls. Hosting, storage,
scanning and any future tracking-engine licensing are separate costs; no engine
has been adopted or priced as part of this estimate. The owner's USD5 test
ceiling is separate from estimated future per-scene costs.
