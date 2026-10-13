---
title: Parallax A1 AI quota operator guide
audience: administrator
status: current
canonical_for: parallax-a1-quota-operator-guide
last_reviewed: 2026-10-13
---

# AI resource control

Parallax A1 adds **AI Usage & Quotas** to Admiralty. Deploying its additive
database migrations is required before those views can query their new tables.
Integrated browser, ordinary software qualification and landed smoke pass.
Owner visual review remains pending.

Use **Overview** to inspect monthly accounted spending, settled spending,
remaining global budget, requests, active Creators, daily spending and outcomes.
Accounted spending includes reservations and unresolved provider usage. A
configured credential does not establish upstream availability.

Use **Global Policy** to review enablement, standard/advanced models and reasoning,
global and default user allowances, rate/concurrency limits, input/output bounds,
request exposure, timeout and proposal retention. Initial assistance and advanced
access are disabled. Defaults include 500 requests per user and a $10 global
monthly spending cap. Only supported models and bounded values are accepted.
Emergency disable stops new requests without erasing usage.

GPT-6 Astra is available as an explicitly allowed, priced model for bounded
evaluation. It is absent from the initial allowlist and does not replace Luna
or Sol defaults. Allowing it requires compatible request and monthly exposure
limits. Provider timeout accepts up to 180,000 milliseconds for slower vision
requests; the initial 20,000-millisecond timeout is unchanged. A timeout still
retains unresolved provider exposure rather than assuming zero charge.

## Global settings and consequences

The overview's daily chart can show **Requests**, **Settled cost**, or **Accounted
spending**. Today and daily averages use the same ledger projection, including
zero-activity elapsed days. Labels identify UTC request days and US dollars.
Settled cost is known billed usage; accounted spending also includes active
reservations and unresolved exposure. A cost settling later remains associated
with its request day. Expand the daily activity table for exact requests, settled
cost, reservations and unresolved spending. The table scrolls on narrow screens
and is keyboard accessible. Choosing a metric sends no provider request and
changes no limits.

Use the existing **People** search to open a user's account dossier and inspect
or change their AI allowances there. There is no second AI-specific user search.

Amounts in the form are US dollars. Request allowances reset at the start of
the UTC calendar month; changing a limit never clears consumption already
recorded for that period. The defaults below apply to a newly initialized policy,
not necessarily to an administrator's current saved policy.

In-flight, settled and unresolved requests consume allowance. A known unbilled
failure releases its reservation and request allowance while retaining its safe
history entry. A billed clarification, unsupported proposal or invalid response
still consumes usage even though no scene edit was applied. Replaying the same
accepted request identity does not consume a second allowance.

| Setting                         | Initial value       | Effect of changing it                                                                                                                                                                                           |
| ------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assistance enabled              | Off                 | Allows new requests only when a server credential and all other gates are satisfied. Turning it off stops new admissions without deleting history or cancelling already dispatched usage.                       |
| Provider                        | OpenAI              | Fixed server adapter; administrators cannot substitute an arbitrary upstream URL or browser credential.                                                                                                         |
| Standard model                  | GPT-6 Luna          | Selects the model for ordinary assistance, within the allowed-model list. A more expensive selection requires enough budget and maximum request exposure for its conservative reservation.                      |
| Advanced model                  | GPT-6.1 Sol         | Selects the model for deliberate advanced requests, subject to both global enablement and the account's eligibility.                                                                                            |
| Advanced access enabled         | Off                 | Makes advanced mode available only to accounts explicitly eligible for it. Enabling this alone does not grant every user advanced access.                                                                       |
| Standard / advanced reasoning   | Low / Low           | Chooses low or medium reasoning for the corresponding mode. Medium can increase latency and billed output; token and spending ceilings still apply.                                                             |
| Allowed models                  | Luna and Sol        | Restricts selectable and dispatchable model identities. The selected standard model and any enabled advanced model must remain allowed.                                                                         |
| Global spending cap             | $10 per month       | Hard local admission ceiling across this database. Settled charges, in-flight reservations and unresolved usage all consume capacity. A request must fit its complete reservation, even if some budget remains. |
| Spending warning                | $5                  | Shows an informational warning when accounted spending reaches the threshold. It does not stop requests and cannot exceed the global cap.                                                                       |
| Global requests per month       | 10,000              | Caps admitted requests across all users in this database, separately from dollars. Zero prevents new requests.                                                                                                  |
| Default user requests per month | 500                 | Supplies the inherited individual allowance, bounded by the global request ceiling. A dossier exception can replace this default without resetting usage.                                                       |
| Default user spending cap       | Blank               | Blank inherits the global dollar cap for each account. A value establishes an inherited personal cap; the global cap always remains authoritative.                                                              |
| Maximum request exposure        | $0.10               | Rejects a request before dispatch if its worst-case reservation exceeds this amount. This is a safety ceiling, not a flat fee; final known usage settles at pinned pricing.                                     |
| User requests per minute        | 10                  | Sets the platform ceiling for an account's short-term admissions. Individual overrides may tighten it but cannot exceed it.                                                                                     |
| Global requests per minute      | 60                  | Limits short-term admissions across this database. The platform user rate cannot exceed this rate.                                                                                                              |
| Concurrent requests per user    | 1                   | Bounds simultaneously active requests for one account. Increasing it permits more overlapping exposure; the global concurrency limit still applies.                                                             |
| Global concurrent requests      | 3                   | Bounds active requests across all accounts. It must be at least the per-user concurrency value.                                                                                                                 |
| Maximum input tokens            | 12,000              | Bounds the conservative request context, including schema, instructions and framing. Larger requests are rejected rather than silently clipped. Raising it also increases the reserved dollar exposure.         |
| Maximum output tokens           | 4,000               | Caps provider output and increases the reservation when raised. Too small a limit can produce incomplete output that cannot become an actionable proposal.                                                      |
| Provider timeout                | 20,000 milliseconds | Bounds waiting for an upstream response. A timeout preserves the scene but does not prove the provider billed nothing; uncertain usage retains conservative exposure.                                           |
| Private proposal retention      | 30 days             | Sets expiry for newly retained private task/proposal results. Expired results cannot authorize Apply or provide follow-up context. It does not erase the separate historical usage or policy audit.             |

