---
title: Ordinary verifier cold startup
audience: engineering
status: current
canonical_for: ordinary-verifier-cold-startup
last_reviewed: 2026-10-17
---

# Ordinary verifier cold startup

The ordinary command awaits completed-evidence intake during its top-level
startup. Intake must use the existing authority functions without awaiting an
import of that same, still-evaluating command module. Otherwise module evaluation
cannot finish and Node can exit before the command writes its canonical decision.

The [authenticated reader](../../scripts/sounding-line/authenticated-completed-evidence.mjs)
imports the two hoisted authority functions statically. It keeps the existing
provider, source, fingerprint and receipt checks. Completed receipts remain
supporting evidence; current browser, setup and policy obligations retain their
existing requirements.

The regression exercises a fresh process through the actual ordinary command,
using isolated synthetic repositories, stripped credentials and a bounded failing
command. It requires normal failure handling and a canonical failed decision.
Importing an already evaluated module cannot establish this startup behavior.

The protected ordinary check and landed verification remain required for
integration.
