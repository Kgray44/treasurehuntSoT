"""Offline checks for pinned private-runtime inputs. This module launches nothing."""
import argparse
import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path

PLAN = Path(__file__).with_name("jammy-native-runtime-inputs.json")
PLAN_SHA256 = "6f6e9900e45aac6b8e7fc4b5063fdffb1c12c073c48f53b51562eb9b52cee273"
RECEIPT_LIMIT = 64*1024
LISTING_LIMIT = 8192
SELECTED_LIMIT = 8*1024*1024
ADDRESS = r"\(0x[0-9a-fA-F]{1,16}\)"


def require(condition, code):
    if not condition:
        raise ValueError(code)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def bounded_read(stream, limit, code):
    data = stream.read(limit+1)
    require(0 < len(data) <= limit, code)
    return data


def load_plan():
    with PLAN.open("rb") as stream:
        data = bounded_read(stream, 8192, "RUNTIME_INPUT_PLAN_SIZE")
    require(sha256(data) == PLAN_SHA256, "RUNTIME_INPUT_PLAN_PIN")
    plan = json.loads(data)
    require(plan["runtimeAuthorized"] is False and plan["reuseAuthorized"] is False,
            "RUNTIME_INPUT_PLAN_AUTHORITY")
    return plan


def verify_inventory(plan, data):
    pin = plan["inventory"]
    require(0 < len(data) <= RECEIPT_LIMIT and sha256(data) == pin["receiptSha256"],
            "RUNTIME_INPUT_RECEIPT_PIN")
    receipt = json.loads(data)
    require(receipt["source"] == receipt["workflowSha"] == pin["source"] and
            receipt["runId"] == pin["run"] and receipt["attempt"] == pin["attempt"] and
            receipt["manifestSha256"] == pin["manifestSha256"] and receipt["runner"] == pin["runner"] and
            receipt["status"] == "STATIC_INVENTORY_ONLY" and receipt["ownedScratchRemoved"] is True and
            receipt["unverifiedRuntimeDenials"] == plan["requiredRuntimeDenials"] and
            all(receipt[name] is False for name in ("runtimeAdmitted", "qualification",
                                                   "externalIsolationProved", "reuseAuthorized")),
            "RUNTIME_INPUT_RECEIPT_SCOPE")
    actual, expected = receipt["members"], plan["members"]
    require(actual.keys() == expected.keys() and
            all(all(actual[name][field] == row[field] for field in ("member", "bytes", "sha256"))
                for name, row in expected.items()), "RUNTIME_INPUT_MEMBER_IDENTITY")
    interpreter = plan["interpreter"]["target"]
    require(actual["bwrap"]["interpreter"] == interpreter, "RUNTIME_INPUT_INTERPRETER")
    return actual


def staged_paths(plan):
    targets = {member["target"]: name for name, member in plan["members"].items()}
    interpreter = plan["interpreter"]
    require(len(targets) == len(plan["members"]) and interpreter["target"] not in targets and
            interpreter["member"] in plan["members"], "RUNTIME_INPUT_STAGE_COLLISION")
    targets[interpreter["target"]] = interpreter["member"]
    return targets


def bind_member_bytes(plan, payloads):
    expected = plan["members"]
    require(payloads.keys() == expected.keys(), "RUNTIME_INPUT_PAYLOAD_SET")
    total = 0
    for name, data in payloads.items():
        pin = expected[name]
        require(type(data) is bytes and 0 < len(data) == pin["bytes"] <= 4*1024*1024 and
                sha256(data) == pin["sha256"], "RUNTIME_INPUT_PAYLOAD_PIN")
        total += len(data)
        require(total <= SELECTED_LIMIT, "RUNTIME_INPUT_PAYLOAD_LIMIT")
    return {target: payloads[name] for target, name in staged_paths(plan).items()}


