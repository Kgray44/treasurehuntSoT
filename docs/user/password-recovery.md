---
title: Password recovery
audience: product-users
status: current
canonical_for: password-recovery
last_reviewed: 2026-08-05
---

# Password recovery

Use **Forgot password** from Sign In. Voyagewright returns the same safe response whether or not the address is registered, then dispatches a single-use recovery message through the governed transactional-email provider. Expired or already-used recovery links must be requested again. If delivery is unavailable, no success claim implies that an external message was accepted.

These instructions describe the Round 3 branch. They do not claim mainline availability, deployment, live Postmark delivery, owner acceptance, broad Light Mode completion, production MySQL proof, or physical assistive-technology validation.
