"""Launch the frozen C856 producer inside one kernel-bounded filesystem."""
import base64
import hashlib
import io
import json
import os
import re
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import types
import time
import urllib.request
import zipfile
from pathlib import Path

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
from producer_boundary import (
    CAPSULE_EXPORT_CAP, EVIDENCE_EXPORT_CAP, HOST_MARGIN, HOST_RESERVE, INODE_CAP, MIB, TMPFS_CAP,
    admitted_host_space, available, bind_readonly, create_owned_scratch, directory_identity, drop_caps_and_chroot,
    need, prctl, setup_namespace_root, verify_owned_scratch,
)

REPO = "Kgray44/treasurehuntSoT"
SOURCE = "31181b7b94816b0cf22c79bcebbaecb24e01eec9"
TREE = "1f92226da882098af1fdd6d42a3e43927f6ad676"
SOURCE_URL = "https://github.com/" + REPO + ".git"
NODE_URL = "https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz"
NODE_SHA256 = "14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647"
NODE_ZIP_LIMIT = 48*MIB
NODE_EXPANDED_LIMIT = 256*MIB
STAGED_CODE_CAP = 256*1024
TIMEOUT = 14*60
WORKFLOW = ".github/workflows/sounding-line-b-c856-runtime-producer.yml"
SPARSE = (
    "/.gitattributes", "/.nvmrc", "/.node-version", "/.agents/scripts/", "/package.json",
    "/package-lock.json", "/next.config.ts", "/tsconfig.json", "/postcss.config.mjs", "/eslint.config.mjs",
    "/src/", "/public/", "/prisma/", "/bridgewatch/", "/scripts/", "/testing/",
)
ALLOWED_PROVIDER = (
    "GITHUB_REPOSITORY", "GITHUB_ACTIONS", "GITHUB_EVENT_NAME", "GITHUB_REF", "GITHUB_ACTOR",
    "GITHUB_TRIGGERING_ACTOR", "GITHUB_RUN_ATTEMPT", "GITHUB_RUN_ID", "GITHUB_WORKFLOW_REF",
    "GITHUB_WORKFLOW_SHA", "GITHUB_SHA", "RUNNER_ENVIRONMENT", "RUNNER_OS", "RUNNER_ARCH", "ImageVersion",
    "C856_PRODUCER_SHA", "C856_PRODUCER_WORKFLOW_ID",
)


def guard():
    identity = {key: os.environ.get(key) for key in ALLOWED_PROVIDER}
    expected = {
        "GITHUB_REPOSITORY": REPO, "GITHUB_ACTIONS": "true", "GITHUB_EVENT_NAME": "workflow_dispatch",
        "GITHUB_REF": "refs/heads/main", "GITHUB_ACTOR": "Kgray44", "GITHUB_TRIGGERING_ACTOR": "Kgray44",
        "GITHUB_RUN_ATTEMPT": "1", "GITHUB_WORKFLOW_REF": REPO+"/"+WORKFLOW+"@refs/heads/main",
        "RUNNER_ENVIRONMENT": "github-hosted", "RUNNER_OS": "Linux", "RUNNER_ARCH": "X64",
    }
    need(sys.platform == "linux" and os.getuid() != 0 and
         all(identity[key] == value for key, value in expected.items()), "PRODUCER_PROVIDER_SCOPE")
    sha = identity["C856_PRODUCER_SHA"]
    need(sha and re.fullmatch(r"[a-f0-9]{40}", sha) and
         sha == identity["GITHUB_WORKFLOW_SHA"] == identity["GITHUB_SHA"], "PRODUCER_PROTECTED_SHA")
    for name in ("GITHUB_RUN_ID", "C856_PRODUCER_WORKFLOW_ID"):
        need(identity[name] and re.fullmatch(r"[1-9][0-9]{0,15}", identity[name]), "PRODUCER_PROVIDER_ID")
    need(identity["ImageVersion"] and re.fullmatch(r"[A-Za-z0-9._+-]{1,80}", identity["ImageVersion"]),
         "PRODUCER_IMAGE_ID")
    return identity


