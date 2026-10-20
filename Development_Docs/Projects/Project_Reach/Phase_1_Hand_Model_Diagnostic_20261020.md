---
title: Reach Phase 1 dedicated hand model diagnostic
audience: product-engineering
status: research-only-no-production-candidate-perception-mission-incomplete
canonical_for: reach-phase1-hand-model-diagnostic-20261020
last_reviewed: 2026-10-20
---

# Reach Phase 1 dedicated hand model diagnostic

**BOTTOM-RIGHT LOCALIZATION SIGNAL; NO PRODUCTION CANDIDATE; PHASE 1 NOT READY.** One frozen offline RTMDet nano plus RTMPose Hand5 CPU route improves coarse positive development circle compatibility from 21/31 to 28/31 against the retained native-image CPU neural comparator. All eight paired circle-compatible gains occur in BOTTOM-RIGHT, which changes from 0/9 to 8/9. RIGHT remains 11/11, SWEEP remains 4/5, and LEFT falls from 6/6 to 5/6. These exposed AI estimates do not establish physical fingertip accuracy, selected-index continuity or the required RIGHT and mixed-motion tracking improvement. The candidate retains two outside-circle positive proposals and one missing proposal. No model or proposal is promoted into Reach.

The [native48 and all-category aggregate](evidence/hand-model-diagnostic-20261020/native48-aggregate.json) and [actual CPU cost aggregate](evidence/hand-model-diagnostic-20261020/timing-aggregate.json) preserve all fourteen prompt categories plus ALL. Raw images, source/frame identifiers, coordinates, landmarks, model outputs, annotations, executable bindings and failed receipts remain private. Public exports contain aggregate counts, uncertainty summaries, timing statistics and artifact hashes only.

