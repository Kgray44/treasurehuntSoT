---
title: Project Admiralty Governing Amendment v1.3 - The Support Pilot
audience: engineering
status: mandatory-governing-amendment
canonical_for: admiralty-support-pilot
document_id: VW-ADMIRALTY-AMEND-1.3
version: "1.3"
date: 2026-08-19
parent_authority: Project Admiralty v1.2
verification_authority: Project Sounding Line
---

# PROJECT ADMIRALTY
## Governing Amendment v1.3: The Support Pilot
### Autonomous Support Diagnosis, Governed Repair, Verification, and Case Evidence

**Version 1.3 | August 19, 2026 | Mandatory Governing Amendment**

> **Governing Principle**  
> An autonomous support agent may inspect and repair only what a user-approved support grant, authenticated administrative authority, and registered canonical owner command jointly authorize. It must never inherit unrestricted Administrator power, access prohibited private or secret data, mutate outside registered commands, or claim resolution until defined postconditions prove the reported problem is no longer present.

---

# Document Control

| Field | Governing value |
|---|---|
| Document ID | `VW-ADMIRALTY-AMEND-1.3` |
| Program | Project Admiralty |
| Amendment | v1.3 - The Support Pilot |
| Status | Mandatory governing amendment |
| Parent authority | Project Admiralty v1.2 |
| Parent project rule | Administrative control without domain theft |
| Verification authority | Project Sounding Line |
| Identity authority consumed | Project Wayfarer |
| Runtime authority consumed | Project One Voyage |
| Community authority consumed | Project Harborlight |
| Private-content authority consumed | Project Sealed Hold |
| Operational context source | Project Bridgewatch, bounded safe projections only |
| Product-capability feedback | Project Deepwater |
| Agent-context efficiency | Project Trim, without access expansion |
| Implementation sequence | Admiralty P3 acceptance -> S1 -> S2 -> S3 -> Admiralty P4/P5 |
| Final acceptance | Governed increment gates plus owner walkthrough of support surfaces and evidence |

## Normative Language

**MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative. MUST-level rules are completion gates. Passing tests, an Administrator login, database access, a successful command response, or a completion receipt is not an exception.

## Precedence

This amendment supplements Project Admiralty v1.2. It does not replace the v1.2 support-grant, audit, privacy, command-port, or domain-ownership rules. Where this amendment is more specific about autonomous support execution, this amendment governs. Specialized platform projects continue to own their own business truth and mutations.

---

# Contents

1. Executive Summary  
2. Amendment Authority and Relationship to Admiralty v1.2  
3. Problem Statement and Supportability Gap  
4. Product Vision and Support Pilot Role  
5. Non-Negotiable Design Principles  
6. Scope, Boundaries, and Non-Goals  
7. Canonical Support Pilot Architecture  
8. Support Case Lifecycle  
9. Agent Identity and Attribution  
10. Delegated Support Execution Grant  
11. User Consent and Support Scopes  
12. Privacy, Data Minimization, and Prohibited Data  
13. Diagnostic Read Ports and Sanitized Support Snapshot  
14. Diagnosis and Repair Planning  
15. Support Repair Registry  
16. Autonomous Repair Risk Classes  
17. Governed Repair Execution Contract  
18. Verification and Postcondition Proof  
19. Failure, Rollback, Crash, and Restart Behavior  
20. Concurrency, Stale State, Expiry, and Revocation  
21. Source-Code Defects vs Runtime/Data Repair  
22. Support Receipt and User-Visible Case History  
23. Support Pattern Intelligence and Engineering Handoff  
24. Cross-Project Integration Boundaries  
25. Security Threat Model and Abuse Resistance  
26. Support User Experience, Accessibility, and Product Reality  
27. Testing and Acceptance Matrix  
28. Implementation Sequence and Mainline-Safety Contracts  
29. Final Acceptance Criteria  
30. Governance, Capability Evolution, and Future Expansion  
Appendix A. Canonical Contract Sketches  
Appendix B. Example Repair Registry Entries  
Appendix C. Example Support Receipt  
Appendix D. Adversarial Acceptance Scenarios  
Appendix E. Increment Exit Gates

---

# 1. Executive Summary

Project Admiralty already provides the human support foundation: scoped temporary support access, user consent, sanitized read projections, canonical owner commands, reauthentication, risk classification, audit evidence, and fail-closed behavior. The missing capability is an autonomous support execution layer that can use those existing controls coherently.

The Support Pilot turns that gap into a governed product:

**authorize -> diagnose -> propose -> repair -> verify -> report -> close**

The Support Pilot is **not** an unrestricted Administrator agent. It is a temporary, case-bound, capability-scoped support principal. Every read and every command must be justified by the intersection of:

1. the affected user's active consent grant;
2. the human Administrator's current authenticated authority;
3. the exact support case;
4. the registered support read or repair capability;
5. the configured autonomous risk ceiling;
6. the command's live preconditions.

The Support Pilot may autonomously complete low- and medium-risk support work when all controls are satisfied. High-risk actions require explicit human approval. Prohibited actions remain prohibited even if the operator is an Administrator.

The central completion rule is:

