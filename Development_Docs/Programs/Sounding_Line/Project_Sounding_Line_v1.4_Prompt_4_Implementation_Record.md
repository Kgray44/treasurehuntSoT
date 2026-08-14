# Project Sounding Line v1.4 — Prompt 4 Implementation Record

Status: implemented locally; nonauthoritative until the governed Prompt 5 cutover.

- Branch: `codex/sounding-line-v1.4-mainline-throughput`
- Original v1.4 base: `0055d012a121a8950b7fa70d371d5eafc6223d10`
- Prompt 3 starting head: `08f4160657ae0cccae47df5ee49925c2c37d757c`
- `origin/main` observed at start: `0055d012a121a8950b7fa70d371d5eafc6223d10`

## Delivered train machinery

`scripts/sounding-line/v14/mainline-train.mjs` is an additive shadow controller. It cannot dispatch a workflow, push a ref, merge a pull request, alter v1.3, or emit `RELEASE_GO`.

The sealed durable train model binds identity, generation, authority and policy identities, admission policy, actual-main commit/tree, merge strategy, ordered frozen candidate cars, candidate/base/predicted/actual tree identities, evidence/plan/MSES links, fairness fields, admissions, replans, brakes and audit lineage. Deterministic ordering uses explicit priority, bounded age, admission ordinal, and immutable candidate ID, while preserving explicit dependencies.

Planning receives an injected local-only deterministic integrator and records each predicted parent/tree and predicted integration tree. Conflict outcomes have no invented tree; they record sorted conflict paths and ownership and brake only the affected suffix. Tree comparison creates a sealed comparison receipt and accepts different commit objects only when their tree identities match. Missing/stale/method-mismatched/mismatched landing identities brake.

Mutation creates a replacement frozen identity and supersedes/replans the affected suffix. Withdrawal rebuilds only downstream cars. Revocation, head failure, policy/authority drift, unexpected external main, conflicts and migration collisions have explicit fail-closed brake/replan representations. Replanning records generations, preserved prefix, invalidated suffix, old/new predicted trees and semantic evidence dispositions.

Record-only admission requires a valid strict classifier, while emergency preemption is explicit and auditable but marked unauthorised until Prompt 5 supplies the future authority boundary. State is sealed and persists/reloads through a tamper-detecting record.

## Remaining Prompt 5 work

Prompt 5 alone may bind this controller to protected workflows, authorization, GitHub physical landing, current-authority replacement, and hosted controlled performance proof. No such activation is included here.
