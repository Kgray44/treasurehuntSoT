"""Fixed, unprivileged storage boundary for the C856 producer."""
import ctypes
import json
import os
import re
import stat
from pathlib import Path

GIB = 1 << 30
MIB = 1 << 20
TMPFS_CAP = 6*GIB
INODE_CAP = 200000
HOST_RESERVE = 2*GIB
CAPSULE_EXPORT_CAP = 2*GIB
EVIDENCE_EXPORT_CAP = 16*MIB
HOST_MARGIN = 48*MIB
OWNERSHIP = ".c856-owner.json"
MS_RDONLY, MS_NOSUID, MS_NODEV, MS_NOEXEC, MS_REMOUNT, MS_BIND = 1, 2, 4, 8, 32, 4096


class BoundaryError(ValueError):
    pass


def need(ok, code):
    if not ok:
        raise BoundaryError(code)


def admitted_host_space(free):
    minimum = HOST_RESERVE + CAPSULE_EXPORT_CAP + EVIDENCE_EXPORT_CAP + HOST_MARGIN
    need(type(free) is int and free >= minimum, "PRODUCER_HOST_RESERVE")
    return minimum


def available(root):
    disk = os.statvfs(root)
    need(0 < disk.f_frsize <= 4096, "PRODUCER_HOST_BLOCK_SIZE")
    return disk.f_bavail*disk.f_frsize


def directory_identity(path):
    item = path.lstat()
    need(stat.S_ISDIR(item.st_mode) and not path.is_symlink() and path.resolve(strict=True) == path,
         "PRODUCER_OWNED_DIRECTORY")
    return item.st_dev, item.st_ino, item.st_uid


def marker(path, contents):
    with (path/OWNERSHIP).open("xb") as output:
        output.write(json.dumps(contents, sort_keys=True, separators=(",", ":")).encode("ascii")+b"\n")
        output.flush()
        os.fsync(output.fileno())


def create_owned_scratch(path, run, marker_writer=marker):
    need(isinstance(run, str) and re.fullmatch(r"[1-9][0-9]{0,15}", run), "PRODUCER_RUN_ID")
    path.mkdir(mode=0o700, exist_ok=False)
    identity = directory_identity(path)
    try:
        marker_writer(path, {"run": run, "attempt": 1, "directory": list(identity)})
        need(verify_owned_scratch(path, run), "PRODUCER_OWNERSHIP_MARKER")
    except BaseException:
        # This process just created the exact inode. Roll back a failed first
        # marker write before any checkout, download, or mount is possible.
        if directory_identity(path) == identity:
            record = path/OWNERSHIP
            if os.path.lexists(record) and not record.is_symlink() and record.is_file():
                record.unlink()
            path.rmdir()
        raise


def verify_owned_scratch(path, run):
    try:
        identity = directory_identity(path)
        record = path/OWNERSHIP
        info = record.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != identity[2]:
            return False
        with record.open("rb") as stream:
            value = stream.read(1025)
        return len(value) <= 1024 and json.loads(value) == {
            "run": run, "attempt": 1, "directory": list(identity),
        }
    except (OSError, ValueError):
        return False


def host_mount(source, target, filesystem=None, flags=0, options=None):
    libc = ctypes.CDLL(None, use_errno=True)
    mount = libc.mount
    mount.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_ulong, ctypes.c_char_p]
    src = os.fsencode(source) if source is not None else None
    typ = os.fsencode(filesystem) if filesystem is not None else None
    data = os.fsencode(options) if options is not None else None
    need(mount(src, os.fsencode(target), typ, flags, data) == 0,
         "PRODUCER_NAMESPACE_MOUNT_REFUSED")


def bind_readonly(source, target, *, device=False):
    host_mount(source, target, flags=MS_BIND)
    flags = MS_BIND | MS_REMOUNT | MS_RDONLY | MS_NOSUID
    if not device:
        flags |= MS_NODEV
    host_mount(None, target, flags=flags)


def setup_namespace_root(root):
    # Only a private, anonymous, noswap mount is used. All app-writable files
    # share this superblock and its kernel block and inode limits.
    need(root.is_dir() and not any(root.iterdir()), "PRODUCER_EMPTY_MOUNTPOINT")
    host_mount("c856-producer", root, "tmpfs", MS_NODEV | MS_NOSUID,
               f"size={TMPFS_CAP},nr_inodes={INODE_CAP},noswap,mode=0700")
    limits = os.statvfs(root)
    need(limits.f_blocks*limits.f_frsize == TMPFS_CAP and limits.f_files == INODE_CAP,
         "PRODUCER_TMPFS_HARD_LIMIT")
    for name in ("usr", "etc", "etc/ssl", "etc/ssl/certs", "dev", "proc", "workspace",
                 "tmp", "tools", "bootstrap", "home"):
        (root/name).mkdir(mode=0o700)
    for name in ("bin", "lib", "lib64", "sbin"):
        (root/name).symlink_to("usr/"+name)
    bind_readonly("/usr", root/"usr")
    bind_readonly("/etc/ssl/certs", root/"etc/ssl/certs")
    for name in ("resolv.conf", "hosts", "nsswitch.conf", "ld.so.cache"):
        source = Path("/etc", name).resolve(strict=True)
        need(source.is_file(), "PRODUCER_PUBLIC_SYSTEM_CONFIG")
        destination = root/"etc"/name
        destination.touch(exist_ok=False)
        bind_readonly(source, destination)
    for name in ("null", "zero", "urandom"):
        destination = root/"dev"/name
        destination.touch(exist_ok=False)
        bind_readonly("/dev/"+name, destination, device=True)
    host_mount("proc", root/"proc", "proc", MS_RDONLY | MS_NOSUID | MS_NODEV | MS_NOEXEC)
    os.chmod(root/"tmp", 0o700)


def prctl(option, value):
    libc = ctypes.CDLL(None, use_errno=True)
    need(libc.prctl(option, value, 0, 0, 0) == 0, "PRODUCER_PRCTL_REFUSED")


def drop_caps_and_chroot(root):
    os.chroot(root)
    os.chdir("/")
    prctl(47, 4)  # PR_CAP_AMBIENT_CLEAR_ALL
    class Header(ctypes.Structure):
        _fields_ = [("version", ctypes.c_uint32), ("pid", ctypes.c_int)]
    class Cap(ctypes.Structure):
        _fields_ = [(key, ctypes.c_uint32) for key in ("effective", "permitted", "inheritable")]
    libc = ctypes.CDLL(None, use_errno=True)
    need(libc.capset(ctypes.byref(Header(0x20080522, 0)), (Cap*2)()) == 0, "PRODUCER_CAPABILITY_DROP")
    prctl(38, 1)  # PR_SET_NO_NEW_PRIVS