def host_paths(run):
    temp = Path(os.environ["RUNNER_TEMP"])
    need(directory_identity(temp)[2] == os.getuid(), "PRODUCER_RUNNER_TEMP_OWNER")
    return temp/f"c856-producer-{run}-1", temp/f"c856-producer-evidence-{run}-1"


def write_fixed(path, body):
    with path.open("xb") as output:
        output.write(body)


def public_receipt(path, fields):
    write_fixed(path, json.dumps(fields, sort_keys=True, separators=(",", ":")).encode("ascii")+b"\n")


def trusted(path):
    selected = Path(path).resolve(strict=True)
    need(selected.is_relative_to("/usr/bin") and selected.is_file(), "PRODUCER_SYSTEM_LAUNCHER")
    for item in (selected, *selected.parents):
        info = item.lstat()
        need(info.st_uid == 0 and not info.st_mode & 0o022, "PRODUCER_SYSTEM_LAUNCHER_OWNER")
    return selected


TOKEN_LIMIT = 4096


def require_checkout_token(token):
    need(0 < len(token) <= TOKEN_LIMIT and re.fullmatch(rb"[!-~]+", token), "PRODUCER_CHECKOUT_TOKEN")


def read_token():
    token = sys.stdin.buffer.read(TOKEN_LIMIT + 1)
    require_checkout_token(token)
    return token


def node_bytes():
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(NODE_URL, timeout=12) as response:
            need(response.status == 200 and response.geturl() == NODE_URL, "PRODUCER_NODE_RELEASE_URL")
            data = response.read(NODE_ZIP_LIMIT+1)
    except OSError:
        raise ValueError("PRODUCER_NODE_RELEASE_UNAVAILABLE") from None
    need(0 < len(data) <= NODE_ZIP_LIMIT and hashlib.sha256(data).hexdigest() == NODE_SHA256,
         "PRODUCER_NODE_RELEASE_DIGEST")
    return data


def install_pinned_node(data, dest):
    root = "node-v24.19.0-linux-x64/"
    count = 0
    size = 0
    seen = set()
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:xz") as archive:
        for item in archive:
            if not item.name.startswith(root):
                continue
            name = item.name.removeprefix(root)
            if name != "bin/node" and not name.startswith("lib/node_modules/npm/"):
                continue
            parts = name.split("/")
            need(all(part not in ("", ".", "..") for part in parts) and name not in seen and
                 len(name) <= 240 and not re.search(r"[\\\x00-\x1f]", name), "PRODUCER_NODE_MEMBER")
            if item.isdir():
                continue
            need(item.isreg() and not item.mode & 0o7000, "PRODUCER_NODE_MEMBER_TYPE")
            size += item.size
            count += 1
            need(size <= NODE_EXPANDED_LIMIT and count <= 6000, "PRODUCER_NODE_EXPANSION_BOUND")
            path = dest.joinpath(*parts)
            path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            with archive.extractfile(item) as original, path.open("xb") as output:
                remaining = item.size
                while remaining:
                    part = original.read(min(MIB, remaining))
                    need(part, "PRODUCER_NODE_MEMBER_TRUNCATED")
                    output.write(part)
                    remaining -= len(part)
            path.chmod(0o755 if item.mode & 0o111 else 0o644)
            seen.add(name)
    need({"bin/node", "lib/node_modules/npm/bin/npm-cli.js"} <= seen, "PRODUCER_NODE_REQUIRED_FILES")


