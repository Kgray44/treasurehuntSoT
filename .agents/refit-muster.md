# Muster Refit continuation

Use the existing `refit-v1/muster` branch in `D:/CodexWorktrees/treasurehunt-refit-v1-muster`. Owner feedback applies to this same candidate. Preserve other worktrees and the port-3000 walkthrough.

The written authority is [the design packet](../Development_Docs/Projects/Voyagewright_Refit_V1/muster/design-packet.md). The owner-approved complete mockup is image-3.png in the recorded attachment directory. The area remains IMPLEMENTATION_ITERATING; do not infer owner acceptance, run final Sounding Line, merge, or start another Refit area.

Preview: http://127.0.0.1:3128/captain/voyages/muster-all-ready/muster. Runtime ownership is recorded in ignored `.runtime/muster/runtime.json`. Synthetic local credentials and browser test sessions are in ignored `.runtime/muster/fixture.json`; never commit them.

For a fresh owned checkout, install dependencies, generate Prisma, run `node scripts/refit/bootstrap-muster.mjs`, then set DATABASE_URL to that checkout's absolute `.runtime/muster/muster.sqlite` file URL and CHRONICLE_ASSET_ROOT to its absolute `.runtime/muster/chronicle-assets` directory. Run `npx tsx scripts/refit/prepare-muster.ts` and `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/refit/start-muster-preview.ps1`. Preparation preserves existing rows and chat. Never reset the database for a visual delta.

Focused development proof: the two Muster wrapper tests, `src/components/muster/CrewChat.test.tsx`, and `node scripts/refit/prove-muster.mjs` with the same DATABASE_URL. Evidence outputs stay under `.runtime/muster/proof`; summarize engineering findings in the packet. The proof creates extra task-owned Voyages for lifecycle and abuse checks. Do not use shared owner data.
