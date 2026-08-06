---
title: Email verification
audience: product-users
status: current
canonical_for: email-verification
last_reviewed: 2026-08-05
---

# Email verification

After registration, Voyagewright asks for the six-digit code sent to the submitted address. The code expires, can be used once, and is replaced when a new code is sent. A short cooldown protects resend. Incorrect, expired, unavailable, and successful states remain distinct; change the address from the verification screen if it was entered incorrectly.

Round 3 local walkthroughs use a task-owned synthetic inbox. Real delivery requires configured Postmark sender and templates.

These instructions describe the Round 3 branch. They do not claim mainline availability, deployment, live Postmark delivery, owner acceptance, broad Light Mode completion, production MySQL proof, or physical assistive-technology validation.