def git_checkout(token, source):
    source.mkdir(mode=0o700, exist_ok=False)
    auth = base64.b64encode(b"x-access-token:"+token).decode("ascii")
    env = {"PATH": "/usr/bin:/bin", "HOME": "/home", "TMPDIR": "/tmp", "LANG": "C.UTF-8",
           "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_TERMINAL_PROMPT": "0",
           "GIT_CONFIG_COUNT": "2", "GIT_CONFIG_KEY_0": "http.https://github.com/.extraHeader",
           "GIT_CONFIG_VALUE_0": "AUTHORIZATION: basic "+auth,
           "GIT_CONFIG_KEY_1": "credential.helper", "GIT_CONFIG_VALUE_1": ""}
    def git(*args, input=None, timeout=20):
        result = subprocess.run(["/usr/bin/git", *args], cwd=source, env=env, input=input,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=timeout)
        need(result.returncode == 0 and len(result.stdout) <= 65536 and len(result.stderr) <= 65536,
             "PRODUCER_PINNED_CHECKOUT")
        return result.stdout.strip().decode("ascii")
    git("init", "--quiet")
    git("remote", "add", "origin", SOURCE_URL)
    git("sparse-checkout", "set", "--no-cone", "--stdin", input=("\n".join(SPARSE)+"\n").encode("ascii"))
    git("fetch", "--quiet", "--no-tags", "--depth=1", "--filter=blob:none", "origin", SOURCE, timeout=80)
    git("checkout", "--quiet", "--detach", "FETCH_HEAD", timeout=90)
    need(git("rev-parse", "HEAD") == SOURCE and git("rev-parse", "HEAD^{tree}") == TREE,
         "PRODUCER_CHECKOUT_IDENTITY")
    # Only an HTTPS origin and promisor config may persist. The header was process-local.
    config = (source/".git/config").read_bytes()
    need(b"AUTHORIZATION" not in config and token not in config, "PRODUCER_CHECKOUT_CREDENTIAL_PERSISTED")


def worker(identity):
    expected = {name: "0000000000000000" for name in ("CapInh", "CapPrm", "CapEff", "CapAmb")}
    with open("/proc/self/status", encoding="ascii") as stream:
        status = dict(line.rstrip().split(":\t", 1) for line in stream if ":\t" in line)
    need(all(status.get(name) == value for name, value in expected.items()) and
         status.get("NoNewPrivs") == "1", "PRODUCER_WORKER_CAPABILITIES")
    try:
        os.readlink("/proc/1/root")
    except PermissionError:
        pass
    else:
        raise ValueError("PRODUCER_SUPERVISOR_ROOT_VISIBLE")
    root_device = os.stat("/").st_dev
    need(all(os.stat(path).st_dev == root_device for path in ("/tmp", "/tools", "/workspace", "/home")),
         "PRODUCER_WORKER_WRITABLE_SUPERBLOCK")
    for path in ("/usr", "/etc/ssl/certs", "/etc/hosts", "/etc/resolv.conf", "/etc/nsswitch.conf",
                 "/etc/ld.so.cache", "/bootstrap", "/proc"):
        need(os.statvfs(path).f_flag & os.ST_RDONLY, "PRODUCER_WORKER_READONLY_SYSTEM")
    token = read_token()
    git_checkout(token, Path("/workspace/c856-source"))
    del token
    install_pinned_node(node_bytes(), Path("/tools/node/24.19.0/x64"))
    child_env = {**identity, "PATH": "/usr/bin:/bin", "LANG": "C.UTF-8", "HOME": "/home", "TMPDIR": "/tmp",
                 "GITHUB_WORKSPACE": "/workspace", "RUNNER_TEMP": "/tmp", "RUNNER_TOOL_CACHE": "/tools"}
    os.execve("/usr/bin/python3", ["/usr/bin/python3", "-B", "/bootstrap/producer.py", "build"], child_env)


def package_members(raw):
    need(0 < len(raw) <= STAGED_CODE_CAP, "PRODUCER_CODE_ARCHIVE_BOUND")
    required = {
        "admission.py", "capsule.py", "controller.py", "diagnostic-v3.zip", "native_layout.py",
        "producer.py", "producer_boundary.py", "producer_driver.py", "provider.py", "seal.py",
    }
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        items = archive.infolist()
        need(len(items) == len(required) and {item.filename for item in items} == required and
             all(0 < item.file_size <= 64*1024 for item in items), "PRODUCER_CODE_ARCHIVE_INVENTORY")
        return {item.filename: archive.read(item) for item in items}