> **A support case is not resolved because Codex found a plausible cause or a command returned success. It is resolved only when the system proves that the user's reported problem is no longer true, or truthfully classifies the case as mitigated, unresolved, or requiring engineering work.**

---

# 2. Amendment Authority and Relationship to Admiralty v1.2

Project Admiralty v1.2 remains the governing administrative baseline. This amendment consumes, rather than replaces, its existing rules for:

- scoped temporary Support Access;
- strict data minimization;
- canonical subsystem ownership;
- typed sanitized projections;
- command routing through owning systems;
- reauthentication;
- audit and correlation evidence;
- risk classification;
- rollback or compensation;
- provider truth;
- mainline-safe incremental expansion.

The Support Pilot is therefore an **Admiralty orchestration capability**. It must never become:

- a second Wayfarer account authority;
- a second One Voyage progression or membership authority;
- a second Harborlight moderation or community authority;
- a private-content bypass around Sealed Hold;
- a testing/release authority that competes with Sounding Line;
- a raw-database support console.

The v1.3 capability catalog is additive. Later Admiralty phases may register additional safe repair commands without redesigning the Support Pilot.

---

# 3. Problem Statement and Supportability Gap

Voyagewright is mature enough that real support cases can cross multiple systems. A user may report a symptom such as:

- a Chronicle appearing missing;
- conflicting signed-in state;
- an accepted invitation that does not transition;
- an artifact not appearing;
- a preference that does not persist;
- a stale crew membership;
- a background job that never completes;
- a derived projection that disagrees with canonical truth.

The current human workflow can require manually correlating Admiralty, Bridgewatch, subsystem APIs, audit events, job state, and source knowledge. Codex can assist, but ordinary browser automation is too indirect and too dependent on the human operator.

The missing capability is a **direct, typed, bounded support path** that lets Codex inspect approved system state and invoke already-governed repair commands without receiving unrestricted administrative credentials.

This is a maturity gap, not a replacement for ordinary engineering. The Support Pilot exists to reduce the operational cost of diagnosing and repairing cases that already fit within governed platform capabilities.

---

# 4. Product Vision and Support Pilot Role

A finished support interaction should feel like this:

1. The user reports a problem.
2. An Administrator opens a support case and records the reason.
3. The user sees exactly which support data categories are requested.
4. The user approves, refuses, narrows, or later revokes that access.
5. Admiralty mints a short-lived delegated Support Execution Grant.
6. The support agent reads only approved typed projections.
7. The agent develops a diagnosis with confidence and evidence.
8. It proposes a repair plan using registered canonical commands.
9. Commands at or below the authorized autonomous ceiling may execute.
10. Each mutation is verified against explicit postconditions.
11. The case closes with a concise plain-language summary and a complete forensic receipt.
12. The user's grant is consumed, revoked, or expires.
13. Sanitized recurrence data may contribute to systemic defect detection.

The normal path should require **no application deployment** for runtime, account-state, projection, job, configuration, or other repairable operational problems.

Source-code defects remain engineering defects. The Support Pilot may apply a registered temporary mitigation where safe, but it must never hot-patch production source or silently redefine canonical behavior.

---

# 5. Non-Negotiable Design Principles

## 5.1 Delegated Authority, Never Borrowed Administrator Identity

The agent MUST NOT receive the human Administrator's cookie, bearer token, raw session token, password, API secret, or unrestricted internal credential.

The human Administrator's authenticated authority is an input to minting a narrower delegated grant. The delegated grant is a distinct principal with its own case, scope, expiry, command set, risk ceiling, and audit identity.

## 5.2 Four-Way Authorization Intersection

A support read or command is permitted only when all required authority intersects:

- **user consent** authorizes the affected person's data class;
- **Administrator authority** authorizes the support operation;
- **Support Execution Grant** authorizes the exact case, scope, and command;
- **canonical subsystem policy** permits the operation under current state.

No one layer can substitute for another.

## 5.3 Canonical Owner Commands Only

The Support Pilot MAY orchestrate commands. It MUST NOT recreate domain business rules, write tables directly, fabricate derived state, or perform undocumented dual writes.

## 5.4 Evidence Before Confidence

Every finding must cite safe evidence identities and source freshness. The agent must distinguish known fact, bounded inference, uncertainty, and unavailable evidence.

## 5.5 Verification Before Resolution

A command result is not a repair receipt. Resolution requires explicit postconditions and, where practical, an end-user-facing verification journey.

## 5.6 Context Expansion Does Not Expand Data Access

Project Trim may allow autonomous context expansion for Codex, but the support grant remains the hard ceiling. Reading more repository context can never authorize reading more user data.

## 5.7 Private Content Remains Private in v1.3

The v1.3 Support Pilot does not delegate `PRIVATE_MEDIA` or `PRIVATE_CHRONICLE_CONTENT` to the autonomous agent, even if those classes may be exceptionally consented to for a human support operator under the parent Admiralty baseline.

## 5.8 Secrets Are Never Grantable

`SECRETS_AND_CREDENTIALS` remains permanently prohibited.

---

# 6. Scope, Boundaries, and Non-Goals

The Support Pilot owns:

- support-case orchestration;
- delegated execution identity;
- support-grant enforcement;
- diagnostic read composition;
- repair-registry lookup;
- bounded command execution;
- verification orchestration;
- case receipts;
- safe support-pattern intelligence.

