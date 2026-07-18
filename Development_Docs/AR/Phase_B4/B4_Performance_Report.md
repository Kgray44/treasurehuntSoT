# Phase B-4 Performance Report

## Test host

- OS: Windows 11 Home, build 10.0.26200, x64.
- CPU: AMD Ryzen AI 7 350 with Radeon 860M, 8 cores / 16 logical processors.
- RAM: 33,413,779,456 bytes (about 31.1 GiB).
- Discrete GPU: NVIDIA GeForce RTX 5070 Laptop GPU, driver 32.0.16.1047; WMI-reported adapter RAM 4,293,918,720 bytes.
- Integrated GPU: AMD Radeon Graphics, driver 32.0.31021.5001.
- Node.js: v24.18.0.

## Provider truth

`CPU_CLASSICAL` is the only active inference provider. CUDA and DirectML are detected-only inventory entries. No GPU backend, GPU inference test, VRAM measurement, or acceleration claim exists.

## Synthetic replay measurements

Command:

```powershell
node scripts/run-vision-b4-replay.cjs --output Development_Docs/AR/Phase_B4/Evidence/synthetic-replay-report.json
```

Observed on 2026-07-18:

- full three-fixture wall time: 1,298 ms;
- process user CPU: 1,422 ms;
- process system CPU: 94 ms;
- RSS at start: 56,426,496 bytes;
- observed peak/final RSS: 142,495,744 bytes;
- observed RSS increase: 86,069,248 bytes;
- builds: 491 ms, 364 ms, and 337 ms;
- positive scans: 69 ms, 50 ms, and 53 ms;
- negative scans: 48 ms, 38 ms, and 38 ms;
- weak-evidence scans: 23 ms, 13 ms, and 14 ms.

These are single-process, warm synthetic measurements. They are not a production percentile study and do not include native capture, WebM decoding, game rendering contention, disk pressure, thermal behavior, GPU activity, or long-session memory stability.

## Operational budgets and controls

Build and runtime operations are bounded, cancellable, and timeout-aware. The service permits one active local build and one armed runtime attempt. Player frames use a bounded memory ring and are zeroized after selection/consumption. Packages declare a memory budget and are loaded per attempt.

## Missing performance gate evidence

- cold and warm distributions across real packages;
- p50/p95/p99 native capture-to-result latency;
- CPU utilization and frame-time impact while Sea of Thieves is running;
- integrated/discrete GPU utilization and VRAM impact;
- thermals, power, and throttling under repeated scans/builds;
- long-session leak and package-cache measurements;
- GPU provider correctness and fallback performance.

The combined B-4 CPU/GPU/memory/game-impact exit item therefore remains false.
