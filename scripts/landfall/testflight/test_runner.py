"""Focused boundary checks. No real credentials, signing, network or runtime state."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from runner import BUNDLE, Failure, TEAM, cleanup_owned, signature_raw, validate_origin, validate_profile


class TestSigningBoundaries(unittest.TestCase):
    def profile(self):
        return {"ExpirationDate": dt.datetime(2030, 1, 1), "TeamIdentifier": [TEAM],
                "UUID": "11111111-1111-1111-1111-111111111111", "DeveloperCertificates": [b"synthetic-public-cert"],
                "Entitlements": {"application-identifier": f"{TEAM}.{BUNDLE}", "com.apple.developer.team-identifier": TEAM,
                                 "get-task-allow": False, "com.apple.developer.nfc.readersession.formats": ["NDEF"]}}

    def test_exact_app_distribution_profile(self):
        profile = self.profile()
        self.assertEqual(validate_profile(profile), hashlib.sha1(b"synthetic-public-cert").hexdigest().upper())
        for key, value in (("TeamIdentifier", ["OTHERTEAM00"]), ("ProvisionedDevices", ["synthetic-device"]),
                           ("ProvisionsAllDevices", True), ("ExpirationDate", dt.datetime(2000, 1, 1))):
            changed = self.profile()
            changed[key] = value
            with self.assertRaises(Failure):
                validate_profile(changed)
        for key, value in (("application-identifier", f"{TEAM}.*"), ("get-task-allow", True),
                           ("com.apple.developer.nfc.readersession.formats", [])):
            changed = self.profile()
            changed["Entitlements"][key] = value
            with self.assertRaises(Failure):
                validate_profile(changed)

    def test_ecdsa_jwt_padding(self):
        # R's leading sign byte must be stripped and S padded to 32 octets.
        left = b"\x00" + b"\x80" * 32
        right = b"\x01"
        der = bytes([0x30, 2 + len(left) + 2 + len(right), 0x02, len(left)]) + left + bytes([0x02, len(right)]) + right
        self.assertEqual(signature_raw(der), b"\x80" * 32 + b"\x00" * 31 + b"\x01")
        with self.assertRaises(Failure):
            signature_raw(b"\x31\x00")

    def test_tls_origin_boundaries(self):
        self.assertEqual(validate_origin("https://192.168.0.18:8449"), ("https://192.168.0.18:8449", "192.168.0.18"))
        for value in ("http://192.168.0.18", "https://user:password@example.com", "https://a'bad", "https://example.com/path"):
            with self.assertRaises(Failure):
                validate_origin(value)

    def test_interrupted_cleanup_refuses_paths_outside_owned_runner_temp(self):
        with tempfile.TemporaryDirectory() as directory:
            record = Path(directory) / "ncl01-testflight-ownership.json"
            record.write_text(json.dumps({"temp": str(Path(directory).parent), "keychain": None,
                                          "profiles": [], "previousKeychains": []}), encoding="utf-8")
            with patch.dict(os.environ, {"RUNNER_TEMP": directory}):
                with self.assertRaisesRegex(Failure, "CLEANUP_TEMP_SCOPE_INVALID"):
                    cleanup_owned()
            self.assertTrue(record.exists())


if __name__ == "__main__":
    unittest.main()
