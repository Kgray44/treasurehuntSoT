"""Bind authenticated provider and archive evidence before the dormant Jammy service."""
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from jammy_native_inventory import collect_inventory
from jammy_native_runtime_inputs import bind_member_bytes, bounded_read, load_plan, require, sha256, verify_inventory
from jammy_preflight_provider import authenticate_jammy_preflight_run
from jammy_preflight_supervisor import Run, load_supervisor_plan

SOURCE = Path(__file__).resolve().parent
# GitHub's successful inventory run 42904385774/1 started at this UTC timestamp.
ORIGINAL_INVENTORY_RUN = 42904385774
ORIGINAL_INVENTORY_STARTED = datetime(2026, 11, 10, 21, 22, 19, tzinfo=timezone.utc)


@dataclass(frozen=True)
class PreparedRuntimeInputs:
    run: Run
    receipt: bytes
    members: dict[str, bytes]


def verify_runner(run, runner_image):
    require(sys.platform == "linux", "JAMMY_PREPARATION_RUNNER")
    expected = load_supervisor_plan()["runner"]
    host = os.uname()
    local = {
        "GITHUB_RUN_ID": str(run.run_id),
        "GITHUB_RUN_ATTEMPT": "1",
        "GITHUB_SHA": run.source,
        "GITHUB_WORKFLOW_SHA": run.workflow_source,
        "GITHUB_REF": run.ref,
        "GITHUB_EVENT_NAME": run.event,
        "RUNNER_ENVIRONMENT": "github-hosted",
        "RUNNER_ARCH": "X64",
        "ImageVersion": expected["image"],
    }
    require(host.sysname == "Linux" and host.machine == expected["architecture"] and
            host.release == expected["kernel"] and os.getuid() == os.geteuid() == expected["uid"] and
            runner_image == expected["image"] and all(os.environ.get(key) == value for key, value in local.items()),
            "JAMMY_PREPARATION_RUNNER")


def read_inventory_inputs(manifest_hash):
    with (SOURCE / "jammy-native-inventory.json").open("rb") as stream:
        manifest = bounded_read(stream, 8192, "JAMMY_PREPARATION_MANIFEST_SIZE")
    require(sha256(manifest) == manifest_hash, "JAMMY_PREPARATION_MANIFEST_PIN")
    with (SOURCE / "diagnostic-v3.zip").open("rb") as stream:
        verifier = bounded_read(stream, 64 * 1024, "JAMMY_PREPARATION_VERIFIER_SIZE")
    return json.loads(manifest), verifier


def prepare_runtime_inputs(run_id, approval, token, receipt, runner_image):
    """Reacquire the seven pinned members. This step neither authorizes nor starts a service."""
    run = authenticate_jammy_preflight_run(run_id, approval, token)
    verify_runner(run, runner_image)
    plan = load_plan()
    expected = verify_inventory(plan, receipt)
    inventory = plan["inventory"]
    require(inventory["run"] == ORIGINAL_INVENTORY_RUN, "JAMMY_PREPARATION_INVENTORY_RUN")
    manifest, verifier = read_inventory_inputs(inventory["manifestSha256"])
    observed, members = collect_inventory(manifest, verifier, snapshot_attested_at=ORIGINAL_INVENTORY_STARTED)
    require(observed["ownedScratchRemoved"] is True and observed["members"] == expected,
            "JAMMY_PREPARATION_INVENTORY_DRIFT")
    bind_member_bytes(plan, members)
    return PreparedRuntimeInputs(run, receipt, members)
