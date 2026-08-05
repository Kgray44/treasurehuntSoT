---
title: Project Homeport Linked Identity Provider Contract
audience: product-engineering
status: current
canonical_for: project-homeport-linked-identity-provider-contract
last_reviewed: 2026-08-04
---

# Linked identity provider contract

Discord, Steam, and Microsoft/Xbox share one adapter interface for availability, authorization start, callback validation,
safe identity projection, collision handling, and disconnect. Implementations must be verified against current official
provider documentation before protocol code is accepted.

Adapters enforce provider state and CSRF validation; PKCE and nonce where the provider supports or requires them; bounded
redirect URIs; account-link confirmation; reauthentication to unlink; last-credential protection; minimal provider-subject
storage; encrypted tokens only when downstream API access truly requires them; and security audit events. Client DTOs may
contain only provider family, safe display, linked date, visibility/sign-in policy, availability, and permitted actions.
They exclude raw subjects, scopes, tokens, callback payloads, and provider errors.

Unconfigured providers render a truthful unavailable state. Automated proof may use task-owned synthetic adapters but is
not live provider proof.
