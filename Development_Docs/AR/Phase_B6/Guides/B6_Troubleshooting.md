# Vision troubleshooting

| Symptom                        | Safe action                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sea of Thieves not found       | Use windowed/borderless mode, reopen Companion targets, and select only the exact game window. Do not disable security tools or inject a helper.                              |
| Capture frozen or black        | Restore/unminimize the selected window, stop the attempt, reselect, and check Companion health. Exclusive fullscreen may need borderless mode.                                |
| Pairing failed                 | Confirm exact origin, local Companion approval, current short code/challenge, and clock; revoke stale pairings. Wildcards are unsupported.                                    |
| GPU unavailable                | Continue only if diagnostics show `CPU_CLASSICAL` active and budgets are acceptable. “Detected” is not “active.”                                                              |
| Scan too dark/bright/blurry    | Improve lighting, face the stable region, stop camera motion, and retry.                                                                                                      |
| Repeated insufficient evidence | Follow guidance, change position/framing, then use Captain recovery; do not relabel as definitely wrong.                                                                      |
| Ambiguous similar place        | Move away from the confuser, use a constrained angle, or keep Captain confirmation.                                                                                           |
| Build reconstruction failed    | Add sharp overlapping coverage and stable texture; remove leakage between build/calibration/locked partitions.                                                                |
| Hard negative too similar      | Add it to governed review, constrain pose/region, and rebuild a new version. Never tune against locked results.                                                               |
| Package incompatible/corrupt   | Keep the pinned published version, reacquire a trusted compatible package, or build a new version. Do not hand-edit the envelope.                                             |
| Offline package missing        | Reconnect; the system must not substitute a different package silently.                                                                                                       |
| Update failed                  | Preserve user data, inspect release state, verify signature/hash/channel, and let startup recovery restore the prior version.                                                 |
| Diagnostic bundle needed       | Export metadata-only diagnostics: versions, hashes, gates, error codes, timings, provider, retention state, and redacted logs. Do not attach frames without explicit consent. |
