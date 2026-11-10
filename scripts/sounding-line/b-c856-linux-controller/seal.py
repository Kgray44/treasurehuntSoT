"""Seal an already-built Linux C856 bundle without fetching or installing inputs.

Run only in the independently reviewed native publisher environment.
The consumer binds the resulting artifact to that protected workflow run.
"""
import argparse
import hashlib
import os
import platform
import re
import stat
import subprocess
import sys
import tarfile
from pathlib import Path

from admission import ACTOR, MAX_CAPSULE, MIB, REPOSITORY, SOURCE, TREE, WORKFLOW_PATH, available, need
from capsule import (BROWSER, BROWSER_PLAN, MAX_ENTRIES, MAX_SEED, MAX_TAR_OVERHEAD,
                     digest, manifest_check, parse_json, valid_path)
from controller import v3_bytes, write_document

STAGED_SEED_LIMIT = MAX_SEED + 1


def git(root, *args):
    return subprocess.check_output(
        ["/usr/bin/git", "-c", "protocol.allow=never", *args], cwd=root,
        env={"PATH": "/usr/bin:/bin", "GIT_NO_LAZY_FETCH": "1", "GIT_NO_REPLACE_OBJECTS": "1",
             "GIT_OPTIONAL_LOCKS": "0", "LC_ALL": "C"}, timeout=10,
    )


def source_binding(source, node, temporary, plan):
    need(git(source, "rev-parse", "HEAD").strip().decode("ascii") == SOURCE and
         git(source, "rev-parse", "HEAD^{tree}").strip().decode("ascii") == TREE, "NATIVE_SOURCE_IDENTITY")
    git(source, "diff", "--quiet", "HEAD", "--")
    with temporary.open("xb") as stream:
        stream.write(v3_bytes()["source.mjs"])
    try:
        run = subprocess.run([str(node), str(temporary), str(source)], capture_output=True, check=False,
                             env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"}, timeout=40)
        need(run.returncode == 0 and 0 < len(run.stdout) <= 128*1024 and
             parse_json(run.stdout) == parse_json(plan), "NATIVE_SOURCE_PLAN")
    finally:
        temporary.unlink()


def pin_run():
    expected = {
        "GITHUB_REPOSITORY": REPOSITORY, "GITHUB_ACTIONS": "true", "GITHUB_EVENT_NAME": "workflow_dispatch",
        "GITHUB_REF": "refs/heads/main", "GITHUB_ACTOR": ACTOR, "GITHUB_TRIGGERING_ACTOR": ACTOR,
        "GITHUB_RUN_ATTEMPT": "1", "RUNNER_ENVIRONMENT": "github-hosted", "RUNNER_OS": "Linux",
        "RUNNER_ARCH": "X64", "GITHUB_WORKFLOW_REF": REPOSITORY + "/" + WORKFLOW_PATH + "@refs/heads/main",
    }
    need(sys.platform == "linux" and os.getuid() != 0 and all(os.environ.get(k) == v for k, v in expected.items()),
         "NATIVE_PUBLISHER_IDENTITY")
    need(re.fullmatch(r"[a-f0-9]{40}", os.environ["GITHUB_WORKFLOW_SHA"]) and
         os.environ["GITHUB_WORKFLOW_SHA"] == os.environ["GITHUB_SHA"], "NATIVE_PUBLISHER_SHA")
    return {"run": int(os.environ["GITHUB_RUN_ID"]), "workflow": int(os.environ["C856_PRODUCER_WORKFLOW_ID"]),
            "sha": os.environ["GITHUB_SHA"]}


def file_view(stat_result):
    return (stat_result.st_dev, stat_result.st_ino, stat_result.st_size, stat_result.st_uid,
            stat_result.st_gid, stat_result.st_mode, stat_result.st_nlink, stat_result.st_mtime_ns,
            stat_result.st_ctime_ns)


def open_input(file):
    return os.fdopen(os.open(file, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), "rb")


def inventory(root):
    items = {}
    total = 0
    for directory, folders, files in os.walk(root, followlinks=False):
        current = Path(directory)
        need(current.resolve(strict=True) == current and current.stat().st_uid == os.getuid(), "NATIVE_STAGE_PATH")
        for name in folders:
            st = (current / name).lstat()
            need(stat.S_ISDIR(st.st_mode) and st.st_uid == os.getuid(), "NATIVE_DIRECTORY_ALIAS")
        for name in files:
            file = current / name
            path = file.relative_to(root).as_posix()
            valid_path(path)
            need(path not in items and len(items) < MAX_ENTRIES, "NATIVE_STAGE_INVENTORY")
            with open_input(file) as stream:
                old = os.fstat(stream.fileno())
                need(stat.S_ISREG(old.st_mode) and old.st_uid == os.getuid() and old.st_nlink == 1 and
                     not old.st_mode & 0o7000 and "security.capability" not in os.listxattr(stream.fileno()),
                     "NATIVE_FILE_IDENTITY")
                total += old.st_size
                need(total <= MAX_CAPSULE, "NATIVE_CAPSULE_LIMIT")
                hash_value = hashlib.file_digest(stream, "sha256").hexdigest()
                need(file_view(old) == file_view(os.fstat(stream.fileno())) == file_view(file.lstat()),
                     "NATIVE_FILE_CHANGED")
            mode = 0o555 if old.st_mode & 0o111 else 0o444
            items[path] = {"bytes": old.st_size, "mode": mode, "sha256": hash_value}
    return items, total


def fixed_tar(output, root, files):
    with output.open("xb") as destination, tarfile.open(fileobj=destination, mode="w", format=tarfile.USTAR_FORMAT) as tar:
        for name, spec in sorted(files.items()):
            file = root.joinpath(*valid_path(name).parts)
            entry = tarfile.TarInfo(name)
            entry.uid = entry.gid = entry.mtime = 0
            entry.mode = spec["mode"]
            entry.size = spec["bytes"]
            with open_input(file) as stream:
                before = os.fstat(stream.fileno())
                need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
                     before.st_size == entry.size and hashlib.file_digest(stream, "sha256").hexdigest() ==
                     spec["sha256"], "NATIVE_TAR_INPUT_CHANGED")
                stream.seek(0)
                tar.addfile(entry, stream)
                need(file_view(before) == file_view(os.fstat(stream.fileno())) == file_view(file.lstat()),
                     "NATIVE_TAR_INPUT_CHANGED")