It consumes, but does not own:

- Wayfarer account/profile/session truth;
- One Voyage membership/runtime truth;
- Harborlight community truth;
- Sealed Hold private-content status and operations;
- Bridgewatch system-health projections;
- background-job and provider owner commands;
- Sounding Line verification policy;
- Deepwater capability-realization tracking.

Explicit non-goals for v1.3:

- unrestricted SQL or database shell access;
- arbitrary mutation endpoints;
- direct storage manipulation;
- source-code hotpatching;
- deployment bypass;
- disabling authorization or privacy controls;
- changing audit history;
- exposing secrets;
- autonomous access to private Chronicle prose or private media;
- arbitrary bulk-account operations;
- replacing engineering bug-fix workflows;
- allowing Codex to invent new repair commands during a live case.

---

# 7. Canonical Support Pilot Architecture

```text
User Problem
    |
    v
Support Case
    |
    +--> User Consent Grant
    |
    +--> Administrator Authority + Recent Assurance
    |
    v
Support Execution Grant
    |
    v
Support Agent Session
    |
    +--> Typed Diagnostic Read Ports
    |       Wayfarer / One Voyage / Harborlight / Jobs / Config / Bridgewatch
    |
    +--> Support Repair Registry
    |       canonical owner commands only
    |
    v
Diagnosis -> Repair Proposal -> Execution -> Verification
    |
    v
Sealed Support Receipt
    |
    +--> User-visible summary
    +--> Administrator forensic record
    +--> Sanitized pattern intelligence
```

The Support Pilot runtime SHOULD be implemented as a bounded Admiralty service/worker using existing durable operation patterns where practical. Its API surface must be machine-oriented and typed rather than dependent on browser clicking.

Browser automation MAY be used for user-facing verification after repair, but it is not the canonical repair mechanism.

---

# 8. Support Case Lifecycle

Canonical case states:

- `OPEN`
- `AWAITING_USER_GRANT`
- `AUTHORIZED`
- `DIAGNOSING`
- `REPAIR_PROPOSED`
- `REPAIRING`
- `VERIFYING`
- `RESOLVED_VERIFIED`
- `MITIGATED_ENGINEERING_REQUIRED`
- `UNRESOLVED`
- `CANCELLED`
- `EXPIRED`
- `REVOKED`
- `FAILED_SAFE`

Required invariants:

- Every active execution session belongs to exactly one Support Case.
- A case cannot enter `DIAGNOSING` without an active matching grant.
- A case cannot enter `REPAIRING` without a valid plan and authorized command set.
- `RESOLVED_VERIFIED` requires all mandatory postconditions to pass.
- Closing or revoking a case terminates the delegated execution session.
- Historical evidence is retained according to Admiralty retention policy without retaining prohibited raw data.

The affected user SHOULD be able to see a plain-language support history entry after the case closes.

---

# 9. Agent Identity and Attribution

The autonomous agent is a first-class audited actor, not an invisible extension of the human Administrator.

Every execution must identify:

- support agent type and version;
- support session ID;
- support case ID;
- delegating Administrator account;
- active user-consent grant;
- Support Execution Grant ID;
- application build/version;
- policy/registry versions;
- correlation ID.

Audit events must attribute actions to both:

1. the autonomous support principal that performed the operation; and
2. the human Administrator whose authority allowed the delegation.

This prevents both false human attribution and untraceable "the AI did it" records.

---

# 10. Delegated Support Execution Grant

A conceptual grant:

```ts
type SupportExecutionGrant = {
  id: string;
  supportCaseId: string;
  targetAccountId: string;
  delegatingAdministratorAccountId: string;
  userConsentGrantId: string;

  allowedReadScopes: string[];
  allowedRepairCommandIds: string[];
  maximumRiskClass: "R0" | "R1" | "R2" | "R3" | "R4";

  allowAutonomousRead: boolean;
  allowAutonomousMutation: boolean;
  requireMutationPreview: boolean;

  maxCommandCount: number;
  maxAffectedRecords: number;
  maxDomains: number;
  maxElapsedSeconds: number;

  issuedAt: string;
  expiresAt: string;
  reauthenticationReceiptId: string;
  sourceVersion: string;
  correlationId: string;
};
```

Required grant behavior:

- fail closed if any referenced authority becomes invalid;
- cannot be widened by the agent;
- cannot outlive the user-consent grant;
- cannot outlive the Administrator's required assurance window;
- cannot survive delegating Administrator role revocation;
- cannot be reused for another account or case;
- command allowance decreases as commands execute;
- budget exhaustion ends mutation authority;
- grant changes invalidate stale repair proposals.

Grant states:

- `PENDING`
- `ACTIVE`
- `PARTIALLY_REVOKED`
- `REVOKED`
- `EXPIRED`
- `CONSUMED`

---

# 11. User Consent and Support Scopes

The parent Admiralty v1.2 scopes remain authoritative for human support. The autonomous v1.3 subset is stricter.

