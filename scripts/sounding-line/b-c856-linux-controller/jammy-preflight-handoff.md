# Jammy preflight authorization and handoff

The proposed native action is one diagnostic attempt on the pinned Ubuntu 22.04 runner. It checks the loader closure, Bubblewrap version, isolation denials, and cleanup. The local publication candidate places the workflow at `.github/workflows/sounding-line-jammy-confined-preflight.yml` with its job disabled and native entry hard-disabled. This candidate covers registration of the disabled workflow only.

## Authenticate the action

1. Record owner authorization for the exact proposed publication commit, tree, and workflow file SHA-256. Read the workflow ID back from GitHub after registration. Native use requires its own reviewed publication tuple with the trusted provider wrapper and bounded cancellation recovery in place. Record dispatch authorization separately for that published tuple, the repository `Kgray44/treasurehuntSoT`, protected `main`, the operation `confined-loader-and-denials-only`, and a single attempt.
2. Before package acquisition, read the actual provider run record. Require the authorized workflow ID and path, exact protected source commit and tree, workflow SHA, event and ref, owner actor and triggering actor, run ID, and attempt one. Require the exact runner image and kernel from the plan. A missing or different field refuses admission. Supply the verified provider record through the trusted wrapper. Worker arguments carry the resulting scope and cannot authorize a run.
3. Use inventory workflow `413733115`, run `42904385774` attempt `1`, source `0f5ec2311999324d933ad334c8d9b794b2ad51ec`, tree `2094b0c7195009ca3c380c010e9939f9ec3dad74`, and original receipt SHA-256 `bb6ad7b76ee9cb11e8fb63c2699b7de7003a086b3510f68fff82ceedb5a9ef1a`. The runtime input plan pins all seven original members, their archive paths, sizes, and hashes. Acquire only their authenticated public packages through the existing inventory verifier. Retain the original receipt and validate each member before passing its bytes to the service. [Original inventory run](https://github.com/Kgray44/treasurehuntSoT/actions/runs/42904385774)
4. The trusted wrapper must exclusively provision `/run/user/1001/sl-native-custody-<run>-<nonce>` and its empty `ownership.lock`. Use UID 1001, a new random 128-bit nonce, directory mode 0700, and lock mode 0600. Confirm the private base and lock device/inode identities through opened descriptors. Retain them with the authenticated run record so an independent owner can reopen the exact scope. A name collision, unverified base, replaced lock, or incomplete bootstrap retains custody and refuses native admission.

For the reviewed runner wrapper, the isolated Python entry script takes the action
(`launch` or `recover`) and an absolute, owner-private receipt directory. Send the
independently authorized publication and dispatch records over bounded JSON via
stdin. For launch, include the original inventory receipt as base64. For recovery,
include the custody digest preserved by the independent caller. Deliver the
read-only provider token to the entry process separately. The entry verifies
these bindings against the current workflow metadata before invoking the
controller or the same-boot recovery checks.

The dormant workflow uses the owner-protected `sounding-line-jammy-preflight`
environment for the independently retained approval envelope. It binds the
checkout commit and tree before passing the envelope to the entry point.
On launch and recovery, the workflow reads the standard-library-only bootstrap
from the exact Git commit. It checks the entire controller file set and every
tracked blob before invoking Python on any checkout module.
The launch step publishes the custody digest to its log and step output before
starting the controller. The recovery step reads only that earlier step output
and operates on the same job's receipt directory. GitHub's behavior under
runner-wide cancellation still requires separate evidence.

## Run within the pinned limits

- Set a five-minute job limit with no rerun. The public archive phase has a 90-second ceiling. Reserve at most 64 MiB of host scratch and require at least 2 GiB of runner-disk free space after that reservation. Keep private tmpfs at 16 MiB and 256 inodes.
- Require the user service's eight-second queue deadline, five-second start deadline, 12-second active deadline, and two-second stop deadline. Verify 128 MiB memory, zero swap, eight tasks, and the exact service and child membership before staging. Use the existing unprivileged user manager. Host security policy and privileges stay in their provider configuration.
- Run only the two fixed loader commands and the denial probes in their attested roots. Bound each captured stream to 8 KiB. A mismatch in source, package bytes, limits, child identities, mounts, or loader closure refuses the run. Emit a source-bound diagnostic receipt with the primary failure and any custody hold.

## Recover and verify

On the same runner boot, an independent trusted caller can reopen the authenticated private base and lock after the original controller and watchdog have exited. Recovery verifies both recorded process identities, including boot and process start time. Before admission, only empty scratch in the exact private base is eligible for removal. Once admission is recorded, recovery uses the retained lease and allows up to 32 seconds for passive expiry and cleanup checks. Preserve ambiguous entries and incomplete records. Keep the private base, journal, and original receipts for the owner until evidence is collected.

If interruption follows custody receipt publication and precedes reservation,
recovery verifies the recorded controller has exited. Under the ownership lock
it retires an empty, unreserved scope to prevent a late watchdog from reserving
it. Pending records, scratch, or an unexpected fragment hold the scope.

Before activation, verify how a trusted recovery caller survives or is relaunched after runner-wide cancellation. If the provider destroys the VM, obtain provider teardown evidence for that exact run. A synthetic recovery pass cannot establish provider cleanup or native isolation. Diagnostic success does not authorize B or C reuse or replace any existing protected release decision.
