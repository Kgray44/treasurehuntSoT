"""Dormant launcher primitives for owned Jammy preflight units and recovery."""
import ctypes
import errno
import hashlib
import json
import os
import re
import select
import socket
import stat
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from jammy_confined_preflight import (
    MANAGER_ENDPOINTS, NAMESPACES, clone_policy_attempt, connect, denied, namespace_ids, open_control,
)
from jammy_native_runtime_inputs import bind_member_bytes, load_plan, require, verify_inventory
from jammy_preflight_custody import custody, owner_record, verify_owners_gone
from jammy_preflight_supervisor import (
    MS_PRIVATE, MS_REC, PreflightFailure, Scope, absent, bounded_command, exercise_cgroup_canary, has_identity,
    load_supervisor_plan, manager_positive_controls, read_mounts, reap_canary, stage_private_root,
    unit_properties, verify_limits, verify_pidfd, verify_run, verify_unloaded,
)
from producer_boundary import (
    MS_BIND, MS_NODEV, MS_NOEXEC, MS_NOSUID, MS_RDONLY, MS_REMOUNT, drop_caps_and_chroot, host_mount,
)

SCRATCH_MARKER = "scope"
FRAGMENT = "unit.fragment"
PRIVATE_ROOT = "root"
STOP_WINDOW = 8 + 5 + 12 + 2
RECOVERY_SECONDS = STOP_WINDOW + 5
WATCHDOG_WAIT = 300 - RECOVERY_SECONDS
LIMIT_NAMES = ("memory.swap.max", "memory.max", "pids.max")


@dataclass(frozen=True)
class RecoveryLease:
    source: str
    run: int
    attempt: int
    nonce: str
    scratch: tuple
    fragment: tuple
    marker: tuple
    root: tuple
    fragment_sha256: str


def identity(info):
    return info.st_dev, info.st_ino


def validate_lease(scope, lease):
    require(type(scope) is Scope and type(lease) is RecoveryLease, "LAUNCH_RECOVERY_SCOPE")
    verify_run(scope.run, lease.source)
    require(
            (lease.run, lease.attempt, lease.nonce) ==
            (scope.run.run_id, scope.run.attempt, scope.nonce) and
            scope.run.unit_nonce in (None, scope.nonce) and
            type(scope.nonce) is str and re.fullmatch(r"[a-f0-9]{32}", scope.nonce) and
            type(lease.fragment_sha256) is str and re.fullmatch(r"[a-f0-9]{64}", lease.fragment_sha256) and
            all(type(pair) is tuple and len(pair) == 2 and
                all(type(value) is int and value > 0 for value in pair)
                for pair in (lease.scratch, lease.fragment, lease.marker, lease.root)),
            "LAUNCH_RECOVERY_SCOPE")


def unit_fragment(scope, python_worker, tracking, controller_pid=None):
    """Only a trusted Python service enters the bounded cgroup."""
    path = str(python_worker)
    require(type(scope) is Scope and re.fullmatch(r"[a-f0-9]{32}", scope.nonce) and
            re.fullmatch(r"/[A-Za-z0-9_./-]+/jammy_preflight_worker\.py", path) and
            Path(path).as_posix() == path and ".." not in Path(path).parts and
            re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", tracking), "LAUNCH_UNIT_ARGUMENT")
    verify_run(scope.run, scope.run.source)
    controller = os.getpid() if controller_pid is None else controller_pid
    require(type(controller) is int and controller > 1, "LAUNCH_CONTROLLER_PID")
    binding = "" if scope.custody is None else " " + " ".join(scope.custody.arguments())
    return (
        "[Unit]\nJobTimeoutSec=8s\nCollectMode=inactive-or-failed\n"
        "[Service]\nType=exec\nSlice=app.slice\nDelegate=yes\n"
        "MemorySwapMax=0\nMemoryMax=128M\nTasksMax=8\nNoNewPrivileges=yes\n"
        "RuntimeMaxSec=12s\nTimeoutStartSec=5s\nTimeoutStopSec=2s\n"
        "KillMode=control-group\nRestart=no\nLimitFSIZE=4M\n"
        "StandardInput=null\nStandardOutput=null\nStandardError=journal\n"
        f"ExecStart=/usr/bin/env -i PATH=/usr/bin:/bin LANG=C "
        f"RUNNER_TRACKING_ID={tracking} /usr/bin/python3 -IB {path} "
        f"{scope.run.source} {scope.run.run_id} 1 {scope.nonce} {controller}{binding}\n"
    ).encode("ascii")


def exclusive_file(directory_fd, name, data, entries):
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC,
                 0o600, dir_fd=directory_fd)
    try:
        created = identity(os.fstat(fd))
        entries.append((name, created, False))
        require(os.write(fd, data) == len(data), "LAUNCH_CUSTODY_SHORT_WRITE")
        os.fsync(fd)
        return created
    finally:
        os.close(fd)