Raising token limits or changing models may make a request exceed the maximum
request exposure even when monthly money and request allowances remain. The
reviewed policy must keep these controls compatible. Limits apply to new
admissions; lowering a cap does not refund earlier requests or rewrite their
pinned pricing. Existing exposure can therefore exceed a newly reduced cap,
preventing further admissions until capacity is available. The safe defaults
above reserve at most $0.0047 for Luna or $0.094 for Sol per request.

## Individual settings and inheritance

Find a user through Admiralty's existing **People** search and open the account
dossier. **AI usage & quotas** shows inherited or overridden policy, used and
remaining requests, accounted/settled spending, reset time and activity. Edit
monthly allowance, personal spending allowance, rate, advanced eligibility,
suspension and optional expiry there. Blank values inherit the platform default;
**Restore inherited policy** removes the exception through a new revision.
Global safety ceilings always remain authoritative. Raising an allowance does
not reset consumption. Expired exceptions inherit defaults; UTC month rollover
preserves historical usage. Configuration observation and account observation
are required for this section; configuration operation is required to change it.

| Account setting      | Inherited behavior                                         | Effect of an exception                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monthly requests     | Platform default user allowance                            | Replaces that default for this account, bounded by the global request ceiling. A value below already-used requests blocks new assistance; raising it preserves the existing count. |
| Monthly spending cap | Default user cap, or global cap when that default is blank | Sets a personal accounted-dollar ceiling, always bounded by the global cap. Settled and unresolved exposure continue to count.                                                     |
| Requests per minute  | Platform user rate                                         | Can reduce the rate or restore it up to the platform user/global ceiling. It does not bypass concurrency limits.                                                                   |
| Advanced eligibility | Not granted                                                | Explicitly allows advanced mode only while global advanced access is enabled. Removing eligibility stops new advanced requests without rewriting prior usage.                      |
| Suspended            | No                                                         | Stops new requests for this account. Reenabling preserves prior consumption and still requires the other admission gates.                                                          |
| Expiry               | No expiry                                                  | Sets when the entire exception stops being effective and platform defaults resume. It does not clear usage or audit history.                                                       |

For example, an account that has used 450 of its inherited 500 requests has
50 left. An approved exception of 750 gives it 300 left, provided global capacity
remains. Reducing its allowance to 400 blocks new requests without deleting the
450 already recorded. Restoring inheritance returns it to the current platform
default, rather than to an old saved default.

## Reviewed changes and historical spending

Every change needs a reason, an exact current/proposed preview, recent privileged
assurance, explicit confirmation and a durable audit receipt. Editing the form,
changing the policy revision or changing operator session invalidates the
preview. Restore previous values through a new reviewed revision. An unexpected
provider charge beyond reserved exposure disables assistance automatically and
records a system policy revision.

**Usage History** shows bounded safe metadata, never request text or retained
proposals. The account dossier scopes history/export to that identity. The global
console shows platform history. Select a UTC range up to one year; the view is
bounded to 100 records and export to 1,000. **Provider Health** shows configured
status, last successful invocation, safe failure category, unknown-usage count
and pinned standard pricing. Credential values are never returned.

Configure the local server using the [shared Windows user environment
guide](Parallax_A1_Local_OpenAI_Configuration.md). Local quotas bound admitted
application exposure; they are not an OpenAI account-wide invoice cap and cannot
control unrelated processes using the same credential. Review provider-side
account controls separately, including the [enforced project/organization spend
limits](https://developers.openai.com/api/docs/guides/spend-limits) when multiple
worktrees share a credential across independent databases. A local warning is informational; reservations
against the local hard cap fail closed. Do not release unresolved usage as zero
merely because a connection timed out.

In the OpenAI API Platform, open the relevant organization or project **Limits**
page, choose **Spend → Edit spend limit**, enter the monthly amount, enable
**Enforce a hard limit**, and save. Alerts alone do not stop requests. Provider
enforcement can lag and allow a small overshoot; the local ledger still reserves
conservative exposure before dispatch. These provider controls are separate from
Voyagewright's reviewed policy and apply to other processes using that project.
