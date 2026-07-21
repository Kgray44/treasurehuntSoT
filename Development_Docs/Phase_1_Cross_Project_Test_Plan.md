# Phase 1 Cross-Project Test Plan

Focused gates are run after each candidate. Final acceptance requires formatting, lint, TypeScript, Prisma format/validate/generate, empty and representative SQLite rehearsals, isolated MySQL rehearsal, lifecycle/privacy/CSRF/rate-limit/idempotency tests, package/import/export/backup scans, browser journeys, restart proof, production build, and the full repository gate.

The integrated journey proves one account across Player/Captain/Creator, Chronicle creation and account ownership, canonical Session ownership, legacy invitation membership, guest claim/merge collision safety, encrypted export/import as a private draft, asset denial/reveal/revocation, restart preservation, untouched legacy writers, and absence of private sentinels from public/unauthorized output.

Skips are recorded as skips, never passes. The Rive source/export gate remains independently required.