def prepare_lease(scope, python_worker, tracking, *, controller_pid, journal=None):
    """Prepare only private metadata. No manager-visible unit exists yet."""
    body = unit_fragment(scope, python_worker, tracking, controller_pid)
    require(scope.run.unit_nonce == scope.nonce, "LAUNCH_UNIT_NONCE")
    digest = hashlib.sha256(body).hexdigest()
    parent = scope.scratch.parent
    info = parent.lstat()
    require(parent.resolve(strict=True) == parent and stat.S_ISDIR(info.st_mode) and
            info.st_uid == os.geteuid() == 1001 and not info.st_mode & 0o077 and
            absent(Path(scope.run.fragment)), "LAUNCH_CUSTODY_PARENT")
    name = scope.scratch.name
    flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_DIRECTORY | os.O_CLOEXEC
    parent_fd = os.open(parent, flags)
    scratch = fd = None
    created_scratch = scratch_bound = False
    entries = []
    try:
        require(identity(os.fstat(parent_fd)) == identity(info), "LAUNCH_CUSTODY_PARENT")
        if journal is not None:
            require(identity(info) == scope.custody.base, "LAUNCH_CUSTODY_BASE")
            journal.reserve(owner_record(controller_pid, os.getpid()))
        os.mkdir(name, mode=0o700, dir_fd=parent_fd)
        created_scratch = True
        created = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        require(stat.S_ISDIR(created.st_mode) and created.st_uid == 1001 and
                not created.st_mode & 0o077, "LAUNCH_CUSTODY_SCRATCH")
        scratch = identity(created)
        fd = os.open(name, flags, dir_fd=parent_fd)
        require(identity(os.fstat(fd)) == scratch, "LAUNCH_CUSTODY_SCRATCH")
        scratch_bound = True
        if journal is not None:
            journal.bind(scratch)
        os.mkdir(PRIVATE_ROOT, mode=0o700, dir_fd=fd)
        root = identity(os.stat(PRIVATE_ROOT, dir_fd=fd, follow_symlinks=False))
        entries.append((PRIVATE_ROOT, root, True))
        fragment = exclusive_file(fd, FRAGMENT, body, entries)
        journal = {"source": scope.run.source, "run": scope.run.run_id, "attempt": scope.run.attempt,
                   "nonce": scope.nonce, "scratch": scratch, "fragment": fragment,
                   "fragmentSha256": digest, "root": root}
        marker = exclusive_file(fd, SCRATCH_MARKER,
                                json.dumps(journal, sort_keys=True, separators=(",", ":")).encode("ascii"),
                                entries)
        lease = RecoveryLease(scope.run.source, scope.run.run_id, scope.run.attempt, scope.nonce,
                              scratch, fragment, marker, root, digest)
        validate_lease(scope, lease)
        return lease
    except BaseException as primary:
        if not created_scratch:
            raise
        try:
            require(scratch_bound, "LAUNCH_CUSTODY_SCRATCH_UNBOUND")
            for name, owned, directory in reversed(entries):
                unlink_owned(fd, name, owned, directory=directory)
            unlink_owned(parent_fd, scope.scratch.name, scratch, directory=True)
        except BaseException as error:
            raise PreflightFailure(primary, [("unpublished_lease_recovery", error)]) from error
        raise
    finally:
        if fd is not None:
            os.close(fd)
        os.close(parent_fd)


def unlink_owned(directory_fd, name, expected, *, directory=False):
    """Remove one exact journaled entry from an exclusively owned directory."""
    try:
        current = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
    except FileNotFoundError:
        return
    expected_type = stat.S_ISDIR if directory else stat.S_ISREG
    require(identity(current) == expected and expected_type(current.st_mode),
            "LAUNCH_RECOVERY_FOREIGN_ENTRY")
    if directory:
        os.rmdir(name, dir_fd=directory_fd)
    else:
        os.unlink(name, dir_fd=directory_fd)