def export_regular(source, output, cap):
    need(source.resolve(strict=True) == source, "PRODUCER_EXPORT_ALIAS")
    fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, "rb") as data:
        first = os.fstat(data.fileno())
        need(stat.S_ISREG(first.st_mode) and first.st_uid == os.getuid() and first.st_nlink == 1 and
             0 <= first.st_size <= cap, "PRODUCER_EXPORT_FILE")
        need(available(output.parent) >= HOST_RESERVE + first.st_size + HOST_MARGIN, "PRODUCER_EXPORT_RESERVE")
        count = 0
        with output.open("xb") as sink:
            while block := data.read(min(MIB, first.st_size-count+1)):
                count += len(block)
                need(count <= first.st_size, "PRODUCER_EXPORT_SIZE_CHANGED")
                sink.write(block)
        after = os.fstat(data.fileno())
        need(count == first.st_size and first.st_ino == after.st_ino and
             first.st_ctime_ns == after.st_ctime_ns, "PRODUCER_EXPORT_CHANGED")
    return count


def close_private_processes(root):
    # The supervisor is PID 1 in a fresh PID namespace. PIDs read from its
    # own proc mount cannot name a runner or another job process.
    need(os.getpid() == 1, "PRODUCER_PRIVATE_PID_NAMESPACE")
    deadline = time.monotonic()+3
    while True:
        for entry in (root/"proc").iterdir():
            if not entry.name.isascii() or not entry.name.isdecimal() or entry.name == "1":
                continue
            pid = int(entry.name)
            try:
                fd = os.pidfd_open(pid)
            except ProcessLookupError:
                continue
            try:
                signal.pidfd_send_signal(fd, signal.SIGKILL)
            except ProcessLookupError:
                pass
            finally:
                os.close(fd)
        while True:
            try:
                if not os.waitpid(-1, os.WNOHANG)[0]:
                    break
            except ChildProcessError:
                break
        if not any(item.name.isascii() and item.name.isdecimal() and item.name != "1"
                   for item in (root/"proc").iterdir()):
            return
        need(time.monotonic() < deadline, "PRODUCER_PRIVATE_PROCESS_TEARDOWN")
        time.sleep(.02)



def inner(scratch, evidence):
    identity = guard()
    run = identity["GITHUB_RUN_ID"]
    need(os.getpid() == 1 and verify_owned_scratch(scratch, run), "PRODUCER_SCRATCH_IDENTITY")
    prctl(4, 0)  # PR_SET_DUMPABLE, deny worker access through /proc/1/root.
    root = scratch/"mount"
    setup_namespace_root(root)
    files = package_members((scratch/"code.zip").read_bytes())
    for name, body in files.items():
        write_fixed(root/"bootstrap"/name, body)
    for name, bound in (("bwrap.bin", 80424), ("bwrap-proof.json", 65536)):
        with (scratch/name).open("rb") as stream:
            data = stream.read(bound+1)
        need(0 < len(data) <= bound, "PRODUCER_SIGNED_INPUT_BOUND")
        write_fixed(root/"bootstrap"/name, data)
    bind_readonly(root/"bootstrap", root/"bootstrap")
    child_code = None
    try:
        child = subprocess.run(["/usr/bin/python3", "-B", "/bootstrap/producer_driver.py", "worker"],
                               env={**identity, "PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"},
                               close_fds=True, preexec_fn=lambda: drop_caps_and_chroot(root), timeout=TIMEOUT)
        child_code = child.returncode
    except subprocess.TimeoutExpired:
        pass
    close_private_processes(root)
    receipts = root/"tmp"/f"c856-producer-evidence-{run}-1"
    evidence_bytes = 0
    if receipts.is_dir() and not receipts.is_symlink():
        files = list(receipts.iterdir())
        need(len(files) <= 32, "PRODUCER_EVIDENCE_COUNT")
        for item in sorted(files):
            need(re.fullmatch(r"[a-z0-9-]+(?:\.original\.txt|\.json)", item.name), "PRODUCER_EVIDENCE_NAME")
            evidence_bytes += export_regular(item, evidence/item.name, EVIDENCE_EXPORT_CAP-evidence_bytes)
    need(child_code == 0 and (evidence/"producer-result.json").is_file(), "PRODUCER_NATIVE_STAGE_FAILED")
    private_artifact = root/"tmp"/f"c856-producer-{run}-1"/"artifact"
    artifact = scratch/"artifact"
    artifact.mkdir(mode=0o700, exist_ok=False)
    exported = 0
    for name in ("capsule.tar", "capsule.json", "seed.sqlite"):
        exported += export_regular(private_artifact/name, artifact/name, CAPSULE_EXPORT_CAP-exported)
    public_receipt(evidence/"storage-boundary.json", {"tmpfsBytes": TMPFS_CAP, "tmpfsInodes": INODE_CAP,
        "capsuleExportBytes": exported, "evidenceExportBytes": evidence_bytes, "swapDisabledForTmpfs": True,
        "reserveBytes": HOST_RESERVE, "scope": "PRODUCER_WRITABLE_ROOT_AND_BOUNDED_HOST_EXPORT"})


