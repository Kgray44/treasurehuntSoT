---
title: Parallax A1 model and prompt comparison
audience: engineering
status: software-qualified
canonical_for: parallax-a1-model-and-prompt-comparison
last_reviewed: 2026-10-11
---

# Selection and scope

Retain **GPT-6 Luna with low reasoning** as the standard Spatial Assistant.
Keep GPT-6.1 Sol available through the existing administrator-controlled advanced
policy. The matched comparisons did not establish a functional advantage large
enough to justify Sol's approximately eighteen-fold measured cost. Medium Luna
reasoning likewise did not establish a consistent completion advantage. This is
the best tested default for these synthetic examples, not a universal optimum.

The owner increased the additional paid-testing ceiling from $0.10 to **$0.40**.
Fifteen completed rounds made **484 calls**, all with settled accounting, for
**$0.263774605**. The remaining allowance is **$0.136225395**. This study excludes
the earlier six-call A1 canary and its separate authorization. No automatic
retries, background requests or model escalation were used.
The accounting balance is not authorization to start further rounds; paid
testing is complete and the subsequent resource instructions grant no new calls.

The [study manifest](evidence/owner-refinements/model-comparison/study.json)
records every round's exact cost, token usage, source identity, dirty-source
label, prompt digest and strict result. Its referenced JSON reports preserve the
actual public synthetic interpretations. Raw JSON is archived as `.json.txt`
to preserve exact bytes independently of code formatting; file hashes remain in
the manifest. Historical results were not rewritten.
The first report's omitted reasoning field is labeled as inferred from the pinned
evaluator default; its instruction identity is matched by the recorded digest.
The [instruction archive](evidence/owner-refinements/model-comparison/instruction-variants.json)
reproduces the tested instruction strings; publication verifies their digests.

# Comparisons

| Matched sample                          | Luna low                   | Sol low                  | Outcome                                                                                     |
| --------------------------------------- | -------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| Six difficult CANDIDATE messages        | $0.0016083; mean 3.385 s   | $0.0302085; mean 4.821 s | Same functional goals; Sol's narrative wording caused one strict mismatch                   |
| Six TUNED recovery/placement messages   | $0.001475725; mean 3.731 s | $0.026767; mean 3.917 s  | Twelve semantically acceptable outputs; eighteen-fold cost difference                       |
| Twelve FINAL recovery/adaptive messages | $0.00268293; mean 3.288 s  | $0.0485053; mean 4.538 s | Comparable task outcomes; review identified a high wall-offset default in one Luna proposal |

These are measured provider times, excluding the complete browser interaction.
Cache use and model variability affect realized costs. Earlier reports lack
request-level joins, so their case-level cost is not inferred from database row
order. Later reports retain request IDs for exact joins. The final SELECTED
sign comparison tests three phrasings with both models; all six passed with
separate signs at anchor-local y=0.

Independent review subsequently found new desk notes overlapping existing map
content in two QUALIFIED cases despite strict passes. A four-case SELECTED desk
retest confirmed that gap in all four proposals. Their original version-three
strict results remain intact. The SPACED prompt now explicitly separates new
fixed readable content from existing objects as well as other new objects;
the final SPACED ninety-case run completed with 83/90 strict passes, all settled,
costing $0.016765750 (mean $0.000186286 per call). All four desk cases now clear
the existing map. [Independent semantic review](evidence/owner-refinements/model-comparison/model-independent-spaced-review.json.txt)
inspected all ninety actual outputs against their original requests and saved
scenes, verified the exact prompt digest, and found no confirmed blocking defect
in this bounded run. The seven strict mismatches remain recorded: intent labels,
equivalent Guided narratives, preserved existing interactions and safe locked-object
clarification. The Guided clock-tower wording is less specific than the fixture;
that limitation remains visible. Mean provider latency was 2.740 seconds.

Two broad Luna runs tested the original sixty messages plus thirty natural,
adaptive and fresh examples. The TUNED run had 81/90 strict passes; QUALIFIED
had 82/90. Strict matching also flags equivalent unquoted narratives, intent
labels and preservation of an interaction the user did not ask to remove.
Independent review distinguishes those from real completion and recovery gaps.
These counts are not represented as a 100% natural-language quality result.