def remove_owned_scratch(scope, lease):
    """Never recurse or unmount. Every permissible entry has a recorded inode."""
    if absent(scope.scratch):
        return True
    parent = os.open(scope.scratch.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        fd = os.open(scope.scratch.name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
                     dir_fd=parent)
        try:
            info = os.fstat(fd)
            require(identity(info) == lease.scratch and info.st_uid == 1001 and
                    not info.st_mode & 0o077 and
                    set(os.listdir(fd)) <= {SCRATCH_MARKER, FRAGMENT, PRIVATE_ROOT},
                    "LAUNCH_RECOVERY_SCRATCH_SCOPE")
            unlink_owned(fd, PRIVATE_ROOT, lease.root, directory=True)
            unlink_owned(fd, FRAGMENT, lease.fragment)
            unlink_owned(fd, SCRATCH_MARKER, lease.marker)
        finally:
            os.close(fd)
        unlink_owned(parent, scope.scratch.name, lease.scratch, directory=True)
    finally:
        os.close(parent)
    return absent(scope.scratch)


def remove_owned_fragment(scope, lease):
    fragment = Path(scope.run.fragment)
    if absent(fragment):
        return True
    verify_fragment(fragment, lease)
    parent = os.open(fragment.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        unlink_owned(parent, fragment.name, lease.fragment)
    finally:
        os.close(parent)
    return absent(fragment)


def observe_quiescence(scope, timeout):
    """Passive only. The manager expires the exact service by its own deadlines."""
    cgroup = Path("/sys/fs/cgroup") / scope.run.cgroup.lstrip("/")
    return absent(cgroup) and verify_unloaded(scope.run, timeout)


def verify_no_host_mount(scope):
    prefix = str(scope.scratch)
    return all(row["path"] != prefix and not row["path"].startswith(prefix + "/")
               for row in read_mounts("self"))


def recover_bound(scope, lease, *, clock=time.monotonic, sleep=time.sleep,
            quiescent=observe_quiescence, mounts_gone=verify_no_host_mount,
            remove_fragment=remove_owned_fragment, remove_scratch=remove_owned_scratch):
    """Never send StopUnit or a signal. Wait out the manager's bound, then verify."""
    validate_lease(scope, lease)
    end = clock() + RECOVERY_SECONDS
    # A queued start can precede controller death. A momentary unloaded result
    # is insufficient until the complete queue/start/active/stop window passes.
    sleep(STOP_WINDOW)
    remaining = end - clock()
    require(remaining > 0 and quiescent(scope, min(3, remaining)) is True and
            mounts_gone(scope) is True, "LAUNCH_RECOVERY_NOT_QUIESCENT")
    require(end > clock() and remove_fragment(scope, lease) is True, "LAUNCH_RECOVERY_FRAGMENT")
    remaining = end - clock()
    require(remaining > 0 and quiescent(scope, min(2, remaining)) is True,
            "LAUNCH_RECOVERY_UNIT_RECHECK")
    require(end > clock() and remove_scratch(scope, lease) is True, "LAUNCH_RECOVERY_SCRATCH")
    return True


def lease_record(lease):
    return json.loads(json.dumps(asdict(lease)))


def decode_lease(scope, record):
    values = dict(record)
    for name in ("scratch", "fragment", "marker", "root"):
        values[name] = tuple(values[name])
    lease = RecoveryLease(**values)
    validate_lease(scope, lease)
    return lease


def recover(scope, lease, **options):
    if scope.custody is None:
        return recover_bound(scope, lease, **options)
    validate_lease(scope, lease)
    with custody(scope) as journal:
        require(journal.read("reserved") is not None and
                journal.read("bound") == {"scratch": list(lease.scratch)}, "LAUNCH_CUSTODY_RECOVERY_PHASE")
        admitted = journal.read("admitted")
        require(admitted is None or admitted == lease_record(lease), "LAUNCH_CUSTODY_RECOVERY_PHASE")
        terminal = {"admitted": admitted is not None}
        previous = journal.read("retired")
        if previous is not None:
            require(previous == terminal and journal.scratch_identity() is None and
                    absent(Path(scope.run.fragment)), "LAUNCH_CUSTODY_RETIREMENT")
            return True
        recover_bound(scope, lease, **options)
        journal.write("retired", terminal)
        return True


def recover_after_cancellation(scope, **options):
    """Reconcile an authenticated prior scope after both launcher processes exit."""
    with custody(scope) as journal:
        verify_owners_gone(journal.read("reserved"))
        admitted = journal.read("admitted")
        if admitted is None:
            if journal.read("retired") is not None:
                require(journal.read("retired") == {"admitted": False} and journal.scratch_identity() is None and
                        absent(Path(scope.run.fragment)), "LAUNCH_CUSTODY_RETIREMENT")
                return True
            require(absent(Path(scope.run.fragment)), "LAUNCH_CUSTODY_RECOVERY_FRAGMENT")
            journal.recover_empty()
            return True
        lease = decode_lease(scope, admitted)
    return recover(scope, lease, **options)


def watchdog_wait(scope, lease, controller_pid, controller_pidfd, *, poll_factory=None,
                  recover_owned=recover, acknowledge=None, completion_fd=None, validated=False):
    """Run in an independent trusted process with a retained controller pidfd."""
    validate_lease(scope, lease)
    if not validated:
        verify_pidfd(controller_pid, controller_pidfd)
    poll = (poll_factory or select.poll)()
    poll.register(controller_pidfd, select.POLLIN)
    if completion_fd is not None:
        poll.register(completion_fd, select.POLLIN)
    if acknowledge is not None:
        acknowledge()
    end = time.monotonic() + WATCHDOG_WAIT
    while True:
        remaining = end - time.monotonic()
        require(remaining > 0, "LAUNCH_WATCHDOG_CONTROLLER_STILL_LIVE")
        ready = dict(poll.poll(max(1, int(remaining * 1000))))
        if ready.get(controller_pidfd, 0) & select.POLLIN:
            return recover_owned(scope, lease)
        if completion_fd is not None and completion_fd in ready:
            if os.read(completion_fd, 2) == b"C":
                return True
            poll.unregister(completion_fd)
            completion_fd = None
        else:
            raise ValueError("LAUNCH_WATCHDOG_CONTROLLER_STILL_LIVE")


@dataclass(frozen=True)
class ArmedWatchdog:
    pid: int
    lease: RecoveryLease
    completion_fd: int | None = None


def arm_watchdog(scope, python_worker, tracking, timeout):
    """Fork before publishing the fragment; the child cannot hold workload FDs."""
    require(0 < timeout <= 3, "LAUNCH_WATCHDOG_TIMEOUT")
    controller = os.getpid()
    controller_fd = os.pidfd_open(controller)
    try:
        read_fd, write_fd = os.pipe2(os.O_CLOEXEC)
        try:
            complete_read, complete_write = os.pipe2(os.O_CLOEXEC)
        except BaseException:
            os.close(read_fd)
            os.close(write_fd)
            raise
        try:
            child = os.fork()
        except BaseException:
            for fd in (read_fd, write_fd, complete_read, complete_write):
                os.close(fd)
            raise
        if child == 0:
            status = 1
            try:
                os.setsid()
                keep = {controller_fd, write_fd, complete_read}
                for item in os.listdir("/proc/self/fd"):
                    fd = int(item)
                    if fd not in keep:
                        try:
                            os.close(fd)
                        except OSError as error:
                            if error.errno != errno.EBADF:
                                raise
                verify_pidfd(controller, controller_fd)
                try:
                    with custody(scope) as journal:
                        lease = prepare_lease(scope, python_worker, tracking, controller_pid=controller,
                                              journal=journal)
                except Exception as error:
                    reason = ("LAUNCH_WATCHDOG_PREPARE_CUSTODY_HELD" if isinstance(error, PreflightFailure)
                              else "LAUNCH_WATCHDOG_PREPARE_REFUSED")
                    try:
                        os.write(write_fd, json.dumps({"refusal": reason}).encode("ascii"))
                    except BrokenPipeError:
                        pass
                    raise

                def acknowledge():
                    payload = json.dumps(asdict(lease), separators=(",", ":")).encode("ascii")
                    try:
                        require(len(payload) <= 4096 and os.write(write_fd, payload) == len(payload),
                                "LAUNCH_WATCHDOG_ACK")
                    except BrokenPipeError:
                        pass  # Controller died during preparation; recover via pidfd.
                    finally:
                        os.close(write_fd)

                if watchdog_wait(scope, lease, controller, controller_fd, acknowledge=acknowledge,
                                 completion_fd=complete_read, validated=True):
                    status = 0
            finally:
                os._exit(status)
        os.close(write_fd)
        os.close(complete_read)
        try:
            ready, _, _ = select.select([read_fd], [], [], timeout)
            require(ready == [read_fd], "LAUNCH_WATCHDOG_ACK")
            payload = os.read(read_fd, 4097)
            require(0 < len(payload) <= 4096, "LAUNCH_WATCHDOG_ACK")
            record = json.loads(payload)
            if type(record) is dict and set(record) == {"refusal"}:
                require(record["refusal"] in ("LAUNCH_WATCHDOG_PREPARE_CUSTODY_HELD",
                                              "LAUNCH_WATCHDOG_PREPARE_REFUSED"), "LAUNCH_WATCHDOG_ACK")
                raise ValueError(record["refusal"])
            lease = decode_lease(scope, record)
        except BaseException:
            os.close(complete_write)
            raise
        finally:
            os.close(read_fd)
    finally:
        os.close(controller_fd)
    return ArmedWatchdog(child, lease, complete_write)


def finish_watchdog(watchdog, *, cleanup_verified):
    require(type(watchdog) is ArmedWatchdog and watchdog.completion_fd is not None,
            "LAUNCH_WATCHDOG_COMPLETION")
    try:
        if cleanup_verified:
            require(os.write(watchdog.completion_fd, b"C") == 1, "LAUNCH_WATCHDOG_COMPLETION")
    finally:
        os.close(watchdog.completion_fd)
    if cleanup_verified:
        end = time.monotonic() + 2
        while time.monotonic() < end:
            pid, status = os.waitpid(watchdog.pid, os.WNOHANG)
            if pid == watchdog.pid:
                require(status == 0, "LAUNCH_WATCHDOG_EXIT")
                return
            time.sleep(0.01)
        raise ValueError("LAUNCH_WATCHDOG_REAP_TIMEOUT")


def publish_fragment(scope, lease, watchdog):
    """No-replace link. The watchdog must already hold the unpublished inode."""
    validate_lease(scope, lease)
    require(type(watchdog) is ArmedWatchdog and watchdog.lease == lease and
            type(watchdog.pid) is int and watchdog.pid > 1 and
            os.waitpid(watchdog.pid, os.WNOHANG) == (0, 0), "LAUNCH_WATCHDOG_MISSING")
    source = scope.scratch / FRAGMENT
    target = Path(scope.run.fragment)
    require(has_identity(scope.scratch, lease.scratch), "LAUNCH_FRAGMENT_IDENTITY")
    require(observe_quiescence(scope, 2) is True, "LAUNCH_UNIT_ALREADY_PRESENT")
    verify_fragment(source, lease)
    os.link(source, target, follow_symlinks=False)
    verify_fragment(target, lease)


def verify_fragment(path, lease):
    fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW | os.O_CLOEXEC)
    with os.fdopen(fd, "rb") as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 1001 and not info.st_mode & 0o077 and
                identity(info) == lease.fragment and 0 < info.st_size <= 4096, "LAUNCH_FRAGMENT_IDENTITY")
        require(hashlib.sha256(stream.read(4097)).hexdigest() == lease.fragment_sha256,
                "LAUNCH_FRAGMENT_DIGEST")


