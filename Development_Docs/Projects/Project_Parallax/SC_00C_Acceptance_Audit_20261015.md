---
title: SC-00C Spatial Library acceptance audit
audience: product-engineering
status: implementation-in-validation
canonical_for: sc-00c-spatial-library-acceptance-audit
last_reviewed: 2026-10-15
---

# Spatial Library acceptance audit

This audit tracks the 12 required SC-00C journeys against retained evidence. A local pass on the earlier full-inventory Library does not prove the later paged, installed-aware combined candidate. A test or source inspection alone does not prove the rendered journey. Every row remains open until the named behavior is exercised on one exact combined source with screenshots where useful.

| Required journey                                       | Retained evidence so far                                                                                                                                                                              | Combined-candidate proof still needed                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1. Search for a built-in asset                         | The [bridge browser receipt](evidence/sc-00c/20261015-bridge-pass/README.md) searched for Peeking Letter.                                                                                             | Search on paged mode with the real built-in provider.                                                                |
| 2. Preview and insert it                               | The bridge receipt inspected and added Peeking Letter.                                                                                                                                                | Exact combined Library preview and insertion, including the selected result.                                         |
| 3. Find the new asset in the Scene                     | The bridge receipt asserted the Inspector showed the inserted item.                                                                                                                                   | Verify viewport and Scene Graph selection on the combined insertion path.                                            |
| 4. Browse a saved Environment                          | The bridge receipt opened a saved, owner-scoped Environment without changing its definition.                                                                                                          | Paged Environment card, source label, geometry preview and exact read.                                               |
| 5. Inspect associated Scenes                           | The bridge receipt followed the saved Environment's associated Scenes filter.                                                                                                                         | Global paged Scene filter with the canonical SC-01 parent identity.                                                  |
| 6. Open one Scene and return                           | The bridge receipt inspected a Scene but did not prove opening and returning.                                                                                                                         | Canonical open/edit/return journey with Library state restored.                                                      |
| 7. Reuse a saved asset or prefab                       | The [filtered composition rerun](evidence/sc-00c/20261015-composition-rerun/README.md) passed saved composition selection, reuse, reload and rendered playback on the repaired combined Library.      | Repeat on the final SC-07A candidate and prove immediate selection and undo/redo.                                    |
| 8. Rename or duplicate owned content                   | The [legacy action receipt](evidence/sc-00c/20261015-legacy-actions-pass/README.md) checked action visibility without invoking SC-01 callbacks.                                                       | Invoke an eligible rename or duplicate, then verify the canonical stored result.                                     |
| 9. Distinguish private and published Community content | The [paged Library handoff](SC_00C_Paged_Library_Handoff_20261015.md) tests installed read-only presentation and pinned metadata locally.                                                             | Integrate SC-07A reader/publisher, then capture private, published and installed states without false owner actions. |
| 10. Browse a growing catalog responsively              | The [rendered scale observations](evidence/sc-00c/20261015-browser-scale/README.md) measure 1,000 and 2,000 owner Scenes: 48-card pages, far-end search, 96-card Show more and a 390 px phone layout. | Recheck the final SC-07A source and qualify its full Studio bootstrap, which reached about 24 MB for 2,000 Scenes.   |
| 11. Keyboard and responsive layouts                    | The [2,000-Scene browser journey](evidence/sc-00c/20261015-browser-scale/README.md) opened item details by keyboard and resized the Library to 210 and 420 px; the phone stayed within 390 px.        | Recheck final source, keyboard context actions and common layouts.                                                   |
| 12. Preserve saved content after migration             | The [typed legacy projection](SC_00C_Legacy_Working_Projection_20261015.md) and browser receipt check working/release separation on the earlier candidate.                                            | Combined migrated owner records, SC-01 Manager actions, immutable references and no destructive cascade.             |

Cross-cutting acceptance also requires the one-rail layout, five-category provider-aware taxonomy, source-grounded previews, relevant context actions, asset/effect placement, actual favorites/collections behavior, Community license and attribution, and the three canonical Environment creation methods. The SC-00C task brief is the source of these requirements.

Current result: **not accepted**. The combined root has now enabled paged browsing,
connected the installed reader/collector and integrated SC-01's canonical host.
Its first twelve-journey run at `a885b6c3` passed eleven cases, but a Source-filter
transition exposed stale clickable composition cards. Preserve that failed run's original source
and all prior history. The repaired query-bound page passed the [affected focused browser rerun](evidence/sc-00c/20261015-composition-rerun/README.md)
at `9d1c7227`, while the full twelve-journey suite has not been repeated on that source.
The [rendered 2,000-Scene observation](evidence/sc-00c/20261015-browser-scale/README.md)
adds keyboard and panel-width evidence. The 23,990,373-byte full Studio bootstrap
remains a measured limitation. SC-07A publisher/installer integration, full current
Library consumer coverage, coordinated independent review, protected qualification
and owner review remain separate gates.
