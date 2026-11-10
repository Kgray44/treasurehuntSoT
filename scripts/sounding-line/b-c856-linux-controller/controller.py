"""Owner-only source-bound controller for the B-C856 GitHub-hosted diagnostic."""
import argparse
import hashlib
import importlib
import io
import json
import os
import re
import shutil
import signal
import stat
import subprocess
import sys
import time
import zipfile
from pathlib import Path

from admission import (
    ACTOR, GIT_SHA, MAX_CAPSULE, MAX_ARCHIVE, MIB, REPOSITORY, SHA256, SOURCE, TREE,
    V3_PACKAGE_SHA256, V3_SHA256, available, need, storage_plan,
)
from capsule import digest, no_duplicates, unpack
from provider import artifact_metadata, download

HERE = Path(__file__).resolve().parent
V3 = HERE / "diagnostic-v3.zip"
CONTROLLER_PATH = ".github/workflows/sounding-line-b-c856-runtime.yml"
POSINT = re.compile(r"[1-9][0-9]{0,15}\Z")
PUBLIC_CODE = re.compile(r"[A-Z][A-Z0-9_]{1,90}\Z")
ORIGINAL_LIMIT = 128*MIB


def write_document(path, value):
    with path.open("xb") as stream:
        stream.write(json.dumps(value, sort_keys=True, separators=(",", ":")).encode("ascii") + b"\n")


def read_document(path, limit):
    with path.open("rb") as stream:
        data = stream.read(limit+1)
    need(0 < len(data) <= limit, "CONTROLLER_DOCUMENT_BOUND")
    return json.loads(data, object_pairs_hook=no_duplicates)


def choice_from_environment():
    raw = os.environ["C856_APPROVED_INPUTS"]
    need(len(raw) <= 4096, "APPROVED_INPUT_BOUND")
    inputs = json.loads(raw, object_pairs_hook=no_duplicates)
    expected = {"controller_sha", "producer_run", "producer_sha", "producer_workflow",
                "artifact_id", "archive_sha256", "archive_bytes", "manifest_sha256", "capsule_bytes"}
    need(set(inputs) == expected and all(type(value) is str for value in inputs.values()), "APPROVED_INPUT_FIELDS")
    numbers = ("producer_run", "producer_workflow", "artifact_id", "archive_bytes", "capsule_bytes")
    need(all(POSINT.fullmatch(inputs[key]) for key in numbers) and
         all(GIT_SHA.fullmatch(inputs[key]) for key in ("controller_sha", "producer_sha")) and
         all(SHA256.fullmatch(inputs[key]) for key in ("archive_sha256", "manifest_sha256")), "APPROVED_INPUT_VALUE")
    choice = {"controller": inputs["controller_sha"], "run": int(inputs["producer_run"]),
              "producer": inputs["producer_sha"], "workflow": int(inputs["producer_workflow"]),
              "artifact": int(inputs["artifact_id"]), "sha256": inputs["archive_sha256"],
              "bytes": int(inputs["archive_bytes"]), "manifest": inputs["manifest_sha256"],
              "capsuleBytes": int(inputs["capsule_bytes"])}
    need(choice["bytes"] <= MAX_ARCHIVE and choice["capsuleBytes"] <= MAX_CAPSULE, "APPROVED_INPUT_SIZE")
    return choice


def controller_identity(choice):
    expected = {
        "GITHUB_ACTIONS": "true", "GITHUB_REPOSITORY": REPOSITORY, "GITHUB_EVENT_NAME": "workflow_dispatch",
        "GITHUB_REF": "refs/heads/main", "GITHUB_ACTOR": ACTOR, "GITHUB_TRIGGERING_ACTOR": ACTOR,
        "GITHUB_RUN_ATTEMPT": "1", "RUNNER_ENVIRONMENT": "github-hosted", "RUNNER_OS": "Linux", "RUNNER_ARCH": "X64",
        "GITHUB_WORKFLOW_SHA": choice["controller"], "GITHUB_SHA": choice["controller"],
        "GITHUB_WORKFLOW_REF": REPOSITORY + "/" + CONTROLLER_PATH + "@refs/heads/main",
    }
    need(sys.platform == "linux" and os.getuid() != 0 and all(os.environ.get(k) == v for k, v in expected.items()),
         "CONTROLLER_PROVIDER_IDENTITY")
    run = os.environ["GITHUB_RUN_ID"]
    need(POSINT.fullmatch(run), "CONTROLLER_RUN_ID")
    temp = Path(os.environ["RUNNER_TEMP"])
    need(temp.is_absolute() and temp.resolve(strict=True) == temp and temp.stat().st_uid == os.getuid(),
         "CONTROLLER_SCRATCH_ROOT")
    return temp / f"c856-scratch-{run}-1", temp / f"c856-evidence-{run}-1"