def read_lease(scope):
    """The service consumes the exact metadata published before unit start."""
    path = scope.scratch / SCRATCH_MARKER
    fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW | os.O_CLOEXEC)
    with os.fdopen(fd, "rb") as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 1001 and not info.st_mode & 0o077 and
                0 < info.st_size <= 4096, "LAUNCH_CUSTODY_MARKER")
        value = json.loads(stream.read(4097))
    require(set(value) == {"source", "run", "attempt", "nonce", "scratch", "fragment",
                           "fragmentSha256", "root"}, "LAUNCH_CUSTODY_MARKER_FIELDS")
    lease = RecoveryLease(value["source"], value["run"], value["attempt"], value["nonce"],
                          tuple(value["scratch"]), tuple(value["fragment"]), identity(info),
                          tuple(value["root"]), value["fragmentSha256"])
    validate_lease(scope, lease)
    require(has_identity(scope.scratch, lease.scratch) and
            has_identity(scope.scratch / PRIVATE_ROOT, lease.root), "LAUNCH_CUSTODY_MARKER_PATHS")
    verify_fragment(scope.scratch / FRAGMENT, lease)
    verify_fragment(Path(scope.run.fragment), lease)
    if scope.custody is not None:
        with custody(scope, timeout=2) as journal:
            require(journal.read("admitted") == lease_record(lease) and
                    journal.read("retired") is None and journal.scratch_identity() == lease.scratch,
                    "LAUNCH_CUSTODY_ADMISSION")
    scope.owned.scratch = lease.scratch
    scope.owned.fragment = lease.fragment
    return lease