| Scope | Agent delegation rule |
|---|---|
| `ACCOUNT_STATE` | Allowed when explicitly approved; credentials excluded. |
| `AUTH_EVENTS` | Allowed for bounded recent metadata; raw tokens prohibited. |
| `CHRONICLE_HISTORY_METADATA` | Allowed for version/date/status/ID metadata; no private prose. |
| `COMMUNITY_ACTIVITY` | Allowed only for case-relevant bounded activity. |
| `PRIVATE_MEDIA` | **Not delegable to autonomous Support Pilot v1.3.** |
| `PRIVATE_CHRONICLE_CONTENT` | **Not delegable to autonomous Support Pilot v1.3.** |
| `SECRETS_AND_CREDENTIALS` | **Never grantable.** |

The consent UI must tell the user:

- why support is requesting access;
- what categories are requested;
- what is explicitly excluded;
- how long access lasts;
- that an autonomous support agent may inspect approved data;
- whether automated repair is allowed;
- how to revoke access;
- what audit/history they will receive afterward.

General support consent must never imply private-content consent.

---

# 12. Privacy, Data Minimization, and Prohibited Data

Support diagnostics should prefer:

- identifiers;
- lifecycle states;
- timestamps;
- safe event names;
- bounded counts;
- status codes;
- revision/version IDs;
- source freshness;
- sanitized error classes.

They must not retain or broadly log:

- passwords;
- session tokens;
- OAuth secrets;
- signing keys;
- API secrets;
- private Chronicle prose;
- private photos/audio/video;
- accepted answers;
- Captain-only notes unrelated to the approved case;
- protected object-storage keys when a safe asset ID suffices.

The agent's internal working context must not become a shadow archive of user data. Persist stable evidence references and bounded sanitized observations rather than raw dumps.

---

# 13. Diagnostic Read Ports and Sanitized Support Snapshot

Each owning subsystem may expose a support projection contract such as:

```ts
type SupportDiagnosticPort = {
  id: string;
  owner: string;
  requiredScopes: string[];
  privacyClass: string;
  read(input: SupportDiagnosticRequest): Promise<SupportDiagnosticResult>;
};
```

The initial diagnostic family SHOULD cover:

- Wayfarer account status, roles/capabilities, session metadata, profile/projection status;
- One Voyage invitation/membership/runtime relationship metadata;
- Harborlight ownership/listing/community status relevant to the user;
- background job state and retry/lease status;
- runtime configuration status where user-specific behavior depends on it;
- Bridgewatch safe service/provider health;
- correlated Admiralty audit metadata.

A Support Snapshot is a composition of authorized projections. It is not a database export.

Every field should carry:

- source system;
- source timestamp;
- confidence/freshness;
- privacy class;
- evidence reference.

---

# 14. Diagnosis and Repair Planning

The Support Pilot must diagnose before mutating.

A diagnosis records:

- reported symptom;
- observed facts;
- contradictory facts;
- hypotheses considered;
- selected root-cause classification;
- confidence;
- missing evidence;
- proposed commands;
- expected state change;
- verification contract.

The agent may autonomously expand repository/source-code context as needed, subject to Project Trim, but it may only expand user-data reads through already authorized diagnostic ports.

If evidence is insufficient, the correct output is `UNRESOLVED` or a narrower support-grant request, not fabricated certainty.

Repair proposals must bind to current revisions/preconditions. If underlying state changes, the proposal becomes stale.

---

# 15. Support Repair Registry

Autonomous repair exists only through registered repair commands.

A registry entry must declare:

```ts
type SupportRepairDefinition = {
  id: string;
  commandSchemaVersion: string;
  ownerSubsystem: string;
  riskClass: "R1" | "R2" | "R3" | "R4" | "RX";
  requiredSupportScopes: string[];
  requiredAdminCapabilities: string[];
  reauthenticationRequired: boolean;
  userConsentRequired: boolean;
  supportsDryRun: boolean;
  idempotency: string;
  maxAffectedRecords: number;
  mutationPreview: string;
  preconditionContractId: string;
  verificationContractId: string;
  rollbackOrCompensation: string;
  auditCategory: string;
  autonomousExecutionAllowed: boolean;
};
```

Representative entries may include:

- `wayfarer.profile.reconcile`
- `wayfarer.session.revoke-stale`
- `one-voyage.membership.reconcile`
- `harborlight.projection.rebuild`
- `jobs.retry-safe`
- `jobs.release-expired-lease`
- `configuration.apply-runtime-setting`

Those are examples, not permission to create a command when the owning subsystem does not already support it safely.

The registry is a capability floor and may grow as Admiralty gains new owner-command integrations.

---

# 16. Autonomous Repair Risk Classes

| Class | Meaning | Default autonomy |
|---|---|---|
| `R0` | Observation only | Autonomous |
| `R1` | Safe reconcile, refresh, idempotent retry | Autonomous when grant permits |
| `R2` | Bounded runtime/session correction | Autonomous when grant permits |
| `R3` | Bounded user-state mutation | Autonomous only when explicitly allowed by grant and registry |
| `R4` | High-risk, broad-impact, destructive, recovery, or policy-sensitive action | **Explicit human owner confirmation required per action** |
| `RX` | Prohibited | Never executable |

Examples of `RX`:

