# Sounding Line V3

Run these commands from an owned checkout with the repository Node version.

| Command                                  | Use                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| npm run sl -- plan                       | Show the checks for commits since the merge base with origin/main.                   |
| npm run sl -- explain --project Wayfarer | Show selected files and the reason for each suite.                                   |
| npm run sl -- test                       | Run the selected checks against a clean checkout of HEAD.                            |
| npm run sl -- test --suite unit.landfall | Add a registered test suite.                                                         |
| npm run sl -- test --full                | Request the full verification plan.                                                  |
| npm run sl:integrate -- 123 124          | Preview integration for the listed PRs. Add --apply to update or merge eligible PRs. |

Use npm.cmd in Windows PowerShell if it intercepts npm argument separators. Use --base and --head to inspect another committed comparison. Tests run from the checked-out commit. Install locked dependencies before local product jobs and Playwright browsers before local browser jobs. GitHub installs those dependencies only for the jobs that use them.

Use PR labels sl:mode:maintenance, sl:project:Wayfarer, sl:suite:unit.landfall, or sl:full to add coverage. Use the actual owners and IDs from [the suite registry](../../testing/suites.json). A label can increase coverage. Changed paths and shared contracts still determine the minimum. Unknown project names and suite IDs fail with an error.

Open **Actions → Sounding Line V3** to inspect the selector's summary, job output and timestamps, rerun failed jobs, or cancel a run. **Run workflow** requests the full suite on the selected ref. The manual result has its own check name. Ordinary PR verification runs on GitHub's proposed merge tree. Independent matrix jobs run concurrently. A new run can cancel the previous run for the same PR.

The lightweight path checks Markdown links, image signatures, applicable document-index entries, Git diff sanity, and changed text for private-material markers. The selector uses repository test families and impact mappings for product changes. Unknown source changes can widen to the available unit and browser checks. TypeScript checking and production builds cover the application workspace whenever selected.

Add a line such as **Depends on: #123, #124** to the PR description to declare predecessors. The coordinator holds dependent PRs until their predecessors land, and continues through independent candidates. It uses GitHub's exact-head update and merge APIs, keeps strict main protection enabled, and compares the proposed tree with the landed tree after each merge. GitHub's manual merge control remains available to the owner. Check dependencies in the PR description before merging manually.

For the registered Wayfarer and Landfall unit suites, Actions may reuse a successful result on the same PR when the selected tests, toolchain, runner OS family, and tracked suite inputs match. The logs identify reuse. Other selected checks run on the current proposed tree.

The cutover disables the legacy ordinary workflow in GitHub Actions. Its source and receipts remain available for historical diagnostics. This workflow uses the existing project test fixtures, including browser harnesses, in isolated runner jobs.

Full browser verification uses independent jobs for dedicated journey runners, Lanternwake, and the other browser profiles. The generic Chromium profile runs in four Playwright shards, with spec files kept intact. Each job owns its build and fixture data. The full decision requires every job to pass.

The manual `generic-serial` scope runs the same generic Chromium profile in one job for timing comparisons. It has its own result.

### Formatting

Ordinary PRs run Prettier on new or modified supported source and configuration files. Passive Markdown and image changes keep the dependency-free diff, link, and asset checks.

Manual full verification reports every unchanged violation in the recorded 78-file baseline. A grandfathered finding requires the same tracked path, blob, formatter version, and formatting configuration. New or modified violations fail the check. Historical files stay intact until they are revised for their own purpose.