def manager_command(*arguments, timeout):
    return bounded_command(["/usr/bin/systemctl", "--user", "--no-ask-password", *arguments], timeout=timeout)


def start_owned_unit(scope, lease, watchdog, *, timeout):
    """Do not queue any start until the manager read-back and custody agree."""
    validate_lease(scope, lease)
    require(type(watchdog) is ArmedWatchdog and watchdog.lease == lease and
            os.waitpid(watchdog.pid, os.WNOHANG) == (0, 0), "LAUNCH_WATCHDOG_MISSING")
    fragment = Path(scope.run.fragment)
    verify_fragment(fragment, lease)
    expected = unit_properties(scope.run)
    deadline = time.monotonic() + timeout
    status, output, error = manager_command("show", "--property=" + ",".join(expected), scope.run.unit,
                                            timeout=min(2, timeout))
    lines = output.decode("ascii").splitlines()
    require(status == 0 and not error and len(lines) == len(expected) and
            set(lines) == {f"{key}={value}" for key, value in expected.items()}, "LAUNCH_UNIT_READBACK")
    remaining = deadline - time.monotonic()
    require(remaining > 0, "LAUNCH_START_EXPIRED")
    verify_fragment(fragment, lease)
    status, output, error = manager_command("--job-mode=fail", "--no-block", "start", scope.run.unit,
                                            timeout=remaining)
    require(status == 0 and not output and not error, "LAUNCH_UNIT_START")


