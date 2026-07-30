---
title: Project Sounding Line Performance Budget Report
audience: engineering
status: current
last_reviewed: 2026-07-30
---

# Project Sounding Line Performance Budget Report

The authoritative mainline receipt dated 2026-07-30 completed 27 required
families with `RELEASE_GO`. Every receipt recorded a clean cleanup state and
no timeout. Notable elapsed times were static core 56,876 ms, the isolated
access sentinel 119,890 ms, production build 73,897 ms, player-shell component
45,505 ms, and private-content unit 15,099 ms.

Hard budgets are enforced by the governed adapter timeout, not merely reported.
The static family budget was raised from an unverified 60 seconds to an
empirical 120 seconds after its observed cold validation. The access sentinel
has a 600-second hard budget to include fresh isolated-runtime creation; its
test command itself remains a three-test fast sentinel. Broad browser matrices
are not represented as mainline performance passes.

The source of truth is
`artifacts/sounding-line/mainline-authoritative-final.json`, plan digest
`ea07b1f3b4ffb8fec0d40d168bf5da60091a362368bc371563f4826b96bee91e`, and
final evidence digest
`a68bf1c7d135af6ae35959f0c96f90dd77e5a72a65fca24615c039f33fc74682`.