def v3_bytes():
    with V3.open("rb") as stream:
        raw = stream.read(128*1024 + 1)
    need(0 < len(raw) <= 128*1024 and digest(raw) == V3_SHA256, "CONTROLLER_V3_DIGEST")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        items = archive.infolist()
        need(len(items) == 25 and len({item.filename for item in items}) == 25 and
             all(re.fullmatch(r"[A-Za-z0-9_.-]{1,80}", item.filename) and
                 0 < item.file_size <= 64*1024 for item in items), "CONTROLLER_V3_INVENTORY")
        members = {item.filename: archive.read(item) for item in items}
    need(digest(members["package.py"]) == V3_PACKAGE_SHA256, "CONTROLLER_ROOT_PROGRAM")
    return members


def live_space(root, choice):
    total, free = available(root)
    return storage_plan(total, free, choice["bytes"], choice["capsuleBytes"])


def post_transfer_space(root, choice):
    total, free = available(root)
    return storage_plan(total, free, choice["bytes"], choice["capsuleBytes"], archive_already_allocated=True)


def prepare(choice, scratch, evidence):
    scratch.mkdir(mode=0o700, exist_ok=False)
    evidence.mkdir(mode=0o700, exist_ok=False)
    v3 = v3_bytes()
    planned = live_space(scratch, choice)
    write_document(evidence / "admission.json", planned)
    token = os.environ.pop("C856_ARTIFACT_READ_TOKEN", None)
    need(token and len(token) <= 512, "CONTROLLER_ARTIFACT_TOKEN")
    provider = artifact_metadata(choice, token)
    write_document(evidence / "provider.json", provider)
    carrier = scratch / "capsule.zip"
    download(choice, token, carrier)
    del token
    after_download = post_transfer_space(scratch, choice)
    root, _, _, manifest = unpack(carrier, scratch, choice, v3)
    need(root.stat().st_dev == scratch.stat().st_dev == evidence.stat().st_dev, "CAPSULE_FILESYSTEM_CHANGED")
    _, free_after_unpack = available(scratch)
    need(free_after_unpack >= planned["requiredReserveBytes"] + ORIGINAL_LIMIT, "POST_UNPACK_FREE_SPACE")
    write_document(evidence / "capsule-admission.json", {"provider": provider, "afterDownload": after_download,
        "observedFreeAfterUnpackBytes": free_after_unpack, "manifestSha256": choice["manifest"],
        "native": manifest["linux"], "seedSha256": manifest["seedSha256"], "chromiumSha256": manifest["chromiumSha256"]})
    carrier.unlink()
    write_document(scratch / "prepared.json", choice)


def assert_workload_environment():
    forbidden = {
        "C856_ARTIFACT_READ_TOKEN", "GH_TOKEN", "GITHUB_TOKEN", "ACTIONS_RUNTIME_TOKEN",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_URL", "NODE_OPTIONS", "NODE_PATH",
    }
    need(not (forbidden & os.environ.keys()), "WORKLOAD_CREDENTIAL_OR_OVERRIDE")
    os.umask(0o077)


def trusted_system_tool(path):
    named = Path(path)
    actual = named.resolve(strict=True)
    need(actual.is_relative_to("/usr/bin"), "SYSTEM_TOOL_PATH")
    for component in (actual, *actual.parents):
        st = component.lstat()
        need(st.st_uid == 0 and st.st_gid == 0 and not st.st_mode & 0o022, "SYSTEM_TOOL_OWNER")
    need(stat.S_ISREG(actual.stat().st_mode), "SYSTEM_TOOL_TYPE")
    return named


