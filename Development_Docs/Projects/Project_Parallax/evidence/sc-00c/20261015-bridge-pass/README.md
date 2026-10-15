---
title: SC-00C bridge Library local browser receipt
audience: product-engineering
status: local-browser-pass-pending-integration
canonical_for: sc-00c-bridge-library-local-browser
last_reviewed: 2026-10-15
---

# Bridge Library browser receipt

The [authenticated synthetic browser run](run.json) passed **1/1** on candidate `12a5919da1b7d1e2f10536d12be6513615bc91b1`, tree `c37917a5a5b475ce2a181847024d089b0f5032ff`. Its [observations](sc00c-bridge-observations.json) record a working-snapshot Scene found through its Environment, a read-only Environment preview with the original owner definitions unchanged, an unsaved Environment's disabled reuse action and explicit save action, insertion selecting the new asset, 390 px document width at a 390 px viewport, and zero serious or critical findings in the Library axe scan. The [desktop](sc00c-bridge-library-desktop.png) and [phone](sc00c-bridge-library-phone.png) screenshots show the actual authenticated product on this source.

The phone image was captured after scrolling to an inspected Asset, so it does not display the Library's category tabs and search at the top of the panel. It also shows some existing global header controls compressed at this width. This local bridge run tests document overflow and Library controls, not the final combined phone design; SC-02's reviewed one-column disclosure must be reconciled and captured on the combined source. SC-01 Manager, SC-02 models/effects, independent combined review, protected qualification, physical-device behavior and owner acceptance remain separate.

The [first](../20261015-bridge-first-failed/README.md), [second](../20261015-bridge-second-failed/README.md) and [third](../20261015-bridge-third-failed/README.md) attempts stopped on test-only selector errors before exercising the Library. Their exact failed receipts remain preserved.

A later phone-compactness capture on `917fe5d8` showed first-result visibility at 390 px, then [failed at a desktop Inspector assertion](../20261015-phone-first-failed/README.md) because the test left the responsive Inspector closed. Its incomplete run remains separate from this earlier bridge pass.

The [corrected phone run](../20261015-phone-pass/README.md) passed on `e0fea9f7` with initial-result and expandable-filter proof; it remains local bridge evidence pending combined-source review.
