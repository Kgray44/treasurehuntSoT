---
title: "SC-05 Chronicle Architect Exact Visual Reference Asset Manifest"
document_id: VW-SC-ARCHITECT-VISUAL-001
version: "1.0-review-candidate"
date: "2026-10-25"
status: "ORIGINAL_PNG_CUSTODY_VERIFIED_DESIGN_PROPOSED"
program: Spatial Chronicle Creation
repository: Kgray44/treasurehuntSoT
---

# SC-05 Chronicle Architect: Exact Source Image and Visual Acceptance Contract

**Governing image rule:** The Creator supplied ten images. The first two are **the actual required background images**, not image-generation prompts. Do not substitute AI-generated artwork, a vaguely similar gradient, a reconstructed lighthouse, a screenshot of the whole UI, or any newly made replacement for either supplied image. The exact original PNGs were inspected, SHA-256 hashed, and packed byte-for-byte into the companion file SC05_Chronicle_Architect_Visual_References.zip.

**Original binary custody:** All ten original PNGs are included in this draft documentation branch under [visual_references](./visual_references/README.md). Import used `SC05_Chronicle_Architect_Visual_References.zip` from the owner's Downloads folder; its ten PNGs match both the hashes below and the ten extensionless entries in the supplied `Architect-Representative-Images.zip`. Only filenames were normalized; the PNG bytes were copied without decoding, recompression, resizing or regeneration. The two background assets remain separate originals. Documentation custody is verified; production integration, rights clearance for product distribution and visual/functional acceptance remain separate future gates. The owner explicitly requested this repository import; that request does not establish a broader license.

**Documentation asset directory:** [Original PNG gallery](./visual_references/README.md). Production backgrounds may later be copied via the accepted asset pipeline with original exact file custody. Crops/optimized renditions require separately reviewed derivatives, not overwriting originals. No production asset or application code is changed by this documentation import.

## Ten user-supplied source images

| Owner concept label                     | Checked-in original PNG                                                                                              | Dimensions  | SHA-256 of exact supplied bytes                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| Architect Background                    | [architect-home-background.png](./visual_references/architect-home-background.png)                                   | 1672 × 941  | 64d4949a12db6d38a1240c3cbdafff5f6576edec00b6e2a6e9bd65fdfd5dc227 |
| Architect Sidebar Background            | [architect-sidebar-background.png](./visual_references/architect-sidebar-background.png)                             | 941 × 1672  | bda3de2061afa9be629815d4e83ca6187084f1f3bc502594f009655287cf30b9 |
| Architect Home Screen(2)                | [architect-home-screen-concept.png](./visual_references/architect-home-screen-concept.png)                           | 1672 × 941  | c8ec0a3442c117b2a882eca61c9876521df5dc2e23ab4a1c5d590d6ada4dfb59 |
| Architect Chronicle Overview(1)         | [architect-chronicle-overview-concept.png](./visual_references/architect-chronicle-overview-concept.png)             | 1505 × 1045 | 339e0821e645e0f1c5c84c7477736d23cdb63c2aca5e632805712cf78d771eba |
| Architect Storyboard(1)                 | [architect-storyboard-concept.png](./visual_references/architect-storyboard-concept.png)                             | 1505 × 1045 | 41c035ed17fd055b05dd355a233c3729c6444059e67a30658109ccd4a0da5c5a |
| Architect Puzzles(1)                    | [architect-puzzle-composition-concept.png](./visual_references/architect-puzzle-composition-concept.png)             | 1505 × 1045 | 9899a12d61bde718996e7f8f3ff93ff387efe0254f1ca2290c36b34162bece71 |
| Editor - Expanded Architect(1)          | [story-editor-architect-expanded-concept.png](./visual_references/story-editor-architect-expanded-concept.png)       | 1505 × 1045 | bccc33801fcbe288652521587037388cf899503fe014800a849a2cd75dba01c2 |
| Editor - Minimized Architect(1)         | [story-editor-architect-minimized-concept.png](./visual_references/story-editor-architect-minimized-concept.png)     | 1505 × 1045 | fcf43592d2262ff9bc621a393e06a4cac070462239ddfb08bac95504f5ae129d |
| Spatial Studio - Expanded Architect(1)  | [spatial-studio-architect-expanded-concept.png](./visual_references/spatial-studio-architect-expanded-concept.png)   | 1505 × 1045 | ebae0ab6e9ecdd9a65740f9385d7d29790954376788766470ad1331e0da87682 |
| Spatial Studio - Minimized Architect(1) | [spatial-studio-architect-minimized-concept.png](./visual_references/spatial-studio-architect-minimized-concept.png) | 1505 × 1045 | 9a987f0451dd705260072ceb6d6b0575f6cd0d3a1e243a30ae93da8bf1441c18 |

