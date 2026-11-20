"""Trusted-runner ingress for the held Jammy action and its same-boot recovery."""
import base64
import binascii
import json
import os
import re
import sys
from pathlib import Path

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))

import jammy_preflight_worker as worker
from jammy_native_runtime_inputs import RECEIPT_LIMIT, bounded_read, require
from jammy_preflight_preparation import reconcile_preflight_intent, recover_preflight_scope, run_published_preflight
from jammy_preflight_provider import OPERATION, REPOSITORY
from jammy_preflight_supervisor import CLEANUP, PreflightFailure

APPROVAL_LIMIT = 96 * 1024
CLEANUP_STAGES = {*CLEANUP, "passive_recovery", "watchdog_retirement",
                  "trusted_command_reap", "unpublished_lease_recovery"}
PUBLICATION_FIELDS = {"workflowId", "source", "tree", "workflowSha256"}
SAFE_CODE = re.compile(r"(?:JAMMY_(?:ENTRY|PREPARATION|PROVIDER)|LAUNCH|PREFLIGHT|RUNTIME_INPUT|INVENTORY)_[A-Z0-9_]{1,90}")


def unique_object(items):
    result = dict(items)
    require(len(result) == len(items), "JAMMY_ENTRY_APPROVAL_DUPLICATE")
    return result


def read_approval(stream, operation):
    data = json.loads(bounded_read(stream, APPROVAL_LIMIT, "JAMMY_ENTRY_APPROVAL_SIZE"),
                      object_pairs_hook=unique_object)
    payloads = ("inventoryReceipt",) if operation == "launch" else ("custodyReceiptSha256", "intentReceiptSha256")
    require(type(data) is dict and any(set(data) == {"publication", "dispatch", payload} for payload in payloads),
            "JAMMY_ENTRY_APPROVAL")
    return data


def validate_approval(data):
    publication, dispatch = data["publication"], data["dispatch"]
    require(type(publication) is dict and set(publication) == PUBLICATION_FIELDS and
            type(publication["workflowId"]) is int and 0 < publication["workflowId"] < 10**15 and
            all(type(publication[key]) is str and re.fullmatch(pattern, publication[key])
                for key, pattern in (("source", "[a-f0-9]{40}"), ("tree", "[a-f0-9]{40}"),
                                     ("workflowSha256", "[a-f0-9]{64}"))), "JAMMY_ENTRY_PUBLICATION")
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    require(re.fullmatch(r"[1-9][0-9]{0,14}", run_id) and os.environ.get("GITHUB_RUN_ATTEMPT") == "1" and
            os.environ.get("GITHUB_SHA") == publication["source"] and
            os.environ.get("GITHUB_REF") == "refs/heads/main" and os.environ.get("GITHUB_REPOSITORY") == REPOSITORY and
            os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch", "JAMMY_ENTRY_RUN")
    expected = {
        "workflowId": publication["workflowId"], "source": publication["source"], "runId": int(run_id),
        "attempt": 1, "repository": REPOSITORY, "ref": "refs/heads/main", "operation": OPERATION,
    }
    require(type(dispatch) is dict and dispatch == expected and
            all(type(dispatch[key]) is int for key in ("workflowId", "runId", "attempt")), "JAMMY_ENTRY_DISPATCH")
    return int(run_id), publication


def decode_inventory(encoded):
    require(type(encoded) is str and 0 < len(encoded) <= 4 * ((RECEIPT_LIMIT + 2) // 3),
            "JAMMY_ENTRY_INVENTORY")
    try:
        receipt = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("JAMMY_ENTRY_INVENTORY") from None
    require(0 < len(receipt) <= RECEIPT_LIMIT and base64.b64encode(receipt).decode("ascii") == encoded,
            "JAMMY_ENTRY_INVENTORY")
    return receipt


def run(operation, receipt_directory, ingress, evidence):
    require(operation in ("launch", "recover"), "JAMMY_ENTRY_OPERATION")
    if operation == "launch":
        require(worker.NATIVE_ENABLED is True, "LAUNCH_ACTION_NOT_AUTHORIZED")
    require(sys.platform == "linux", "JAMMY_ENTRY_PLATFORM")
    data = read_approval(ingress, operation)
    run_id, publication = validate_approval(data)
    if operation == "launch":
        payload = decode_inventory(data["inventoryReceipt"])
    else:
        intent_only = "intentReceiptSha256" in data
        payload = data["intentReceiptSha256" if intent_only else "custodyReceiptSha256"]
        require(type(payload) is str and re.fullmatch(r"[a-f0-9]{64}", payload), "JAMMY_ENTRY_CUSTODY_DIGEST")
    token = os.environ.pop("JAMMY_PREFLIGHT_TOKEN", "")
    require(0 < len(token) <= 512 and re.fullmatch(r"[A-Za-z0-9_.-]+", token), "JAMMY_ENTRY_TOKEN")
    directory = Path(receipt_directory)
    require(directory.is_absolute() and directory.resolve(strict=True) == directory, "JAMMY_ENTRY_RECEIPT_DIRECTORY")
    fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        if operation == "launch":
            return run_published_preflight(run_id, publication, token, payload, fd, evidence)
        if intent_only:
            require(reconcile_preflight_intent(run_id, publication, token, fd, payload) is True,
                    "JAMMY_ENTRY_RECOVERY_UNVERIFIED")
            return {"kind": "JAMMY_PREFLIGHT_INTERRUPTED_BEFORE_CUSTODY", "run": run_id, "attempt": 1,
                    "source": publication["source"], "runtimeCustodyPresent": False,
                    "qualification": False, "externalIsolationProved": False, "reuseAuthorized": False}
        require(recover_preflight_scope(run_id, publication, token, fd, payload) is True,
                "JAMMY_ENTRY_RECOVERY_UNVERIFIED")
        return {"kind": "JAMMY_PREFLIGHT_RECOVERY_ONLY", "run": run_id, "attempt": 1,
                "source": publication["source"], "cleanupVerified": True,
                "qualification": False, "externalIsolationProved": False, "reuseAuthorized": False}
    finally:
        os.close(fd)


def error_code(error):
    if isinstance(error, ValueError) and SAFE_CODE.fullmatch(str(error)):
        return str(error)
    if isinstance(error, OSError):
        return "JAMMY_ENTRY_OS_ERROR"
    return "JAMMY_ENTRY_REFUSED"


def failure_parts(error):
    if not isinstance(error, PreflightFailure):
        return (error_code(error) if error is not None else None), []
    primary, cleanup = failure_parts(error.primary)
    for stage, cause in error.cleanup:
        code, subsidiary = failure_parts(cause)
        cleanup.append({"stage": stage if stage in CLEANUP_STAGES else "cleanup", "code": code})
        cleanup.extend(subsidiary)
    return primary, cleanup


def failure_record(error):
    primary, cleanup = failure_parts(error)
    return {"kind": "JAMMY_PREFLIGHT_REFUSED", "primary": primary, "cleanup": cleanup,
            "qualification": False, "externalIsolationProved": False, "reuseAuthorized": False}


def main(args):
    try:
        require(len(args) == 2, "JAMMY_ENTRY_ARGUMENTS")
        result = run(args[0], args[1], sys.stdin.buffer, sys.stdout)
    except (OSError, ValueError, TypeError, KeyError, PreflightFailure) as error:
        print(json.dumps(failure_record(error), sort_keys=True), flush=True)
        return 1
    print(json.dumps(result, sort_keys=True), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
