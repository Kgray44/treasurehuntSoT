"""Fixed Linux root layout for the C856 Homeport diagnostic producer."""
import hashlib
import os
import re
import shutil
import stat
import subprocess
from pathlib import Path

GIB = 1 << 30
MIB = 1 << 20
NATIVE_STAGE_CAP = 3*GIB
RESERVE = 2*GIB
FILE_LIMIT = 512*MIB
ENTRY_LIMIT = 120000
LIBRARY_DIRS = ("/lib/x86_64-linux-gnu", "/usr/lib/x86_64-linux-gnu", "/lib64")
LOADER = "/lib64/ld-linux-x86-64.so.2"
SYSTEM_LIBS = (
    "libnss3.so", "libnssutil3.so", "libsmime3.so", "libsoftokn3.so", "libfreebl3.so",
    "libgbm.so.1", "libdrm.so.2", "libasound.so.2", "libfontconfig.so.1",
)
PYTHON = "/usr/bin/python3"
PYTHON_LIBRARY = "/usr/lib/python3.12"


class LayoutError(ValueError):
    pass


def need(ok, code):
    if not ok:
        raise LayoutError(code)


def archive_relative(text):
    need(isinstance(text, str) and 0 < len(text) <= 240 and
         re.fullmatch(r"[A-Za-z0-9._@+/\[\]-]+", text), "NATIVE_PATH")
    parts = text.split("/")
    need(len(parts) <= 24 and all(part not in ("", ".", "..", ".git", ".npmrc") and
         not part.startswith(".env") for part in parts), "NATIVE_PATH")
    need(not text.lower().endswith((".key", ".p12", ".pfx", ".encrypted")) and
         not any(part in ("shadow", "gshadow", "ssh", ".ssh", "sudoers", ".netrc") for part in parts),
         "PRIVATE_NATIVE_INPUT")
    return text


def loader_rows(text):
    paths = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("linux-vdso.so.1 "):
            continue
        row = re.fullmatch(r"(?:[A-Za-z0-9_.+-]+ => )?(/[^ ]+) \(0x[0-9a-f]+\)", line)
        need(row, "NATIVE_DEPENDENCY_LINE")
        item = Path(row.group(1))
        # Pure slash handling keeps fixture checks identical on Windows.
        directory, _, name = row.group(1).rpartition("/")
        need(directory in LIBRARY_DIRS and re.fullmatch(r"[A-Za-z0-9_.+-]+", name)
             and ".." not in item.parts, "NATIVE_LIBRARY_PATH")
        paths.append(row.group(1))
    return tuple(dict.fromkeys(paths))


def publisher_projection(free, stage, carrier):
    need(all(type(n) is int and n >= 0 for n in (free, stage, carrier)), "NATIVE_STORAGE_INTEGER")
    need(0 < stage <= NATIVE_STAGE_CAP and 0 < carrier <= NATIVE_STAGE_CAP+128*MIB, "NATIVE_OUTPUT_BOUND")
    remaining = free - stage - carrier
    need(remaining >= RESERVE, "NATIVE_PRODUCER_FREE_SPACE")
    return {"availableBeforeBytes": free, "additionalBytes": stage+carrier, "projectedFreeAfterBytes": remaining,
            "reserveBytes": RESERVE}


def filesystem_free(root):
    info = os.statvfs(root)
    need(0 < info.f_frsize <= 4096, "NATIVE_FILESYSTEM_BLOCK_SIZE")
    return info.f_bavail*info.f_frsize


def file_identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mode, info.st_uid,
            info.st_gid, info.st_nlink, info.st_mtime_ns, info.st_ctime_ns)


def system_file(path):
    requested = Path(path)
    actual = requested.resolve(strict=True)
    need(actual.is_file() and (actual.is_relative_to("/usr/lib") or actual.is_relative_to("/usr/bin") or
                              actual.is_relative_to("/usr/share/fonts")), "NATIVE_SYSTEM_FILE")
    need(os.statvfs("/usr").f_flag & os.ST_RDONLY, "NATIVE_SYSTEM_MOUNT_WRITABLE")
    # The private namespace does not map host UID 0. The host publisher
    # verifies actual root ownership and exact member bytes before upload.
    overflow = int(Path("/proc/sys/kernel/overflowuid").read_text(encoding="ascii"))
    for member in (actual, *actual.parents):
        if member == Path("/"):
            break
        info = member.lstat()
        need(info.st_uid == overflow and not info.st_mode & 0o022, "NATIVE_SYSTEM_FILE_PROJECTION")
    return actual


