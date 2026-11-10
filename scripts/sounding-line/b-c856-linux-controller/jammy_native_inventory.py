"""Inventory authenticated ELF bytes. This module has no native launch path."""
import hashlib
import io
import json
import lzma
import os
import re
import shutil
import signal
import stat
import struct
import sys
import tarfile
import tempfile
import types
import urllib.request
import zipfile
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path, PurePosixPath

MIB = 1 << 20
ARCHIVE = "https://archive.ubuntu.com/ubuntu/"
LIBDIR = "usr/lib/x86_64-linux-gnu"
LOADER = "ld-linux-x86-64.so.2"
INTERPRETER = "/lib64/" + LOADER
INDEX = "main/binary-amd64/Packages.xz"
VERIFIER_SHA256 = "84be75e7a0f97e63a5953c3491142d4cbbd6531f5ef71350478ef5795753bb13"
DENIALS = ("sameUidManagerAccess", "cgroupRemount", "cgroupMigration", "cgroupLimitMutation")


def require(condition, code):
    if not condition:
        raise ValueError(code)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def tar_members(raw, targets):
    require(0 < len(raw) <= 8*MIB, "INVENTORY_TAR_SIZE")
    files = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:") as archive:
        for index, member in enumerate(archive):
            require(index < 4096, "INVENTORY_TAR_COUNT")
            name = member.name.removeprefix("./")
            require(not name.startswith("/") and ".." not in PurePosixPath(name).parts and
                    name not in files, "INVENTORY_TAR_PATH")
            files[name] = member
        output = {}
        for target in targets:
            name = f"{LIBDIR}/{target}"
            member = files.get(name)
            require(member is not None, "INVENTORY_MEMBER_MISSING")
            if member.issym():
                require(member.uid == member.gid == 0 and not member.pax_headers and
                        re.fullmatch(re.escape(target)+r"(?:\.[0-9]+){1,4}", member.linkname),
                        "INVENTORY_MEMBER_LINK")
                name = f"{LIBDIR}/{member.linkname}"
                member = files.get(name)
            require(member is not None and member.type in (tarfile.REGTYPE, tarfile.AREGTYPE) and
                    not member.pax_headers and member.sparse is None and member.uid == member.gid == 0 and
                    not member.mode & 0o7022 and 0 < member.size <= 4*MIB, "INVENTORY_MEMBER_TYPE")
            with archive.extractfile(member) as stream:
                body = stream.read(member.size+1)
            require(len(body) == member.size, "INVENTORY_MEMBER_LENGTH")
            output[target] = (name, body)
    return output


def elf_inventory(raw):
    require(len(raw) >= 64 and raw[:7] == b"\x7fELF\x02\x01\x01", "INVENTORY_ELF_CLASS")
    header = struct.unpack_from("<16sHHIQQQIHHHHHH", raw)
    require(header[1] in (2, 3) and header[2] == 62 and header[9] == 56 and header[11] == 64 and
            0 < header[10] <= 64 and 0 < header[12] <= 128, "INVENTORY_ELF_HEADER")

    def read(fmt, position, end):
        require(0 <= position <= end <= len(raw) and position + struct.calcsize(fmt) <= end,
                "INVENTORY_ELF_BOUNDS")
        return struct.unpack_from(fmt, raw, position)

    def string(section, offset):
        require(section[1] == 3 and 0 <= offset < section[5], "INVENTORY_ELF_STRING_TABLE")
        start = section[4]+offset
        end = raw.find(b"\0", start, min(section[4]+section[5], start+256))
        require(start < end, "INVENTORY_ELF_STRING")
        return raw[start:end].decode("ascii")

    interpreters = []
    for index in range(header[10]):
        segment = read("<IIQQQQQQ", header[5]+56*index, len(raw))
        if segment[0] == 3:
            require(segment[5] == len(INTERPRETER)+1 and
                    segment[2]+segment[5] <= len(raw), "INVENTORY_ELF_INTERPRETER")
            interpreters.append(raw[segment[2]:segment[2]+segment[5]])
    require(interpreters in ([], [INTERPRETER.encode()+b"\0"]), "INVENTORY_ELF_INTERPRETER")
    sections = [read("<IIQQQQIIQQ", header[6]+64*i, len(raw)) for i in range(header[12])]
    dynamic = [section for section in sections if section[1] == 6]
    require(len(dynamic) == 1, "INVENTORY_ELF_DYNAMIC")
    table = dynamic[0]
    require(table[6] < len(sections) and 0 < table[5] <= 4096 and table[5] % 16 == 0,
            "INVENTORY_ELF_DYNAMIC")
    needed, sonames, terminated = [], [], False
    for position in range(table[4], table[4]+table[5], 16):
        tag, value = read("<qQ", position, table[4]+table[5])
        if tag == 0:
            terminated = True
            break
        require(tag not in (15, 29, 0x6ffffefa, 0x6ffffefb, 0x6ffffefc, 0x7ffffffd, 0x7fffffff),
                "INVENTORY_ELF_SEARCH_OVERRIDE")
        if tag in (1, 14):
            (needed if tag == 1 else sonames).append(string(sections[table[6]], value))
    require(terminated and len(needed) == len(set(needed)) <= 16 and len(sonames) <= 1,
            "INVENTORY_ELF_DYNAMIC")
    versions, definitions = {}, set()
    for table in (section for section in sections if section[1] in (0x6ffffffe, 0x6ffffffd)):
        end = table[4]+table[5]
        require(table[6] < len(sections) and 0 < table[7] <= 256, "INVENTORY_ELF_VERSIONS")
        strings, offset = sections[table[6]], table[4]
        for index in range(table[7]):
            if table[1] == 0x6ffffffe:
                version, count, library, aux, link = read("<HHIII", offset, end)
                name = string(strings, library)
                require(name in needed and name not in versions and 0 < count <= 256 and aux >= 16,
                        "INVENTORY_ELF_VERSION_NEED")
                names, at = [], offset+aux
                for item in range(count):
                    _, _, _, label, following = read("<IHHII", at, end)
                    names.append(string(strings, label))
                    require(following >= 16 if item+1 < count else following == 0, "INVENTORY_ELF_VERSION_CHAIN")
                    at += following
                versions[name] = names
            else:
                version, _, _, count, _, aux, link = read("<HHHHIII", offset, end)
                require(count > 0 and aux >= 20, "INVENTORY_ELF_VERSION_DEF")
                label, _ = read("<II", offset+aux, end)
                definitions.add(string(strings, label))
            require(version == 1 and (link >= 16 if index+1 < table[7] else link == 0),
                    "INVENTORY_ELF_VERSION_CHAIN")
            offset += link
    return {"needed": needed, "soname": next(iter(sonames), None),
            "interpreter": INTERPRETER if interpreters else None,
            "versionNeeds": versions, "versionDefinitions": sorted(definitions)}