## Exact-byte import record

The table above is the unchanged SHA-256 authority. PNG signatures and dimensions were also checked after extraction. The owner concept labels `Home Screen(2)` and other `(1)` suffixes identify the original conversation concepts; the supplied representative ZIP uses the same names without those suffixes. Hash identity resolves that naming difference. The import totals **19,440,389 original PNG bytes**.

These are Git blob object IDs of the actual original PNG bytes, not Git LFS pointers. The containing commit is recorded in PR #805; retrieve its file history without introducing a self-referential commit hash into this manifest.

| Original PNG                                                                                                         |   Bytes | Git blob (SHA-1 object ID)                 |
| -------------------------------------------------------------------------------------------------------------------- | ------: | ------------------------------------------ |
| [architect-home-background.png](./visual_references/architect-home-background.png)                                   | 2696611 | `6d62b4c2e13faa77cfde26a468d7353028240850` |
| [architect-sidebar-background.png](./visual_references/architect-sidebar-background.png)                             | 2045566 | `25e04da7fee9f810d435bb784801b82796d0e5de` |
| [architect-home-screen-concept.png](./visual_references/architect-home-screen-concept.png)                           | 2172647 | `22c380abf7078dec36c246f2fdf6eb2091d3683c` |
| [architect-chronicle-overview-concept.png](./visual_references/architect-chronicle-overview-concept.png)             | 1999213 | `7a32135e30a2268b8a683e0f9478b463b8259ae7` |
| [architect-storyboard-concept.png](./visual_references/architect-storyboard-concept.png)                             | 2200281 | `174fc175628f24d3b61b2efae36c0d91734e146a` |
| [architect-puzzle-composition-concept.png](./visual_references/architect-puzzle-composition-concept.png)             | 2120026 | `6a4b8851a98078469214e1dc6b9ef22f2b5e637a` |
| [story-editor-architect-expanded-concept.png](./visual_references/story-editor-architect-expanded-concept.png)       | 1636016 | `d05cdd178e3433c37a0356d1346163d7affadea9` |
| [story-editor-architect-minimized-concept.png](./visual_references/story-editor-architect-minimized-concept.png)     | 1489932 | `419199d7408713f72adb63408571205e6a788f56` |
| [spatial-studio-architect-expanded-concept.png](./visual_references/spatial-studio-architect-expanded-concept.png)   | 1593153 | `a556f597ac9cc5ca1808a2de076324e2c4445719` |
| [spatial-studio-architect-minimized-concept.png](./visual_references/spatial-studio-architect-minimized-concept.png) | 1486944 | `d1640f992fccc60779e55117988400dab4cbe1dc` |

## Scene-by-scene visual and interaction requirements

**Home background:** Use the exact original 1672 × 941 "Architect Background" as the real visual layer behind the full Architect new-Chronicle welcome. Preserve the lighthouse, compass motif, warm sunset and surf; responsive cover/crop must not distort horizon or hide the principal lighthouse without a deliberate approved narrow layout. No image synthesis. Apply contrast scrims or regulated glass overlay **above** the image as needed.

**Sidebar background:** Use the exact original 941 × 1672 "Architect Sidebar Background" as the real backdrop of the right Architect conversation rail in full, docked and editor-embedded states. Layer genuine user messages, Architect responses, control pills and composer as DOM/UI content above its image and glass/scrim layers. The rail may adapt to narrow view but should not turn into unrelated colors and generic gradients.

**Home Screen(2):** Centered welcome headline and first prompt, one strong translucent rounded message composer; build-with-me/complete-draft/improve/critique options below; conversation rail on right initially quiet. On first submitted prompt, shared-element motion transfers the **same composer** into right-side input position, visible chat history forms and left/center becomes the visual workspace. Include Technical Review as a full collaboration style in the real product even if absent from this particular concept screenshot.

**Chronicle Overview(1):** Existing Chronicle title and status, Story Bible/Creative Commitments/Recent Changes summary cards, large left/center chapter and branch overview visualizer, right-side conversation and prominent collaboration selector. The graph and counts must originate from actual authored entities, not static illustration in production.

