"""Bind authenticated provider and archive evidence before the dormant Jammy service."""
import json
import os
import re
import secrets
import stat
import sys
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from errno import errorcode
from pathlib import Path

import jammy_preflight_worker as worker
from jammy_native_inventory import collect_inventory
from jammy_native_runtime_inputs import bind_member_bytes, bounded_read, load_plan, require, sha256, verify_inventory
from jammy_preflight_custody import MAX_RECORD, CustodyBinding, base_path, boot_id, capture_owner, identity, private_directory, provision_binding, verify_owner_gone
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
    try:
        run = authenticate_jammy_preflight_run(run_id, approval, token, launch=True)
    except OSError as error:
        code = errorcode.get(error.errno, "OS_ERROR")
        raise ValueError(f"JAMMY_PREPARATION_PROVIDER_{code}") from error
    verify_runner(run, runner_image)
    plan = load_plan()
    expected = verify_inventory(plan, receipt)
    inventory = plan["inventory"]
    require(inventory["run"] == ORIGINAL_INVENTORY_RUN, "JAMMY_PREPARATION_INVENTORY_RUN")
    manifest, verifier = read_inventory_inputs(inventory["manifestSha256"])
    try:
        observed, members = collect_inventory(manifest, verifier, snapshot_attested_at=ORIGINAL_INVENTORY_STARTED)
    except OSError as error:
        code = errorcode.get(error.errno, "OS_ERROR")
        raise ValueError(f"JAMMY_PREPARATION_INVENTORY_{code}") from error
    require(observed["ownedScratchRemoved"] is True and observed["members"] == expected,
            "JAMMY_PREPARATION_INVENTORY_DRIFT")
    bind_member_bytes(plan, members)
    return PreparedRuntimeInputs(run, receipt, members, approval["workflowId"],
                                 approval["tree"], approval["workflowSha256"])


def custody_receipt_name(run):
    return f"jammy-preflight-custody-{run.run_id}.json"


def intent_receipt_name(run):
    return f"jammy-preflight-intent-{run.run_id}.json"


def receipt_identity(run, approval, receipt_sha256, boot, controller, nonce):
    return {
        "runId": run.run_id, "attempt": run.attempt, "workflowId": approval["workflowId"],
        "source": run.source, "tree": approval["tree"], "workflowSha256": approval["workflowSha256"],
        "inventoryReceiptSha256": receipt_sha256, "boot": boot, "controller": controller, "nonce": nonce,
    }


def encode_record(record):
    return json.dumps(record, sort_keys=True, separators=(",", ":")).encode("ascii")


def encode_custody_receipt(scope, approval, receipt_sha256, boot, controller):
    run, binding = scope.run, scope.custody
    return encode_record({
        **receipt_identity(run, approval, receipt_sha256, boot, controller, scope.nonce),
        "kind": "JAMMY_PREFLIGHT_CUSTODY_V1", "unit": run.unit,
        "base": list(binding.base), "lock": list(binding.lock),
    })


def open_new_receipt(directory, name):
    try:
        return os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC,
                       0o600, dir_fd=directory)
    except FileExistsError as error:
        raise ValueError("JAMMY_PREPARATION_CUSTODY_COLLISION") from error


def valid_receipt(info):
    return (stat.S_ISREG(info.st_mode) and info.st_uid == 1001 and info.st_nlink == 1
            and stat.S_IMODE(info.st_mode) == 0o600)


def persist_receipt(fd, directory, name, data):
    require(0 < len(data) <= MAX_RECORD, "JAMMY_PREPARATION_CUSTODY_SIZE")
    require(os.write(fd, data) == len(data), "JAMMY_PREPARATION_CUSTODY_SHORT_WRITE")
    os.fsync(fd)
    os.fsync(directory)
    info = os.fstat(fd)
    require(valid_receipt(info) and info.st_size == len(data), "JAMMY_PREPARATION_CUSTODY_RECEIPT")
    require(identity(os.stat(name, dir_fd=directory, follow_symlinks=False)) == identity(info),
            "JAMMY_PREPARATION_CUSTODY_REPLACED")
    return sha256(data)


def publish_digest(evidence, kind, digest):
    line = f"jammyPreflight{kind}Sha256={digest}\n"
    require(evidence.write(line) == len(line), "JAMMY_PREPARATION_CUSTODY_EVIDENCE")
    evidence.flush()


def provision_preflight_scope(prepared, receipt_dir_fd, evidence):
    """Retain an intent digest before creating the runtime base and lock."""
    run = prepared.run
    verify_run(run, run.source)
    require(run.unit_nonce is None and private_directory(os.fstat(receipt_dir_fd)),
            "JAMMY_PREPARATION_CUSTODY_OUTPUT")
    nonce = secrets.token_hex(16)
    boot = boot_id()
    controller = capture_owner(os.getpid())
    approval = {"workflowId": prepared.workflow_id, "tree": prepared.tree,
                "workflowSha256": prepared.workflow_sha256}
    inventory = sha256(prepared.receipt)
    name = custody_receipt_name(run)
    receipt_fd = open_new_receipt(receipt_dir_fd, name)
    try:
        placeholder = os.fstat(receipt_fd)
        require(valid_receipt(placeholder) and placeholder.st_size == 0, "JAMMY_PREPARATION_CUSTODY_RECEIPT")
        intent_name = intent_receipt_name(run)
        intent_fd = open_new_receipt(receipt_dir_fd, intent_name)
        try:
            intent = encode_record({**receipt_identity(run, approval, inventory, boot, controller, nonce),
                                    "kind": "JAMMY_PREFLIGHT_INTENT_V1", "receipt": list(identity(placeholder))})
            digest = persist_receipt(intent_fd, receipt_dir_fd, intent_name, intent)
        finally:
            os.close(intent_fd)
        publish_digest(evidence, "Intent", digest)
        binding = provision_binding(run.run_id, nonce)
        scope = Scope(replace(run, unit_nonce=nonce), nonce, custody=binding)
        data = encode_custody_receipt(scope, approval, inventory, boot, controller)
        return scope, persist_receipt(receipt_fd, receipt_dir_fd, name, data)
    finally:
        os.close(receipt_fd)