def public_bwrap(members, scratch):
    # Keep the frozen verifier's UID 0 check in the host user namespace.
    # Its archive, index and package reads are bounded. Temporary signature
    # state goes in the already-owned, separately admitted host scratch.
    with zipfile.ZipFile(io.BytesIO(members["diagnostic-v3.zip"])) as verifier:
        for name in ("package", "archive"):
            filename = name+".py"
            entry = verifier.getinfo(filename)
            need(0 < entry.file_size <= 64*1024, "PRODUCER_VERIFIER_MEMBER_BOUND")
            module = types.ModuleType(name)
            sys.modules[name] = module
            exec(compile(verifier.read(entry), filename, "exec"), module.__dict__)
    previous = tempfile.tempdir
    tempfile.tempdir = str(scratch)
    try:
        _, binary, proof = sys.modules["archive"].authenticated_package()
    finally:
        tempfile.tempdir = previous
    need(len(binary) == 80424 and hashlib.sha256(binary).hexdigest() == proof["binarySha256"],
         "PRODUCER_SIGNED_BINARY")
    write_fixed(scratch/"bwrap.bin", binary)
    public_receipt(scratch/"bwrap-proof.json", proof)


def read_bounded_json(path, maximum):
    need(path.resolve(strict=True) == path, "PRODUCER_HOST_PROOF_ALIAS")
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, "rb") as stream:
        info = os.fstat(stream.fileno())
        need(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid() and
             info.st_nlink == 1 and 0 < info.st_size <= maximum, "PRODUCER_HOST_PROOF_BOUND")
        data = stream.read(maximum+1)
    need(len(data) == info.st_size, "PRODUCER_HOST_PROOF_SIZE")
    return json.loads(data)


def system_relative(name):
    return name.split("/", 2)[2] if name.startswith(("children/app/", "children/browser/")) else name


def system_destinations(files):
    selected = set()
    for name in files:
        relative = system_relative(name)
        if relative == "usr/bin/python3" or relative.startswith((
            "usr/lib/python3.12/", "lib/x86_64-linux-gnu/", "usr/lib/x86_64-linux-gnu/", "lib64/",
            "usr/share/fonts/truetype/dejavu/",
        )):
            selected.add(name)
    return selected