**Storyboard(1):** Six sample cinematic beats with actual beat durations, shot images, mood tags and visual timeline in main canvas; right Architect conversation suggests alternatives. Storyboard is a _view or authoring tool_, while Storytide/Lanternwake retain cinematic implementation authority.

**Puzzles(1):** Lighthouse Lens Calibration visualization with ring-based mechanical interaction, light-path visualizer, puzzle stages, solution conditions and success/partial/fail outcomes. Rich 3D is an illustration only until Parallax implements it. An equivalent accessible 2D mechanism must be part of any actual supported Player puzzle per SC-04.

**Editor - Expanded / Minimized:** Preserve the familiar drag-and-drop Chronicle passages editor and actual canonical save/undo/publish controls; expanded Architect uses real sidebar art as background. Minimized Architect becomes a small nonblocking lower-right glass capsule; expansion returns to the same conversation and selected passage, not another session.

**Spatial Studio - Expanded / Minimized:** Preserve actual Scene viewport, object inspector, edit/select/snap/undo controls and Parallax source-truth. The expanded state places same Architect conversation on right and the minimized state restores tool space and contextual inspector. Do not retain a second competing Parallax chatbot.

## Cross-image quality and motion contract

1. One canonical Creator identity, Chronicle, selected object, tool session and revision across every image state.
2. Glass style means genuine rounded frosted translucent layers, restrained refraction/edge-light, legible text, premium spacing, responsive blur and subtle physics-informed motion. Treat Apple Liquid Glass as visual inspiration, not affiliation or license to copy protected marks.
3. Use **actual background images**; do not generate substitute imagery at runtime. Do not use a flattened concept screenshot as an interactive page.
4. Prefer shared-element continuity from concept preview to persisted edit, but only after a canonical authoring operation genuinely succeeded.
5. Distinguish concept/proposed, preview, applying, persisted and verified states. Decorative visualizer illustrations must not be labeled completed real objects.
6. Design for mouse/touch/keyboard/screen readers, high zoom, reduced-motion, reduced-transparency and low GPU capability.
7. The two-photo room reconstruction remains a distinct domain workflow, not replaced with chat. Its metering integrates with Admiralty.
8. Verify rights/provenance and private user metadata before publishing any asset to a public repository, CDN or product. Creator-provided does not automatically mean public licensing rights.
9. Screenshots contain illustrative names/copy/times; those are not API specifications or proof of shipped features.

## Asset acceptance gates

VR-01 Verify SHA-256 of exact two required backgrounds against above values, once present in repository or production asset custody.
VR-02 Review desktop/phone crop, legibility, contrast, screen-reader and reduced-transparency fallbacks using originals.
VR-03 Verify first-input central-to-right transition, persistent conversation, real workspace and all collaboration styles.
VR-04 Verify same current Chronicle/draft when moving full/docked/minimized and between Story Editor and Spatial Studio.
VR-05 Verify expanded rail uses actual sidebar image, no generic AI substitute, and minimized capsule never obstructs required controls.
VR-06 Verify storyboard/puzzle visualizer is honest about draft/tool ownership and real object persistence.
VR-07 Preserve all original concept images as development evidence, including source hashes; do not destroy user design history.

## Documentation links

- [Chronicle Architect proposed governing document](./Project_Chronicle_Architect_Governing_Document_v1.0.md)
- [SC-00–SC-11 roadmap](./Voyagewright_Spatial_Chronicle_Creation_Program_Roadmap_v1.0.md)
- [Creator Tools and universal Playtest amendment](./Voyagewright_Creator_Experience_Cross_Project_Integration_Amendment_v1.0.md)
- [Cross-project requirements ledger](./SC_Requirements_Traceability_Ledger_v1.0.md)
- [SC-04 Puzzle Workshop proposed specification](./Project_Chronicle_Puzzle_Composition_Governing_Document_v1.0.md)
- [Ten original PNGs with individual previews](./visual_references/README.md)
- [Engineering documentation home](../../README.md)

**Status:** all ten original PNGs are present on this draft documentation branch and match the original SHA-256 manifest. The governing design remains **proposed**, with no SC-05 implementation, product acceptance, protected-main integration or paid AI testing claimed. See the [ten-image gallery](./visual_references/README.md).
