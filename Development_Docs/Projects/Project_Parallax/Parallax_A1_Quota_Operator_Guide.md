---
title: Parallax A1 AI quota operator guide
audience: administrator
status: implementation-candidate
canonical_for: parallax-a1-quota-operator-guide
last_reviewed: 2026-10-11
---

# AI resource control

The A1 candidate adds **AI Usage & Quotas** to Admiralty. Deploying its additive
database migrations is required before those views can query their new tables.
Integrated browser checks pass; final ordinary qualification and owner review
remain pending.

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
