"""Trusted preflight sequencing and Linux read-back. The held workflow has no launcher."""
import hashlib
import json
import os
import re
import select
import selectors
import signal
import socket
import stat
import struct
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path

from jammy_confined_preflight import CONTROLS, MANAGER_ENDPOINTS, NAMESPACES, verify_runtime_output
from jammy_native_runtime_inputs import (
    LISTING_LIMIT, PLAN_SHA256, bind_member_bytes, bounded_read, load_plan, require, staged_paths,
    verify_inventory,
)
from producer_boundary import MS_NODEV, MS_NOEXEC, MS_NOSUID, MS_RDONLY, MS_REMOUNT, host_mount

PLAN = Path(__file__).with_name("jammy-confined-preflight-plan.json")
SUPERVISOR_PLAN_SHA256 = "433b22f13f64400c8acd8846c24ca00c4b07b673bb5886f200195ea64b3b30d8"
GROUP_PARENT = "/user.slice/user-1001.slice/user@1001.service/app.slice"
MOUNT_FLAGS = {"ro", "nosuid", "nodev"}
PROC_FLAGS = MOUNT_FLAGS | {"noexec"}
MS_REC, MS_PRIVATE = 16384, 1 << 18
CLEANUP = ("stop_unit", "verify_processes_gone", "verify_mounts_gone", "verify_cgroup_gone",
           "remove_fragment", "verify_unit_unloaded", "remove_scratch", "verify_scratch_gone")


class PreflightFailure(RuntimeError):
    def __init__(self, primary, cleanup):
        super().__init__("PREFLIGHT_TRANSACTION_REFUSED")
        self.primary = primary
        self.cleanup = tuple(cleanup)


@dataclass(frozen=True)
class Run:
    source: str
    workflow_source: str
    run_id: int
    attempt: int
    actor: str
    triggering_actor: str
    repository: str
    ref: str
    event: str
    operation: str

    @property
    def unit(self):
        return f"sounding-line-native-preflight-{self.run_id}.service"

    @property
    def cgroup(self):
        return f"{GROUP_PARENT}/{self.unit}"

    @property
    def fragment(self):
        return "/run/user/1001/systemd/user/" + self.unit


@dataclass(frozen=True)
class Scope:
    run: Run
    nonce: str
    owned: "Ownership" = field(default_factory=lambda: Ownership(), compare=False)

    @property
    def scratch(self):
        return Path(f"/run/user/1001/sl-native-{self.run.run_id}-{self.nonce}")

    @property
    def abstract_endpoint(self):
        return "\0sounding-line-native-preflight-" + self.nonce


@dataclass
class Ownership:
    # The creating adapter journals each exclusive create before any later
    # action can fail. These are lstat (device, inode) identities, not paths.
    fragment: tuple[int, int] | None = None
    scratch: tuple[int, int] | None = None
    start_requested: bool = False
    invocation: str | None = None


class TrackedProcess:
    """Owns a private duplicate until explicit release. Never lend it out."""
    def __init__(self, pid, pidfd):
        self.pid = pid
        self._retained_fd = os.dup(pidfd)
        try:
            verify_pidfd(pid, self._retained_fd)
        except BaseException:
            self.release()
            raise

    def release(self):
        require(self._retained_fd is not None, "PREFLIGHT_PIDFD_RELEASED")
        fd, self._retained_fd = self._retained_fd, None
        os.close(fd)


def has_identity(path, identity):
    try:
        info = path.lstat()
    except FileNotFoundError:
        return False
    return (info.st_dev, info.st_ino) == identity


def load_supervisor_plan():
    with PLAN.open("rb") as stream:
        raw = bounded_read(stream, 8192, "PREFLIGHT_PLAN_SIZE")
    require(hashlib.sha256(raw).hexdigest() == SUPERVISOR_PLAN_SHA256, "PREFLIGHT_PLAN_PIN")
    plan = json.loads(raw)
    require(plan["runtimeInputPlanSha256"] == PLAN_SHA256 and
            all(plan[name] is False for name in ("runtimeAuthorized", "qualification",
                                                 "externalIsolationProved", "reuseAuthorized")),
            "PREFLIGHT_PLAN_AUTHORITY")
    return plan