# Changes supported by the evidence

- Guided narration uses FALLBACK, preserving scene objects and progression.
- Private omitted text remains unknown; unrelated wording and properties stay
  unchanged, and quoted new content is exact.
- Out-of-range requests explain their limit without substituting an unchanged
  value or claiming the impossible edit was fulfilled.
- Existing selection, local axes and canonical preview placements resolve
  routine references. Fixed scenes choose readable defaults for unspecified
  positions; adaptive scenes preserve semantic constraints and zero offsets.
- Coordinates are explicitly anchor-local. The normal wall origin supplies
  eye level; separate readable signs use horizontal offsets and a gap.
- Pickup/inspection/placement behaviors identify their interacting source.
  Assistant placement preserves size and rotation through canonical edits.
- Undo and Redo direct the Creator to existing history controls.
- Explanations describe proposals. Server validation rejects punctuation-only
  summaries, questions and explanations without restricting requested object text.

The version-three corpus corrects the repository's -Z-forward convention,
checks anchor placement by entity identity rather than operation order, detects
sign overlap after all dependent transforms, and treats increasing a 50 cm map
to 40 cm as a contradiction. Tests retain the original sixty distinct messages
and fifteen categories. Earlier version-two reports retain their original
expectations and findings.
Version four additionally checks new fixed desk/wall objects against existing
readable objects at equivalent canonical anchor poses after dependent transforms.
Its deterministic desk fixtures use separate offsets. This is a conservative
synthetic readability check, not a general collision engine or physical AR proof.

# Cost controls and limitations

Short instructions and brief responses reduce useful request and response work.
The default stays low reasoning; there is no automatic premium-model fallback.
Testing used a 2,048-token output ceiling to bound its own reservations. The
production 4,000-token ceiling and administrator policy remain unchanged;
reducing a ceiling alone is not presented as a reduction in settled cost.

Every round used the existing server provider/service, isolated synthetic SQLite
storage, fixed OpenAI HTTPS endpoint and pinned accounting. The shared Windows
user credential was supplied in process memory. No credential, authorization
header or arbitrary raw provider envelope is in the evidence. The three-checkout
[diagnostic](evidence/owner-refinements/model-comparison/shared-credential-diagnostic.json.txt)
made zero network requests and created no credential files.

The evaluator's instruction overrides are testing-only and cannot be selected by
browser input. Only its public synthetic cases can be run. Invalid or incomplete
proposals preserve the scene; billed non-edits still consume usage. Unknown
accounting stops further calls and remains reserved.

Final SPACED Sol and medium reasoning were not retested; historical matched
comparisons do not prove an all-model ranking for the current prompt. One attempt
per message does not establish repeat-run reliability. Finite synthetic comparisons
do not establish universal reliability, physical
AR accuracy, production-user content quality or owner visual acceptance. Models
can still ask an unnecessary follow-up or vary explanatory wording. Explicit
Creator review and deterministic validation remain mandatory. Current source
qualification, the revised visual package and independent reviews are tracked in
the [owner-refinement record](Parallax_A1_Visual_Refinements.md).

Final software qualification subsequently found that a bounded adaptive scene
exceeded the unchanged conservative input allowance by 113 bytes. Server context
now omits duplicate capability enum lists already present in the strict response
schema; saved state, capability limits, response schema and tested instructions
are unchanged. The repaired example is 11,799 bytes including framing under the
12,000-byte allowance, and 163 focused checks pass. This payload compaction was
not retested with paid calls; the live reports retain their original payloads.

The instruction and adapter correction is software-qualified and integrated through PR #717 at `b078f823f197e2fa175c6525a7e190b45e680a7c`, after ordinary PASS run 38200759321 and 121 landed smoke tests. [Exact integration](evidence/owner-refinements/integration-b078f823.json) preserves the finite paid-study boundaries; software qualification does not recategorize any strict mismatch or claim a paid rerun of context compaction.
