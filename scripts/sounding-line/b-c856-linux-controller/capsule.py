"""Immutable C856 Linux capsule transport. No build or sandbox runs here."""
import hashlib
import json
import os
import re
import stat
import struct
import tarfile
import zipfile
from pathlib import Path, PurePosixPath

from admission import MAX_CAPSULE, MIB, SHA256, SOURCE, TREE, need

MAX_MANIFEST = 24*MIB
MAX_SEED = 32*MIB
MAX_ENTRIES = 120000
MAX_DIRECTORIES = 40000
MAX_TAR_OVERHEAD = 2*MAX_ENTRIES*512 + 16384
MEMBERS = {"capsule.json", "capsule.tar", "seed.sqlite"}
BROWSER = ("children/browser/browsers/chromium_headless_shell-1194/"
           "chrome-headless-shell-linux64/chrome-headless-shell")
BROWSER_CAPTURE = "children/browser/source/scripts/sounding-line/experience-browser.mjs"
BROWSER_PLAN = "children/browser/inputs/plan.json"
BWRAP_SHA = "5d1f77a455d3a5cc1a45bdbf2e23b89cbd7b33e640dd9ae3b5ce2573d133889e"
V3_FILES = {
    "diagnostic/boundary.py": "boundary.py", "diagnostic/supervisor.py": "supervisor.py",
    "diagnostic/peers.py": "peers.py", "children/app/diagnostic/app.mjs": "app.mjs",
    "children/app/diagnostic/probe.py": "probe.py", "children/browser/diagnostic/probe.py": "probe.py",
    "children/browser/diagnostic/capture.mjs": "capture.mjs",
    "children/browser/diagnostic/comparison.mjs": "comparison.mjs",
    BROWSER_PLAN: "plan.original.json",
}
DIRECTORIES = tuple(
    f"{prefix}{path}" for prefix in ("", "children/app/", "children/browser/")
    for path in ("dev", "proc", "run", "tmp", "state")
) + ("masks/dir", "children/browser/source/artifacts", "children/app/inputs")
REQUIRED_FILES = set(V3_FILES) | {
    BROWSER, BROWSER_CAPTURE, "usr/bin/bwrap", "usr/bin/python3", "masks/file",
    "children/app/usr/bin/python3", "children/app/usr/bin/node",
    "children/browser/usr/bin/python3", "children/browser/usr/bin/node",
    "children/browser/inputs/authentication.json", "children/app/source/.next/BUILD_ID",
    "children/app/inputs/controls.json", "children/app/inputs/seed.sqlite",
    "children/browser/inputs/controls.json",
    "children/app/source/node_modules/next/dist/bin/next",
    "children/browser/source/node_modules/playwright-core/browsers.json",
}
EXPECTED_MODES = (0o444, 0o555)


def no_duplicates(items):
    result = {}
    for key, value in items:
        need(key not in result, "DUPLICATE_JSON_KEY")
        result[key] = value
    return result


def parse_json(data):
    return json.loads(data, object_pairs_hook=no_duplicates)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def valid_path(text):
    need(isinstance(text, str) and 0 < len(text) <= 240 and
         re.fullmatch(r"[A-Za-z0-9._@+/\[\]-]+", text), "CAPSULE_PATH")
    parts = text.split("/")
    need(len(parts) <= 24 and all(part not in ("", ".", "..", ".git", ".npmrc") and
         not part.startswith(".env") for part in parts), "CAPSULE_PATH")
    need(not text.endswith((".key", ".p12", ".pfx", ".encrypted")) and
         "owner-key" not in text.lower() and "custodyreceipts" not in text.lower(), "PRIVATE_CAPSULE_INPUT")
    need(parts[0] in ("usr", "lib", "lib64", "etc", "diagnostic", "masks", "children") and
         (parts[0] != "children" or len(parts) >= 3 and parts[1] in ("app", "browser")), "CAPSULE_ROOT_SCOPE")
    scoped = parts[2:] if parts[0] == "children" else parts
    if scoped[0] == "etc":
        name = "/".join(scoped[1:])
        need(name in ("hosts", "nsswitch.conf", "localtime", "ld.so.conf", "mime.types") or
             name.startswith(("fonts/", "ld.so.conf.d/")), "CAPSULE_SYSTEM_FILE_SCOPE")
    return PurePosixPath(text)


