---
title: Email verification
audience: product-users
status: current
canonical_for: email-verification
last_reviewed: 2026-08-06
---

# Email verification

After registration, Voyagewright asks for the six-digit code sent to the submitted address. The code expires, can be used once, and is replaced when a new code is sent. A short cooldown protects resend. Incorrect, expired, unavailable, and successful states remain distinct; change the address from the verification screen if it was entered incorrectly.

Round 3 automated walkthroughs use a task-owned synthetic inbox. Real delivery
uses the selected Resend adapter and requires a verified Resend sending domain,
server-only API key, provider acceptance, and receipt in a real inbox.

A verification code is required after new registration, but it is not an
ordinary returning sign-in factor. An existing account with valid active
credentials may sign in while its primary email is unverified. The signed-in
experience shows a non-blocking verification notice with resend and governed
email-change actions; only operations whose policy genuinely requires a
verified email remain restricted.

If delivery fails after account creation, the account remains one truthful
pending account. Use Retry sending, Change email, Sign in, or the displayed
recovery guidance; retrying does not create another account.

These instructions describe the Round 3 branch. They do not claim deployment or
owner acceptance.
