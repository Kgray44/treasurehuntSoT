# Phase B-6 installation and update test matrix

| Scenario                                      | Result                 | Evidence or gap                                                                 |
| --------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| Local x64 NSIS build                          | PASS                   | `npm run desktop:build`; assisted per-user installer produced                   |
| Packaged application launch                   | PASS                   | Embedded Next server loaded title `The Forever Treasure`                        |
| Packaged native capture                       | PASS                   | Dedicated external window selected; 15 captured, 9 selected; raw frames cleared |
| Development signature status                  | PASS as truth boundary | Artifact remains visibly unsigned; not eligible for preview/stable              |
| Manifest signature tamper                     | PASS automated         | Ed25519 metadata tests reject tamper/untrusted scope                            |
| Artifact hash/length mismatch                 | PASS automated         | Release-governance tests reject before staging                                  |
| Interrupted activation                        | PASS automated         | Release-manager startup recovery restores prior version                         |
| Failed health check                           | PASS automated         | Prior version atomically restored                                               |
| Active scan/story                             | PASS automated         | Update is deferred                                                              |
| Corrupt update / unsafe path                  | PASS automated         | Rejected before activation                                                      |
| User projects during rollback                 | PASS automated         | Test store is isolated from application version store                           |
| Fresh clean-machine install                   | NOT RUN                | Separate clean Windows account/machine required                                 |
| Upgrade from 0.7.0-b5 / oldest supported      | NOT RUN                | Signed hosted artifacts required                                                |
| Interrupted download / insufficient disk      | NOT RUN                | Clean-machine publication harness required                                      |
| Non-admin install / multiple Windows accounts | NOT RUN                | Not available in this session                                                   |
| Uninstall preserving data                     | NOT RUN                | NSIS behavior authored; clean-machine observation absent                        |
| Uninstall removing local data                 | NOT RUN                | Explicit installer page authored; clean-machine observation absent              |
| Reinstall and repair                          | NOT RUN                | Clean-machine observation absent                                                |

The installer is per-user, assisted, non-elevating, and allows an install-directory choice. Uninstall defaults to preserving local data and offers an explicit removal choice. The default Electron icon remains the non-blocking B6-011 presentation issue. B6-003 and B6-007 remain blocking because automated store tests and a local unpacked smoke do not substitute for clean-machine install/update/uninstall evidence.