def verify_run(run, expected_source):
    require(type(expected_source) is str and re.fullmatch(r"[a-f0-9]{40}", expected_source) and
            run.source == run.workflow_source == expected_source and
            type(run.run_id) is int and 0 < run.run_id < 10**15 and
            type(run.attempt) is int and run.attempt == 1 and
            run.actor == run.triggering_actor == "Kgray44" and run.repository == "Kgray44/treasurehuntSoT" and
            run.ref == "refs/heads/main" and run.event == "workflow_dispatch" and
            run.operation == "confined-loader-and-denials-only", "PREFLIGHT_RUN_BINDING")


def unit_properties(run):
    return {"FragmentPath": run.fragment, "DropInPaths": "", "LoadState": "loaded",
            "JobTimeoutUSec": "8s", "RuntimeMaxUSec": "12s", "TimeoutStartUSec": "5s",
            "TimeoutStopUSec": "2s", "MemorySwapMax": "0", "MemoryMax": "134217728",
            "TasksMax": "8", "NoNewPrivileges": "yes", "KillMode": "control-group", "Restart": "no",
            "Delegate": "yes"}


def read_control(cgroup, name):
    fd = os.open(cgroup / name, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    with os.fdopen(fd, "rb") as stream:
        return bounded_read(stream, 4096, "PREFLIGHT_CGROUP_READ_SIZE").decode("ascii").strip()


def verify_limits(run, pid, leaf=None, *, proc=Path("/proc"), sysfs=Path("/sys/fs/cgroup")):
    """Execute in the trusted host view. Never open a control for writing here."""
    require(type(pid) is int and pid > 1, "PREFLIGHT_PID")
    cgroup = sysfs / run.cgroup.lstrip("/")
    require(cgroup.resolve(strict=True) == cgroup, "PREFLIGHT_CGROUP_ALIAS")
    require(leaf in (None, "preflight-worker") and
            read_control(proc / str(pid), "cgroup") == "0::" + run.cgroup + ("/" + leaf if leaf else ""),
            "PREFLIGHT_CGROUP_MEMBERSHIP")
    expected = {"memory.swap.max": "0", "memory.max": "134217728", "pids.max": "8",
                "memory.swap.current": "0"}
    require({name: read_control(cgroup, name) for name in expected} == expected,
            "PREFLIGHT_CGROUP_LIMITS")
    return True


def mount_rows(data):
    """Read the mount identity and flags from the kernel mountinfo format."""
    rows = []
    for line in data.splitlines():
        left, right = line.split(" - ", 1)
        fields, filesystem = left.split(), right.split()
        require(len(fields) >= 6 and len(filesystem) == 3, "PREFLIGHT_MOUNTINFO")
        rows.append({"id": int(fields[0]), "parent": int(fields[1]), "path": fields[4],
                     "flags": set(fields[5].split(",")), "propagation": fields[6:],
                     "type": filesystem[0], "superFlags": set(filesystem[2].split(","))})
    require(len({row["id"] for row in rows}) == len(rows), "PREFLIGHT_MOUNTINFO_IDS")
    return rows


def read_mounts(pid, proc=Path("/proc")):
    with (proc / str(pid) / "mountinfo").open("rb") as stream:
        return mount_rows(bounded_read(stream, 256*1024, "PREFLIGHT_MOUNTINFO_SIZE").decode("ascii"))


def read_private_root(pid, host_namespaces, scratch, *, proc=Path("/proc")):
    """Read a blocked worker's chroot view from its trusted parent."""
    require(type(pid) is int and pid > 1, "PREFLIGHT_PID")
    entry = proc / str(pid)
    root = entry / "root"
    limits = os.statvfs(root)
    root_id = root.stat()
    scratch_id = scratch.stat()
    rows = read_mounts(pid, proc)
    return {"mounts": rows, "privatePropagation": all(not row["propagation"] for row in rows),
            "scratchOutsideRoot": root_id.st_dev != scratch_id.st_dev,
            "hostNamespaces": host_namespaces,
            "workerNamespaces": {name: (entry / "ns" / name).stat().st_ino for name in NAMESPACES},
            "bytes": limits.f_blocks*limits.f_frsize, "inodes": limits.f_files}


def stage_private_root(scope, bound, host_namespaces):
    """Stage within the already isolated supervisor's mount namespace."""
    inputs = load_plan()
    canonical = staged_paths(inputs)
    require(set(bound) == set(canonical), "PREFLIGHT_STAGE_TARGETS")
    payloads = {name: bound[member["target"]] for name, member in inputs["members"].items()}
    require(bound == bind_member_bytes(inputs, payloads), "PREFLIGHT_STAGE_BYTES")
    current = {name: Path("/proc/self/ns", name).stat().st_ino for name in NAMESPACES}
    require(set(host_namespaces) == set(NAMESPACES) and
            all(type(host_namespaces[name]) is int and current[name] != host_namespaces[name]
                for name in NAMESPACES), "PREFLIGHT_STAGE_NAMESPACES")
    root = scope.scratch / "root"
    info = root.lstat()
    require(has_identity(scope.scratch, scope.owned.scratch) and root.resolve(strict=True) == root and
            stat.S_ISDIR(info.st_mode) and
            info.st_uid == os.geteuid() and not info.st_mode & 0o077 and not any(root.iterdir()),
            "PREFLIGHT_STAGE_MOUNTPOINT")
    host_mount(None, "/", flags=MS_REC | MS_PRIVATE)
    before = root.stat()
    host_mount("sl-jammy-preflight", root, "tmpfs", MS_NOSUID | MS_NODEV,
               "size=16777216,nr_inodes=256,mode=0700")
    after = root.stat()
    limits = os.statvfs(root)
    require(before.st_dev != after.st_dev and limits.f_blocks*limits.f_frsize == 16777216 and
            limits.f_files == 256, "PREFLIGHT_STAGE_TMPFS_LIMIT")
    for name in ("proc", "probe"):
        (root / name).mkdir(mode=0o700)
    host_mount("proc", root / "proc", "proc", MS_RDONLY | MS_NOSUID | MS_NODEV | MS_NOEXEC)
    executables = {inputs["interpreter"]["target"], inputs["members"]["bwrap"]["target"]}
    for target, content in bound.items():
        entry = root / target.lstrip("/")
        entry.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        fd = os.open(entry, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC,
                     0o555 if target in executables else 0o444)
        with os.fdopen(fd, "wb") as stream:
            require(stream.write(content) == len(content), "PREFLIGHT_STAGE_SHORT_WRITE")
    host_mount(None, root, flags=MS_REMOUNT | MS_RDONLY | MS_NOSUID | MS_NODEV)
    rows = [row for row in read_mounts("self") if row["path"] == str(root)]
    require(len(rows) == 1 and rows[0]["type"] == "tmpfs" and
            "ro" in rows[0]["flags"] and "ro" in rows[0]["superFlags"], "PREFLIGHT_STAGE_SEAL")
    attest_private_files(root, bound)
    return root


def control_write(directory_fd, name, data):
    fd = os.open(name, os.O_WRONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=directory_fd)
    try:
        require(os.write(fd, data) == len(data), "PREFLIGHT_CANARY_SHORT_WRITE")
    finally:
        os.close(fd)


def exercise_cgroup_canary(run, pid, *, proc=Path("/proc"), sysfs=Path("/sys/fs/cgroup")):
    """Positive controls. The caller owns an unreaped, blocked child and both leaves."""
    require(type(pid) is int and pid > 1, "PREFLIGHT_CANARY_PID")
    process = proc / str(pid)
    status = read_control(process, "status")
    require(re.search(r"^PPid:\s+" + str(os.getpid()) + r"$", status, re.M),
            "PREFLIGHT_CANARY_PARENT")
    source = run.cgroup + "/preflight-source"
    target = run.cgroup + "/preflight-target"
    require(read_control(process, "cgroup") == "0::" + source, "PREFLIGHT_CANARY_SOURCE")
    rows = read_mounts("self", proc)
    matching = [row for row in rows if row["path"] == str(sysfs)]
    require(len(matching) == 1 and matching[0]["type"] == "cgroup2" and
            "rw" in matching[0]["flags"], "PREFLIGHT_CANARY_CGROUP_V2")
    leaf = sysfs / target.lstrip("/")
    require(leaf.resolve(strict=True) == leaf, "PREFLIGHT_CANARY_ALIAS")
    fd = os.open(leaf, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        info = os.fstat(fd)
        require(info.st_uid == os.geteuid() and os.path.samestat(info, leaf.stat()) and
                leaf.stat().st_dev == sysfs.stat().st_dev, "PREFLIGHT_CANARY_OWNERSHIP")
        require(read_control(leaf, "cgroup.events").splitlines()[0] == "populated 0",
                "PREFLIGHT_CANARY_TARGET_NOT_EMPTY")
        for name, value in (("memory.swap.max", "0"), ("memory.max", "33554432"), ("pids.max", "2")):
            require(read_control(leaf, name) == "max", "PREFLIGHT_CANARY_INITIAL_LIMIT")
            control_write(fd, name, (value + "\n").encode("ascii"))
            require(read_control(leaf, name) == value, "PREFLIGHT_CANARY_LIMIT_READBACK")
        control_write(fd, "cgroup.procs", (str(pid) + "\n").encode("ascii"))
        require(read_control(process, "cgroup") == "0::" + target, "PREFLIGHT_CANARY_MOVE_READBACK")
    finally:
        os.close(fd)
    return {"sourceLeaf": source, "targetLeaf": target, "cgroupV2MountAttested": True,
            "canaryMovedAndReadBack": True, "limitChangedAndReadBack": True}


def verify_pidfd(pid, pidfd):
    require(type(pid) is int and pid > 1 and type(pidfd) is int and pidfd >= 3 and
            os.readlink(Path("/proc/self/fd") / str(pidfd)) == "anon_inode:[pidfd]" and
            read_control(Path("/proc/self/fdinfo"), str(pidfd)).splitlines().count(f"Pid:\t{pid}") == 1,
            "PREFLIGHT_PIDFD_IDENTITY")


def reap_canary(pid, pidfd):
    """Use only the caller's pinned canary. Caller owns leaf removal."""
    verify_pidfd(pid, pidfd)
    require(re.search(r"^PPid:\s+" + str(os.getpid()) + r"$",
                      read_control(Path("/proc") / str(pid), "status"), re.M), "PREFLIGHT_CANARY_PIDFD")
    signal.pidfd_send_signal(pidfd, signal.SIGKILL)
    poll = select.poll()
    poll.register(pidfd, select.POLLIN)
    require(any(event & select.POLLIN for _, event in poll.poll(1000)), "PREFLIGHT_CANARY_REAP_TIMEOUT")
    child, status = os.waitpid(pid, os.WNOHANG)
    require(child == pid and os.WIFSIGNALED(status) and os.WTERMSIG(status) == signal.SIGKILL,
            "PREFLIGHT_CANARY_REAP")
    return True


def bounded_command(argv, *, timeout, output_limit=LISTING_LIMIT):
    """Bounded, non-shell invocation for a trusted fixed command."""
    deadline = time.monotonic() + timeout
    env = {"PATH": "/usr/bin:/bin", "LANG": "C", "XDG_RUNTIME_DIR": "/run/user/1001",
           "DBUS_SESSION_BUS_ADDRESS": "unix:path=/run/user/1001/bus"}
    child = subprocess.Popen(argv, env=env, stdin=subprocess.DEVNULL,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        with selectors.DefaultSelector() as selector:
            streams = {child.stdout: bytearray(), child.stderr: bytearray()}
            for stream in streams:
                selector.register(stream, selectors.EVENT_READ)
            while selector.get_map():
                remaining = deadline - time.monotonic()
                require(remaining > 0, "PREFLIGHT_COMMAND_DEADLINE")
                for key, _ in selector.select(remaining):
                    chunk = os.read(key.fd, 4096)
                    if chunk:
                        buffer = streams[key.fileobj]
                        buffer.extend(chunk)
                        require(len(buffer) <= output_limit, "PREFLIGHT_COMMAND_OUTPUT_LIMIT")
                    else:
                        selector.unregister(key.fileobj)
            remaining = deadline - time.monotonic()
            require(remaining > 0, "PREFLIGHT_COMMAND_DEADLINE")
            status = child.wait(timeout=remaining)
        return status, bytes(streams[child.stdout]), bytes(streams[child.stderr])
    except BaseException as primary:
        try:
            if child.poll() is None:
                child.kill()
                child.wait(timeout=0.25)
        except (OSError, subprocess.TimeoutExpired) as error:
            raise PreflightFailure(primary, [("trusted_command_reap", error)]) from error
        raise
    finally:
        child.stdout.close()
        child.stderr.close()


def stop_owned_unit(scope, timeout):
    run = scope.run
    require(scope.owned.start_requested and has_identity(Path(run.fragment), scope.owned.fragment),
            "PREFLIGHT_STOP_OWNERSHIP")
    invocation = scope.owned.invocation
    require(type(invocation) is str and re.fullmatch(r"(?!0{32}$)[0-9a-f]{32}", invocation),
            "PREFLIGHT_STOP_INVOCATION")
    deadline = time.monotonic() + timeout
    status, output, error = bounded_command(
        ["/usr/bin/systemctl", "--user", "show", "--property=FragmentPath,DropInPaths,ControlGroup,InvocationID",
         run.unit], timeout=timeout/2)
    expected = {f"FragmentPath={run.fragment}", "DropInPaths=", f"ControlGroup={run.cgroup}",
                f"InvocationID={invocation}"}
    lines = output.decode("ascii").splitlines()
    require(status == 0 and not error and len(lines) == len(expected) and set(lines) == expected,
            "PREFLIGHT_STOP_ACTIVE_UNIT")
    remaining = deadline - time.monotonic()
    require(remaining > 0, "PREFLIGHT_COMMAND_DEADLINE")
    status, _, _ = bounded_command(["/usr/bin/systemctl", "--user", "--no-ask-password",
                                    "--job-mode=fail", "stop", run.unit], timeout=remaining)
    return status == 0


def verify_unloaded(run, timeout):
    status, output, error = bounded_command([
        "/usr/bin/busctl", "--address=unix:path=/run/user/1001/bus", "--timeout=2s", "call",
        "org.freedesktop.systemd1", "/org/freedesktop/systemd1", "org.freedesktop.systemd1.Manager",
        "GetUnit", "s", run.unit,
    ], timeout=timeout)
    return status == 1 and output == b"" and error.strip() == f"Call failed: Unit {run.unit} not loaded.".encode()


def manager_positive_controls(scope, timeout):
    """Bind the private same-UID socket to the manager's bus owner."""
    require(type(scope) is Scope and re.fullmatch(r"[a-f0-9]{32}", scope.nonce),
            "PREFLIGHT_SCOPE")
    deadline = time.monotonic() + timeout
    status, output, error = bounded_command([
        "/usr/bin/busctl", "--address=unix:path=/run/user/1001/bus", "--timeout=2s", "call",
        "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
        "GetConnectionUnixProcessID", "s", "org.freedesktop.systemd1",
    ], timeout=min(2, timeout))
    match = re.fullmatch(rb"u ([1-9][0-9]{0,9})\n", output)
    require(status == 0 and not error and match is not None, "PREFLIGHT_MANAGER_BUS_OWNER")
    manager_pid = int(match[1])
    for endpoint in (*MANAGER_ENDPOINTS, scope.abstract_endpoint):
        remaining = deadline - time.monotonic()
        require(remaining > 0, "PREFLIGHT_COMMAND_DEADLINE")
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.settimeout(min(0.25, remaining))
            client.connect(endpoint)
            credentials = client.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize("3i"))
            pid, uid, _ = struct.unpack("3i", credentials)
        require(uid == 1001 and (endpoint != MANAGER_ENDPOINTS[1] or pid == manager_pid) and
                (endpoint != scope.abstract_endpoint or pid == os.getpid()), "PREFLIGHT_MANAGER_PEER")
    return {"managerEndpoints": MANAGER_ENDPOINTS, "managerAuthenticated": True, "abstractConnected": True}


def verify_pidfds_gone(processes, expected_count):
    require(type(expected_count) is int and expected_count > 0 and
            len(processes) == expected_count and all(type(item) is TrackedProcess for item in processes) and
            len({item.pid for item in processes}) == len({item._retained_fd for item in processes}) == expected_count,
            "PREFLIGHT_PIDFD_COVERAGE")
    poll = select.poll()
    fds = set()
    for item in processes:
        fd = item._retained_fd
        require(fd is not None, "PREFLIGHT_PIDFD_RELEASED")
        fds.add(fd)
        poll.register(fd, select.POLLIN)
    ready = dict(poll.poll(0))
    return set(ready) == fds and all(event & select.POLLIN for event in ready.values())


def absent(path):
    try:
        path.lstat()
    except FileNotFoundError:
        return True
    return False


def attest_private_files(root, staged, *, root_fd=None):
    """Called only by the trusted supervisor on the private, sealed tmpfs."""
    allowed_dirs = {Path("."), Path("proc"), Path("probe")}
    for target in staged:
        allowed_dirs.update(Path(target.lstrip("/")).parents)
    def on_error(error):
        raise error

    if root_fd is None:
        info = root.lstat()
    else:
        require(root == Path("/proc/self/fd") / str(root_fd), "PREFLIGHT_ROOT_ANCHOR")
        info = os.fstat(root_fd)
    require(stat.S_ISDIR(info.st_mode) and not info.st_mode & 0o7022, "PREFLIGHT_ROOT_MODE")
    uid = info.st_uid
    visited, visited_dirs = set(), set()
    for directory, dirs, names in os.walk(root, followlinks=False, onerror=on_error):
        base = Path(directory)
        relative = base.relative_to(root)
        require(relative in allowed_dirs, "PREFLIGHT_ROOT_DIRECTORY")
        visited_dirs.add(relative)
        if relative == Path("proc"):
            dirs.clear()  # Its separate kernel mount is attested by mount ID.
            continue
        for name in dirs + names:
            entry = base / name
            info = entry.lstat()
            require((entry == root / "proc" or info.st_uid == uid) and not info.st_mode & 0o7022,
                    "PREFLIGHT_ROOT_MODE")
            if name in dirs:
                require(stat.S_ISDIR(info.st_mode) and entry.relative_to(root) in allowed_dirs,
                        "PREFLIGHT_ROOT_DIRECTORY")
                continue
            target = "/" + entry.relative_to(root).as_posix()
            require(target in staged and stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and
                    info.st_size == len(staged[target]), "PREFLIGHT_ROOT_FILE")
            with entry.open("rb") as stream:
                data = bounded_read(stream, info.st_size, "PREFLIGHT_ROOT_FILE_SIZE")
            require(hashlib.sha256(data).digest() == hashlib.sha256(staged[target]).digest(),
                    "PREFLIGHT_ROOT_FILE_HASH")
            visited.add(target)
    require(visited == set(staged) and visited_dirs == allowed_dirs, "PREFLIGHT_ROOT_FILE_COVERAGE")
    return True


def attest_worker_root(pid, pidfd, root_identity, staged):
    verify_pidfd(pid, pidfd)
    fd = os.open(Path("/proc") / str(pid) / "root", os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    try:
        info = os.fstat(fd)
        require((info.st_dev, info.st_ino) == root_identity, "PREFLIGHT_WORKER_ROOT_IDENTITY")
        verify_pidfd(pid, pidfd)
        attest_private_files(Path("/proc/self/fd") / str(fd), staged, root_fd=fd)
        verify_pidfd(pid, pidfd)
    finally:
        os.close(fd)
    return True


def verify_root(root, plan):
    tmpfs, proc = root["mounts"]
    require(root["privatePropagation"] is True and root["scratchOutsideRoot"] is True and
            tmpfs["path"] == "/" and tmpfs["type"] == "tmpfs" and
            set(tmpfs["flags"]) - {"relatime"} == MOUNT_FLAGS and "ro" in tmpfs["superFlags"] and
            proc["path"] == "/proc" and proc["type"] == "proc" and
            set(proc["flags"]) - {"relatime"} == PROC_FLAGS and
            all(type(m["id"]) is int and m["id"] > 0 for m in (tmpfs, proc)) and tmpfs["id"] != proc["id"] and
            proc["parent"] == tmpfs["id"] and
            root["bytes"] == plan["limits"]["privateTmpfsBytes"] and
            root["inodes"] == plan["limits"]["privateTmpfsInodes"], "PREFLIGHT_PRIVATE_ROOT")
    require(set(root["hostNamespaces"]) == set(root["workerNamespaces"]) == set(NAMESPACES) and
            all(type(root["hostNamespaces"][key]) is type(root["workerNamespaces"][key]) is int and
                root["hostNamespaces"][key] > 0 and root["workerNamespaces"][key] > 0 and
                root["hostNamespaces"][key] != root["workerNamespaces"][key] for key in NAMESPACES),
            "PREFLIGHT_PRIVATE_NAMESPACES")


def verify_controls(controls, run):
    # The adapter must perform the harmless writes/moves on its own bounded
    # canary and read them back. The service and ancestors are never targets.
    require(tuple(controls["managerEndpoints"]) == MANAGER_ENDPOINTS and
            controls["managerAuthenticated"] is True and controls["abstractConnected"] is True,
            "PREFLIGHT_MANAGER_POSITIVE")
    require(controls["sourceLeaf"] == run.cgroup + "/preflight-source" and
            controls["targetLeaf"] == run.cgroup + "/preflight-target" and
            controls["cgroupV2MountAttested"] is True and controls["remountCanarySucceeded"] is True and
            controls["canaryMovedAndReadBack"] is True and controls["limitChangedAndReadBack"] is True and
            controls["canaryReaped"] is True and controls["leavesRemoved"] is True,
            "PREFLIGHT_CGROUP_POSITIVE")


def verify_denials(result):
    require(set(result) == {"sameUidManagerAccess", "cgroupRemount", "cgroupMigration",
                            "cgroupLimitMutation"} and all(value is True for value in result.values()),
            "PREFLIGHT_NATIVE_DENIALS")


def cleanup(ops, scope):
    failures = []
    safe_to_remove = True
    for action in CLEANUP:
        if action in CLEANUP[:4] and not scope.owned.start_requested:
            continue
        if action in ("remove_fragment", "verify_unit_unloaded") and scope.owned.fragment is None:
            continue
        if action in ("remove_scratch", "verify_scratch_gone") and scope.owned.scratch is None:
            continue
        if action in ("remove_fragment", "remove_scratch") and not safe_to_remove:
            failures.append((action, "PREFLIGHT_CUSTODY_RETAINED"))
            continue
        try:
            require(getattr(ops, action)(scope, timeout=3) is True, "PREFLIGHT_CLEANUP_UNVERIFIED")
        except BaseException as error:
            safe_to_remove = False
            failures.append((action, error))
    return failures


def supervise(run, expected_source, receipt, ops, *, clock=time.monotonic):
    """Run the state machine with trusted, operation-specific OS adapters.

    There is no adapter registered by the dormant workflow. All operations must
    take a deadline. Ownership is recorded by reserve before any side effect;
    reserve itself is a read-only check and returns the identity for later steps.
    """
    verify_run(run, expected_source)
    plan = load_supervisor_plan()
    inputs = load_plan()
    verify_inventory(inputs, receipt)
    end = clock() + plan["limits"]["jobSeconds"] - 3*len(CLEANUP)

    def time_left(cap):
        remaining = min(cap, end - clock())
        require(remaining > 0, "PREFLIGHT_DEADLINE")
        return remaining

    scope = ops.reserve(run, plan["runner"], plan["limits"], timeout=time_left(3))
    require(type(scope) is Scope and scope.run == run and type(scope.nonce) is str and
            re.fullmatch(r"[a-f0-9]{32}", scope.nonce) and scope.owned == Ownership(), "PREFLIGHT_SCOPE")
    primary = None
    output = None
    try:
        properties = ops.configure_unit(scope, timeout=time_left(3))
        require(properties == unit_properties(run), "PREFLIGHT_UNIT_CONFIGURATION")
        require(all(type(identity) is tuple and len(identity) == 2 and
                    all(type(item) is int and item > 0 for item in identity)
                    for identity in (scope.owned.fragment, scope.owned.scratch)), "PREFLIGHT_UNIT_OWNERSHIP")
        # Public archive fetching is bounded separately. Only authenticated
        # in-memory member bytes cross into the service after admission.
        payloads = ops.acquire_public_members(scope, timeout=time_left(plan["limits"]["inventorySeconds"]))
        staged = bind_member_bytes(inputs, payloads)
        startup = time_left(plan["limits"]["startupSeconds"])
        scope.owned.start_requested = True
        pid = ops.start_blocked(scope, timeout=startup)
        require(type(pid) is int and pid > 1, "PREFLIGHT_PID")
        end = min(end, clock() + plan["limits"]["runtimeSeconds"])
        require(ops.verify_effective_limits(scope, pid, timeout=time_left(2)) is True,
                "PREFLIGHT_EFFECTIVE_LIMITS")
        positive = ops.positive_controls(scope, pid, timeout=time_left(3))
        verify_controls(positive, run)
        root = ops.stage_and_seal(scope, pid, staged, timeout=time_left(2))
        verify_root(root, plan)
        require(ops.verify_private_files(scope, pid, staged, timeout=time_left(2)) is True,
                "PREFLIGHT_PRIVATE_FILE_ATTESTATION")
        verify_denials(ops.denial_controls(scope, pid, positive, timeout=time_left(2)))
        require(ops.verify_effective_limits(scope, pid, timeout=time_left(2)) is True,
                "PREFLIGHT_EFFECTIVE_LIMITS")
        listing, version = ops.loader_commands(scope, pid, plan["launchCommands"],
                                               output_limit=LISTING_LIMIT, timeout=time_left(2))
        output = verify_runtime_output(receipt, *listing, *version)
        require(ops.verify_effective_limits(scope, pid, timeout=time_left(2)) is True,
                "PREFLIGHT_EFFECTIVE_LIMITS")
        time_left(2)
    except BaseException as error:
        primary = error
    errors = cleanup(ops, scope)
    if primary is not None or errors:
        raise PreflightFailure(primary, errors)
    return {"kind": "PREFLIGHT_DIAGNOSTIC_ONLY", "source": run.source, "run": run.run_id,
            "attempt": run.attempt, "loader": output, "cleanupVerified": True,
            "qualification": False, "externalIsolationProved": False, "reuseAuthorized": False}
