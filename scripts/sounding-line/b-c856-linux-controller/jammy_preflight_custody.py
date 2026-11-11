"""Scratch state for an independently provisioned private runtime directory."""
import json
import os
import re
import stat
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

from jammy_native_runtime_inputs import require

LOCK = "ownership.lock"
PHASES = ("reserved", "bound", "admitted", "retired")
MAX_RECORD = 4096


@dataclass(frozen=True)
class CustodyBinding:
    base: tuple[int, int]
    lock: tuple[int, int]

    @classmethod
    def from_values(cls, values):
        require(len(values) == 4 and all(type(item) is int and 0 < item < 2**64 for item in values),
                "LAUNCH_CUSTODY_BINDING")
        return cls(tuple(values[:2]), tuple(values[2:]))

    def arguments(self):
        return tuple(str(value) for value in (*self.base, *self.lock))


def identity(info):
    return info.st_dev, info.st_ino


def base_path(run_id, nonce):
    return Path(f"/run/user/1001/sl-native-custody-{run_id}-{nonce}")


def boot_id():
    with Path("/proc/sys/kernel/random/boot_id").open("r", encoding="ascii") as stream:
        value = stream.read(64).strip()
    require(re.fullmatch(r"[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}", value),
            "LAUNCH_CUSTODY_BOOT")
    return value


def process_identity(pid):
    require(type(pid) is int and 1 < pid < 2**31, "LAUNCH_CUSTODY_PID")
    try:
        with (Path("/proc") / str(pid) / "stat").open("r", encoding="ascii") as stream:
            data = stream.read(8193)
    except FileNotFoundError:
        return None
    fields = data.rsplit(")", 1)[-1].split()
    require(len(data) <= 8192 and data.startswith(f"{pid} (") and
            len(fields) >= 20 and fields[19].isdigit(), "LAUNCH_CUSTODY_PROC_STAT")
    return fields[0], int(fields[19])


def owner_record(controller, watchdog):
    require(controller != watchdog, "LAUNCH_CUSTODY_PID")
    actors = []
    for pid in (controller, watchdog):
        info = process_identity(pid)
        require(info is not None and info[0] not in ("Z", "X", "x"), "LAUNCH_CUSTODY_PID")
        actors.append([pid, info[1]])
    return {"boot": boot_id(), "owners": actors}


def verify_owners_gone(record):
    require(type(record) is dict and set(record) == {"boot", "owners"} and record["boot"] == boot_id() and
            type(record["owners"]) is list and len(record["owners"]) == 2 and
            all(type(row) is list and len(row) == 2 and all(type(item) is int and item > 0 for item in row)
                for row in record["owners"]) and record["owners"][0][0] != record["owners"][1][0],
            "LAUNCH_CUSTODY_OWNER_RECORD")
    for pid, start in record["owners"]:
        current = process_identity(pid)
        require(current is None or current[1] != start or current[0] in ("Z", "X", "x"),
                "LAUNCH_CUSTODY_ORIGINAL_PROCESSES_LIVE")


@contextmanager
def custody(scope, timeout=0):
    import fcntl

    binding = scope.custody
    require(type(binding) is CustodyBinding, "LAUNCH_CUSTODY_BINDING")
    CustodyBinding.from_values((*binding.base, *binding.lock))
    base = scope.scratch.parent
    require(base == base_path(scope.run.run_id, scope.nonce) and base.resolve(strict=True) == base,
            "LAUNCH_CUSTODY_BASE")
    base_fd = os.open(base, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW)
    try:
        opened = os.fstat(base_fd)
        require(identity(opened) == binding.base and opened.st_uid == os.geteuid() == 1001 and
                not opened.st_mode & 0o077, "LAUNCH_CUSTODY_BASE")
        fd = os.open(LOCK, os.O_RDWR | os.O_CLOEXEC | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=base_fd)
        try:
            lock = os.fstat(fd)
            require(stat.S_ISREG(lock.st_mode) and identity(lock) == binding.lock and lock.st_uid == 1001 and
                    lock.st_nlink == 1 and not lock.st_mode & 0o077 and lock.st_size == 0,
                    "LAUNCH_CUSTODY_LOCK")
            deadline = time.monotonic() + timeout
            while True:
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    remaining = deadline - time.monotonic()
                    require(remaining > 0, "LAUNCH_CUSTODY_LOCK_BUSY")
                    time.sleep(min(0.02, remaining))
            require(identity(os.stat(LOCK, dir_fd=base_fd, follow_symlinks=False)) == binding.lock,
                    "LAUNCH_CUSTODY_LOCK")
            yield Journal(scope, base_fd)
        finally:
            os.close(fd)
    finally:
        os.close(base_fd)