def manifest_check(data, expected_digest, expected_bytes, publisher, v3):
    need(0 < len(data) <= MAX_MANIFEST and digest(data) == expected_digest, "CAPSULE_MANIFEST_DIGEST")
    result = parse_json(data)
    need(set(result) == {"source", "tree", "publisher", "linux", "buildId", "seedSha256",
                        "chromiumSha256", "files"}, "CAPSULE_MANIFEST_FIELDS")
    need(result["source"] == SOURCE and result["tree"] == TREE and result["publisher"] == publisher,
         "CAPSULE_SOURCE_IDENTITY")
    linux = result["linux"]
    need(set(linux) == {"os", "arch", "imageVersion", "kernel", "node", "playwright", "chromiumRevision"} and
         linux["os"] == "ubuntu-24.04" and linux["arch"] == "x64" and linux["node"] == "24.19.0" and
         linux["playwright"] == "1.56.1" and linux["chromiumRevision"] == "1194" and
         all(re.fullmatch(r"[A-Za-z0-9._+-]{1,80}", linux[k]) for k in ("imageVersion", "kernel")),
         "CAPSULE_NATIVE_IDENTITY")
    need(re.fullmatch(r"[A-Za-z0-9_-]{1,100}", result["buildId"]) and
         SHA256.fullmatch(result["seedSha256"]) and SHA256.fullmatch(result["chromiumSha256"]), "CAPSULE_DIGESTS")
    files = result["files"]
    need(isinstance(files, dict) and REQUIRED_FILES <= set(files) and len(files) <= MAX_ENTRIES, "CAPSULE_REQUIRED_FILES")
    total = 0
    directories = set(DIRECTORIES)
    for path, record in files.items():
        rel = valid_path(path)
        directories.update(parent.as_posix() for parent in rel.parents)
        need(len(directories) <= MAX_DIRECTORIES, "CAPSULE_DIRECTORY_BOUND")
        need(set(record) == {"bytes", "sha256", "mode"} and type(record["bytes"]) is int and
             0 <= record["bytes"] <= MAX_CAPSULE and SHA256.fullmatch(record["sha256"]) and
             type(record["mode"]) is int and record["mode"] in EXPECTED_MODES, "CAPSULE_FILE_RECORD")
        total += record["bytes"]
        need(total <= MAX_CAPSULE, "CAPSULE_EXPANDED_BOUND")
    need(total == expected_bytes, "CAPSULE_EXPANDED_IDENTITY")
    for name, source in V3_FILES.items():
        need(files[name]["sha256"] == digest(v3[source]), "CAPSULE_V3_MEMBER")
    for marker in ("masks/file", "children/app/inputs/controls.json", "children/app/inputs/seed.sqlite",
                   "children/browser/inputs/controls.json"):
        need(files[marker]["bytes"] == 0 and files[marker]["sha256"] == digest(b""), "CAPSULE_MOUNT_TARGET")
    for tool in ("node", "python3"):
        left, right = [files[f"children/{role}/usr/bin/{tool}"] for role in ("app", "browser")]
        need(left == right and left["mode"] == 0o555, "CAPSULE_SHARED_RUNTIME_IDENTITY")
    expected_capture = parse_json(v3["plan.original.json"])["sandboxedCaptureSha256"]
    need(files[BROWSER_CAPTURE]["sha256"] == expected_capture and
         files[BROWSER]["sha256"] == result["chromiumSha256"] and files["usr/bin/bwrap"]["sha256"] == BWRAP_SHA and
         files[BROWSER]["mode"] == files["usr/bin/bwrap"]["mode"] == 0o555, "CAPSULE_EXECUTABLE_IDENTITY")
    return result


def safe_outer_zip(path):
    # GitHub's carrier contains three flat entries. Bound central directory
    # metadata before ZipFile constructs a member list. Zip64 local records
    # are fine. A Zip64 central directory is unnecessary below 2 GiB.
    with path.open("rb") as stream:
        stream.seek(-22, os.SEEK_END)
        end = stream.read(22)
    signature, disk, first_disk, count_here, count, size, offset, comment = struct.unpack("<4s4H2IH", end)
    need(signature == b"PK\x05\x06" and disk == first_disk == comment == 0 and
         count_here == count == 3 and 0 < size <= 4096 and offset + size == path.stat().st_size - 22,
         "CARRIER_CENTRAL_DIRECTORY")
    archive = zipfile.ZipFile(path)
    items = archive.infolist()
    try:
        need(len(items) == 3 and {item.filename for item in items} == MEMBERS and all(
            not item.is_dir() and not item.flag_bits & 1 and
            stat.S_IFMT(item.external_attr >> 16) in (0, stat.S_IFREG) and
            item.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED) for item in items
        ), "CARRIER_MEMBERS")
    except BaseException:
        archive.close()
        raise
    return archive


