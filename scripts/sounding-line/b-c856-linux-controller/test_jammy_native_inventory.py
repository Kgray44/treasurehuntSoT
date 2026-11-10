"""Offline synthetic fixtures for the static preflight. No package or runtime is loaded."""
import io
import lzma
import struct
import sys
import tarfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import jammy_native_inventory as probe


def fixture_tar(entries):
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode="w", format=tarfile.USTAR_FORMAT) as archive:
        for name, body, kind, link in entries:
            member = tarfile.TarInfo(name)
            member.type, member.linkname, member.size = kind, link, len(body)
            archive.addfile(member, io.BytesIO(body))
    return stream.getvalue()


def fixture_elf(needed="libc.so.6", interpreter=probe.INTERPRETER, tag=1):
    raw = bytearray(800)
    names = b"\0"+needed.encode()+b"\0"
    identity = b"\x7fELF\x02\x01\x01"+b"\0"*9
    struct.pack_into("<16sHHIQQQIHHHHHH", raw, 0, identity, 3, 62, 1, 0, 64, 400, 0,
                     64, 56, 1, 64, 3, 0)
    text = interpreter.encode()+b"\0"
    struct.pack_into("<IIQQQQQQ", raw, 64, 3, 0, 128, 0, 0, len(text), len(text), 1)
    raw[128:128+len(text)] = text
    raw[200:200+len(names)] = names
    struct.pack_into("<qQqQ", raw, 250, tag, 1, 0, 0)
    struct.pack_into("<IIQQQQIIQQ", raw, 464, 0, 3, 0, 0, 200, len(names), 0, 0, 1, 0)
    struct.pack_into("<IIQQQQIIQQ", raw, 528, 0, 6, 0, 0, 250, 32, 1, 0, 8, 16)
    return bytes(raw)