def exact_closure(files):
    reports = {name: {"member": member, "sha256": sha256(raw), "bytes": len(raw), **elf_inventory(raw)}
               for name, (member, raw) in files.items()}
    require(reports["bwrap"]["interpreter"] == INTERPRETER and LOADER in reports,
            "INVENTORY_REQUIRED_INTERPRETER")
    for name, report in reports.items():
        require(report["soname"] == (None if name == "bwrap" else name),
                "INVENTORY_ELF_SONAME")
        require(set(report["needed"]) <= reports.keys()-{"bwrap"}, "INVENTORY_ELF_DEPENDENCY")
        for dependency, needed in report["versionNeeds"].items():
            require(set(needed) <= set(reports[dependency]["versionDefinitions"]), "INVENTORY_ELF_ABI")
    return reports


def noble_rows(release, index, plan, now):
    pins = plan["noble"]
    require([release.get(key) for key in ("Origin", "Label", "Suite", "Codename", "Version")] ==
            ["Ubuntu", "Ubuntu", pins["pocket"], "noble", "24.04"] and
            "amd64" in release.get("Architectures", "").split() and "main" in release.get("Components", "").split(),
            "INVENTORY_RELEASE_SCOPE")
    date = parsedate_to_datetime(release["Date"])
    require(date.tzinfo is not None and timedelta(0) <= now-date <= timedelta(hours=48) and
            ("Valid-Until" not in release or now <= parsedate_to_datetime(release["Valid-Until"])),
            "INVENTORY_RELEASE_FRESHNESS")
    pointers = [line.split() for line in release["SHA256"].splitlines() if line.split()[-1:] == [INDEX]]
    require(pointers == [[pins["indexSha256"], str(pins["indexBytes"]), INDEX]] and
            len(index) == pins["indexBytes"] and sha256(index) == pins["indexSha256"], "INVENTORY_INDEX_PIN")
    decoder = lzma.LZMADecompressor(format=lzma.FORMAT_XZ, memlimit=64*MIB)
    decoded = decoder.decompress(index, max_length=24*MIB+1)
    require(decoder.eof and not decoder.unused_data and len(decoded) <= 24*MIB, "INVENTORY_INDEX_SIZE")
    found = set()
    for stanza in decoded.decode("utf-8").split("\n\n"):
        fields = [line.split(": ", 1) for line in stanza.splitlines() if re.match(r"^[A-Za-z0-9-]+: ", line)]
        row = dict(fields)
        name = row.get("Package")
        if name in plan["packages"] and row.get("Architecture") == "amd64":
            version, filename, size, digest, _ = plan["packages"][name]
            require(len(row) == len(fields) and name not in found and
                    [row.get(key) for key in ("Version", "Filename", "Size", "SHA256")] ==
                    [version, filename, str(size), digest], "INVENTORY_PACKAGE_RECORD")
            found.add(name)
    require(found == plan["packages"].keys(), "INVENTORY_PACKAGE_COVERAGE")


