# Unattended autonomy policy

Use this policy only when a task has a durable `UNATTENDED_CONTINUATION`
standing delegation envelope. The envelope is objective-scoped and must name
the repository/project scope, allowed action classes, explicit hard stops,
budgets, expiry/completion, and an audit identity.

Route every owner-classified finding through the durable policy as one of
`AUTO_DELEGATED`, `DELEGATED_WITH_BUDGET`, or `TRUE_OWNER_REQUIRED`. Keep the
original finding and route in the ledger. A delegated route permits focused,
reversible, in-scope engineering work; it never permits a self-issued
verification decision, a protected merge, a branch-protection change, a
secret-custody action, destructive production work, external spend, or a
material scope/policy/security decision.

For the same root cause, reject a blind unchanged retry. A strategy or a
semantic precondition must change. Stop after the configured strategy or
repair budget and record one complete escalation: exact protected-main and
candidate identities, root cause, delegation gap, hard-stop class, attempted
strategies, requested decision with consequences, and preserved work location.

Bosun may inherit a parent objective's envelope for one necessary, reversible,
bounded shared repair. It still produces focused proof and enters the normal
Sounding Line Mainline Train. It does not gain release authority.
