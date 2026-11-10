"""Owner-dispatched builder for the exact C856 Homeport native capsule."""
import argparse
import hashlib
import json
import os
import platform
import re
import selectors
import secrets
import shutil
import signal
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from admission import SOURCE, TREE
from capsule import BROWSER, BROWSER_CAPTURE, BROWSER_PLAN, BWRAP_SHA, MAX_SEED, V3_FILES, digest
from controller import v3_bytes, write_document
from native_layout import (GIB, MIB, RESERVE, NATIVE_STAGE_CAP, Stage, filesystem_free, need,
                           publisher_projection, system_browser_libraries)
from seal import git, pin_run, seal, source_binding

LOCK_BLOB = "fca84d3ab68ff77c013554e5eb9531cb3f7b11c2"
BUILD_WRITER_BUDGET = 3*GIB
RECEIPT_LOG_LIMIT = 1*MIB
PUBLISHER_UPLOAD_CEILING = 2*GIB - 16*MIB
PRISMA = {
    "libquery_engine-debian-openssl-3.0.x.so.node":
        "a2924eab1c78a0a7bb67edac5738939fa10589ef073af5542f53812a22e4a7d8",
    "schema-engine-debian-openssl-3.0.x":
        "5d42b181631fd20bb0ecc5abcdba72575e7f467a0d52f4d5ef1ff28f0c74e6e9",
}
WORKFLOW = ".github/workflows/sounding-line-b-c856-runtime-producer.yml"


def paths():
    pin = pin_run()
    need(os.environ.get("C856_PRODUCER_SHA") == pin["sha"] and pin["run"] > 0 and pin["workflow"] > 0,
         "PRODUCER_APPROVAL_IDENTITY")
    temp = Path(os.environ["RUNNER_TEMP"])
    workspace = Path(os.environ["GITHUB_WORKSPACE"])
    need(temp.resolve(strict=True) == temp and workspace.resolve(strict=True) == workspace and
         temp.stat().st_uid == workspace.stat().st_uid == os.getuid() and
         temp.stat().st_dev == workspace.stat().st_dev, "PRODUCER_FILESYSTEM_SCOPE")
    return pin, workspace/"c856-source", temp/f"c856-producer-{pin['run']}-1", temp/f"c856-producer-evidence-{pin['run']}-1"


def source_identity(source):
    need(source.resolve(strict=True) == source and source.stat().st_uid == os.getuid(), "PRODUCER_SOURCE_DIRECTORY")
    need(git(source, "rev-parse", "HEAD").strip().decode("ascii") == SOURCE and
         git(source, "rev-parse", "HEAD^{tree}").strip().decode("ascii") == TREE and
         git(source, "rev-parse", "HEAD:package-lock.json").strip().decode("ascii") == LOCK_BLOB,
         "PRODUCER_SOURCE_OR_LOCK")
    git(source, "diff", "--quiet", "HEAD", "--")
    for name in ("node_modules", ".next"):
        need(not os.path.lexists(source/name), "PRODUCER_COLD_BUILD_REQUIRED")


def provider_node():
    root = Path(os.environ["RUNNER_TOOL_CACHE"]).resolve(strict=True)
    file = root/"node/24.19.0/x64/bin/node"
    need(file.resolve(strict=True) == file and file.is_file(), "PRODUCER_PINNED_NODE")
    for path in (file, *file.parents):
        st = path.lstat()
        need(st.st_uid in (0, os.getuid()) and not st.st_mode & 0o022, "PRODUCER_NODE_OWNER")
    return file


def private_env(scratch, node, db, nonce):
    return {
        "PATH": str(node.parent)+":/usr/bin:/bin", "HOME": str(scratch/"home"), "TMPDIR": str(scratch/"tmp"),
        "XDG_CACHE_HOME": str(scratch/"cache"), "LANG": "C.UTF-8", "CI": "true",
        "DATABASE_URL": "file:"+str(db), "NEXT_TELEMETRY_DISABLED": "1",
        "SOUNDING_LINE_SUITE_PROFILE": "generic", "SOUNDING_LINE_TASK_OWNED_HTTP": "1",
        "FOREVER_VALIDATION_ISOLATION": "1", "FOREVER_VALIDATION_NONCE_HASH": nonce,
        "HOMEPORT_SYNTHETIC_EMAIL_ADAPTER": "TASK_OWNED_TEST", "SEALED_HOLD_SINGLE_FORK": "1",
        "GM_USERNAME": "kato", "GM_PASSWORD": "development-captain-only",
        "PLAYER_USERNAME": "sera", "PLAYER_ACCESS_CODE": "development-moonwake",
        "NPM_CONFIG_USERCONFIG": "/dev/null", "NPM_CONFIG_GLOBALCONFIG": "/dev/null",
        "NPM_CONFIG_CACHE": str(scratch/"npm-cache"), "NPM_CONFIG_REGISTRY": "https://registry.npmjs.org/",
        "PLAYWRIGHT_BROWSERS_PATH": str(scratch/"browsers"),
    }