def trusted_tool(name):
    path = Path("/usr/bin")/name
    resolved = path.resolve(strict=True)
    require(resolved.is_relative_to("/usr/bin") and stat.S_ISREG(resolved.lstat().st_mode) and
            all(member.lstat().st_uid == 0 and not member.lstat().st_mode & 0o022
                for member in (resolved, *resolved.parents)), "INVENTORY_SYSTEM_TOOL")


def expired(_signal, _frame):
    raise TimeoutError("INVENTORY_DEADLINE")


def inventory(plan, verifier):
    require(plan["kind"] == "SOUNDING_LINE_JAMMY_STATIC_NATIVE_INVENTORY_V1" and
            plan["runtimeAdmission"] == {"authorized": False, "requiredDenials": list(DENIALS),
                                         "unverifiedDenials": list(DENIALS)}, "INVENTORY_RUNTIME_REFUSED")
    require(sha256(verifier) == VERIFIER_SHA256, "INVENTORY_VERIFIER_PIN")
    for name in ("gpgv", "dpkg-deb"):
        trusted_tool(name)
    root = Path(os.environ["RUNNER_TEMP"])
    require(root.resolve(strict=True) == root and root.stat().st_uid == os.getuid() and
            shutil.disk_usage(root).free >= (2 << 30)+64*MIB, "INVENTORY_STORAGE_ADMISSION")
    with open("/proc/meminfo", encoding="ascii") as memory:
        available = re.search(r"^MemAvailable:\s+([0-9]+) kB$", memory.read(16384), re.M)
    require(available and int(available[1])*1024 >= 512*MIB, "INVENTORY_MEMORY_ADMISSION")
    with zipfile.ZipFile(io.BytesIO(verifier)) as archive:
        for name in ("package", "archive"):
            module = types.ModuleType(name)
            sys.modules[name] = module
            exec(compile(archive.read(name+".py"), name+".py", "exec"), module.__dict__)
    public = sys.modules["archive"]
    package = sys.modules["package"]
    client = urllib.request.build_opener(public.NoRedirect(), urllib.request.ProxyHandler({}))
    with tempfile.TemporaryDirectory(prefix="sl-jammy-inventory-", dir=root) as scratch:
        tempfile.tempdir = scratch
        signal.signal(signal.SIGALRM, expired)
        signal.alarm(90)
        try:
            pins = plan["noble"]
            prefix = ARCHIVE+"dists/"+pins["pocket"]+"/"
            signed = public.fetch(client, prefix+"InRelease", 512*1024)
            require(sha256(signed) == pins["releaseSha256"], "INVENTORY_RELEASE_PIN")
            release = public.signed_release(signed)
            index = public.fetch(client, prefix+INDEX.rsplit("/", 1)[0]+"/by-hash/SHA256/"+pins["indexSha256"],
                                 pins["indexBytes"])
            noble_rows(release, index, plan, datetime.now(timezone.utc))
            deb, binary, bubblewrap_proof = public.authenticated_package()
            bwrap = plan["bubblewrap"]
            require(len(deb) == bwrap["packageBytes"] and hashlib.sha512(deb).hexdigest() == bwrap["packageSha512"] and
                    len(binary) == bwrap["bytes"] and sha256(binary) == bwrap["sha256"], "INVENTORY_BWRAP_PIN")
            files = {"bwrap": ("usr/bin/bwrap", binary)}
            for _, path, size, digest, targets in plan["packages"].values():
                deb = public.fetch(client, ARCHIVE+path, size)
                require(len(deb) == size and sha256(deb) == digest, "INVENTORY_PACKAGE_PIN")
                selected = tar_members(package.bounded_tar(deb), targets)
                require(not files.keys() & selected.keys(), "INVENTORY_MEMBER_DUPLICATE")
                files.update(selected)
                require(sum(len(member) for _, member in files.values()) <= 8*MIB, "INVENTORY_CLOSURE_SIZE")
            members = exact_closure(files)
        finally:
            signal.alarm(0)
            tempfile.tempdir = None
    require(not Path(scratch).exists(), "INVENTORY_CLEANUP")
    return {"members": members, "bubblewrapArchive": bubblewrap_proof, "ownedScratchRemoved": True,
            "status": "STATIC_INVENTORY_ONLY", "runtimeAdmitted": False,
            "unverifiedRuntimeDenials": list(DENIALS), "qualification": False,
            "externalIsolationProved": False, "reuseAuthorized": False}