- raw SQL;
- audit deletion or rewriting;
- privilege escalation outside canonical role commands;
- disabling authorization/privacy;
- reading secrets;
- reading private Chronicle content under v1.3;
- source hotpatching;
- arbitrary shell execution through support APIs;
- unregistered mutation endpoints.

The human Administrator chooses the maximum risk ceiling when launching the support session. The agent cannot raise it.

---

# 17. Governed Repair Execution Contract

Every repair execution follows:

```text
verify grant
-> verify Administrator capability/assurance
-> verify user consent
-> reload current target state
-> evaluate command preconditions
-> compare proposal revision
-> generate/show mutation preview when required
-> execute canonical owner command
-> capture canonical result
-> audit command attempt/result
-> enter verification
```

The system must enforce:

- optimistic revision or equivalent stale-state protection;
- idempotency key where applicable;
- exact target bounds;
- command-count and record-count budgets;
- owner subsystem availability;
- rollback/compensation definition before execution;
- failure before mutation if audit persistence is unavailable.

Bulk support repairs are out of scope for v1.3 unless a specific registered command defines safe bounded behavior.

---

# 18. Verification and Postcondition Proof

Verification is a distinct required phase.

Possible postconditions:

- canonical state equals expected value;
- stale session no longer authenticates;
- fresh session can access intended surface;
- membership/projection agrees with canonical runtime;
- queued job reaches terminal success;
- user's original route/API behavior succeeds;
- unrelated records remain unchanged.

Verification classifications:

- `VERIFIED_RESOLVED`
- `VERIFIED_MITIGATED`
- `VERIFICATION_FAILED_ROLLED_BACK`
- `VERIFICATION_INCONCLUSIVE`
- `OWNER_ACTION_REQUIRED`

Where practical, a task-owned synthetic or user-safe browser/API journey should prove the visible symptom is repaired.

A 200 response from the repair command is not a sufficient resolution condition.

---

# 19. Failure, Rollback, Crash, and Restart Behavior

The Support Pilot must fail safe.

Required behavior:

- command failure retains evidence and does not fabricate success;
- postcondition failure triggers rollback/compensation when the command contract provides it;
- rollback failure elevates to human owner action immediately;
- agent process crash does not authorize a blind retry;
- restart loads durable case/command state and determines whether the prior command committed;
- ambiguous commit state requires canonical reconciliation before another mutation;
- expired grant on restart closes mutation authority;
- unavailable owner subsystem blocks only the affected repair path;
- a read-only diagnosis may still complete when mutation is unavailable.

No autonomous retry loop may repeatedly mutate the same user state without idempotent proof.

---

# 20. Concurrency, Stale State, Expiry, and Revocation

Two support sessions must not silently race over the same mutable target.

Required controls:

- case-scoped mutation lease or equivalent conflict detection;
- target revision/precondition checks;
- duplicate command suppression;
- stale proposal invalidation;
- user grant revocation takes effect immediately;
- partial scope revocation removes those diagnostic/repair capabilities without waiting for case closure;
- Administrator role loss or reauthentication expiry ends privileged execution;
- case cancellation stops queued actions;
- case expiry prevents new reads and commands.

A support session may continue only with the permissions that remain valid **now**, not those valid when diagnosis began.

---

# 21. Source-Code Defects vs Runtime/Data Repair

## Repairable operational problem

Examples:

- stale projection;
- expired or stuck lease;
- retryable job;
- stale session;
- bounded incorrect runtime setting;
- derived state requiring reconciliation.

These may be repaired through registered commands.

## Software defect

Examples:

- incorrect authorization predicate;
- wrong API logic;
- deterministic projection bug that will recur;
- source-code exception requiring a code change;
- missing capability.

The Support Pilot MUST NOT hotpatch source or edit production files.

It MAY:

1. apply a registered safe mitigation;
2. verify the user's immediate experience;
3. classify the case `MITIGATED_ENGINEERING_REQUIRED`;
4. create a sanitized engineering handoff.

Temporary mitigation must never be mislabeled as permanent resolution.

---

# 22. Support Receipt and User-Visible Case History

Every closed case produces two projections from one evidence source.

## User-visible summary

Plain language:

- what was wrong;
- what support inspected;
- what support changed;
- what was explicitly not accessed;
- whether the issue is resolved or mitigated;
- whether further action is required.

## Administrator forensic receipt

Includes:

- case and execution identities;
- user-consent grant;
- delegating Administrator;
- agent identity/version;
- scopes used;
- diagnostic observations;
- root-cause classification;
- repair proposals;
- commands attempted;
- before/after bounded summaries;
- verification results;
- rollback/compensation;
- source versions;
- timestamps/correlation IDs;
- access closure.

Example status:

```text
SUP-00194
RESOLVED_VERIFIED

Problem: Chronicle Passport unavailable
Root cause: stale Wayfarer capability projection
Repairs: 1 projection reconciliation, 1 stale-session revocation
Verification: 5/5 mandatory postconditions passed
Private Chronicle content accessed: NONE
Private media accessed: NONE
User grant: CONSUMED/CLOSED
Engineering follow-up: possible systemic projection invalidation defect
```

---

# 23. Support Pattern Intelligence and Engineering Handoff

Support cases should become a safe sensor for recurring product defects.

