"""Focused boundary checks. No real credentials, signing, network or runtime state."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from runner import BUNDLE, Failure, TEAM, altool_command, altool_diagnostics, cleanup_owned, signature_raw, signing_overlay, validate_origin, validate_profile


class TestSigningBoundaries(unittest.TestCase):
    def test_current_altool_arguments_bind_ipa_and_authentication_without_legacy_flags(self):
        for action, flag in (("validate", "--validate-app"), ("upload", "--upload-package")):
            ipa, key = Path("/owned/app with spaces.ipa"), Path("/private/key.p8")
            command = altool_command(action, ipa, "PUBLICKEY1", "public-issuer", key)
            self.assertEqual(command[:4], ["xcrun", "altool", flag, str(ipa)])
            self.assertEqual(command[4:], ["--api-key", "PUBLICKEY1", "--api-issuer", "public-issuer", "--output-format", "json", "--p8-file-path", str(key)])
        with self.assertRaises(Failure):
            altool_command("delete", "app.ipa", "key", "issuer")

    def test_altool_diagnostics_discard_unstructured_and_private_fields_and_redact_messages(self):
        secret = "synthetic-test-secret"
        token = "eyJheader.payload.signature"
        pem = "-----BEGIN PRIVATE KEY-----\nsynthetic-key-body\n-----END PRIVATE KEY-----"
        raw = "tool banner\n" + json.dumps({"product-errors": [{"code": -1000,
            "message": f"Rejected {secret} {token} {pem} owner@example.invalid",
            "userInfo": {"private": "DO_NOT_PUBLISH"}}], "authentication": "DO_NOT_PUBLISH"})
        result = altool_diagnostics(raw, [secret, pem])
        public = json.dumps(result)
        self.assertTrue(result["jsonResponseParsed"])
        self.assertEqual(result["messages"][0]["code"], "-1000")
        for value in (secret, token, "synthetic-key-body", "owner@example.invalid", "DO_NOT_PUBLISH"):
            self.assertNotIn(value, public)
        self.assertEqual(altool_diagnostics("unstructured private output"), {"jsonResponseParsed": False, "messages": []})
        self.assertNotIn("synthetic-key-body", json.dumps(altool_diagnostics(json.dumps({"errors": [{"message": "partial synthetic-key-body"}]}), [pem])))
        bounded = altool_diagnostics(json.dumps({"errors": [{"detail": "x" * 1000}] * 12}))
        self.assertEqual(len(bounded["messages"]), 8)
        self.assertEqual(len(bounded["messages"][0]["detail"]), 800)

    def test_signing_is_scoped_to_release_app_and_preserves_included_source_paths(self):
        root = Path("/owned/workspace with spaces")
        overlay = signing_overlay(root, "synthetic-public-identity", "11111111-1111-1111-1111-111111111111")
        self.assertEqual(overlay["include"], [{"path": str(root / "native/ios/project.yml"), "relativePaths": True}])
        self.assertNotIn("settings", overlay)
        self.assertEqual(list(overlay["targets"]), ["LandfallCompanion"])
        app = overlay["targets"]["LandfallCompanion"]["settings"]
        self.assertNotIn("base", app)
        self.assertEqual(list(app["configs"]), ["Release"])
        self.assertEqual(app["configs"]["Release"]["DEVELOPMENT_TEAM"], TEAM)
        self.assertEqual(app["configs"]["Release"]["CODE_SIGNING_ALLOWED"], "YES")

    def profile(self):
        return {"ExpirationDate": dt.datetime(2030, 1, 1), "TeamIdentifier": [TEAM],
                "UUID": "11111111-1111-1111-1111-111111111111", "DeveloperCertificates": [b"synthetic-public-cert"],
                "Entitlements": {"application-identifier": f"{TEAM}.{BUNDLE}", "com.apple.developer.team-identifier": TEAM,
                                 "get-task-allow": False, "com.apple.developer.nfc.readersession.formats": ["TAG"]}}

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
                           ("com.apple.developer.nfc.readersession.formats", []),
                           ("com.apple.developer.nfc.readersession.formats", ["NDEF"])):
            changed = self.profile()
            changed["Entitlements"][key] = value
            with self.assertRaises(Failure):
                validate_profile(changed)
        # Apple profiles can authorize older formats alongside TAG. The shipped
        # app requests only TAG; profile superset support must remain valid.
        profile["Entitlements"]["com.apple.developer.nfc.readersession.formats"] = ["NDEF", "TAG", "PACE"]
        self.assertEqual(validate_profile(profile), hashlib.sha1(b"synthetic-public-cert").hexdigest().upper())

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