class Stage:
    def __init__(self, root):
        self.root = root
        root.mkdir(mode=0o700, exist_ok=False)
        self.total = 0
        self.entries = set()
        self.system_sources = {}
        self.elf = {role: set() for role in ("", "children/app", "children/browser")}

    def target(self, name, size):
        archive_relative(name)
        need(name not in self.entries and len(self.entries) < ENTRY_LIMIT and 0 <= size <= FILE_LIMIT,
             "NATIVE_STAGE_ENTRY")
        need(self.total+size <= NATIVE_STAGE_CAP and filesystem_free(self.root) >= RESERVE+size+4096,
             "NATIVE_STAGE_FREE_SPACE")
        self.entries.add(name)
        self.total += size
        file = self.root.joinpath(*name.split("/"))
        file.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        return file

    def bytes(self, name, data, executable=False):
        file = self.target(name, len(data))
        with file.open("xb") as stream:
            stream.write(data)
        file.chmod(0o755 if executable else 0o644)
        return file

    def copy(self, source, name, system=False, provider=False):
        if system:
            source = system_file(source)
            self.system_sources[name] = str(source)
        else:
            need(source.resolve(strict=True) == source, "NATIVE_SOURCE_ALIAS")
        fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(fd, "rb") as stream:
            old = os.fstat(stream.fileno())
            need(stat.S_ISREG(old.st_mode) and not old.st_mode & 0o7000 and
                 (system or (old.st_uid in ((0, os.getuid()) if provider else (os.getuid(),)) and old.st_nlink == 1)) and
                 "security.capability" not in os.listxattr(stream.fileno()), "NATIVE_SOURCE_FILE")
            file = self.target(name, old.st_size)
            signature = stream.read(20)
            stream.seek(0)
            count = 0
            with file.open("xb") as out:
                while block := stream.read(min(1*MIB, old.st_size-count+1)):
                    count += len(block)
                    need(count <= old.st_size, "NATIVE_SOURCE_SIZE_CHANGED")
                    out.write(block)
            need(count == old.st_size and file_identity(old) == file_identity(os.fstat(stream.fileno())) ==
                 file_identity(source.lstat()), "NATIVE_SOURCE_CHANGED")
        file.chmod(0o755 if old.st_mode & 0o111 else 0o644)
        if signature.startswith(b"\x7fELF") and not system:
            need(signature[:7] == b"\x7fELF\x02\x01\x01" and signature[18:20] == b"\x3e\x00", "NATIVE_ELF_ARCH")
            role = "/".join(name.split("/")[:2]) if name.startswith("children/") else ""
            self.elf[role].add(file)
        return file

    def tree(self, source, name, *, skip=(), system=False):
        need(source.is_dir() and source.resolve(strict=True) == source, "NATIVE_INPUT_TREE")
        for parent, folders, files in os.walk(source, followlinks=False):
            base = Path(parent)
            for child in list(folders):
                branch = base/child
                relative = branch.relative_to(source).as_posix()
                if relative in skip or child == "__pycache__":
                    folders.remove(child)
                    continue
                need(not branch.is_symlink(), "NATIVE_DIRECTORY_SYMLINK")
            for child in files:
                item = base/child
                rel = item.relative_to(source).as_posix()
                if rel in skip or child.endswith((".pyc", ".pyo")):
                    continue
                self.copy(item, f"{name}/{rel}", system=system)

    def runtime(self, role, node=None):
        prefix = role+"/" if role else ""
        self.copy(Path(PYTHON), prefix+"usr/bin/python3", system=True)
        self.tree(Path(PYTHON_LIBRARY), prefix+"usr/lib/python3.12", skip=(
            "dist-packages", "site-packages", "test", "tests", "ensurepip", "idlelib", "tkinter"
        ), system=True)
        self.elf[role].add(self.root/(prefix+"usr/bin/python3"))
        for lib in (self.root/(prefix+"usr/lib/python3.12/lib-dynload")).glob("*.so"):
            self.elf[role].add(lib)
        if node is not None:
            self.copy(node, prefix+"usr/bin/node", provider=True)
            self.elf[role].add(self.root/(prefix+"usr/bin/node"))
        self.bytes(prefix+"etc/hosts", b"127.0.0.1 localhost\n::1 localhost\n")
        self.bytes(prefix+"etc/nsswitch.conf", b"hosts: files\n")

    def dependencies(self, role, extra=()):
        prefix = role+"/" if role else ""
        loader = system_file(LOADER)
        self.copy(Path(LOADER), prefix+LOADER.lstrip("/"), system=True)
        linked = {LOADER}
        examined = set()
        inputs = list(sorted(self.elf[role])) + [Path(item) for item in extra]
        need(len(inputs) <= 2048, "NATIVE_ELF_COUNT")
        for file in inputs:
            with file.open("rb") as stream:
                identity = hashlib.file_digest(stream, "sha256").hexdigest()
            if identity in examined:
                continue
            examined.add(identity)
            # Reviewed image and locked-package ELFs only, no executable main().
            result = subprocess.run([str(loader), "--list", str(file)], capture_output=True, check=False,
                                    env={"PATH": "/usr/bin:/bin", "LANG": "C"}, timeout=8)
            need(len(result.stdout) <= 32768 and len(result.stderr) <= 8192, "NATIVE_ABI_OUTPUT")
            if result.returncode != 0:
                readelf = subprocess.run(["/usr/bin/readelf", "-d", str(file)], capture_output=True,
                                         check=False, env={"PATH": "/usr/bin:/bin", "LANG": "C"}, timeout=8)
                need(readelf.returncode == 0 and len(readelf.stdout) <= 32768 and
                     b"There is no dynamic section in this file." in readelf.stdout, "NATIVE_ABI_REFUSED")
                continue
            for item in loader_rows(result.stdout.decode("ascii")):
                linked.add(item)
        linked.update(str(Path(item)) for item in extra)
        for lib in sorted(linked-{LOADER}):
            self.copy(Path(lib), prefix+lib.lstrip("/"), system=True)
        return len(linked)


def system_browser_libraries():
    text = subprocess.check_output(["/usr/sbin/ldconfig", "-p"], timeout=8,
                                   env={"PATH": "/usr/bin:/bin", "LANG": "C"}).decode("ascii")
    need(len(text) <= 1*MIB, "SYSTEM_LIBRARY_INDEX_BOUND")
    resolved = []
    for name in SYSTEM_LIBS:
        paths = {row.strip().split(" => ", 1)[1] for row in text.splitlines()
                 if row.strip().startswith(name+" (libc6,x86-64) => ")}
        need(len(paths) == 1, "SYSTEM_BROWSER_DEPENDENCY")
        file = paths.pop()
        loader_rows(f"{name} => {file} (0x1)")
        resolved.append(file)
    return resolved