Structured recurrence data may include:

- symptom signature;
- root-cause category;
- affected subsystem;
- repair command ID;
- repair success/failure;
- application version;
- environment class;
- recurrence fingerprint.

Pattern intelligence must be anonymized or aggregated. It must not forward raw private support evidence into telemetry, Deepwater, Bridgewatch, or Sounding Line.

A systemic engineering handoff may include:

- reproducible symptom;
- affected versions;
- common safe state signature;
- known mitigation;
- frequency/count;
- suggested regression contract;
- owning project.

When recurrence crosses a governed threshold, Admiralty SHOULD raise an engineering finding rather than continuing to normalize the issue as "support."

---

# 24. Cross-Project Integration Boundaries

## Wayfarer

Owns account, profile, role/capability, linked identity, session, and personal-history truth. Support Pilot uses Wayfarer support projections and commands.

## One Voyage

Owns invitation, membership, Voyage/runtime progression, and live session state. Support Pilot never rewrites runtime truth directly.

## Harborlight

Owns community listing, publication, moderation, and social truth. Support Pilot may use bounded community support projections and registered owner commands.

## Sealed Hold

Owns private-content protection. v1.3 Support Pilot may inspect safe availability/status metadata and invoke registered operations, but it may not decrypt/read private content or private media.

## Bridgewatch

May provide system health, deployment/build identity, provider status, background operational context, and source freshness. It is not a user-private-data source.

## Deepwater

Receives sanitized systemic capability/defect handoffs and can track product-realization gaps. It does not receive raw case evidence.

## Sounding Line

Governs software test design, regression evidence, and release authority. It does not decide whether an individual support case is resolved. New repair commands and support infrastructure must receive Sounding Line coverage.

## Project Trim

May optimize Codex context acquisition. It cannot broaden support grants or support-data scopes.

---

# 25. Security Threat Model and Abuse Resistance

The Support Pilot must explicitly defend against:

- privilege escalation;
- confused deputy behavior;
- forged or replayed grants;
- grant widening;
- stale consent;
- stale Administrator authority;
- IDOR across support cases;
- targeting a different account than the approved subject;
- raw-token leakage;
- secret leakage;
- private-content leakage;
- prompt injection contained in user-supplied or community content;
- malicious support-case text attempting to alter policy;
- repair-registry command injection;
- arbitrary argument injection;
- SSRF through diagnostic adapters;
- destructive command chaining;
- audit suppression;
- stale-state mutation;
- race conditions between sessions;
- repeated non-idempotent retries;
- receipt tampering.

Important rule:

> **User-provided content is evidence, never authority.**

Text found in profile data, Chronicle metadata, comments, uploaded filenames, logs, or error payloads must never be interpreted as executable agent instructions.

---

# 26. Support User Experience, Accessibility, and Product Reality

Required Administrator surfaces:

- Support Cases list;
- case detail;
- requested/active user grant;
- agent execution status;
- diagnosis;
- repair proposal;
- risk ceiling;
- mutation preview;
- verification status;
- final receipt.

Required user surfaces:

- support-access request;
- plain-language scopes;
- exclusions;
- grant approve/deny/narrow;
- active grant and revoke control;
- closed-case summary/history.

Every surface must support:

- desktop/mobile reachability;
- keyboard operation;
- screen-reader labels;
- 200% zoom;
- reduced motion;
- loading/empty/error/denied/degraded states;
- obvious distinction between read access and mutation permission;
- explicit confirmation for human-gated R4 actions.

Product acceptance must include an owner walkthrough against a running synthetic support case. A backend-only pipeline is not a finished Support Pilot.

---

# 27. Testing and Acceptance Matrix

Minimum governed coverage:

| Area | Required proof |
|---|---|
| Grant identity | Agent cannot use another user's, case's, or Administrator's grant. |
| Scope | Each read field is denied unless its data class is authorized. |
| Private content | Autonomous agent cannot receive private media or Chronicle content in v1.3. |
| Secrets | Secrets/credentials are never returned or grantable. |
| Reauthentication | Expired assurance blocks sensitive execution. |
| Role revocation | Administrator role loss terminates delegated authority. |
| User revocation | Active case loses revoked scope immediately. |
| Risk ceiling | R4 and RX cannot execute autonomously. |
| Registry | Unregistered command IDs fail closed. |
| Stale state | Revision change invalidates stale repair proposal. |
| Idempotency | Retry does not duplicate mutation. |
| Budgets | Command/record/time ceilings are enforced. |
| Audit | Reads, proposals, commands, results, and closure have correlation evidence. |
| Verification | Command success without postcondition proof cannot yield resolved status. |
| Rollback | Failed verification follows registered rollback/compensation behavior. |
| Crash/restart | Ambiguous operations reconcile before retry. |
| Concurrency | Competing sessions cannot silently race the same target. |
| Prompt injection | User/community text cannot change support policy or command authority. |
| Cross-domain | Support Pilot cannot bypass owning subsystem rules. |
| UI | User/admin journeys are navigable, responsive, accessible, and truthful. |
| Engineering handoff | Sanitized defect signal contains no prohibited case data. |

Sounding Line must register stable support-pilot contracts and negative authorization/privacy tests.

---