Production source, tests, public assets, package/lock files and scripts remain byte-equal to retained application commit 62ebde00a7dd9c623a20b46e20d6f4e9d63dfe99 on existing draft [PR #769](https://github.com/Kgray44/treasurehuntSoT/pull/769). The admitted application baseline remains 504 measured positions / 1,336 frames, including RIGHT 13/89. This experiment produces zero Reach measurements and performs no application candidate replay. Its raw proposal counts cannot be compared with 504 or 13 as tracking improvements. The [complete image and identity diagnostic](Phase_1_Complete_Image_Diagnostic_20261019.md) and earlier [causal point tracker rejection](Phase_1_Causal_Point_Tracker_20261020.md) remain intact.

## Hypothesis, exact assets and feasibility

This experiment tests whether a dedicated hand detector and hand-only two-dimensional pose model can localize the index tip on the original native images more consistently than the retained whole-hand CPU neural route. It tests current-image raw XY localization, without optical tracking, temporal filtering, selected identity, calibration or recovery. It does not retune the earlier reflection, material-correlation, descriptor or causal point-tracker methods.

The pinned [official MMPose hand-model listing](https://github.com/open-mmlab/mmpose/blob/759b39c13fea6ba094afc1fa932f51dc1b11cbf9/projects/rtmpose/README.md) links the Hand5 export and RTMLib. The pinned [RTMLib mirror mapping](https://github.com/Tau-J/rtmlib/blob/03a1693e59e4f7cd84582c0fb30459b3bf18ad42/rtmlib/tools/file.py) links the publisher's converted assets to the [Hugging Face model repository](https://huggingface.co/Tau-J/RTMPose/blob/cd4d7095f5cfc9cfc4f46289bee91ea4a1e1d9fd/README.md). Its exact 28-byte model card declares Apache 2.0. That is publisher-declared converted-asset license evidence, beyond generic source-code licensing; it does not establish every upstream checkpoint, training-data or dependent-asset right, or deployment clearance. The distinct original PTH's full hash and PTH-specific grant remain unverified; it is neither acquired nor executed.

| Exact artifact             |      Bytes | SHA-256                                                          |
| -------------------------- | ---------: | ---------------------------------------------------------------- |
| Hand5 SDK ZIP              | 51,270,352 | 45c9e1aa21b8fe33859973c49bce4647645d312e7a226e398a42f9137d44a56d |
| Hand5 end2end.onnx member  | 55,080,248 | 39e858936bca0f94c09847d4e70b68a51d6c0adac61f36b457fcadb54621cd29 |
| RTMDet nano hand SDK ZIP   |  3,840,129 | 9c0370a43c02b2fe42b4382aba7383d97cfa3ed35623b655cac4f0c25cfde402 |
| RTMDet end2end.onnx member |  4,010,667 | 568d3ea97a5b142488366b67e036b6a5cb0a1fef9087a710cb8e66b6979fbac2 |

Both ONNX members load from the checked archives into memory without model extraction. Graph metadata shows standard operators, IR 6 and default opset 11, with no custom domains or external tensor data. Hand5 takes float32 square 256 input; actual synthetic and recorded outputs validate two arrays shaped [1,21,512]. The detector takes float32 square 320 input and supplies boxes/scores and class labels. Native CPU feasibility does not prove browser operator support, WebGPU/WASM performance, deployment compatibility, memory fit or physical quality.

The retained SDK sidecars disagree about pose input dimensions, name an older configuration alongside the Hand5 checkpoint, and differ from source and serialized detector NMS settings. The graph establishes its actual input/output contract; it does not resolve every training/checkpoint correspondence. The fixed diagnostic explicitly selects one source-bound convention before any model output and retains the discrepancies. No channel, crop, threshold, backend or resolution sweep follows the outcomes.

## Fixed processing and proposal rule

All 1,336 original source-joined 640-by-480 PNGs are processed in chronology, with no prompt reset or excluded failure frame. They are already mirrored. OpenCV decodes BGR and the new route returns direct saved-PNG XY without a second horizontal flip.

Detector preprocessing subtracts BGR means 103.53/116.28/123.675 and divides by 57.375/57.12/58.395. The image becomes 320-by-240 with linear interpolation and bottom padding to 320 square using value 114. The serialized detector's own NMS remains fixed; its max-output setting is 200, IoU is approximately 0.6, score floor approximately 0.05, preselection 2,100 and final cap 100. After decode, the diagnostic requires class zero, a finite positive-size box and strict float32 score greater than float32 0.3. Sidecar IoU/preselection discrepancies are not silently substituted. Empty detections cause no pose call: the linked wrapper's empty-list whole-image fallback is deliberately absent.

Each surviving box receives the fixed 1.25 padding, square aspect adjustment, zero-rotation affine, zero border and linear interpolation. Pose preprocessing explicitly converts BGR to RGB, then subtracts RGB means 123.675/116.28/103.53 and divides by 58.395/57.12/57.375. This follows the selected [MMPose Hand5 configuration](https://github.com/open-mmlab/mmpose/blob/759b39c13fea6ba094afc1fa932f51dc1b11cbf9/configs/hand_2d_keypoint/rtmpose/hand5/rtmpose-m_8xb256-210e_hand5-256x256.py) and retained SDK RGB declaration. The inspected RTMLib path lacks an explicit equivalent channel swap; numerical equivalence is not claimed.

Each SimCC axis uses its own argmax, divided by the fixed split ratio two, then mapped through the inverse affine. The raw score is the minimum of axis maxima, as in the selected official decoder; the linked RTMLib decoder instead uses their mean. All 21 raw XY joints are retained privately with native slot eight fixed as the proposed index tip. No OpenPose conversion, invented Z, handedness, gesture or selected identity is added.

A raw single proposal exists only when there is exactly one surviving current detection and slot eight has a positive minimum-axis score, finite XY and native bounds. Zero, multiple, invalid or outside-image proposals are missing for comparison. Every box's pose is retained when multiple boxes exist; none is selected by proximity to an annotation. There is one detector call per source and one pose call per surviving box, with no tracking state, reseeding, look-ahead, batching or test-time augmentation.

## Comparator and complete denominator

The comparator is arm one, CPU, of the retained actual-ROI paired backend run. Its manifest, runner and interpreter bind every source to the same compressed native PNG asset. Its browser decode and horizontal unmirror differ from the new OpenCV path; its normalized endpoint maps to saved-image coordinates as x=(1-x)*639 and y=y*479. There is no claim of identical input tensors or a weights-only controlled comparison. Both arms use the same exactly-one-region, finite native slot-eight and in-bounds proposal policy; the candidate's positive score requirement is model-specific.

This comparator differs from the original cached-video NN output used in the TAPIR experiment, the reflection experiment's ORIGINAL_CPU rerun, and the accepted application position ledger. The present baseline's 21/31 circle compatibility and RIGHT 11/11 are measured from this exact retained native-image arm. Historical baselines are not interchanged.

| Prompt metadata | Frames | Baseline in-bounds single proposal | Hand5 in-bounds single proposal |
| --------------- | -----: | ---------------------------------: | ------------------------------: |
| ALL             |   1336 |                               1181 |                            1246 |
| CENTER          |    109 |                                 97 |                              95 |
| BOTTOM          |    145 |                                107 |                             127 |
| TOP             |    107 |                                107 |                             107 |
| LEFT            |     90 |                                 90 |                              90 |
| RIGHT           |     89 |                                 89 |                              89 |
| TOP-LEFT        |     73 |                                 72 |                              58 |
| TOP-RIGHT       |     74 |                                 71 |                              70 |
| BOTTOM-LEFT     |     71 |                                 70 |                              66 |
| BOTTOM-RIGHT    |     71 |                                 31 |                              68 |
| RELAXED         |    109 |                                 90 |                             109 |
| SWEEP           |    180 |                                165 |                             172 |
| OPEN-PALM       |     91 |                                 91 |                              91 |
| HIDE            |     18 |                                 18 |                              18 |
| RECOVER         |    109 |                                 83 |                              86 |

Across all frames, 1,141 have proposals from both arms, 105 only from Hand5, 40 only from the baseline and 50 from neither. Baseline zero/multiple/out-of-bounds counts are 110/24/21; Hand5 counts are 56/30/4. There are 1,336 detector calls and 1,310 pose calls. Proposal availability regresses in CENTER, TOP-LEFT, TOP-RIGHT and BOTTOM-LEFT. None of these counts establishes correct anatomy or pose, selected-finger identity, absence detection, a recovery event or calibration eligibility. In particular, HIDE is a recording instruction, not independently verified absence truth.

## Fixed native48 comparison and uncertainty

All 48 exposed AI development references remain: 37 visible, six ambiguous and five not visible, with 40 INDEX and eight UNRESOLVED digit labels. Eleven have no point estimate. Thirty-one satisfy the fixed visible/index/point-plausible predicate and have a point. The other seventeen remain separately reported. Five contrary open-palm labels overlap these categories; one lacks a point. No reference is dropped because of missing or poor predictions. This stateless route has no seed and therefore no TAPIR pre-seed exclusion.

The fixed circles have 10–15 native-pixel radii and describe coarse AI uncertainty. Circle compatibility requires the single proposal to fall within the unchanged circle. Given center distance d and radius r, the reported conditional distance interval is [max(0,d-r),d+r]. These are distance bounds conditional on the circle containing the true tip; they are not physically measured errors, calibrated confidence intervals or exact endpoint ground truth.

| Positive development references | Denominator | Baseline inside / outside / missing | Hand5 inside / outside / missing |
| ------------------------------- | ----------: | ----------------------------------- | -------------------------------- |
| LEFT                            |           6 | 6 / 0 / 0                           | 5 / 1 / 0                        |
| RIGHT                           |          11 | 11 / 0 / 0                          | 11 / 0 / 0                       |
| BOTTOM-RIGHT                    |           9 | 0 / 6 / 3                           | 8 / 1 / 0                        |
| SWEEP                           |           5 | 4 / 1 / 0                           | 4 / 0 / 1                        |
| ALL                             |          31 | 21 / 7 / 3                          | 28 / 2 / 1                       |

Eight paired transitions enter a circle, all BOTTOM-RIGHT: six outside-to-inside and two missing-to-inside. One LEFT transition goes inside-to-outside. Four BOTTOM-RIGHT comparisons have strictly better nonoverlapping conditional distance intervals; none has a strictly worse interval. Twenty-three intervals overlap and four comparisons are unpaired because one arm is missing. The LEFT circle loss still counts as a loss despite overlapping distance intervals. The SWEEP outside-to-missing transition earns no gain.

The remaining BOTTOM-RIGHT outside-circle proposal has conditional distance bounds approximately 113.91–143.91 pixels, so aggregate gains do not remove a serious possible mislocalization. Across present positive proposals, Hand5 lower-bound median/P95/max are 0/1.015853/113.906186 pixels and upper-bound median/P95/max are 17.271110/27.729239/143.906186, over 30 available proposals. Baseline summaries use 28 available proposals and are retained in JSON. Conditional statistics exclude missing coordinates and must always be read with the 31-reference denominator and explicit missing counts.

Both arms emit proposals on all five contrary references. Hand5 also emits proposals on all three BOTTOM-RIGHT nonpositive references labelled not visible. The new route has no semantic eligibility gate; these results cannot establish safe false-identification behavior. The sparse exposed labels do not provide a physical false-positive rate. RIGHT is already at the coarse-circle ceiling in this comparator; 11/11 versus 11/11 neither demonstrates a gain nor explains how to satisfy the application's tighter current-image proof. Dense error, identity switches, automatic recovery success/delay, jitter, full physical accuracy and controller/calibration usability remain unmeasured. No eligible perception candidate consumes the sealed analytic holdout.

## Actual sustained CPU cost

The private isolated runtime is Python 3.12.10, ONNX Runtime 1.31.0 CPUExecutionProvider, NumPy 2.2.6 and OpenCV 4.12.0 from the pinned headless 4.12.0.88 wheel. Six exact wheel artifacts are installed offline with hashes into a separate environment. Four intra-op and one inter-op ORT threads, and one OpenCV thread, remain fixed. Runtime/library inventories and notices are retained; no global installation or production dependency changes.

| Actual recorded interval                    | Samples | Conventional median ms | Nearest-rank P95 ms | Maximum ms | Strictly over 150 ms |
| ------------------------------------------- | ------: | ---------------------: | ------------------: | ---------: | -------------------: |
| Detector native inference                   |    1336 |               17.54875 |             28.3536 |    68.0790 |                    0 |
| Pose native inference, pooled calls         |    1310 |                49.8072 |             67.3075 |   110.8920 |                    0 |
| Core detector/pose pipeline                 |    1336 |                81.2662 |            120.1046 |   207.8312 |                   17 |
| PNG read, hash and decode                   |    1336 |                6.53285 |             12.3906 |    23.8438 |                    0 |
| Row before serialization and outer BGR hash |    1336 |               87.93305 |            129.6717 |   222.0814 |                   30 |
| JSON serialization and buffered row write   |    1336 |                 0.3724 |              1.9563 |     8.5903 |                    0 |

No warm-up or row is excluded. Even-count medians average the two central values; P95 is nearest rank, sorted[ceil(0.95*n)-1]. The core includes detector/pose preparation, inference, decode and diagnostic tensor hashes; its clock starts after the caller's PNG decode. Row-before timing excludes the later outer BGR hash, serialization and write. Buffered write timing does not assert per-row fsync. These nested intervals cannot be summed as independent totals.

The full recording input loop takes 123,719.4348 ms, or 10.798626765 offline frames/second. It includes PNG read/hash/decode, source checks, core processing, outer BGR hash, serialization, buffered writes, counters, periodic logs and stream close; it excludes package imports, model-session setup, baseline parsing, final result hashing and final receipt writing. Detector and pose session construction take 163.5467 and 300.9449 ms. Actual recorded package-import duration is unavailable. Earlier synthetic import and inference timings are separate feasibility evidence and are not substituted for these sustained costs.

These are absolute offline costs, without a concurrent baseline speed comparison or controlled power/thermal/load study. They do not establish camera cadence, capture-to-display latency, live freshness, production throughput or usable calibration performance. Seventeen core intervals already exceed the unchanged 150 ms budget, before omitted live capture/display work. Faster native inference alone would not resolve the observed localization/identity limitations.

## Independent checks, preserved failure and ownership

The fixed method and source-bound scorer are frozen and independently reviewed before recorded outputs exist. A separate synthetic smoke makes four detector and four forced-ROI pose calls, validates runtime shapes and three pure contracts, and uses no recorded or hidden frame. Boxes on generated blank/checkerboard inputs reinforce that detector/pose outputs alone have no physical presence or identity authority.

The first recording attempt cannot compile the canonical Windows guardian because its output volume is full. It fails before payload process creation or any recorded inference. The original ENOSPC log and zero-byte receipt remain immutable; the shell pipeline's zero exit is not a scientific pass or cleanup receipt. A later read-only process inventory finds no matching owned process, which does not replace the missing original cleanup proof. No unrelated file is removed or moved to make room.

A new owned output/temporary root on the available volume changes storage, receipt bindings and free-space checks only. The core, model, source PNGs, inference conventions, thresholds, selection, evaluation arithmetic and resource caps are unchanged. The successor preserves the failed predecessor and exact pinned-file prefix. Independent reverse-edit and full-pin reviews clear this storage-only successor. The corrected probe runs once over all 1,336 sources; the scorer runs once. Superseded unexecuted preparation and review-correction records remain preserved.

All 4,325 source/runtime/input pins, totaling 715,830,151 bytes, match before and after actual recorded execution. A creation-bound Windows Job records direct exit zero, descendant tree reaped and streams closed; cleanup passes with escalation true. A 900-second deadline, 1 MiB row cap and 512 MiB result cap remain fixed. No shared browser, preview, camera, application server or database is invoked. Output/source hashes do not establish complete transitive Windows system-DLL closure.

Independent admission checks all 1,336 rows and joins, finite/counter/proposal rules, the exact retained CPU arm, and unchanged pins before allowing scoring. The scorer retains all 1,336 status rows, 48 references, 31 positives and fourteen strata plus ALL. Independent timing extraction verifies 165 producer-counter comparisons and 2,672 nested-interval checks with zero mismatches. A separately authored native48 arithmetic review independently recomputes the retained status/reference rows and all aggregates: 18,325 compared leaves, including 6,698 numeric leaves, have zero mismatches and maximum numeric delta zero. Its public-export readback confirms the exact aggregate projection and absence of private frame identifiers, coordinates, landmarks and paths. These checks establish provenance and calculation consistency, without converting AI development estimates into physical truth.

## Root-cause implications and remaining acceptance

The complete-pipeline diagnostic already separates camera delivery, neural presence, anatomy, optical material correspondence, temporal identity, current-coordinate proof and sample eligibility. The new experiment narrows one observation: dedicated raw localization can improve several BOTTOM-RIGHT examples while RIGHT's existing native neural point remains circle-compatible and its admitted application coordinates remain scarce. That supports further investigation of coordinate reproof and model/image disagreement in RIGHT; it does not show that bypassing those gates is safe. The unchanged broad mixed-motion assertion still fails separately.

A factual source audit also confirms that current NCC tracking already updates an adaptive patch on accepted optical frames, can refresh a stable reference through bounded probation, and maintains MCP/PIP/DIP material support with distal-plus-other reproof. It is not an initial-image-only tracker. Stored templates and internal optical updates do not themselves establish published measurements: temporal/source/current-image gates can still reject them. This finding prevents treating an already implemented adaptive-template mechanism as a new untested remedy; it does not claim to identify a unique cause for every physical failure.

The canonical full-hand observation requires finite Z as well as XY for each joint, even for an invalid observation. This model supplies only XY. Fabricating depth or packaging it as the existing full-hand provider would misrepresent the source. A separate automatic two-dimensional proposal ingress does not currently exist; the manual-hint channel changes source mode and is not a substitute. Any future auxiliary path needs its own design, evidence and identity/freshness/anatomy/current-image enforcement before application evaluation. This report implements none.

The fixed route is retained as a research-only localization diagnostic and is not nominated for production replacement. Required RIGHT and mixed-motion gains, no increase in false identities/positions, browser deployment, actual capture-to-visible timing, natural-motion recovery, independent held-out calibration, physical/controller usability and owner acceptance remain open. The selected-index, 150 ms freshness, anatomical/semantic eligibility, coordinate limits, three-frame/120 ms registration probation, fifteen-sample/600 ms holds and five independent raw 3% calibration checks remain unchanged. No manual same-finger confirmation, Phase 2, Crossdeck or shared acceptance modification occurs.

This is an evidence-only change: product features, current status, feature status, affected guides and changelog retain their existing acceptance state; no completed major capability or important subfeature changes. Documentation/index/Feature Catalog checks validate publication, not tracking reliability. Existing browser failures and the protected Product Experience refusal remain unresolved. No new candidate unit, integration, browser or physical acceptance is claimed. Phase 1 and the owner's perception mission remain incomplete.

## Reproduction bindings

The experiment binds clean source 6dd79c40553a2f42f06b74bce4d5d66db672fa01. Private manifests retain exact executable, runtime, source, archive-member, input, command, environment, review, result and cleanup identities. Public JSON is copied byte-for-byte from the reviewed aggregate files and protected from newline conversion and formatting. The original full input and failure records remain available privately.

| Artifact                                             | SHA-256                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| Exact publisher model card                           | 98b45ea81164d1e1a1dd82255207053b15cd6c69d922a1c5cf3387ce604d4b74 |
| Static graph metadata summary                        | 3ecd9d285f1f80c5ba44c1d8b07f89025ecb756cdf117acd41103b3c16fd0ebb |
| Fixed diagnostic core                                | e349eb6ec19b12a3e22e334d3bd19df96fe3120d03ec8ba3caf81379de833676 |
| Original 1,336-source input manifest                 | 0ba8b1cee8f7b3435f6d6d1e837decba3e8142409ee6ca96965cfe368fdefe5a |
| Retained native CPU comparison results               | 23ef09eb70e1e9e367cd561c698012492da0834fc03be09c547b9e5d63196cfe |
| Retained native CPU comparison manifest              | daafc7a9a3feff82ae19073e2b28d6a0a73f2b22459146efc43e0bb2d93078f6 |
| Original native48 annotations                        | 3f922d9051adb1a4fae8a7af1b5ab2d9031da233c420709506e949a210a40480 |
| Fixed reference derivation                           | 2fd0319b52bc0800fb92c2d0336be5068caf1f84d64bec97dc3b2a3b602130ff |
| Preserved pre-payload disk-full failure              | 7b282d64aafcd0940ee62470e2e38b3e1d5bb826b42e2b0c2d7578bfca000c6f |
| Storage-successor recording freeze                   | e05c5d460736d38e8c589f222865f3d6bcb343453ecc1778edc5505a036a8d35 |
| Pre-execution successor review                       | 419b9a515d95c87f1cd61ec1f76ca200965be0624a44a60b164fdaab95b66ff5 |
| Actual raw results, 7,647,074 bytes                  | b8b766c193bfcdd1d30370b8cc400841a720e3f2c14545b01aa9ec63f7f93556 |
| Actual payload final                                 | 7f9c6903b92072d89a506994b6bd7c001b48a7ff32adb797eec7248df90d1ca7 |
| Actual owned execution                               | 9e6c9e45d64381629014cfa2be4737c6f42163b85f9043fb4168895b90852401 |
| Independent actual-result scoring admission          | f5c0fec4a9e83de533007e8df790691fce54e4510061fb6ecc91e9f57c373fc5 |
| Pre-output native48 evaluator freeze                 | 8307d71c4bd017e506d59e0c826dc38b05532aa8bfaf5b236d4988d58e5f03e2 |
| Fixed native48 scoring protocol                      | e1063ebcd438756ce064786bb31dc0e8f5a7640204c7f8a0973652e65644da36 |
| Native48 private score                               | b1f58dff1f09ac405ee3c1bdc97f27900641d07a6ebb68849e731cb73731d658 |
| Native48 scoring execution                           | a299ee2582e205c79b50079bd904e0bb348d205f0d368a7024c002228d0d5e40 |
| Exact public native48 aggregate                      | 234fb13a4666e57af619513007be0da668ee3105c91ead1cd07fd63d07ef3451 |
| Independent native48 arithmetic/privacy review       | 746ee5d06e63bf63f487ccc509704d28e8e6d8d02026518060a965d1fc3da2c5 |
| Compact role-pinned arithmetic/privacy final receipt | 2d383524215fc20862a2a2cbd91aba5ad23b6a5705236ed8842582b3ad1dc269 |
| Independent timing extractor freeze                  | 9e6cbb39de22e536276d4b7e6ff495951224f48d6fe9c21e44d43fb4b3ed1128 |
| Exact public timing aggregate                        | 15e79a12b62e3eabe723adff61fb0ebd29f66a9bce6d487ecb5beba5d1ce3261 |
| Independent timing extraction receipt                | d0883f69fb08f6d1dca28dd764a2d34658a1e560637b397faa12b0ed033c9ed3 |
| Canonical template lifecycle source audit            | 7a36271928e6cf5954bb51ec35d4986bb3edad365614b3a9847b7c4bb5bc1606 |
