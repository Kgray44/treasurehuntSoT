---
title: Project Tideglass Phase 4 Historical Compatibility Record
status: IN_PROGRESS
project: Project Tideglass
phase: "Phase 4 - Fix the Bearings"
canonical_for: project-tideglass-phase-4-historical-compatibility
---

# Project Tideglass Phase 4 Historical Compatibility Record

## Contract

Tideglass reads immutable published editions. It preserves every source identity
and checksum in its receipt, delegates Story Block upcasting to Drydock, and
never writes a normalized representation back to publishing or history.

| Compatibility case                                                       | Current handling                                                                                    | Evidence status                                                              |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Accepted lossless Drydock migration                                      | `parseDrydockBlock` canonical output is compared; representation-only migration noise is suppressed | Focused contract test passing                                                |
| Legacy v1 immutable envelope without a certified Drydock block migration | Existing Tideglass v1 reader retains only its accepted safe facts                                   | Focused regression passing                                                   |
| Declared lossy migration                                                 | Bounded `LOSSY_UPCAST` partial section; no uncertain values are asserted                            | Adapter path implemented; no accepted current Drydock lossy migration exists |
| Unsupported newer schema                                                 | Metadata remains comparable where safe and the affected section is unavailable                      | Existing semantic contract retained                                          |
| Invalid historical block                                                 | Fails the affected block section closed through the Drydock contract                                | Adapter contract covered                                                     |
| Corrupt edition checksum                                                 | Exact comparison fails before normalization                                                         | Existing service contract retained                                           |
| Redacted edition                                                         | Exact comparison denies the pair                                                                    | Existing service contract retained                                           |

## Synthetic retained-history corpus

`tests/tideglass/historical-compatibility-corpus.test.ts` creates 24 synthetic,
retained immutable editions and compares all 23 adjacent exact pairs twice with
the cache disabled. The corpus intentionally varies title, crew-size maximum,
estimated duration, Captain requirement, provider requirement, and content
warning while preserving a single Chronicle identity. It proves repeatable
source-bound output across a longer retained sequence without using private
content.

## Corpus boundary

All present tests use synthetic Chronicle snapshots. No personal history,
published private Chronicle prose, media URL, Memory, or Keepsake is used as a
fixture. The full long-history corpus and browser evidence remain qualification
work; this record does not claim closure.