def stage_root_if_absent(work, v3, evidence):
    sys.path.insert(0, str(work))
    archive = importlib.import_module("archive")
    package = importlib.import_module("package")
    deb, executable, public_receipt = archive.authenticated_package()
    write_document(evidence / "archive-package.json", public_receipt)
    canonical = Path("/usr/bin/bwrap")
    found = os.path.lexists(canonical)
    if not found:
        sudo = trusted_system_tool("/usr/bin/sudo")
        python = trusted_system_tool("/usr/bin/python3")
        script = v3["package.py"]
        need(digest(script) == V3_PACKAGE_SHA256, "ROOT_STAGE_PROGRAM")
        # The interpreter reads fixed, hash-checked code directly as argv.
        # No workspace-writable program path or inherited Python imports enter sudo.
        result = subprocess.run([str(sudo), "-n", "--", str(python), "-IB", "-c",
                                 script.decode("utf-8"), "--stage-fixed-c856"],
                                input=deb, capture_output=True, timeout=25,
                                env={"PATH": "/usr/bin:/bin", "LANG": "C", "LC_ALL": "C"})
        need(result.returncode == 0 and result.stdout.strip().decode("ascii") == public_receipt["binarySha256"],
             "ROOT_STAGE_REFUSED")
    parent = os.open("/usr/bin", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        observed = package.verify_installed(parent, executable)
    finally:
        os.close(parent)
    need(observed == public_receipt["binarySha256"], "INSTALLED_BINARY_IDENTITY")
    write_document(evidence / "binary-stage.json", {"binarySha256": observed, "preexisting": found,
        "temporaryRunnerCanonicalPath": "/usr/bin/bwrap"})
    return archive, (deb, executable, public_receipt)


def run_diagnostic(choice, scratch, evidence):
    assert_workload_environment()
    need(read_document(scratch / "prepared.json", 4096) == choice, "PREPARATION_IDENTITY")
    manifest = read_document(scratch / "capsule.json", 24*MIB)
    need(digest((scratch / "capsule.json").read_bytes()) == choice["manifest"], "ADMITTED_CAPSULE_MANIFEST")
    runtime = manifest["linux"]
    need(os.environ.get("ImageVersion") == runtime["imageVersion"] and os.uname().release == runtime["kernel"],
         "CAPSULE_RUNNER_IMAGE_OR_KERNEL")
    v3 = v3_bytes()
    work = scratch / "controller-v3"
    work.mkdir(mode=0o700, exist_ok=False)
    for name, body in v3.items():
        if not name.endswith(".py") or name.startswith("test_"):
            continue
        target = work / name
        with target.open("xb") as stream:
            stream.write(body)
        target.chmod(0o400)
    _, authenticated = stage_root_if_absent(work, v3, evidence)
    runner = importlib.import_module("run")
    # The frozen V3 runner rechecks the installed binary and loader. It
    # consumes the signed bytes just authenticated by this same process.
    runner.authenticated_package = lambda: authenticated
    request = argparse.Namespace(bundle=scratch / "bundle", manifest=scratch / "capsule.json",
        manifest_sha256=choice["manifest"], seed=scratch / "seed.sqlite", output=evidence / "run",
        controller_sha=choice["controller"])
    result = runner.execute(request)
    write_document(evidence / "result.json", {**result, "protectedSource": SOURCE, "protectedTree": TREE,
        "capsuleManifestSha256": choice["manifest"], "controllerSha": choice["controller"]})


def cleanup(scratch, evidence):
    if not scratch.exists():
        return
    need(scratch.is_dir() and scratch.resolve(strict=True) == scratch and scratch.stat().st_uid == os.getuid(),
         "OWNED_SCRATCH_CLEANUP")
    # The immutable capsule directories were made read-only by this controller.
    for parent, dirs, files in os.walk(scratch, topdown=True, followlinks=False):
        path = Path(parent)
        need(path.resolve(strict=True) == path and path.stat().st_uid == os.getuid(), "OWNED_SCRATCH_DESCENDANT")
        path.chmod(0o700)
        for name in (*dirs, *files):
            child = path / name
            need(not child.is_symlink() and child.lstat().st_uid == os.getuid(), "OWNED_SCRATCH_DESCENDANT")
    shutil.rmtree(scratch)
    if evidence.is_dir():
        write_document(evidence / "scratch-cleanup.json", {"removed": True, "temporaryBinaryScope": "PROVIDER_VM"})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=("prepare", "run", "cleanup"))
    phase = parser.parse_args().phase
    choice = choice_from_environment()
    scratch, evidence = controller_identity(choice)
    start = time.monotonic()
    if phase == "prepare":
        def expired(_signum, _frame):
            raise TimeoutError("CAPSULE_TRANSFER_DEADLINE")
        signal.signal(signal.SIGALRM, expired)
        signal.alarm(225)
    try:
        {"prepare": prepare, "run": run_diagnostic, "cleanup": lambda _, a, b: cleanup(a, b)}[phase](
            choice, scratch, evidence)
    except Exception as error:
        if evidence.is_dir():
            code = str(error)
            write_document(evidence / f"{phase}-failure.json", {
                "phase": phase, "code": code if PUBLIC_CODE.fullmatch(code) else type(error).__name__,
                "elapsedSeconds": time.monotonic()-start, "qualification": False, "reuseAuthorized": False,
            })
        raise SystemExit("C856 " + phase + " failed. See bounded evidence.") from None
    finally:
        if phase == "prepare":
            signal.alarm(0)


if __name__ == "__main__":
    main()