def seal(source, root, seed_path, output):
    publisher = pin_run()
    for path in (source, root, output.parent):
        need(path.resolve(strict=True) == path and path.stat().st_uid == os.getuid(), "PUBLISHER_OWNED_PATH")
    need(not output.exists() and not output.is_relative_to(root), "PUBLISHER_OUTPUT")
    v3 = v3_bytes()
    node = root / "children/app/usr/bin/node"
    source_binding(source, node, output.parent / "c856-source-plan.mjs", v3["plan.original.json"])
    with open_input(seed_path) as stream:
        seed = stream.read(STAGED_SEED_LIMIT)
    need(512 <= len(seed) <= MAX_SEED and seed[:16] == b"SQLite format 3\0", "NATIVE_SYNTHETIC_SEED")
    files, total = inventory(root)
    build_id = (root / "children/app/source/.next/BUILD_ID").read_text(encoding="ascii").strip()
    manifest = {
        "source": SOURCE, "tree": TREE, "publisher": publisher, "buildId": build_id,
        "linux": {"os": "ubuntu-24.04", "arch": "x64", "imageVersion": os.environ["ImageVersion"],
                  "kernel": platform.release(), "node": "24.19.0", "playwright": "1.56.1", "chromiumRevision": "1194"},
        "seedSha256": digest(seed), "chromiumSha256": files[BROWSER]["sha256"], "files": files,
    }
    import json
    check = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("ascii") + b"\n"
    manifest_check(check, digest(check), total, publisher, v3)
    filesystem_total, free = available(output.parent)
    need(free >= total + MAX_TAR_OVERHEAD + MAX_SEED + 24*MIB + 2*(1 << 30), "PUBLISHER_FREE_SPACE")
    output.mkdir(mode=0o700, exist_ok=False)
    fixed_tar(output / "capsule.tar", root, files)
    with (output / "capsule.json").open("xb") as stream:
        stream.write(check)
    with (output / "seed.sqlite").open("xb") as stream:
        stream.write(seed)
    return {"protectedSource": SOURCE, "protectedTree": TREE, "manifestSha256": digest(check),
            "capsuleBytes": total, "producer": publisher, "observedPublisherFreeBeforeBytes": free,
            "publisherFilesystemTotalBytes": filesystem_total}


def main():
    parser = argparse.ArgumentParser()
    for key in ("source", "stage", "seed", "output"):
        parser.add_argument("--"+key, type=Path, required=True)
    args = parser.parse_args()
    result = seal(args.source, args.stage, args.seed, args.output)
    write_document(args.output.parent / "c856-capsule-build-receipt.json", result)


if __name__ == "__main__":
    main()
