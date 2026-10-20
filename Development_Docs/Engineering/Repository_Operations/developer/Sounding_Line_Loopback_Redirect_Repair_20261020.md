---
title: Sounding Line owned HTTP redirect repair
audience: engineering
status: current
canonical_for: sounding-line-owned-http-redirect-repair-20261020
last_reviewed: 2026-10-20
---

# Owned HTTP redirect repair

Sextant's issued-invitation development run39369898967 reached the real second
issued link in all four variants. Each307 left the browser origin, the destination
had no applicable pending-invitation cookie, and resolution returned404. The
original failure and encrypted diagnostics remain in PR709. This separate
canonical runtime correction starts from accepted main
`40491dd68ace88ee033b53fd264ddbfe303c6d28`.

The focused real HTTP regression reproduces the cause with synthetic data: the
owned proxy forwards a backend absolute `localhost` redirect unchanged, although
its host-only cookie was received at the browser's `127.0.0.1` origin. The original
red result is retained alongside the repaired result in the
[source-bound local evidence](../evidence/20261020-loopback-redirect/local-evidence.json).

The existing nonce-gated HTTP adapter now translates only absolute HTTP or
protocol-relative redirects to its exact owned backend port on `localhost`,
`127.0.0.1` or `[::1]`. The destination uses the configured browser proxy origin;
incoming Host and forwarded headers cannot choose it. Paths, query parameters
and fragments survive. Relative redirects, external destinations, other ports,
other protocols, user information and invalid URLs pass through unchanged.
Cookie adaptation and the existing isolation/production-identity/nonce guard
retain their prior behavior. Product routes, session and invitation authorities
are unchanged.

The real HTTP test covers13 redirect cases, unchanged cookie attributes, backend
Host and adversarial incoming host headers. Both it and the existing nonce-guard
test pass. Proxy cleanup passes and its port is reclaimed. The broader local
ordinary/browser-diagnostics run reports152 passing and13 failing cases; all13
fail again in an exact accepted-main archive on the same Windows host. Those
original failures remain failures, including POSIX path assumptions and denied
symlink creation. They are not a passing suite or a waiver for protected Linux
qualification.

Independent source review, protected verification and landed-tree smoke are
required before installation. This record alone does not establish browser
cookie transmission, a complete invitation merge, Landfall return behavior,
Darwin process containment, formal experience binding, native or owner acceptance.
No completed feature-catalog capability changes.
