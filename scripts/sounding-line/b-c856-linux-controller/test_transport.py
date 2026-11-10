import io
import json
import tarfile
import tempfile
import unittest
import zipfile
from pathlib import Path

from admission import BudgetError
from capsule import digest, parse_json, safe_outer_zip, tar_extract, valid_path
from provider import validate_location


def ustar(name, payload, *, mode=0o444, link=False):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w", format=tarfile.USTAR_FORMAT) as tar:
        entry = tarfile.TarInfo(name)
        entry.mode = mode
        entry.size = len(payload)
        if link:
            entry.type = tarfile.SYMTYPE
            entry.linkname = "/etc/shadow"
            entry.size = 0
        tar.addfile(entry, None if link else io.BytesIO(payload))
    return buf.getvalue()


class TransportTests(unittest.TestCase):
    def test_declared_bytes_are_rehashed_and_aliased_headers_fail(self):
        payload = b"ELF synthetic"
        plan = {"files": {"usr/bin/python3": {"bytes": len(payload), "sha256": digest(payload), "mode": 0o444}}}
        with tempfile.TemporaryDirectory(dir=".") as outer:
            base = Path(outer)
            good = ustar("usr/bin/python3", payload)
            tar_extract(io.BytesIO(good), base / "good", plan, len(good))
            self.assertEqual((base / "good/usr/bin/python3").read_bytes(), payload)
            for n, archive in enumerate((
                ustar("usr/bin/python3", b"tampered test"),
                ustar("../usr/bin/python3", payload),
                ustar("usr/bin/python3", payload, link=True),
            )):
                with self.assertRaises(BudgetError):
                    tar_extract(io.BytesIO(archive), base / str(n), plan, len(archive))

    def test_provider_zip_requires_exact_flat_carrier(self):
        with tempfile.TemporaryDirectory(dir=".") as outer:
            path = Path(outer) / "test.zip"
            with zipfile.ZipFile(path, "x") as z:
                for name in ("capsule.json", "capsule.tar", "seed.sqlite"):
                    z.writestr(name, b"fixture")
            with safe_outer_zip(path) as z:
                self.assertEqual(len(z.infolist()), 3)
            with zipfile.ZipFile(path, "a") as z:
                z.writestr("../alias", b"fixture")
            with self.assertRaises(BudgetError):
                safe_outer_zip(path)

    def test_credential_paths_and_nonprovider_redirects_refused(self):
        self.assertEqual(validate_location("https://trusted.blob.core.windows.net/one?sig=fixture"),
                         "https://trusted.blob.core.windows.net/one?sig=fixture")
        for url in ("http://trusted.blob.core.windows.net/one?sig=fixture",
                    "https://trusted.blob.core.windows.net.attacker.invalid/one?sig=fixture",
                    "https://user@trusted.blob.core.windows.net/one?sig=fixture"):
            with self.assertRaises(BudgetError):
                validate_location(url)
        for path in ("children/app/source/.env.production", "etc/owner-key.bin", "etc/shadow",
                     "children/app/source/../../etc/passwd", "/etc/shadow"):
            with self.assertRaises(BudgetError):
                valid_path(path)
        with self.assertRaises(BudgetError):
            parse_json(b'{"sha":"first","sha":"second"}')