class Journal:
    def __init__(self, scope, base_fd):
        self.scope = scope
        self.fd = base_fd
        self.binding = {"source": scope.run.source, "run": scope.run.run_id, "attempt": scope.run.attempt,
                        "nonce": scope.nonce, "base": list(scope.custody.base), "lock": list(scope.custody.lock)}

    def read(self, phase):
        require(phase in PHASES, "LAUNCH_CUSTODY_PHASE")
        try:
            fd = os.open(phase, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK, dir_fd=self.fd)
        except FileNotFoundError:
            return None
        with os.fdopen(fd, "rb") as stream:
            info = os.fstat(stream.fileno())
            require(stat.S_ISREG(info.st_mode) and info.st_uid == 1001 and info.st_nlink in (1, 2) and
                    not info.st_mode & 0o077 and 0 < info.st_size <= MAX_RECORD, "LAUNCH_CUSTODY_RECORD")
            if info.st_nlink == 2:
                pending = os.stat(phase + ".pending", dir_fd=self.fd, follow_symlinks=False)
                require(identity(pending) == identity(info), "LAUNCH_CUSTODY_RECORD_LINK")
            data = stream.read(MAX_RECORD + 1)
        require(len(data) == info.st_size, "LAUNCH_CUSTODY_RECORD")
        result = json.loads(data)
        require(type(result) is dict and set(result) == {"scope", "phase", "value"} and
                result["scope"] == self.binding and result["phase"] == phase and type(result["value"]) is dict,
                "LAUNCH_CUSTODY_RECORD")
        return result["value"]

    def write(self, phase, value):
        require(phase in PHASES, "LAUNCH_CUSTODY_PHASE")
        data = json.dumps({"scope": self.binding, "phase": phase, "value": value},
                          sort_keys=True, separators=(",", ":")).encode("ascii")
        require(len(data) <= MAX_RECORD, "LAUNCH_CUSTODY_RECORD")
        # The final name is added without replacement. If termination lands
        # between link and unlink, both names must identify the same inode.
        require(self.read(phase) is None, "LAUNCH_CUSTODY_PHASE_EXISTS")
        pending = phase + ".pending"
        fd = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC,
                     0o600, dir_fd=self.fd)
        try:
            require(os.write(fd, data) == len(data), "LAUNCH_CUSTODY_SHORT_WRITE")
            os.fsync(fd)
            os.link(pending, phase, src_dir_fd=self.fd, dst_dir_fd=self.fd, follow_symlinks=False)
            os.fsync(self.fd)
            require(identity(os.stat(pending, dir_fd=self.fd, follow_symlinks=False)) == identity(os.fstat(fd)),
                    "LAUNCH_CUSTODY_RECORD_LINK")
            os.unlink(pending, dir_fd=self.fd)
            os.fsync(self.fd)
        finally:
            os.close(fd)

    def scratch_identity(self):
        name = self.scope.scratch.name
        try:
            info = os.stat(name, dir_fd=self.fd, follow_symlinks=False)
        except FileNotFoundError:
            return None
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 1001 and not info.st_mode & 0o077 and
                info.st_dev == self.scope.custody.base[0], "LAUNCH_CUSTODY_SCRATCH")
        return identity(info)

    def reserve(self, owners):
        require(all(self.read(phase) is None for phase in PHASES) and self.scratch_identity() is None,
                "LAUNCH_CUSTODY_ALREADY_RESERVED")
        self.write("reserved", owners)

    def bind(self, scratch):
        require(self.read("reserved") is not None and self.read("bound") is None and
                self.read("admitted") is None and self.read("retired") is None and
                self.scratch_identity() == scratch, "LAUNCH_CUSTODY_BIND_PHASE")
        self.write("bound", {"scratch": list(scratch)})

    def admit(self, scratch, lease):
        require(self.read("reserved") is not None and self.read("bound") == {"scratch": list(scratch)} and
                self.read("admitted") is None and self.read("retired") is None and
                self.scratch_identity() == scratch, "LAUNCH_CUSTODY_ADMIT_PHASE")
        self.write("admitted", lease)

    def recover_empty(self):
        require(self.read("reserved") is not None and self.read("admitted") is None and
                self.read("retired") is None, "LAUNCH_CUSTODY_RECOVERY_PHASE")
        bound = self.read("bound")
        scratch = self.scratch_identity()
        if bound is not None:
            require(set(bound) == {"scratch"} and type(bound["scratch"]) is list and
                    len(bound["scratch"]) == 2 and all(type(item) is int and item > 0 for item in bound["scratch"]) and
                    (scratch is None or list(scratch) == bound["scratch"]), "LAUNCH_CUSTODY_SCRATCH_REPLACED")
        if scratch is not None:
            name = self.scope.scratch.name
            fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=self.fd)
            try:
                require(identity(os.fstat(fd)) == scratch and not os.listdir(fd) and
                        self.scratch_identity() == scratch, "LAUNCH_CUSTODY_SCRATCH_AMBIGUOUS")
                os.rmdir(name, dir_fd=self.fd)
                os.fsync(self.fd)
            finally:
                os.close(fd)
        self.write("retired", {"admitted": False})
