"""Verify the controller bundle before any repository module is imported."""
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path

CONTROLLER = "scripts/sounding-line/b-c856-linux-controller"
ENTRY = "jammy_preflight_workflow.py"
MAX_ENTRIES = 128
MAX_FILE = 4 * 1024 * 1024
MAX_BUNDLE = 16 * 1024 * 1024
MAX_APPROVAL = 96 * 1024


def require(condition, code):
    if not condition:
        raise ValueError(code)


def git(root, *arguments):
    environment = {
        "PATH": "/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_OPTIONAL_LOCKS": "0", "GIT_NO_REPLACE_OBJECTS": "1", "GIT_NO_LAZY_FETCH": "1",
        "GIT_TERMINAL_PROMPT": "0", "LC_ALL": "C",
    }
    result = subprocess.run(["/usr/bin/git", "-c", "core.fsmonitor=false", "-C", str(root), *arguments],
                            env=environment, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10)
    require(result.returncode == 0 and len(result.stdout) <= 64 * 1024, "JAMMY_CHECKOUT_GIT_READ")
    return result.stdout


def current_publication():
    raw = os.environ.get("JAMMY_PREFLIGHT_APPROVAL", "")
    require(0 < len(raw) <= MAX_APPROVAL and raw.isascii(), "JAMMY_CHECKOUT_APPROVAL_SIZE")
    record = json.loads(raw)
    publication = record.get("publication") if type(record) is dict else None
    require(type(publication) is dict and
            all(type(publication.get(key)) is str and re.fullmatch(r"[a-f0-9]{40}", publication[key])
                for key in ("source", "tree")) and
            publication["source"] == os.environ.get("GITHUB_SHA") == os.environ.get("REQUESTED_SOURCE"),
            "JAMMY_CHECKOUT_APPROVAL_SOURCE")
    return publication


def tracked_bundle(root):
    rows = git(root, "ls-tree", "-r", "-z", "-l", "HEAD", "--", CONTROLLER).split(b"\0")
    require(rows[-1] == b"" and 0 < len(rows) - 1 <= MAX_ENTRIES, "JAMMY_CHECKOUT_TREE_ENTRIES")
    expected = {}
    total = 0
    prefix = f"{CONTROLLER}/".encode("ascii")
    for row in rows[:-1]:
        header, separator, path = row.partition(b"\t")
        fields = header.split()
        name = path[len(prefix):]
        require(separator and path.startswith(prefix) and len(fields) == 4 and fields[0] in (b"100644", b"100755")
                and fields[1] == b"blob" and re.fullmatch(rb"[a-f0-9]{40}", fields[2])
                and re.fullmatch(rb"[0-9]{1,8}", fields[3]) and re.fullmatch(rb"[A-Za-z0-9_.-]+", name),
                "JAMMY_CHECKOUT_TREE_ENTRY")
        filename, size = name.decode("ascii"), int(fields[3])
        require(filename not in expected and filename not in (".", "..") and size <= MAX_FILE,
                "JAMMY_CHECKOUT_TREE_ENTRY")
        total += size
        require(total <= MAX_BUNDLE, "JAMMY_CHECKOUT_TREE_SIZE")
        expected[filename] = (fields[2].decode("ascii"), size)
    return expected


def verify_blob(file, git_hash, size):
    before = file.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_size == size, "JAMMY_CHECKOUT_BLOB")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0) | getattr(os, "O_NONBLOCK", 0)
    with os.fdopen(os.open(file, flags), "rb") as stream:
        opened = os.fstat(stream.fileno())
        require(stat.S_ISREG(opened.st_mode) and opened.st_size == size and
                (opened.st_dev, opened.st_ino) == (before.st_dev, before.st_ino), "JAMMY_CHECKOUT_BLOB")
        data = stream.read(size + 1)
    checksum = hashlib.sha1(f"blob {size}\0".encode("ascii") + data).hexdigest()
    require(len(data) == size and checksum == git_hash, "JAMMY_CHECKOUT_BLOB")


def verify_bundle(root, publication):
    observed = git(root, "rev-parse", "HEAD", "HEAD^{tree}").decode("ascii").splitlines()
    require(observed == [publication["source"], publication["tree"]], "JAMMY_CHECKOUT_IDENTITY")
    expected = tracked_bundle(root)
    directory = root / CONTROLLER
    require(directory.resolve(strict=True) == directory and ENTRY in expected, "JAMMY_CHECKOUT_DIRECTORY")
    with os.scandir(directory) as entries:
        found = set()
        for item in entries:
            require(item.name in expected and item.is_file(follow_symlinks=False), "JAMMY_CHECKOUT_FILE_SET")
            found.add(item.name)
    require(found == expected.keys(), "JAMMY_CHECKOUT_FILE_SET")
    for name, pin in expected.items():
        verify_blob(directory / name, *pin)
    return directory / ENTRY


def main(args):
    try:
        require(sys.platform == "linux" and len(args) == 1 and args[0] in ("launch", "recover"),
                "JAMMY_CHECKOUT_ENTRY")
        entry = verify_bundle(Path.cwd(), current_publication())
        os.execv(sys.executable, [sys.executable, "-IB", str(entry), args[0]])
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        hint = str(error)
        reason = hint if re.fullmatch(r"JAMMY_CHECKOUT_[A-Z_]+", hint) else "JAMMY_CHECKOUT_REFUSED"
        print(json.dumps({"kind": "JAMMY_PREFLIGHT_REFUSED", "primary": reason, "qualification": False}), flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
