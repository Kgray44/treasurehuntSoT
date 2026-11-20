"""Exercise the protected job recovery transport with one owned marker."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import time

OPERATION = "recovery-transport-only"
MAX_RECORD = 4096


def require(condition, code):
    if not condition:
        raise ValueError(code)


def marker_bytes(record, info):
    payload = {**record, "markerDevice": info.st_dev, "markerInode": info.st_ino}
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("ascii")


def create_marker(path, record):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as stream:
        data = marker_bytes(record, os.fstat(stream.fileno()))
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    return hashlib.sha256(data).hexdigest()


def remove_marker(path, record, digest):
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0))
    with os.fdopen(fd, "rb") as stream:
        info = os.fstat(stream.fileno())
        expected = marker_bytes(record, info)
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size == len(expected),
                "JAMMY_REHEARSAL_MARKER_IDENTITY")
        if sys.platform == "linux":
            require(info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o600,
                    "JAMMY_REHEARSAL_MARKER_IDENTITY")
        data = stream.read(MAX_RECORD + 1)
        require(data == expected and hashlib.sha256(data).hexdigest() == digest,
                "JAMMY_REHEARSAL_MARKER_IDENTITY")
    current = path.lstat()
    require((current.st_dev, current.st_ino) == (info.st_dev, info.st_ino),
            "JAMMY_REHEARSAL_MARKER_IDENTITY")
    path.unlink()


def run_context():
    env = os.environ
    source = env["GITHUB_SHA"]
    run_id = env["GITHUB_RUN_ID"]
    require(sys.platform == "linux" and os.getuid() == os.geteuid() == 1001 and
            env.get("GITHUB_ACTIONS") == "true" and env.get("RUNNER_ENVIRONMENT") == "github-hosted" and
            env.get("GITHUB_REPOSITORY") == "Kgray44/treasurehuntSoT" and env.get("GITHUB_REF") == "refs/heads/main" and
            env.get("GITHUB_EVENT_NAME") == "workflow_dispatch" and env.get("GITHUB_RUN_ATTEMPT") == "1" and
            env.get("REQUESTED_OPERATION") == OPERATION and env.get("REQUESTED_SOURCE") == source and
            env.get("GITHUB_WORKFLOW_SHA") == source and env.get("GITHUB_ACTOR") == env.get("GITHUB_TRIGGERING_ACTOR") == "Kgray44" and
            re.fullmatch(r"[a-f0-9]{40}", source) and re.fullmatch(r"[1-9][0-9]{0,14}", run_id),
            "JAMMY_REHEARSAL_RUN")
    root = Path(env["RUNNER_TEMP"])
    require(root.is_absolute() and root.resolve(strict=True) == root and root.is_dir() and
            root.stat().st_uid == 1001, "JAMMY_REHEARSAL_SCRATCH")
    with Path("/proc/sys/kernel/random/boot_id").open(encoding="ascii") as stream:
        boot_id = stream.read(80).strip()
    require(re.fullmatch(r"[a-f0-9-]{36}", boot_id), "JAMMY_REHEARSAL_BOOT")
    image = env["ImageVersion"]
    require(re.fullmatch(r"[0-9.]{3,32}", image), "JAMMY_REHEARSAL_IMAGE")
    record = {"runId": int(run_id), "attempt": 1, "source": source, "image": image,
              "kernel": os.uname().release, "bootSha256": hashlib.sha256(boot_id.encode("ascii")).hexdigest()}
    return root, root / f"sl-jammy-rehearsal-{run_id}.json", record


def main(args):
    require(len(args) == 1 and args[0] in ("exercise", "recover"), "JAMMY_REHEARSAL_OPERATION")
    root, marker, record = run_context()
    if args[0] == "exercise":
        output = Path(os.environ["GITHUB_OUTPUT"])
        require(output.is_absolute() and output.is_relative_to(root) and output.resolve(strict=True) == output,
                "JAMMY_REHEARSAL_OUTPUT")
        fd = os.open(output, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(fd, "a", encoding="ascii") as stream:
            info = os.fstat(stream.fileno())
            require(stat.S_ISREG(info.st_mode) and info.st_uid == 1001 and info.st_nlink == 1,
                    "JAMMY_REHEARSAL_OUTPUT")
            digest = create_marker(marker, record)
            stream.write(f"intent_sha256={digest}\n")
            stream.flush()
            os.fsync(stream.fileno())
        print(f"jammyRehearsalIntentSha256={digest}", flush=True)
        time.sleep(60)
        raise ValueError("JAMMY_REHEARSAL_CANCELLATION_NOT_OBSERVED")
    digest = os.environ.get("REHEARSAL_INTENT_SHA256", "")
    require(re.fullmatch(r"[a-f0-9]{64}", digest), "JAMMY_REHEARSAL_MARKER_IDENTITY")
    remove_marker(marker, record, digest)
    cancelled = os.environ.get("REHEARSAL_CANCELLED") == "true"
    print(json.dumps({**record, "kind": "JAMMY_RECOVERY_TRANSPORT_ONLY", "intentSha256": digest,
                      "cancelled": cancelled, "markerRemoved": True, "qualification": False},
                     sort_keys=True, separators=(",", ":")), flush=True)
    require(cancelled, "JAMMY_REHEARSAL_CANCELLATION_NOT_OBSERVED")


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except KeyboardInterrupt:
        raise SystemExit(130) from None
    except ValueError as error:
        reason = str(error)
        raise SystemExit(reason if re.fullmatch(r"JAMMY_REHEARSAL_[A-Z_]+", reason)
                         else "JAMMY_REHEARSAL_REFUSED") from None
    except (OSError, KeyError):
        raise SystemExit("JAMMY_REHEARSAL_REFUSED") from None