def read_local_member(source, size):
    first = source.lstat()
    require(source.resolve(strict=True) == source and stat.S_ISREG(first.st_mode),
            "RUNTIME_INPUT_PAYLOAD_PATH")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_BINARY", 0)
    with os.fdopen(os.open(source, flags), "rb") as stream:
        opened = os.fstat(stream.fileno())
        require(stat.S_ISREG(opened.st_mode) and opened.st_size == size and
                (opened.st_dev, opened.st_ino) == (first.st_dev, first.st_ino),
                "RUNTIME_INPUT_PAYLOAD_PATH")
        return bounded_read(stream, size, "RUNTIME_INPUT_PAYLOAD_PIN")


def verify_loader_listing(plan, observed, stdout, stderr=b""):
    require(0 < len(stdout) <= LISTING_LIMIT and not stderr, "RUNTIME_INPUT_LISTING_SIZE")
    interpreter = plan["interpreter"]
    required = {interpreter["member"]}
    pending = list(observed["bwrap"]["needed"])
    while pending:
        name = pending.pop()
        require(name in observed and name != "bwrap", "RUNTIME_INPUT_LISTING_DEPENDENCY")
        if name not in required:
            required.add(name)
            pending.extend(observed[name]["needed"])
    expected = {name: plan["members"][name]["target"] for name in required}
    expected[interpreter["member"]] = interpreter["target"]

    found, vdso = {}, False
    for raw in stdout.decode("ascii").splitlines():
        line = raw.strip()
        if re.fullmatch(r"linux-vdso\.so\.1 "+ADDRESS, line):
            require(not vdso, "RUNTIME_INPUT_LISTING_DUPLICATE")
            vdso = True
            continue
        direct = re.fullmatch(re.escape(interpreter["target"])+r" "+ADDRESS, line)
        if direct:
            name, path = interpreter["member"], interpreter["target"]
        else:
            matched = re.fullmatch(r"([A-Za-z0-9_.-]+) => (/[^ ]+) "+ADDRESS, line)
            require(matched is not None, "RUNTIME_INPUT_LISTING_SYNTAX")
            name, path = matched.groups()
        require(name not in found and expected.get(name) == path, "RUNTIME_INPUT_LISTING_PATH")
        found[name] = path
    require(vdso and found == expected, "RUNTIME_INPUT_LISTING_COVERAGE")
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--listing", type=Path, help="Optional untrusted offline loader listing fixture")
    parser.add_argument("--member-directory", type=Path, help="Optional local directory with the seven original members")
    args = parser.parse_args()
    plan = load_plan()
    raw = bounded_read(sys.stdin.buffer, RECEIPT_LIMIT+2, "RUNTIME_INPUT_RECEIPT_SIZE")
    # The provider prints a terminal line ending outside the hashed receipt.
    data = raw.removesuffix(b"\n").removesuffix(b"\r")
    observed = verify_inventory(plan, data)
    result = {"kind": "STATIC_RUNTIME_INPUTS_ONLY", "planSha256": PLAN_SHA256,
              "inventoryReceiptSha256": sha256(data), "stageTargets": staged_paths(plan),
              "unverifiedRuntimeDenials": plan["requiredRuntimeDenials"], "runtimeAdmitted": False,
              "externalIsolationProved": False, "reuseAuthorized": False}
    if args.listing:
        with args.listing.open("rb") as stream:
            listing = bounded_read(stream, LISTING_LIMIT, "RUNTIME_INPUT_LISTING_SIZE")
        result["offlineListingMatches"] = verify_loader_listing(plan, observed, listing)
    if args.member_directory:
        root = args.member_directory.resolve(strict=True)
        payloads = {name: read_local_member(root/member["member"], member["bytes"])
                    for name, member in plan["members"].items()}
        result["offlineStageTargetCount"] = len(bind_member_bytes(plan, payloads))
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError) as error:
        message = str(error)
        raise SystemExit(message if re.fullmatch(r"RUNTIME_INPUT_[A-Z_]+", message)
                         else "RUNTIME_INPUT_REFUSED") from None
