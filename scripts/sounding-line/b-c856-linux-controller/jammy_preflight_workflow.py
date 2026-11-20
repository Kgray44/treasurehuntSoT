"""GitHub Actions transport for the held Jammy controller and recovery entry."""
import io
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))

import jammy_preflight_entry as entry
from jammy_native_runtime_inputs import require
from jammy_preflight_provider import OPERATION
from jammy_preflight_supervisor import PreflightFailure

ROOT = Path(__file__).resolve().parents[3]
CONTROLLER = "scripts/sounding-line/b-c856-linux-controller"


class WorkflowEvidence:
    def __init__(self, provider, step):
        self.provider = provider
        self.step = step

    def write(self, line):
        match = re.fullmatch(r"jammyPreflightCustodySha256=([a-f0-9]{64})\n", line)
        require(match, "JAMMY_ENTRY_WORKFLOW_EVIDENCE")
        step_line = f"custody_sha256={match[1]}\n"
        require(self.step.write(step_line) == len(step_line) and self.provider.write(line) == len(line),
                "JAMMY_ENTRY_WORKFLOW_EVIDENCE")
        return len(line)

    def flush(self):
        self.step.flush()
        self.provider.flush()


def approved_ingress(operation):
    raw = os.environ.pop("JAMMY_PREFLIGHT_APPROVAL", "")
    require(0 < len(raw) <= entry.APPROVAL_LIMIT and raw.isascii(), "JAMMY_ENTRY_APPROVAL_SIZE")
    data = entry.read_approval(io.BytesIO(raw.encode("ascii")), "launch")
    run_id, publication = entry.validate_approval(data)
    require(os.environ.get("REQUESTED_SOURCE") == publication["source"] and
            os.environ.get("REQUESTED_OPERATION") == OPERATION, "JAMMY_ENTRY_DISPATCH")
    if operation == "recover":
        del data["inventoryReceipt"]
        data["custodyReceiptSha256"] = os.environ.get("PRIOR_CUSTODY_SHA256", "")
    return run_id, publication, io.BytesIO(json.dumps(data, separators=(",", ":")).encode("ascii"))


def verify_checkout(publication):
    environment = {"PATH": "/usr/bin:/bin", "GIT_OPTIONAL_LOCKS": "0", "GIT_NO_REPLACE_OBJECTS": "1",
                   "GIT_TERMINAL_PROMPT": "0", "LC_ALL": "C"}
    command = ["/usr/bin/git", "-c", "core.fsmonitor=false", "-C", str(ROOT)]
    observed = subprocess.run(command + ["rev-parse", "HEAD", "HEAD^{tree}"], env=environment,
                              capture_output=True, text=True, timeout=10, check=False)
    require(observed.returncode == 0 and observed.stdout.splitlines() == [publication["source"], publication["tree"]],
            "JAMMY_ENTRY_CHECKOUT_IDENTITY")
    checkout = subprocess.run(command + ["diff", "--quiet", "--no-ext-diff", "HEAD", "--", CONTROLLER],
                              env=environment, capture_output=True, timeout=10, check=False)
    require(checkout.returncode == 0, "JAMMY_ENTRY_CHECKOUT_DIRTY")


def open_step_output(runner_temp):
    path = Path(os.environ.get("GITHUB_OUTPUT", ""))
    require(path.is_absolute() and path.is_relative_to(runner_temp) and path.resolve(strict=True) == path,
            "JAMMY_ENTRY_WORKFLOW_OUTPUT")
    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 1001 and info.st_nlink == 1,
                "JAMMY_ENTRY_WORKFLOW_OUTPUT")
        return os.fdopen(fd, "a", encoding="ascii")
    except BaseException:
        os.close(fd)
        raise


def run_step(operation, stdout):
    require(operation in ("launch", "recover"), "JAMMY_ENTRY_OPERATION")
    if operation == "launch":
        require(entry.worker.NATIVE_ENABLED is True, "LAUNCH_ACTION_NOT_AUTHORIZED")
    require(sys.platform == "linux" and os.environ.get("GITHUB_ACTIONS") == "true",
            "JAMMY_ENTRY_PLATFORM")
    run_id, publication, ingress = approved_ingress(operation)
    verify_checkout(publication)
    runner_temp = Path(os.environ.get("RUNNER_TEMP", ""))
    require(runner_temp.is_absolute() and runner_temp.resolve(strict=True) == runner_temp,
            "JAMMY_ENTRY_RECEIPT_DIRECTORY")
    receipt_directory = runner_temp / f"sl-jammy-receipts-{run_id}"
    if operation == "recover":
        return entry.run(operation, receipt_directory, ingress, stdout)
    with open_step_output(runner_temp) as output:
        receipt_directory.mkdir(mode=0o700)
        return entry.run(operation, receipt_directory, ingress, WorkflowEvidence(stdout, output))


def main(args):
    try:
        require(len(args) == 1, "JAMMY_ENTRY_ARGUMENTS")
        result = run_step(args[0], sys.stdout)
    except (OSError, ValueError, TypeError, KeyError, PreflightFailure, subprocess.TimeoutExpired) as error:
        print(json.dumps(entry.failure_record(error), sort_keys=True), flush=True)
        return 1
    print(json.dumps(result, sort_keys=True), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
