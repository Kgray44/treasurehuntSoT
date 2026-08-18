---
title: Project Fairlead GitHub App Setup
audience: owner
status: current
canonical_for: project-fairlead-github-app-setup
last_reviewed: 2026-08-18
---

# Project Fairlead GitHub App Setup

## External owner configuration required

The repository supports a dedicated read-only App but does not register one or
store its private key. Creating and installing **Voyagewright Automation** is
an owner-controlled GitHub action: `EXTERNAL_OWNER_CONFIGURATION`.

1. In the repository owner’s GitHub settings, create a GitHub App named
   `Voyagewright Automation`.
2. Set the homepage to the repository URL. A public callback URL is not needed
   for the polling-only configuration. Leave webhooks inactive unless the
   optional webhook receiver is deliberately deployed.
3. Grant repository permissions only: Metadata read, Contents read, Pull
   requests read, Checks read, and Actions read. Do not grant write, Members,
   Administration, Issues, or organization permissions without a separate
   governed need.
4. Install the App only on `Kgray44/treasurehuntSoT` (or the owner-selected
   repository), then record the App ID and installation ID from GitHub.
5. Generate a private key and store the PEM at an absolute path outside this
   repository with owner-only filesystem permissions. Relative paths are
   rejected. Never paste the key into an issue, chat, `.env.example`, log,
   state directory, or GitHub Actions variable.
6. Configure only the server environment running Bridgewatch:

   ```text
   BRIDGEWATCH_GITHUB_APP_ID=<App ID>
   BRIDGEWATCH_GITHUB_APP_INSTALLATION_ID=<installation ID>
   BRIDGEWATCH_GITHUB_APP_PRIVATE_KEY_PATH=C:\Secure\voyagewright-automation.pem
   ```

   Local CLI automation may use the equivalent `VOYAGEWRIGHT_GITHUB_APP_*`
   variables. The configured App is preferred for read-only Bridgewatch
   observation; it does not acquire write authority.

7. Run `npm run github:app:check` and start Bridgewatch. The command validates
   the installation repository membership and reports any missing required read
   permission without printing a token. A valid first observation proves the
   App read path is active.

Rotate by generating a replacement private key, atomically updating the
external path, restarting the owning process, checking health, then revoking
the old key in GitHub. Revoke an installation by uninstalling the App; the
implementation fails safely to the configured user token or anonymous read
mode according to existing Bridgewatch policy. Do not place App credentials in
GitHub Actions unless a separately governed hosted use case genuinely requires
them; Actions already has its own minimal `${{ github.token }}` pool.

If webhook invalidation is later deployed, configure only `push`,
`pull_request`, `check_run`, `check_suite`, `workflow_run`, and `workflow_job`
events that the receiver actually consumes. Verify the `X-Hub-Signature-256`
HMAC, cap body size, deduplicate delivery IDs, and keep polling as a safe
reconciliation path. A public webhook endpoint is not required for local
operation.