def read_custody_receipt(run, receipt_dir_fd, *, intent=False):
    require(private_directory(os.fstat(receipt_dir_fd)), "JAMMY_PREPARATION_CUSTODY_OUTPUT")
    name = intent_receipt_name(run) if intent else custody_receipt_name(run)
    flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK
    with os.fdopen(os.open(name, flags, dir_fd=receipt_dir_fd), "rb") as stream:
        info = os.fstat(stream.fileno())
        require(valid_receipt(info), "JAMMY_PREPARATION_CUSTODY_RECEIPT")
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
    require(data == encode_custody_receipt(scope, approval, receipt_sha256, boot_id(), proof.get("controller")),
            "JAMMY_PREPARATION_CUSTODY_RECEIPT")
    # The launcher independently verifies the saved inodes, lease, and terminated owners.
    return recover_after_cancellation(scope, bootstrap_owner=proof.get("controller"))


def reconcile_preflight_intent(run_id, approval, token, receipt_dir_fd, expected_intent_sha256):
    """Confirm interruption before runtime custody, or retain the scope for review."""
    approval = dict(approval) if type(approval) is dict else approval
    run = authenticate_jammy_preflight_run(run_id, approval, token)
    data = read_custody_receipt(run, receipt_dir_fd, intent=True)
    require(sha256(data) == expected_intent_sha256, "JAMMY_PREPARATION_INTENT_DIGEST")
    proof = json.loads(data)
    require(type(proof) is dict and type(proof.get("nonce")) is str and
            re.fullmatch(r"[a-f0-9]{32}", proof["nonce"]) and type(proof.get("receipt")) is list and
            len(proof["receipt"]) == 2 and all(type(item) is int and 0 < item < 2**64 for item in proof["receipt"]),
            "JAMMY_PREPARATION_INTENT_RECEIPT")
    nonce, controller = proof["nonce"], proof.get("controller")
    inventory = load_plan()["inventory"]["receiptSha256"]
    expected = encode_record({**receipt_identity(run, approval, inventory, boot_id(), controller, nonce),
                              "kind": "JAMMY_PREFLIGHT_INTENT_V1", "receipt": proof["receipt"]})
    require(data == expected, "JAMMY_PREPARATION_INTENT_RECEIPT")
    verify_owner_gone(controller)
    final = os.stat(custody_receipt_name(run), dir_fd=receipt_dir_fd, follow_symlinks=False)
    require(valid_receipt(final) and final.st_size == 0 and list(identity(final)) == proof["receipt"],
            "JAMMY_PREPARATION_INTENT_HELD")
    require_absent_intent_base(run, nonce)
    return True


def require_absent_intent_base(run, nonce):
    # A directory without an independently authenticated inode binding is held,
    # even if it happens to look empty. Never remove it from intent alone.
    base = base_path(run.run_id, nonce)
    root = base.parent
    require(root.resolve(strict=True) == root, "JAMMY_PREPARATION_INTENT_ROOT")
    fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        opened = os.fstat(fd)
        require(private_directory(opened) and identity(opened) ==
                identity(os.stat(root, follow_symlinks=False)), "JAMMY_PREPARATION_INTENT_ROOT")
        try:
            os.stat(base.name, dir_fd=fd, follow_symlinks=False)
        except FileNotFoundError:
            return
        raise ValueError("JAMMY_PREPARATION_INTENT_HELD")
    finally:
        os.close(fd)


def run_published_preflight(run_id, approval, token, receipt, receipt_dir_fd, evidence):
    """Handoff from the trusted provider wrapper. Publication and dispatch stay externally gated."""
    require(worker.NATIVE_ENABLED is True, "LAUNCH_ACTION_NOT_AUTHORIZED")
    tracking = os.environ.get("RUNNER_TRACKING_ID", "")
    runner_image = os.environ.get("ImageVersion", "")
    runner_temp = Path(os.environ.get("RUNNER_TEMP", ""))
    require(re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", tracking) and runner_temp.is_absolute()
            and runner_temp.resolve(strict=True) == runner_temp, "JAMMY_PREPARATION_ENVIRONMENT")
    prepared = prepare_runtime_inputs(run_id, approval, token, receipt, runner_image)
    scope, digest = provision_preflight_scope(prepared, receipt_dir_fd, evidence)
    publish_digest(evidence, "Custody", digest)
    return worker.controller(scope, prepared.run.source, prepared.receipt, prepared.members,
                             tracking, runner_image, runner_temp, authorized_run=prepared.run)