def exact_read(stream, size):
    data = stream.read(size)
    need(len(data) == size, "TRUNCATED_CAPSULE")
    return data


def tar_extract(stream, root, manifest, tar_bytes):
    files = manifest["files"]
    total = sum(item["bytes"] for item in files.values())
    need(total <= tar_bytes <= total + MAX_TAR_OVERHEAD, "CAPSULE_TAR_BOUND")
    root.mkdir(mode=0o700, exist_ok=False)
    seen = set()
    byte_count = 0
    for _ in range(len(files)):
        header = exact_read(stream, 512)
        byte_count += 512
        need(header[257:263] == b"ustar\0" and header[156:157] in (b"0", b"\0"), "CAPSULE_TAR_HEADER")
        item = tarfile.TarInfo.frombuf(header, "ascii", "strict")
        rel = valid_path(item.name)
        name = rel.as_posix()
        need(name in files and name not in seen, "CAPSULE_TAR_INVENTORY")
        entry = files[name]
        need(item.isreg() and item.size == entry["bytes"] and item.mode == entry["mode"] and
             item.linkname == "" and item.uid == item.gid == 0, "CAPSULE_TAR_FILE")
        destination = root.joinpath(*rel.parts)
        destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        remaining = item.size
        h = hashlib.sha256()
        with destination.open("xb") as output:
            while remaining:
                chunk = exact_read(stream, min(1*MIB, remaining))
                output.write(chunk)
                h.update(chunk)
                remaining -= len(chunk)
        need(h.hexdigest() == entry["sha256"], "CAPSULE_TAR_MEMBER_DIGEST")
        destination.chmod(entry["mode"])
        padding = -item.size % 512
        need(not any(exact_read(stream, padding)), "CAPSULE_TAR_PADDING")
        byte_count += item.size + padding
        seen.add(name)
    need(seen == set(files), "CAPSULE_TAR_INVENTORY")
    trailing = tar_bytes - byte_count
    need(1024 <= trailing <= 16384 and not any(exact_read(stream, trailing)) and
         not stream.read(1), "CAPSULE_TAR_END")
    for required in DIRECTORIES:
        root.joinpath(*required.split("/")).mkdir(mode=0o700, parents=True, exist_ok=True)
    for current, _, _ in os.walk(root, topdown=False, followlinks=False):
        Path(current).chmod(0o555)


def unpack(archive_path, scratch, choice, v3):
    with safe_outer_zip(archive_path) as archive:
        info = archive.getinfo("capsule.json")
        need(0 < info.file_size <= MAX_MANIFEST, "CAPSULE_MANIFEST_BOUND")
        document = archive.read(info)
        publisher = {"run": choice["run"], "workflow": choice["workflow"], "sha": choice["producer"]}
        manifest = manifest_check(document, choice["manifest"], choice["capsuleBytes"], publisher, v3)
        info = archive.getinfo("seed.sqlite")
        need(512 <= info.file_size <= MAX_SEED, "CAPSULE_SEED_BOUND")
        seed = archive.read(info)
        need(seed[:16] == b"SQLite format 3\0" and digest(seed) == manifest["seedSha256"], "CAPSULE_SEED_DIGEST")
        root = scratch / "bundle"
        tar = archive.getinfo("capsule.tar")
        with archive.open(tar) as stream:
            tar_extract(stream, root, manifest, tar.file_size)
        manifest_path = scratch / "capsule.json"
        seed_path = scratch / "seed.sqlite"
        for target, value in ((manifest_path, document), (seed_path, seed)):
            with target.open("xb") as output:
                output.write(value)
            target.chmod(0o400)
        need((root / "children/app/source/.next/BUILD_ID").read_bytes().rstrip(b"\n") ==
             manifest["buildId"].encode("ascii"), "NEXT_BUILD_IDENTITY")
        need(parse_json((root / "children/browser/inputs/authentication.json").read_bytes()) == [],
             "CAPSULE_ANONYMOUS_CACHE")
        browsers = parse_json((root / "children/browser/source/node_modules/playwright-core/browsers.json").read_bytes())
        need(any(item.get("name") == "chromium-headless-shell" and item.get("revision") == "1194"
                 for item in browsers["browsers"]), "CHROMIUM_REVISION")
        return root, manifest_path, seed_path, manifest