def verify_host_system_sources(scratch, evidence):
    manifest = read_bounded_json(scratch/"artifact/capsule.json", 24*MIB)
    sources = read_bounded_json(evidence/"system-native-sources.json", 1*MIB)
    needed = system_destinations(manifest["files"])
    need(isinstance(sources, dict) and 0 < len(sources) <= 12000 and set(sources) == needed,
         "PRODUCER_HOST_SYSTEM_SOURCE_CLOSURE")
    hashed = {}
    for target, location in sources.items():
        path = Path(location)
        expected = Path("/"+system_relative(target)).resolve(strict=True)
        need(path.is_absolute() and path.resolve(strict=True) == path == expected and
             (path.is_relative_to("/usr/lib") or path.is_relative_to("/usr/bin") or
              path.is_relative_to("/usr/share/fonts")), "PRODUCER_HOST_SYSTEM_SOURCE_PATH")
        for component in (path, *path.parents):
            inode = component.lstat()
            need(inode.st_uid == 0 and not inode.st_mode & 0o022, "PRODUCER_HOST_SYSTEM_SOURCE_OWNER")
        if location not in hashed:
            with path.open("rb") as stream:
                before = os.fstat(stream.fileno())
                need(stat.S_ISREG(before.st_mode) and before.st_size <= 64*MIB,
                     "PRODUCER_HOST_SYSTEM_SOURCE_TYPE")
                value = hashlib.file_digest(stream, "sha256").hexdigest()
                after = os.fstat(stream.fileno())
            need((before.st_dev, before.st_ino, before.st_ctime_ns, before.st_size) ==
                 (after.st_dev, after.st_ino, after.st_ctime_ns, after.st_size),
                 "PRODUCER_HOST_SYSTEM_SOURCE_CHANGED")
            hashed[location] = (value, before.st_size)
        item = manifest["files"][target]
        need(hashed[location] == (item["sha256"], item["bytes"]), "PRODUCER_HOST_SYSTEM_SOURCE_DIGEST")
    public_receipt(evidence/"host-system-verification.json", {
        "rootOwnedMembersVerified": len(sources), "uniqueHostFilesHashed": len(hashed),
        "producerSource": SOURCE,
    })


def run_outer(raw, token):
    identity = guard()
    require_checkout_token(token)
    run = identity["GITHUB_RUN_ID"]
    scratch, evidence = host_paths(run)
    parent = scratch.parent
    free = available(parent)
    minimum = admitted_host_space(free)
    with open("/proc/meminfo", encoding="ascii") as stream:
        match = re.search(r"^MemAvailable:\s+(\d+) kB$", stream.read(16384), flags=re.M)
    need(match and int(match.group(1))*1024 >= TMPFS_CAP+512*MIB, "PRODUCER_MEMORY_ADMISSION")
    members = package_members(raw)
    need(not os.path.lexists(evidence), "PRODUCER_EVIDENCE_PREEXISTS")
    create_owned_scratch(scratch, run)
    evidence_owned = False
    try:
        create_owned_scratch(evidence, run)
        evidence_owned = True
        public_receipt(evidence/"producer-admission.json", {"hostAvailableBytes": free, "hostMinimumBytes": minimum,
            "memoryAvailableBytes": int(match.group(1))*1024, "tmpfsBytes": TMPFS_CAP, "qualification": False})
        (scratch/"mount").mkdir(mode=0o700, exist_ok=False)
        write_fixed(scratch/"code.zip", raw)
        for name in ("producer_driver.py", "producer_boundary.py"):
            write_fixed(scratch/name, members[name])
        trusted("/usr/bin/git")
        public_bwrap(members, scratch)
        python, unshare = trusted("/usr/bin/python3"), trusted("/usr/bin/unshare")
        start = time.monotonic()
        command = [str(unshare), "--map-current-user", "--keep-caps", "--mount", "--propagation", "private",
                   "--pid", "--fork", "--kill-child", "--", str(python), "-IB",
                   str(scratch/"producer_driver.py"), "inner", str(scratch), str(evidence)]
        result = subprocess.run(command, input=token, env={**identity, "PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"},
                                timeout=TIMEOUT+15)
        need(result.returncode == 0 and (evidence/"storage-boundary.json").is_file(), "PRODUCER_BOUNDARY_OR_BUILD_FAILED")
        verify_host_system_sources(scratch, evidence)
        public_receipt(evidence/"producer-elapsed.json", {"seconds": time.monotonic()-start, "reuseAuthorized": False})
    except Exception as error:
        if evidence_owned and verify_owned_scratch(evidence, run):
            code = str(error)
            public_receipt(evidence/"producer-launch-failure.json", {
                "code": code if re.fullmatch(r"[A-Z_]+", code) else type(error).__name__, "qualification": False,
            })
        raise


if __name__ == "__main__":
    if sys.argv[1:] == ["worker"]:
        worker(guard())
    elif len(sys.argv) == 4 and sys.argv[1] == "inner":
        inner(Path(sys.argv[2]), Path(sys.argv[3]))
    else:
        raise SystemExit("C856 producer entry not admitted.")