def writer_limit():
    # Aggregate build growth is monitored, and the separately bounded stage
    # writer enforces every copied byte. Limit any single child output file.
    import resource
    resource.setrlimit(resource.RLIMIT_FSIZE, (512*MIB, 512*MIB))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def terminate_group(process):
    if process.poll() is None:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            pass
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait(timeout=3)


def run_phase(name, argv, cwd, env, scratch, evidence, initial_free, seconds):
    started = time.monotonic()
    minimum = filesystem_free(scratch)
    deadline = started+seconds
    need(minimum >= RESERVE and initial_free-minimum <= BUILD_WRITER_BUDGET, "PRODUCER_BUILD_ADMISSION")
    log = evidence/(name+".original.txt")
    process = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, close_fds=True, start_new_session=True, preexec_fn=writer_limit)
    size = 0
    failure = None
    try:
        with log.open("xb") as output, selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ)
            while selector.get_map():
                need(time.monotonic() < deadline, "PRODUCER_PHASE_TIMEOUT")
                free = filesystem_free(scratch)
                minimum = min(minimum, free)
                need(free >= RESERVE and initial_free-free <= BUILD_WRITER_BUDGET, "PRODUCER_BUILD_HIGH_WATER")
                for key, _ in selector.select(.25):
                    chunk = os.read(key.fd, min(65536, RECEIPT_LOG_LIMIT-size+1))
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    size += len(chunk)
                    need(size <= RECEIPT_LOG_LIMIT, "PRODUCER_LOG_LIMIT")
                    output.write(chunk)
        need(process.wait(timeout=max(.1, deadline-time.monotonic())) == 0, "PRODUCER_COMMAND_FAILED")
    except BaseException as error:
        failure = str(error) if re.fullmatch(r"[A-Z_]+", str(error)) else type(error).__name__
        raise
    finally:
        terminate_group(process)
        process.stdout.close()
        write_document(evidence/(name+".json"), {"phase": name, "durationSeconds": time.monotonic()-started,
            "minimumObservedFreeBytes": minimum, "outputBytes": log.stat().st_size if log.exists() else 0,
            "exitCode": process.returncode, "failure": failure,
            "outputSha256": digest(log.read_bytes()) if log.exists() else None})


def file_digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def prisma_identity(source):
    root = source/"node_modules/@prisma/engines"
    observed = {name: file_digest(root/name) for name in PRISMA}
    need(observed == PRISMA, "PRODUCER_PRISMA_BINARY_IDENTITY")
    return observed


def snapshot_synthetic(source, target, nonce):
    need(source.resolve(strict=True) == source and source.is_file() and source.stat().st_size <= MAX_SEED,
         "PRODUCER_SYNTHETIC_DATABASE")
    need(not target.exists(), "PRODUCER_SEED_ALREADY_PRESENT")
    with sqlite3.connect(source.as_uri()+"?mode=ro", uri=True) as existing, sqlite3.connect(target) as snapshot:
        marker = existing.execute("SELECT count(*) FROM PlatformAuditEvent WHERE action=? AND resourceId=?",
                                  ("VALIDATION_DATABASE_IDENTITY", nonce)).fetchone()
        need(marker == (1,), "PRODUCER_SEED_FIXTURE_MARKER")
        existing.backup(snapshot)
        need(snapshot.execute("PRAGMA quick_check").fetchone() == ("ok",), "PRODUCER_SEED_INTEGRITY")
    need(512 <= target.stat().st_size <= MAX_SEED and
         all(not Path(str(target)+suffix).exists() for suffix in ("-wal", "-shm", "-journal")), "PRODUCER_SEED_BOUND")


def signed_bwrap():
    member = Path("/bootstrap/bwrap.bin").read_bytes()
    receipt = json.loads(Path("/bootstrap/bwrap-proof.json").read_bytes())
    need(len(member) == 80424 and digest(member) == receipt["binarySha256"] == BWRAP_SHA, "PRODUCER_BWRAP_BINARY")
    return member, receipt

