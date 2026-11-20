"""Bind authenticated provider and archive evidence before the dormant Jammy service."""
import json
import os
import re
import secrets
import stat
import sys
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path

import jammy_preflight_worker as worker
from jammy_native_inventory import collect_inventory
from jammy_native_runtime_inputs import bind_member_bytes, bounded_read, load_plan, require, sha256, verify_inventory
from jammy_preflight_custody import MAX_RECORD, CustodyBinding, boot_id, identity, private_directory, provision_binding
from jammy_preflight_launcher import recover_after_cancellation
from jammy_preflight_provider import authenticate_jammy_preflight_run
from jammy_preflight_supervisor import Run, Scope, load_supervisor_plan, verify_run

SOURCE = Path(__file__).resolve().parent
# GitHub's successful inventory run 42904385774/1 started at this UTC timestamp.
ORIGINAL_INVENTORY_RUN = 42904385774
ORIGINAL_INVENTORY_STARTED = datetime(2026, 11, 10, 21, 22, 19, tzinfo=timezone.utc)


@dataclass(frozen=True)
class PreparedRuntimeInputs:
    run: Run
    receipt: bytes
    members: dict[str, bytes]
    workflow_id: int
    tree: str
    workflow_sha256: str


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
    approval = dict(approval) if type(approval) is dict else approval
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
    return PreparedRuntimeInputs(run, receipt, members, approval["workflowId"],
                                 approval["tree"], approval["workflowSha256"])


def custody_receipt_name(run):
    return f"jammy-preflight-custody-{run.run_id}.json"


def encode_custody_receipt(scope, approval, receipt_sha256, boot):
    run, binding = scope.run, scope.custody
    record = {
        "kind": "JAMMY_PREFLIGHT_CUSTODY_V1",
        "runId": run.run_id, "attempt": run.attempt, "workflowId": approval["workflowId"],
        "source": run.source, "tree": approval["tree"], "workflowSha256": approval["workflowSha256"],
        "inventoryReceiptSha256": receipt_sha256,
        "boot": boot, "nonce": scope.nonce, "unit": run.unit,
        "base": list(binding.base), "lock": list(binding.lock),
    }
    return json.dumps(record, sort_keys=True, separators=(",", ":")).encode("ascii")


def provision_preflight_scope(prepared, receipt_dir_fd):
    """Publish custody in an already opened, owner-private output directory before handoff."""
    run = prepared.run
    verify_run(run, run.source)
    require(run.unit_nonce is None and private_directory(os.fstat(receipt_dir_fd)),
            "JAMMY_PREPARATION_CUSTODY_OUTPUT")
    nonce = secrets.token_hex(16)
    boot = boot_id()
    name = custody_receipt_name(run)
    try:
        receipt_fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC,
                             0o600, dir_fd=receipt_dir_fd)
    except FileExistsError as error:
        raise ValueError("JAMMY_PREPARATION_CUSTODY_COLLISION") from error
    try:
        binding = provision_binding(run.run_id, nonce)
        scope = Scope(replace(run, unit_nonce=nonce), nonce, custody=binding)
        approval = {"workflowId": prepared.workflow_id, "tree": prepared.tree,
                    "workflowSha256": prepared.workflow_sha256}
        data = encode_custody_receipt(scope, approval, sha256(prepared.receipt), boot)
        require(len(data) <= MAX_RECORD, "JAMMY_PREPARATION_CUSTODY_SIZE")
        require(os.write(receipt_fd, data) == len(data), "JAMMY_PREPARATION_CUSTODY_SHORT_WRITE")
        os.fsync(receipt_fd)
        os.fsync(receipt_dir_fd)
        info = os.fstat(receipt_fd)
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 1001 and info.st_nlink == 1 and
                stat.S_IMODE(info.st_mode) == 0o600 and info.st_size == len(data),
                "JAMMY_PREPARATION_CUSTODY_RECEIPT")
        require(identity(os.stat(name, dir_fd=receipt_dir_fd, follow_symlinks=False)) == identity(info),
                "JAMMY_PREPARATION_CUSTODY_REPLACED")
        return scope, sha256(data)
    finally:
        os.close(receipt_fd)


def read_custody_receipt(run, receipt_dir_fd):
    require(private_directory(os.fstat(receipt_dir_fd)), "JAMMY_PREPARATION_CUSTODY_OUTPUT")
    name = custody_receipt_name(run)
    flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK
    with os.fdopen(os.open(name, flags, dir_fd=receipt_dir_fd), "rb") as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 1001 and info.st_nlink == 1 and
                stat.S_IMODE(info.st_mode) == 0o600, "JAMMY_PREPARATION_CUSTODY_RECEIPT")
        data = bounded_read(stream, MAX_RECORD, "JAMMY_PREPARATION_CUSTODY_SIZE")
        require(len(data) == info.st_size and identity(info) ==
                identity(os.stat(name, dir_fd=receipt_dir_fd, follow_symlinks=False)),
                "JAMMY_PREPARATION_CUSTODY_REPLACED")
        return data


def recover_preflight_scope(run_id, approval, token, receipt_dir_fd, expected_receipt_sha256):
    """Reauthenticate the prior run and recover only its exact same-boot custody."""
    approval = dict(approval) if type(approval) is dict else approval
    run = authenticate_jammy_preflight_run(run_id, approval, token)
    data = read_custody_receipt(run, receipt_dir_fd)
    # The independent caller must hold the digest emitted before native admission.
    require(sha256(data) == expected_receipt_sha256, "JAMMY_PREPARATION_CUSTODY_DIGEST")
    proof = json.loads(data)
    require(type(proof) is dict and type(proof.get("nonce")) is str and
            re.fullmatch(r"[a-f0-9]{32}", proof["nonce"]) and
            all(type(proof.get(key)) is list and len(proof[key]) == 2 for key in ("base", "lock")),
            "JAMMY_PREPARATION_CUSTODY_RECEIPT")
    nonce = proof["nonce"]
    binding = CustodyBinding.from_values(proof["base"] + proof["lock"])
    scope = Scope(replace(run, unit_nonce=nonce), nonce, custody=binding)
    receipt_sha256 = load_plan()["inventory"]["receiptSha256"]
    require(data == encode_custody_receipt(scope, approval, receipt_sha256, boot_id()),
            "JAMMY_PREPARATION_CUSTODY_RECEIPT")
    # The launcher independently verifies the saved inodes, lease, and terminated owners.
    return recover_after_cancellation(scope)


def run_published_preflight(run_id, approval, token, receipt, receipt_dir_fd, evidence):
    """Handoff from the trusted provider wrapper. Publication and dispatch stay externally gated."""
    require(worker.NATIVE_ENABLED is True, "LAUNCH_ACTION_NOT_AUTHORIZED")
    tracking = os.environ.get("RUNNER_TRACKING_ID", "")
    runner_image = os.environ.get("ImageVersion", "")
    runner_temp = Path(os.environ.get("RUNNER_TEMP", ""))
    require(re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", tracking) and runner_temp.is_absolute()
            and runner_temp.resolve(strict=True) == runner_temp, "JAMMY_PREPARATION_ENVIRONMENT")
    prepared = prepare_runtime_inputs(run_id, approval, token, receipt, runner_image)
    scope, digest = provision_preflight_scope(prepared, receipt_dir_fd)
    line = f"jammyPreflightCustodySha256={digest}\n"
    require(evidence.write(line) == len(line), "JAMMY_PREPARATION_CUSTODY_EVIDENCE")
    evidence.flush()
    return worker.controller(scope, prepared.run.source, prepared.receipt, prepared.members,
                             tracking, runner_image, runner_temp)