def admit_owned_unit(scope, lease, watchdog):
    validate_lease(scope, lease)
    with custody(scope) as journal:
        journal.admit(lease.scratch, lease_record(lease))
        publish_fragment(scope, lease, watchdog)
        start_owned_unit(scope, lease, watchdog, timeout=3)


def attest_service_peer(scope, lease, pid, timeout):
    verify_fragment(Path(scope.run.fragment), lease)
    status, output, error = manager_command(
        "show", "--property=FragmentPath,DropInPaths,ControlGroup,InvocationID,MainPID,ActiveState",
        scope.run.unit, timeout=timeout)
    rows = [line.split("=", 1) for line in output.decode("ascii").splitlines()]
    values = dict(rows)
    invocation = values.pop("InvocationID", "")
    require(status == 0 and not error and len(rows) == 6 and
            re.fullmatch(r"(?!0{32}$)[a-f0-9]{32}", invocation) and
            values == {"FragmentPath": scope.run.fragment, "DropInPaths": "",
                       "ControlGroup": scope.run.cgroup, "MainPID": str(pid), "ActiveState": "active"},
            "LAUNCH_SERVICE_PEER")
    return invocation


def validate_canary_mount(target, expected_identity, *, readonly):
    row = [row for row in read_mounts("self") if row["path"] == str(target)]
    require(len(row) == 1 and row[0]["type"] == "cgroup2" and
            identity(target.stat()) == expected_identity and
            ("ro" if readonly else "rw") in row[0]["flags"], "LAUNCH_CANARY_MOUNT")


def mount_canary(source, target, expected_identity):
    """Trusted disposable probe namespace only. Remount flags are bind-local."""
    require(has_identity(source, expected_identity), "LAUNCH_CANARY_SOURCE")
    host_mount(source, target, flags=MS_BIND)
    host_mount(None, target, flags=MS_REMOUNT | MS_BIND | MS_RDONLY | MS_NODEV | MS_NOSUID | MS_NOEXEC)
    validate_canary_mount(target, expected_identity, readonly=True)