def transform_capture(source, v3):
    original = (source/"scripts/sounding-line/experience-browser.mjs").read_bytes()
    marker = b"await chromium.launch({ headless: true })"
    plan = json.loads(v3["plan.original.json"])
    need(original.count(marker) == 1, "PRODUCER_CAPTURE_TRANSFORM")
    transformed = original.replace(marker, b"await chromium.launch({ headless: true, chromiumSandbox: true })")
    need(digest(transformed) == plan["sandboxedCaptureSha256"], "PRODUCER_CAPTURE_TRANSFORM_DIGEST")
    return transformed


def stage_native(source, scratch, node, v3, bwrap):
    stage = Stage(scratch/"stage")
    for role in ("", "children/app", "children/browser"):
        stage.runtime(role, node if role else None)
    staged_bwrap = stage.bytes("usr/bin/bwrap", bwrap, executable=True)
    stage.elf[""].add(staged_bwrap)
    stage.bytes("masks/file", b"")
    for key, member in V3_FILES.items():
        stage.bytes(key, v3[member])
    for placeholder in ("children/app/inputs/seed.sqlite", "children/app/inputs/controls.json",
                        "children/browser/inputs/controls.json"):
        stage.bytes(placeholder, b"")
    stage.bytes("children/browser/inputs/authentication.json", b"[]\n")
    app = "children/app/source"
    for file in ("package.json", "next.config.ts", "tsconfig.json"):
        stage.copy(source/file, f"{app}/{file}")
    for directory in ("src", "public", "bridgewatch"):
        stage.tree(source/directory, f"{app}/{directory}", skip=("node_modules",))
    stage.tree(source/".next", f"{app}/.next", skip=("cache", "diagnostics", "trace", "trace-build"))
    stage.tree(source/"node_modules", f"{app}/node_modules", skip=(".bin", "@forever-treasure/bridgewatch"))
    stage.tree(source/"bridgewatch", f"{app}/node_modules/@forever-treasure/bridgewatch", skip=("node_modules",))
    browser = "children/browser/source"
    stage.copy(source/"package.json", f"{browser}/package.json")
    stage.tree(source/"scripts/sounding-line", f"{browser}/scripts/sounding-line", skip=("experience-browser.mjs",))
    stage.bytes(BROWSER_CAPTURE, transform_capture(source, v3))
    for package in ("playwright", "playwright-core", "axe-core", "@axe-core/playwright"):
        stage.tree(source/"node_modules"/package, f"{browser}/node_modules/{package}")
    for directory in ("chromium_headless_shell-1194", "ffmpeg-1011"):
        stage.tree(scratch/"browsers"/directory, f"children/browser/browsers/{directory}")
    stage.copy(Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        "children/browser/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", system=True)
    stage.bytes("children/browser/etc/fonts/fonts.conf",
        b"<?xml version='1.0'?>\n<fontconfig><dir>/usr/share/fonts</dir><cachedir>/tmp/font-cache</cachedir></fontconfig>\n")
    libraries = {role or "supervisor": stage.dependencies(role, system_browser_libraries() if role.endswith("browser") else ())
                 for role in ("", "children/app", "children/browser")}
    return stage, libraries


