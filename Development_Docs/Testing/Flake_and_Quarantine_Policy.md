# Flake and Quarantine Policy

A flake is a repeatable test signature that produces materially different outcomes on equivalent source, fixture, environment, and policy conditions. It requires recorded observations, signature matching, owner assignment, severity, suspected cause, and remediation issue; a single retry does not prove a flake. Passing on retry is reported `flake`, never a clean pass.

Quarantine requires release-gate-owner authority, suite/contract owner, start date, expiry, remediation deadline, reason, and visible release effect. It expires automatically unless renewed with evidence. Privacy, authorization, migration, data-loss, and critical release tests cannot be quarantined merely for inconvenience. Unlimited retries, silent retry growth, arbitrary sleeps, indefinite quarantine, and hiding quarantined results are prohibited. `testing/quarantine.json` is intentionally empty at baseline; no currently failing test was placed there.
