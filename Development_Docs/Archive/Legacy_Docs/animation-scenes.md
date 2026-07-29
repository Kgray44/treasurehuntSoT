# Scene catalog

All scene names are typed by `AnimationSceneName` and registered exactly once in `scene-registry.ts`. Server-backed scenes may define opening, waiting idle, success, and failure branches. Local presentation scenes omit the server operation but use the same controls and cleanup.

| Scene                    | Purpose                                                | Principal labels                                                                                 | Reversible |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------- |
| `first-arrival`          | Moonlit harbor prologue and invitation reveal          | dark-sea, moonrise, title, invitation, content-readable                                          | No         |
| `session-reentry`        | Short return to the invitation                         | horizon, invitation, content-readable                                                            | No         |
| `player-access`          | Listen at seal while access is checked; open or reject | listening, await-server, seal-released/lock-rejected                                             | No         |
| `quartermaster-login`    | Key, bolt, and cabin-door sign-in                      | key-turning, await-server, content-readable/lock-rejected                                        | No         |
| `journal-open`           | Clasp and cover opening                                | clasp-awakens, physical-open, content-readable                                                   | No         |
| `manual-page-flip`       | Showcase/manual page turn wrapper                      | physical-open                                                                                    | No         |
| `programmatic-page-flip` | Showcase/programmatic page turn wrapper                | physical-open                                                                                    | No         |
| `chapter-heading`        | Focus a released chapter heading                       | attention, ink-heading                                                                           | No         |
| `prose-ink`              | Reveal story text by masked lines                      | attention, ink-story                                                                             | No         |
| `seal-break`             | Focused seal-to-parchment transition                   | attention, seal, parchment                                                                       | No         |
| `chapter-release`        | Complete omen-to-active chapter ceremony               | omen, attention, seal, parchment, ink-heading, ink-story, ink-objective, ink-riddle, map, active | No         |
| `map-reveal`             | Part fog, stamp location, reveal route                 | fog-gathering, fog-parting, marker-stamp                                                         | Yes        |
| `route-draw`             | Draw a released chart path                             | route-drawing                                                                                    | Yes        |
| `marker-stamp`           | Stamp a new chart marker                               | marker-stamp                                                                                     | No         |
| `ship-course`            | Move ship token along an authored path                 | ship-underway                                                                                    | Yes        |
| `artifact-award`         | Silhouette, light sweep, and relic placement           | velvet-darkening, silhouette, light-sweep, artifact-settled                                      | No         |
| `artifact-inspection`    | Reveal engraving/detail in the dialog                  | engraving-reveal                                                                                 | No         |
| `artifact-connection`    | Draw a relationship between relics                     | connection-drawing                                                                               | Yes        |
| `quest-discovery`        | Unfold note and connect red thread                     | note-unfolds                                                                                     | No         |
| `quest-complete`         | Apply physical completion stamp                        | completion-stamp                                                                                 | No         |
| `log-entry`              | Write date/text and stamp symbol                       | date-written                                                                                     | No         |
| `finale-tease`           | Wake rings without unlocking content                   | fog-gathering, mechanism-wakes, core-sealed                                                      | No         |
| `finale-requirement`     | Illuminate one safe symbolic requirement               | requirement-activates                                                                            | Yes        |
| `prepare-chapter`        | GM ready-state instrument response                     | command-armed, await-server, command-confirmed                                                   | No         |
| `mark-solved`            | GM solved-state confirmation                           | command-armed, await-server, command-confirmed                                                   | No         |
| `pause`                  | Bring campaign instruments to rest                     | command-armed, await-server, campaign-paused                                                     | No         |
| `resume`                 | Restore campaign instruments                           | command-armed, await-server, campaign-underway                                                   | No         |
| `undo`                   | Rewind the most recent durable projection              | command-armed, await-server, state-restored                                                      | No         |

New scenes belong in `src/animation/scenes`, should use the shared duration/distance helpers, must expose semantic labels for debugging and accessibility testing, and must be registered and added to the showcase before use in product UI.
