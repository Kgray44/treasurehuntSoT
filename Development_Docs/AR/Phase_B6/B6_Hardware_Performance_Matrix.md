# Phase B-6 hardware and performance matrix

## Observed local system

| Area                    | Observed result                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| Computer                | GIGABYTE AERO X16 1WH                                                                              |
| OS                      | Windows 11 Home 10.0.26200, build 26200                                                            |
| CPU                     | AMD Ryzen AI 7 350 with Radeon 860M, 16 logical processors                                         |
| Memory                  | 33,413,779,456 bytes                                                                               |
| GPUs detected           | NVIDIA GeForce RTX 5070 Laptop GPU driver 32.0.16.1047; AMD Radeon Graphics driver 32.0.31021.5001 |
| Logical desktop         | One 2048 × 1280, 32-bit display reported through WinForms                                          |
| Active vision provider  | `CPU_CLASSICAL`                                                                                    |
| GPU vision provider     | Not active and not measured                                                                        |
| Release replay          | p50 44 ms, p95 56 ms, p99/max 61 ms; excludes capture and game impact                              |
| Bounded soak            | 15 builds, 250 scans, 0 system errors; p95 53 ms; RSS growth 257,368,064 bytes                     |
| Native packaged capture | 14 frames captured, 9 selected, `EVIDENCE_CAPTURED`, transient frames cleared                      |

## Required but unobserved rows

| Configuration                                                        | Status                               |
| -------------------------------------------------------------------- | ------------------------------------ |
| Integrated-GPU-only Windows system                                   | BLOCKED — unavailable                |
| Discrete NVIDIA and AMD active providers                             | BLOCKED — detection is not execution |
| CPU-only minimum-spec system                                         | BLOCKED — unavailable                |
| 1080p, 1440p, 4K, ultrawide, HDR, multi-monitor                      | BLOCKED — field matrix not run       |
| Windowed, borderless, exclusive fullscreen                           | BLOCKED — Sea of Thieves not run     |
| Low/medium/high/ultra game settings and FOV range                    | BLOCKED — not run                    |
| Game FPS/frame-time, GPU utilization/VRAM, CPU utilization, thermals | BLOCKED — not measured               |
| Multi-hour play, repeated capture, sleep/resume, display/GPU change  | BLOCKED — not run                    |

Capability diagnostics distinguish detected adapters from the active provider and report fallback use. No mandatory verification gate is disabled on lower hardware. B6-006 remains open.