def cgroup_denials(target, expected_identity):
    """Native test helper, called after private mount setup and seccomp."""
    validate_canary_mount(target, expected_identity, readonly=True)
    libc = ctypes.CDLL(None, use_errno=True)
    libc.syscall.restype = ctypes.c_long

    def try_remount():
        flags = MS_REMOUNT | MS_BIND | MS_RDONLY | MS_NODEV | MS_NOSUID | MS_NOEXEC
        if libc.mount(None, os.fsencode(target), None, flags, None) != 0:
            code = ctypes.get_errno()
            raise OSError(code, os.strerror(code))

    denied(try_remount, {errno.EPERM}, "LAUNCH_CANARY_REMOUNT")
    fd = os.open(target, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        require(identity(os.fstat(fd)) == expected_identity, "LAUNCH_CANARY_TARGET")
        denied(lambda: clone_policy_attempt(libc, fd), {errno.EPERM}, "LAUNCH_CANARY_CLONE")
        denied(lambda: open_control(str(target / "cgroup.procs"), os.O_WRONLY),
               {errno.EROFS}, "LAUNCH_CANARY_MIGRATION_WRITE")
        for name in LIMIT_NAMES:
            denied(lambda: open_control(str(target / name), os.O_WRONLY),
                   {errno.EROFS}, "LAUNCH_CANARY_LIMIT_WRITE")
    finally:
        os.close(fd)
    return {"cgroupRemount": True, "cgroupMigration": True, "cgroupLimitMutation": True}


def manager_denials(scope):
    for endpoint in MANAGER_ENDPOINTS:
        denied(lambda: connect(endpoint), {errno.ENOENT}, "LAUNCH_MANAGER_PATH")
    denied(lambda: connect(scope.abstract_endpoint), {errno.ECONNREFUSED}, "LAUNCH_MANAGER_ABSTRACT")
    return {"sameUidManagerAccess": True}


def compare_with_positive_controls(scope, lease, worker_pid, canary_pid, canary_pidfd, private_probe):
    """Only the trusted service can exercise its own blocked child and leaves."""
    validate_lease(scope, lease)
    verify_limits(scope.run, worker_pid, "preflight-worker")
    verify_pidfd(canary_pid, canary_pidfd)
    source = Path("/sys/fs/cgroup") / scope.run.cgroup.lstrip("/") / "preflight-target"
    try:
        canary = exercise_cgroup_canary(scope.run, canary_pid)
        require(canary["targetLeaf"] == scope.run.cgroup + "/preflight-target", "LAUNCH_CANARY_SOURCE")
        target_identity = identity(source.stat())
    finally:
        reap_canary(canary_pid, canary_pidfd)
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as listener:
        listener.bind(scope.abstract_endpoint)
        listener.listen(1)
        manager = manager_positive_controls(scope, timeout=2)
        result = private_probe(scope, lease, namespace_ids(), source, target_identity)
    require(manager["managerAuthenticated"] is True and manager["abstractConnected"] is True and
            canary["cgroupV2MountAttested"] is True and canary["canaryMovedAndReadBack"] is True and
            canary["limitChangedAndReadBack"] is True and
            set(result) == {"sameUidManagerAccess", "cgroupRemount", "cgroupMigration", "cgroupLimitMutation"} and
            all(value is True for value in result.values()), "LAUNCH_COMBINED_DENIALS")
    return result


PROBE_SYSCALLS = (
    "brk", "clock_gettime", "close", "connect", "exit", "exit_group", "fcntl", "fstat",
    "getdents64", "getpid", "getrandom", "gettid", "lseek", "madvise", "mmap", "mprotect",
    "munmap", "newfstatat", "openat", "poll", "ppoll", "read", "readlink", "readlinkat",
    "rt_sigaction", "rt_sigprocmask", "rt_sigreturn", "sigaltstack", "statx", "write",
)


class SeccompComparison(ctypes.Structure):
    _fields_ = [("argument", ctypes.c_uint), ("comparison", ctypes.c_int),
                ("value", ctypes.c_uint64), ("mask", ctypes.c_uint64)]


def probe_filter(*, loader=False):
    """Prepare before chroot. The default blocks clone, remount and namespace escape."""
    require(os.uname().machine == "x86_64", "LAUNCH_PROBE_ARCH")
    lib = ctypes.CDLL("/usr/lib/x86_64-linux-gnu/libseccomp.so.2")
    lib.seccomp_init.argtypes = [ctypes.c_uint32]
    lib.seccomp_init.restype = ctypes.c_void_p
    lib.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
    lib.seccomp_rule_add_array.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int,
                                           ctypes.c_uint, ctypes.POINTER(SeccompComparison)]
    lib.seccomp_load.argtypes = [ctypes.c_void_p]
    lib.seccomp_release.argtypes = [ctypes.c_void_p]
    context = lib.seccomp_init(0x00050000 | errno.EPERM)
    require(context, "LAUNCH_SECCOMP_INIT")

    def allow(name, condition=None):
        number = lib.seccomp_syscall_resolve_name(name.encode("ascii"))
        require(number >= 0 and lib.seccomp_rule_add_array(
            context, 0x7fff0000, number, int(condition is not None),
            ctypes.byref(condition) if condition is not None else None) == 0, "LAUNCH_SECCOMP_RULE")

    try:
        for name in PROBE_SYSCALLS:
            allow(name)
        if loader:
            for name in ("arch_prctl", "execve", "futex", "getegid", "geteuid", "getgid", "getuid",
                         "pread64", "prlimit64", "rseq", "set_robust_list", "set_tid_address"):
                allow(name)
        else:
            allow("socket", SeccompComparison(0, 4, 1, 0))  # AF_UNIX only
            allow("ioctl", SeccompComparison(1, 4, 0x5421, 0))  # FIONBIO only
    except BaseException:
        lib.seccomp_release(context)
        raise
    return lib, context


