---
title: Linked identities
audience: product-users
status: current
canonical_for: linked-identities
last_reviewed: 2026-08-07
---

# Linked identities

Google and GitHub use the same canonical account, session, and linked-identity
lifecycle as password authentication. You can create an account with either
provider, return through the same provider, or sign in first and explicitly
connect a provider from **Linked Identities**. Safe summaries never expose
provider account IDs or tokens, and provider access tokens are discarded after
identity verification.

Voyagewright never merges accounts merely because a provider returns an email
already used by a password account. Sign in with the existing method and then
connect the provider deliberately. Unlinking cannot remove the last usable
sign-in method. A provider-only account may use a recent provider-authenticated
session for the unlink reauthentication boundary; a password account must
confirm its password.

Google and GitHub are available on main through protected PR #10, but are not
deployed. The owner reports both providers working in development; redacted
database inspection independently confirmed Google persistence while GitHub
persistence remains owner-observed. Local automated proof uses an explicit
non-production simulator and is not by itself a live-provider claim. Discord,
Steam, and Microsoft/Xbox remain compatibility provider adapters with truthful
configuration-required states.

## Phase 7 correction Round 1 status

The owner returned walkthrough Round 1 for correction. The corrected capability has completed local automated validation and is awaiting owner re-review; it is not yet included in a published release. Live email delivery and Discord, Steam, and Microsoft/Xbox connections still depend on separately configured services. Automated accessibility coverage does not replace testing with physical assistive technology.