class StaticInventoryTests(unittest.TestCase):
    def test_libc_whole_archive_bound_does_not_raise_selected_member_bound(self):
        name = probe.LIBDIR+"/libc.so.6"
        selected = (name, b"selected", tarfile.REGTYPE, "")
        other = ("usr/share/unselected", bytes(8*probe.MIB), tarfile.REGTYPE, "")
        raw = fixture_tar([selected, other])
        with self.assertRaisesRegex(ValueError, "INVENTORY_TAR_SIZE"):
            probe.tar_members(raw, ["libc.so.6"])
        self.assertEqual(probe.tar_members(raw, ["libc.so.6"], probe.LIBC_TAR_LIMIT),
                         {"libc.so.6": (name, b"selected")})
        with self.assertRaisesRegex(ValueError, "INVENTORY_MEMBER_TYPE"):
            probe.tar_members(fixture_tar([(name, bytes(4*probe.MIB+1), tarfile.REGTYPE, "")]),
                              ["libc.so.6"], probe.LIBC_TAR_LIMIT)

    def test_libc_expansion_refuses_excess_and_reaps_the_decoder(self):
        child = Mock()
        child.poll.return_value = None
        selector = Mock()
        selector.select.return_value = [(SimpleNamespace(fileobj=child.stdout, fd=3), 1)]
        selector.get_map.return_value = {3: child.stdout}
        context = Mock()
        context.__enter__ = Mock(return_value=selector)
        context.__exit__ = Mock(return_value=False)
        with patch.object(probe, "LIBC_TAR_LIMIT", 4), \
             patch.object(probe.subprocess, "Popen", return_value=child), \
             patch.object(probe.selectors, "DefaultSelector", return_value=context), \
             patch.object(probe.os, "read", return_value=b"12345") as read:
            with self.assertRaisesRegex(ValueError, "INVENTORY_LIBC_TAR_EXPANSION"):
                probe.bounded_libc_tar(b"fixture")
        read.assert_called_once_with(3, 5)
        child.kill.assert_called_once_with()
        child.wait.assert_called_once_with(timeout=2)
        child.stdout.close.assert_called_once_with()
        child.stderr.close.assert_called_once_with()

    def test_static_verifier_pins_jammy_without_changing_frozen_path_or_source(self):
        frozen = Path(__file__).with_name("diagnostic-v3.zip").read_bytes()
        with patch.dict(sys.modules):
            archive, _ = probe.inventory_verifier(frozen)
            self.assertEqual(str(archive.KEYRING).replace("\\", "/"), "/etc/apt/trusted.gpg.d/ubuntu-keyring-2018-archive.gpg")
            self.assertEqual(archive.KEYRING_BYTES, 1733)
            self.assertEqual(archive.KEYRING_SHA256,
                             "bfdb0512804d0740816d836bb05b1ef8b27609771d7b9962c95bcc57bfaac230")
            self.assertIs(archive.signed_release.__globals__["archive_key"], archive.archive_key)
            with self.assertRaisesRegex(ValueError, "INVENTORY_VERIFIER_PIN"):
                probe.inventory_verifier(frozen+b"x")

    def test_approved_relative_soname_link_resolves_one_exact_member(self):
        target = "libcap.so.2"
        base = probe.LIBDIR+"/"
        archive = fixture_tar([(base+target, b"", tarfile.SYMTYPE, target+".66"),
                               ("./"+base+target+".66", b"elf", tarfile.REGTYPE, "")])
        self.assertEqual(probe.tar_members(archive, [target]), {target: (base+target+".66", b"elf")})

    def test_archive_link_or_duplicate_member_is_refused(self):
        name = probe.LIBDIR+"/libcap.so.2"
        for entries in (
            [(name, b"", tarfile.SYMTYPE, "../../elsewhere")],
            [(name, b"", tarfile.LNKTYPE, name+".66")],
            [(name, b"one", tarfile.REGTYPE, ""), ("./"+name, b"two", tarfile.REGTYPE, "")],
        ):
            with self.subTest(entries=entries):
                with self.assertRaisesRegex(ValueError, "INVENTORY_(MEMBER|TAR)"):
                    probe.tar_members(fixture_tar(entries), ["libcap.so.2"])

    def test_elf_dependencies_and_interpreter_are_inventory_only(self):
        body = fixture_elf()
        observed = probe.elf_inventory(body)
        self.assertEqual(observed["needed"], ["libc.so.6"])
        self.assertEqual(observed["interpreter"], probe.INTERPRETER)
        for data, error in (
            (fixture_elf(interpreter="/lib64/ld-other-x86-64.so.2"), "INTERPRETER"),
            (fixture_elf(tag=29), "SEARCH_OVERRIDE"),
            (body[:500], "BOUNDS"),
        ):
            with self.subTest(error=error):
                with self.assertRaisesRegex(ValueError, "INVENTORY_ELF_"+error):
                    probe.elf_inventory(data)

    def test_missing_or_insufficient_library_is_refused(self):
        entries = {"bwrap": ("usr/bin/bwrap", b"bwrap"),
                   probe.LOADER: ("usr/lib/loader", b"loader"), "libc.so.6": ("usr/lib/libc", b"libc")}
        values = {
            b"bwrap": {"needed": ["libc.so.6"], "interpreter": probe.INTERPRETER, "soname": None,
                       "versionNeeds": {"libc.so.6": ["GLIBC_2.38"]}, "versionDefinitions": []},
            b"loader": {"needed": [], "interpreter": None, "soname": probe.LOADER,
                        "versionNeeds": {}, "versionDefinitions": []},
            b"libc": {"needed": [], "interpreter": None, "soname": "libc.so.6",
                      "versionNeeds": {}, "versionDefinitions": ["GLIBC_2.38"]},
        }
        with patch.object(probe, "elf_inventory", side_effect=values.__getitem__):
            self.assertEqual(probe.exact_closure(entries)["bwrap"]["sha256"], probe.sha256(b"bwrap"))
            with self.assertRaisesRegex(ValueError, "INVENTORY_ELF_DEPENDENCY"):
                probe.exact_closure({key:value for key,value in entries.items() if key != "libc.so.6"})
            values[b"libc"]["versionDefinitions"] = ["GLIBC_2.35"]
            with self.assertRaisesRegex(ValueError, "INVENTORY_ELF_ABI"):
                probe.exact_closure(entries)

    def test_authentic_index_scope_freshness_and_package_identity(self):
        date = datetime(2026, 11, 10, 12, tzinfo=timezone.utc)
        package = ("Package: libc6\nArchitecture: amd64\nVersion: 1\nFilename: pool/libc.deb\n"
                   "Size: 6\nSHA256: " + "a"*64 + "\n\n")
        for suffix in ("", package, package.replace("Architecture: amd64", "Architecture: arm64")):
            index = lzma.compress((package+suffix).encode())
            pin = {"pocket": "noble-updates", "indexSha256": probe.sha256(index), "indexBytes": len(index)}
            release = {"Origin": "Ubuntu", "Label": "Ubuntu", "Suite": "noble-updates", "Codename": "noble",
                       "Version": "24.04", "Architectures": "amd64", "Components": "main",
                       "Date": "Tue, 10 Nov 2026 11:03:27 UTC",
                       "SHA256": f'{pin["indexSha256"]} {len(index)} {probe.INDEX}'}
            plan = {"noble": pin, "packages": {"libc6": ["1", "pool/libc.deb", 6, "a"*64, ["libc.so.6"]]}}
            if suffix == package:
                with self.assertRaisesRegex(ValueError, "INVENTORY_PACKAGE_RECORD"):
                    probe.noble_rows(release, index, plan, date)
            else:
                probe.noble_rows(release, index, plan, date)
                with self.assertRaisesRegex(ValueError, "INVENTORY_INDEX_PIN"):
                    probe.noble_rows(release, index+b"x", plan, date)
                with self.assertRaisesRegex(ValueError, "INVENTORY_RELEASE_FRESHNESS"):
                    probe.noble_rows(release, index, plan, datetime(2026, 11, 13, tzinfo=timezone.utc))

    def test_no_runtime_admission_even_for_claimed_denials(self):
        plan = {"kind": "SOUNDING_LINE_JAMMY_STATIC_NATIVE_INVENTORY_V1",
                "runtimeAdmission": {"authorized": True, "requiredDenials": list(probe.DENIALS),
                                     "unverifiedDenials": []}}
        with self.assertRaisesRegex(ValueError, "INVENTORY_RUNTIME_REFUSED"):
            probe.inventory(plan, b"")