def build(pin, source, scratch, evidence):
    source_identity(source)
    scratch.mkdir(mode=0o700, exist_ok=False)
    evidence.mkdir(mode=0o700, exist_ok=False)
    write_document(scratch/"owner.json", pin)
    initial = filesystem_free(scratch)
    need(initial >= RESERVE+BUILD_WRITER_BUDGET, "PRODUCER_BUILD_FREE_SPACE")
    v3 = v3_bytes()
    node = provider_node()
    for name in ("home", "tmp", "cache"):
        (scratch/name).mkdir(mode=0o700, exist_ok=False)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")+"000"
    database = scratch/("validation-isolated-"+stamp+"-"+secrets.token_hex(16)+".db")
    nonce = digest(secrets.token_bytes(32))
    env = private_env(scratch, node, database, nonce)
    tool = str(node)
    command = lambda name, args, seconds: run_phase(name, [tool, *args], source, env, scratch, evidence, initial, seconds)
    npm = str(node.parent.parent/"lib/node_modules/npm/bin/npm-cli.js")
    command("dependencies", [npm, "ci", "--ignore-scripts", "--no-audit", "--no-fund"], 180)
    source_binding(source, node, scratch/"source-plan.mjs", v3["plan.original.json"])
    command("prisma-generate", ["node_modules/prisma/build/index.js", "generate", "--schema", "prisma/schema.sqlite.prisma"], 90)
    engines = prisma_identity(source)
    command("sqlite-bootstrap", ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", env["DATABASE_URL"]], 60)
    command("fixture-seed", ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], 90)
    command("legacy-fixture", ["node_modules/tsx/dist/cli.mjs", "scripts/migrate-legacy-companion.ts"], 60)
    command("validation-isolation", ["scripts/sounding-line/prepare-validation-isolation.mjs"], 60)
    command("chromium", ["node_modules/playwright/cli.js", "install", "--only-shell", "chromium"], 180)
    command("next-build", ["node_modules/next/dist/bin/next", "build"], 420)
    git(source, "diff", "--quiet", "HEAD", "--")
    snapshot_synthetic(database, scratch/"synthetic.sqlite", nonce)
    remove_owned(scratch/"npm-cache", scratch)
    bwrap, package = signed_bwrap()
    # A bounded native staging pass checks exact file sizes and live free space
    # as it copies. The second, tar-writing pass has an independent measured gate.
    stage, libraries = stage_native(source, scratch, node, v3, bwrap)
    projected = publisher_projection(filesystem_free(scratch), 1, stage.total+128*MIB)
    result = seal(source, stage.root, scratch/"synthetic.sqlite", scratch/"artifact")
    upload_bytes = sum((scratch/"artifact"/name).stat().st_size for name in ("capsule.tar", "capsule.json", "seed.sqlite"))
    need(upload_bytes <= PUBLISHER_UPLOAD_CEILING, "PRODUCER_UPLOAD_INPUT_BOUND")
    write_document(evidence/"system-native-sources.json", stage.system_sources)
    write_document(evidence/"producer-result.json", {**result, "uncompressedUploadInputsBytes": upload_bytes, "stageBytes": stage.total, "archiveWriteProjection": projected,
        "nodeSha256": file_digest(node), "chromiumSha256": file_digest(stage.root/BROWSER),
        "readOnlyBwrap": package, "prismaEngines": engines, "nativeLibraries": libraries,
        "contexts": 2, "obligations": 16, "qualification": False, "reuseAuthorized": False})


def remove_owned(path, parent):
    if not os.path.lexists(path):
        return
    need(path.parent == parent and path.resolve(strict=True) == path and path.is_dir() and
         path.stat().st_uid == os.getuid(), "PRODUCER_CLEANUP_SCOPE")
    for current, dirs, files in os.walk(path, topdown=True, followlinks=False):
        root = Path(current)
        need(root.resolve(strict=True) == root and root.stat().st_uid == os.getuid(), "PRODUCER_CLEANUP_DIRECTORY")
        root.chmod(0o700)
        for item in (*dirs, *files):
            need((root/item).lstat().st_uid == os.getuid(), "PRODUCER_CLEANUP_OWNER")
    shutil.rmtree(path)


def cleanup(pin, source, scratch, evidence):
    if not scratch.exists():
        return
    need(json.loads((scratch/"owner.json").read_bytes()) == pin, "PRODUCER_CLEANUP_RECEIPT")
    for name in ("node_modules", ".next"):
        remove_owned(source/name, source)
    remove_owned(scratch, scratch.parent)
    if evidence.is_dir():
        write_document(evidence/"cleanup.json", {"ownedScratchRemoved": True, "generatedSourceOutputsRemoved": True})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=("build", "cleanup"))
    phase = parser.parse_args().phase
    pin, source, scratch, evidence = paths()
    def expired(_signum, _frame):
        raise TimeoutError("PRODUCER_DEADLINE")
    if phase == "build":
        signal.signal(signal.SIGTERM, expired)
        signal.signal(signal.SIGINT, expired)
        signal.signal(signal.SIGALRM, expired)
        signal.alarm(850)
    try:
        if phase == "build":
            build(pin, source, scratch, evidence)
        else:
            cleanup(pin, source, scratch, evidence)
    except Exception as error:
        if evidence.is_dir():
            code = str(error)
            write_document(evidence/(phase+"-failure.json"), {"failure": code if re.fullmatch(r"[A-Z_]+", code)
                else type(error).__name__, "qualification": False, "reuseAuthorized": False})
        raise SystemExit("C856 producer "+phase+" failed. See bounded evidence.") from None
    finally:
        if phase == "build":
            signal.alarm(0)


if __name__ == "__main__":
    main()