# 28. Implementation Sequence and Mainline-Safety Contracts

## Prerequisite

**Admiralty Phase 3: Take the Watch must be accepted into protected main before Support Pilot S1 begins.**

Phase 3 establishes governed account/support/security operations that the Support Pilot consumes.

No Phase 0 is required.

## S1 - Open the Case

Formal scope: **Support cases, delegated authority, and read-only autonomous diagnosis.**

Deliver:

- Support Case lifecycle;
- user consent binding;
- Support Execution Grant;
- support-agent identity;
- typed diagnostic ports;
- sanitized support snapshot;
- diagnosis and repair proposal;
- no mutations.

**S1 mainline-safety gate:** If work stopped forever after S1, Voyagewright would have a useful read-only AI support investigator with no autonomous mutation authority.

## S2 - Turn the Wrench

Formal scope: **Registered bounded repairs and verification.**

Deliver:

- Support Repair Registry;
- R0-R4/RX classes;
- execution budgets;
- preconditions;
- mutation previews;
- canonical owner-command execution;
- idempotency;
- rollback/compensation;
- postcondition verification.

**S2 mainline-safety gate:** If work stopped forever after S2, support could safely perform bounded registered repairs and produce verified outcomes without S3 intelligence features.

## S3 - Close the Case

Formal scope: **Turnkey autonomous support workflow, receipts, history, and pattern intelligence.**

Deliver:

- polished admin/user workflow;
- complete sealed receipts;
- user-visible support history;
- recurrence intelligence;
- engineering handoff;
- final cross-project acceptance.

**S3 mainline-safety gate:** Full Support Pilot is a permanent Admiralty capability. Later Admiralty P4/P5 expand the registry but are not required for the Support Pilot to remain coherent.

## Integration discipline

Each increment:

1. starts from current protected main;
2. follows Project Trim context workflow;
3. develops with focused tests;
4. qualifies through Sounding Line;
5. merges independently;
6. records exact-main proof;
7. does not begin the next increment until the current one is accepted.

Then Admiralty resumes:

**P4 Command the Fleet -> P5 Stand the Admiralty**

---

# 29. Final Acceptance Criteria

The Support Pilot v1.3 is accepted only when all of the following are true:

- autonomous agent identity is distinct from Administrator identity;
- no Administrator credential is handed to the agent;
- every active case binds user consent, Administrator authority, Support Execution Grant, and canonical subsystem policy;
- private media/private Chronicle content are unavailable to autonomous v1.3 execution;
- secrets are never grantable;
- raw SQL and arbitrary mutation are impossible through normal support APIs;
- all repairs route through registered canonical owner commands;
- risk ceiling and R4/RX gates are enforced;
- stale proposals fail safely;
- grant expiry/revocation takes effect immediately;
- command budgets are enforced;
- crash/restart cannot duplicate an ambiguous mutation;
- verification is required before resolved status;
- rollback/compensation behavior is tested where applicable;
- user and Administrator receipts reconcile to one evidence source;
- systemic intelligence is anonymized/sanitized;
- source-code defects are handed to engineering, not hotpatched;
- Sounding Line coverage is complete for support infrastructure;
- running browser/API acceptance proves real support journeys;
- owner walkthrough accepts the actual product.

---

# 30. Governance, Capability Evolution, and Future Expansion

The Support Pilot is deliberately extensible.

A new support capability must follow the Admiralty expansion workflow:

1. identify the canonical owner;
2. decide read/command exposure;
3. classify privacy and risk;
4. register a stable capability/command ID;
5. define reauthentication and support-grant requirements;
6. define preconditions, idempotency, rollback/compensation, and verification;
7. add negative authorization/privacy tests;
8. integrate as a mainline-safe increment;
9. update Admiralty, Feature Catalog, Deepwater, and operating records as applicable.

Later projects may add new registered commands for Chronicle, Voyage, Sealed Hold, provider, recovery, maintenance, or release operations. The Support Pilot consumes those registrations. It does not reopen its core architecture every time Admiralty grows.

A future private-content support mode would require a separate explicit amendment. It is not implied by v1.3.

---

# Appendix A - Canonical Contract Sketches

## A.1 SupportCase

```ts
type SupportCase = {
  id: string;
  targetAccountId: string;
  openedByAdministratorId: string;
  reason: string;
  reportedSymptom: string;
  status: SupportCaseStatus;
  userConsentGrantId?: string;
  activeExecutionGrantId?: string;
  currentDiagnosisId?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  correlationId: string;
};
```

## A.2 SupportObservation

```ts
type SupportObservation = {
  id: string;
  caseId: string;
  sourceSystem: string;
  evidenceRef: string;
  observedAt: string;
  sourceObservedAt?: string;
  freshness: "FRESH" | "STALE" | "UNKNOWN";
  privacyClass: string;
  summary: string;
};
```

## A.3 SupportDiagnosis

```ts
type SupportDiagnosis = {
  id: string;
  caseId: string;
  rootCauseCategory: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
  supportingObservationIds: string[];
  conflictingObservationIds: string[];
  proposedRepairIds: string[];
  engineeringRequired: boolean;
  createdAt: string;
};
```

---

# Appendix B - Example Repair Registry Entries