def verify_worker_descriptors(extra=()):
    expected = {0, 1, 2, *extra}
    transient = next(fd for fd in range(len(expected) + 1) if fd not in expected)
    require(set(os.listdir("/proc/self/fd")) <= {str(fd) for fd in expected | {transient}},
            "LAUNCH_PROBE_FDS")
    denied(lambda: os.fstat(transient), {errno.EBADF}, "LAUNCH_PROBE_FD")
    require(all(stat.S_ISFIFO(os.fstat(fd).st_mode) for fd in extra), "LAUNCH_WORKER_BARRIER")
    stdin = os.fstat(0)
    null = Path("/dev/null").stat()
    require((stat.S_ISFIFO(stdin.st_mode) or (stat.S_ISCHR(stdin.st_mode) and
                                             stdin.st_rdev == null.st_rdev)) and
            all(stat.S_ISFIFO(os.fstat(fd).st_mode) for fd in (1, 2)), "LAUNCH_WORKER_STDIO")


def enter_sealed_root(root, *, loader=False, extra=()):
    verify_worker_descriptors(extra)
    lib, context = probe_filter(loader=loader)
    try:
        drop_caps_and_chroot(root)
        require(lib.seccomp_load(context) == 0, "LAUNCH_SECCOMP_LOAD")
    finally:
        lib.seccomp_release(context)


def wait_stage(barrier):
    verify_worker_descriptors(barrier)
    ready, permit = barrier
    require(os.write(ready, b"R") == 1 and os.read(permit, 1) == b"S", "LAUNCH_STAGE_PERMIT")


def wait_sealed(barrier, root_id):
    ready, permit = barrier
    try:
        require(os.write(ready, f"{root_id[0]}:{root_id[1]}\n".encode("ascii")) > 0, "LAUNCH_ROOT_READY")
        require(os.read(permit, 1) == b"G", "LAUNCH_ROOT_PERMIT")
    finally:
        os.close(ready)
        os.close(permit)


def run_denial_worker(scope, lease, host_namespaces, source, canary_identity, barrier):
    """Inside a dedicated new namespace, on a diagnostic root without ELF members."""
    validate_lease(scope, lease)
    observed = namespace_ids()
    require(set(observed) == set(host_namespaces) == set(NAMESPACES) and
            all(type(host_namespaces[name]) is int and observed[name] != host_namespaces[name]
                for name in NAMESPACES), "LAUNCH_PROBE_NAMESPACES")
    expected = Path("/sys/fs/cgroup") / scope.run.cgroup.lstrip("/") / "preflight-target"
    require(source == expected and has_identity(scope.scratch, lease.scratch),
            "LAUNCH_PROBE_SOURCE")
    root = scope.scratch / PRIVATE_ROOT
    require(has_identity(root, lease.root) and not any(root.iterdir()), "LAUNCH_PROBE_ROOT")
    wait_stage(barrier)
    host_mount(None, "/", flags=MS_REC | MS_PRIVATE)
    host_mount("sl-jammy-denials", root, "tmpfs", MS_NOSUID | MS_NODEV | MS_NOEXEC,
               "size=1048576,nr_inodes=32,mode=0700")
    info = os.statvfs(root)
    require(info.f_blocks * info.f_frsize == 1048576 and info.f_files == 32, "LAUNCH_PROBE_TMPFS")
    probe = root / "probe"
    probe.mkdir(mode=0o700)
    mount_canary(source, probe, canary_identity)
    proc = root / "proc"
    proc.mkdir(mode=0o700)
    host_mount("proc", proc, "proc", MS_RDONLY | MS_NODEV | MS_NOSUID | MS_NOEXEC)
    host_mount(None, root, flags=MS_REMOUNT | MS_RDONLY | MS_NODEV | MS_NOSUID | MS_NOEXEC)
    root_id = identity(root.stat())
    enter_sealed_root(root, extra=barrier)
    wait_sealed(barrier, root_id)
    return {**manager_denials(scope), **cgroup_denials(Path("/probe"), canary_identity)}


def exec_loader_worker(scope, lease, host_namespaces, receipt, members, ordinal, barrier):
    """Use a separate namespace and root for each fixed loader command."""
    validate_lease(scope, lease)
    require(type(ordinal) is int and ordinal in (0, 1) and scope.owned.scratch == lease.scratch,
            "LAUNCH_LOADER_ORDINAL_OR_CUSTODY")
    inputs = load_plan()
    verify_inventory(inputs, receipt)
    bound = bind_member_bytes(inputs, members)
    command = load_supervisor_plan()["launchCommands"][ordinal]
    wait_stage(barrier)
    root = stage_private_root(scope, bound, host_namespaces)
    root_id = identity(root.stat())
    enter_sealed_root(root, loader=True, extra=barrier)
    wait_sealed(barrier, root_id)
    os.execve(command[0], command, {"LANG": "C"})
