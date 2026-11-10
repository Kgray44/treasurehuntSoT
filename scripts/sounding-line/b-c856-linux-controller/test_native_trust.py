import hashlib
import io
import stat
import sys
import tarfile
import tempfile
import types
import unittest
import zipfile
from pathlib import Path
from unittest.mock import Mock, patch

import producer_boundary
import producer_driver


def verifier():
    with zipfile.ZipFile(Path(__file__).with_name("diagnostic-v3.zip")) as bundle:
        package = types.ModuleType("package")
        exec(compile(bundle.read("package.py"), "package.py", "exec"), package.__dict__)
        archive = types.ModuleType("archive")
        with patch.dict(sys.modules, {"package": package}):
            exec(compile(bundle.read("archive.py"), "archive.py", "exec"), archive.__dict__)
    return archive


class NativeTrustTests(unittest.TestCase):
    def test_key_requires_secure_ancestry_file_and_exact_digest(self):
        archive = verifier()
        key = b"synthetic public key"
        directory = Mock()
        directory.lstat.return_value = types.SimpleNamespace(st_uid=0, st_mode=stat.S_IFDIR | 0o755)
        path = Mock()
        path.resolve.return_value = path
        path.parents = (directory,)
        scenarios = [
            (0, 0o755, 0, 0o644, key, None),
            (1000, 0o755, 0, 0o644, key, "ARCHIVE_KEYRING_OWNER"),
            (0, 0o777, 0, 0o644, key, "ARCHIVE_KEYRING_OWNER"),
            (0, 0o755, 1000, 0o644, key, "ARCHIVE_KEYRING_OWNER"),
            (0, 0o755, 0, 0o664, key, "ARCHIVE_KEYRING_OWNER"),
            (0, 0o755, 0, 0o644, b"x"*len(key), "ARCHIVE_KEYRING_DIGEST"),
        ]
        for dir_uid, dir_mode, uid, mode, data, refusal in scenarios:
            with self.subTest(dir_uid=dir_uid, dir_mode=dir_mode, uid=uid, mode=mode, refusal=refusal):
                directory.lstat.return_value = types.SimpleNamespace(st_uid=dir_uid, st_mode=stat.S_IFDIR | dir_mode)
                record = types.SimpleNamespace(st_uid=uid, st_mode=stat.S_IFREG | mode)
                stream = io.BytesIO(data)
                stream.fileno = lambda: 3
                with patch.object(archive, "KEYRING_BYTES", len(key)), \
                     patch.object(archive, "KEYRING_SHA256", hashlib.sha256(key).hexdigest()), \
                     patch.object(archive.os, "O_NOFOLLOW", 0x20000, create=True), \
                     patch.object(archive.os, "O_NONBLOCK", 0x800, create=True), \
                     patch.object(archive.os, "open", return_value=3), \
                     patch.object(archive.os, "fstat", return_value=record), \
                     patch.object(archive.os, "fdopen", return_value=stream):
                    if refusal:
                        with self.assertRaisesRegex(ValueError, "^"+refusal+"$"):
                            archive.archive_key(path)
                    else:
                        self.assertEqual(archive.archive_key(path), key)

    def test_signature_scratch_is_removed_after_refusal(self):
        archive = verifier()
        key = b"synthetic public key"
        observed = []

        def reject(args, **_):
            copy = Path(args[args.index("--keyring")+1])
            self.assertEqual(copy.read_bytes(), key)
            observed.append(copy.parent)
            return types.SimpleNamespace(returncode=2, stdout=b"")

        with tempfile.TemporaryDirectory(dir=".") as root:
            with patch.object(archive.sys, "platform", "linux"), patch.object(archive, "archive_key", return_value=key), \
                 patch.object(archive.tempfile, "tempdir", root), patch.object(archive.subprocess, "run", side_effect=reject):
                with self.assertRaisesRegex(ValueError, "^RELEASE_SIGNATURE$"):
                    archive.signed_release(b"synthetic InRelease")
            self.assertEqual(len(observed), 1)
            self.assertFalse(observed[0].exists())

    def test_font_requires_pinned_package_and_root_owned_exact_member(self):
        deb = b"synthetic authenticated carrier"
        font = b"synthetic font"

        def archive(member, mode=0o644):
            output = io.BytesIO()
            with tarfile.open(fileobj=output, mode="w") as tar:
                item = tarfile.TarInfo("./"+producer_boundary.FONT_MEMBER)
                item.size = len(member)
                item.mode = mode
                tar.addfile(item, io.BytesIO(member))
            return output.getvalue()

        with patch.object(producer_driver, "FONT_PACKAGE_BYTES", len(deb)), \
             patch.object(producer_driver, "FONT_PACKAGE_SHA256", hashlib.sha256(deb).hexdigest()), \
             patch.object(producer_driver, "FONT_BYTES", len(font)), \
             patch.object(producer_boundary, "FONT_BYTES", len(font)), \
             patch.object(producer_boundary, "FONT_SHA256", hashlib.sha256(font).hexdigest()):
            extract = Mock(return_value=archive(font))
            with self.assertRaisesRegex(ValueError, "^PRODUCER_SIGNED_FONT_PACKAGE$"):
                producer_driver.signed_font(b"x"*len(deb), extract)
            extract.assert_not_called()
            self.assertEqual(producer_driver.signed_font(deb, extract), font)
            for content, mode, refusal in ((b"x"*len(font), 0o644, "MEMBER"), (font, 0o666, "METADATA")):
                with self.subTest(mode=mode, refusal=refusal):
                    extract.return_value = archive(content, mode)
                    with self.assertRaisesRegex(ValueError, "^PRODUCER_SIGNED_FONT_"+refusal+"$"):
                        producer_driver.signed_font(deb, extract)
