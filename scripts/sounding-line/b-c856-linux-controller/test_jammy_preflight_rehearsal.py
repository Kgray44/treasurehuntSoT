import hashlib
import tempfile
import unittest
from pathlib import Path

import jammy_preflight_rehearsal as rehearsal


class RehearsalTest(unittest.TestCase):
    def test_recovery_checks_exact_bytes_and_removes_only_the_owned_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / "rehearsal.json"
            other = root / "unrelated.json"
            other.write_bytes(b"keep")
            record = {"run": 123}
            digest = rehearsal.create_marker(marker, record)
            expected = marker.read_bytes()
            self.assertEqual(digest, hashlib.sha256(expected).hexdigest())
            with self.assertRaises(FileExistsError):
                rehearsal.create_marker(marker, record)
            with self.assertRaisesRegex(ValueError, "JAMMY_REHEARSAL_MARKER_IDENTITY"):
                rehearsal.remove_marker(marker, record, "c" * 64)
            self.assertEqual(marker.read_bytes(), expected)
            original = root / "original.json"
            marker.rename(original)
            marker.write_bytes(expected)
            marker.chmod(0o600)
            with self.assertRaisesRegex(ValueError, "JAMMY_REHEARSAL_MARKER_IDENTITY"):
                rehearsal.remove_marker(marker, record, digest)
            self.assertEqual(marker.read_bytes(), expected)
            original.replace(marker)
            rehearsal.remove_marker(marker, record, digest)
            self.assertFalse(marker.exists())
            self.assertEqual(other.read_bytes(), b"keep")


if __name__ == "__main__":
    unittest.main()