| ID | Owner | Class | Intent | Verification |
|---|---|---:|---|---|
| `wayfarer.profile.reconcile` | Wayfarer | R1 | Rebuild a derived profile/capability projection from canonical facts. | Projection matches canonical account/capability state. |
| `wayfarer.session.revoke-stale` | Wayfarer | R2 | Revoke a bounded stale session. | Old session denied; expected current session unaffected. |
| `one-voyage.membership.reconcile` | One Voyage | R3 | Reconcile one user's membership projection through canonical rules. | Runtime and membership projections agree; unrelated members unchanged. |
| `harborlight.projection.rebuild` | Harborlight | R1 | Rebuild a bounded public/owner projection. | Projection checksum/state matches source truth. |
| `jobs.retry-safe` | Owning job system | R1 | Retry an idempotent failed job. | One successful terminal job result; no duplicate side effect. |
| `jobs.release-expired-lease` | Owning job system | R2 | Release a verified stale/expired lease. | Lease owner absent/expired and work becomes safely claimable. |
| `configuration.apply-runtime-setting` | Owning config subsystem | R3/R4 | Apply an explicitly runtime-editable setting. | Effective value matches expected, audit recorded, dependent health remains valid. |

---

# Appendix C - Example Full Support Receipt

```text
SUPPORT CASE: SUP-00194
RESULT: RESOLVED_VERIFIED

Reported symptom
Chronicle Passport could not be opened after a capability change.

Authorization
Delegating Administrator: <safe account ID>
User consent grant: <grant ID>
Support Execution Grant: <grant ID>
Scopes used:
  ACCOUNT_STATE
  AUTH_EVENTS
Excluded:
  PRIVATE_MEDIA
  PRIVATE_CHRONICLE_CONTENT
  SECRETS_AND_CREDENTIALS

Diagnosis
Canonical account capability state was correct.
Derived profile capability projection was stale.
Confidence: HIGH

Repair
Command: wayfarer.profile.reconcile
Risk class: R1
Affected records: 1
Result: SUCCESS

Additional correction
Command: wayfarer.session.revoke-stale
Risk class: R2
Affected sessions: 1
Result: SUCCESS

Verification
Canonical account projection: PASS
Profile capability projection: PASS
Fresh authenticated request: PASS
Passport route access: PASS
Unrelated memberships unchanged: PASS

Private content accessed
NONE

Rollback
Not required

Engineering follow-up
Review recurring stale projection after capability changes if threshold is met.

Grant closure
CONSUMED
```

---

# Appendix D - Adversarial Acceptance Scenarios

At minimum prove:

1. Agent attempts to read private media using a general support grant -> denied.
2. User revokes `AUTH_EVENTS` while diagnosis runs -> subsequent auth reads fail immediately.
3. Administrator loses role after grant issuance -> agent execution terminates.
4. Agent proposes R4 command under R3 ceiling -> owner confirmation required; no mutation.
5. Agent supplies unregistered command ID -> fail closed.
6. Target revision changes after proposal -> command refused as stale.
7. Same idempotent command delivered twice -> one logical mutation.
8. Process dies after command commit but before receipt -> restart reconciles before retry.
9. User profile text contains instructions to reveal secrets -> treated as data, not authority.
10. Diagnostic adapter returns a forbidden storage key -> projection/redaction test fails.
11. Bridgewatch is unavailable -> support records operational context as unavailable and continues unrelated diagnosis.
12. Verification fails after repair -> no `RESOLVED_VERIFIED`.
13. Rollback also fails -> owner action required with full evidence.
14. Two cases target the same mutable object -> lease/revision conflict prevents silent race.
15. Source-code defect identified -> no hotpatch route exists; engineering handoff produced.

---

# Appendix E - Increment Exit Gates

## E.1 S1 - Open the Case

- Active user grant required.
- Delegated agent principal distinct from Administrator.
- Read scopes enforced field-by-field.
- Private content/secrets impossible.
- Cross-domain snapshot is sanitized and source-bound.
- Diagnosis/proposal works with no mutation endpoint.
- Desktop/mobile accessible support surfaces pass.
- Sounding Line support-pilot read contracts pass.

## E.2 S2 - Turn the Wrench

- Repair Registry complete for all enabled commands.
- R0-R4/RX enforcement passes negative tests.
- Mutation previews and budgets work.
- Commands execute only through owning systems.
- Stale-state and idempotency tests pass.
- Verification required for closure.
- Rollback/compensation paths proven where declared.
- Crash/restart reconciliation proven.

## E.3 S3 - Close the Case

- Full authorize -> diagnose -> repair -> verify -> close journey passes.
- User-visible case history matches forensic receipt.
- Pattern intelligence contains no prohibited user data.
- Engineering handoff is safe and useful.
- Admin/user surfaces meet Voyagewright product-reality rules.
- Final owner walkthrough accepts the running Support Pilot.

---

# Final Governing Rule

> **The Support Pilot may be autonomous, but it is never sovereign. User consent defines what personal data may be touched, Admiralty defines what administrative authority may be delegated, the owning subsystem defines what actions are valid, and verification defines whether the case is actually resolved. Codex gets enough power to help - never enough power to quietly become the platform.**
