# Project Harborlight Phase 4 Integration Manifest

Base is `3699f5e7`. The branch adds Harborlight-owned schema, migrations, service/routes, scripts, tests, docs, and a Sounding Line handoff fragment. It does not edit Sounding Line policy, planner, resource, workflow, Playwright topology, or test metadata control-plane files.

Shared-file overlap: Prisma schemas/migrations and `package.json` are deliberate Phase 4 ownership points. `package-lock.json` is not changed. The shared private-content ClamAV transport is a narrow reusable provider seam. Merge review must reconcile Phase 4 schema identifiers with later migrations and confirm the final Sounding Line metadata location.
