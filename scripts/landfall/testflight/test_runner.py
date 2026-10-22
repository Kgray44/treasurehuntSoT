"""Focused boundary checks. No real credentials, signing, network or runtime state."""
import base64
from contextlib import redirect_stderr, redirect_stdout
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import plistlib
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
import urllib.error
from unittest.mock import Mock, patch

from runner import BUNDLE, Failure, PreflightNoRedirect, Runner, TEAM, altool_command, altool_diagnostics, cleanup_owned, latest_build_metadata, main, signature_raw, signing_overlay, validate_distribution_certificate, validate_origin, validate_preflight_route, validate_profile


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


class TestReadOnlyPreflight(unittest.TestCase):
    private_subject = "Apple Distribution: Synthetic Private Person (X2JZ9N65V2)"
    certificate = ("notBefore=Oct 20 00:00:00 2026 GMT\nnotAfter=Oct 20 00:00:00 2030 GMT\n"
                   "subject=\n    OU=X2JZ9N65V2\n    CN=" + private_subject + "\n")

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.workspace = Path(self.directory.name) / "workspace"
        self.workspace.mkdir()
        self.runner_temp = Path(self.directory.name) / "runner"
        self.runner_temp.mkdir()
        self.environment = {
            "RUNNER_TEMP": str(self.runner_temp), "NCL01_ASC_KEY_ID": "PUBLICKEY1",
            "NCL01_ASC_ISSUER_ID": "11111111-1111-1111-1111-111111111111",
            "NCL01_ASC_APP_ID": "1234567890", "NCL01_INTERNAL_GROUP_ID": "synthetic-internal-group",
            "NCL01_DISTRIBUTION_P12_BASE64": base64.b64encode(b"synthetic-private-p12").decode(),
            "NCL01_DISTRIBUTION_P12_PASSWORD": "synthetic-private-password",
            "NCL01_APPSTORE_PROFILE_BASE64": base64.b64encode(b"synthetic-private-profile").decode(),
            "NCL01_ASC_PRIVATE_KEY_P8": "-----BEGIN PRIVATE KEY-----\nsynthetic-private-p8\n-----END PRIVATE KEY-----",
        }
        self.env_patch = patch.dict(os.environ, self.environment, clear=True)
        self.env_patch.start()
        self.cwd_patch = patch("runner.Path.cwd", return_value=self.workspace)
        self.cwd_patch.start()
        self.profile = TestSigningBoundaries().profile()
        self.commands = []
        self.command_failure = None
        self.new_runner()

    def new_runner(self, mode="preflight"):
        self.runner = Runner(SimpleNamespace(mode=mode, candidate="a" * 40,
                            origin="https://example.test", version="0.1.0", build="7"))
        self.runner.run = Mock(side_effect=self.fake_run)

    def tearDown(self):
        try:
            with patch("runner.subprocess.run", return_value=SimpleNamespace(returncode=0)):
                if self.runner.temp.exists():
                    self.runner.cleanup()
                elif self.runner.ownership.exists():
                    # A deliberate cleanup-failure test leaves only its owned marker.
                    self.runner.ownership.unlink()
        finally:
            self.cwd_patch.stop()
            self.env_patch.stop()
            self.directory.cleanup()

    def fake_run(self, command, **kwargs):
        self.commands.append((command, kwargs))
        if self.command_failure and command[:len(self.command_failure)] == self.command_failure:
            raise Failure("SYNTHETIC_COMMAND_FAILURE")
        if command[:3] == ["security", "cms", "-D"]:
            return plistlib.dumps(self.profile)
        if command[:2] == ["security", "find-identity"]:
            return ('  1) ' + hashlib.sha1(self.profile["DeveloperCertificates"][0]).hexdigest().upper() +
                    ' "' + self.private_subject + '"\n').encode()
        if command[:2] == ["security", "create-keychain"]:
            Path(command[-1]).write_bytes(b"synthetic-private-keychain")
            return b""
        if command[:2] == ["security", "list-keychains"]:
            return b'"/synthetic/login.keychain-db"'
        if command[:2] == ["openssl", "x509"]:
            return self.certificate.encode()
        if command[:2] == ["openssl", "pkey"]:
            return b"Public-Key: (256 bit)\nASN1 OID: prime256v1\n" if "-text_pub" in command else b""
        if command[0] == "security":
            return b""
        if command == ["git", "rev-parse", "HEAD"]:
            return ("a" * 40).encode()
        raise AssertionError("Unexpected tool in read-only preflight")

    def builds(self):
        return {"data": [{"id": "synthetic-build", "type": "builds", "attributes": {
                    "version": "7", "processingState": "VALID", "uploadedDate": "2026-10-20T04:00:00Z",
                    "private": "DO_NOT_PUBLISH"}, "relationships": {
                    "preReleaseVersion": {"data": {"id": "synthetic-version"}}}}],
                "included": [{"id": "synthetic-version", "type": "preReleaseVersions",
                              "attributes": {"version": "0.1.0", "private": "DO_NOT_PUBLISH"}}]}

    def api_response(self, route, body=None):
        self.assertIsNone(body)
        if route.startswith("apps?"):
            return {"data": [{"id": "1234567890", "type": "apps",
                              "attributes": {"bundleId": BUNDLE, "private": "DO_NOT_PUBLISH"}}]}
        if route.startswith("betaGroups/"):
            return {"data": {"id": "synthetic-internal-group", "type": "betaGroups",
                             "attributes": {"isInternalGroup": True, "name": "DO_NOT_PUBLISH"},
                             "relationships": {"app": {"data": {"id": "1234567890"}}}}}
        if route.startswith("builds?"):
            return self.builds()
        raise AssertionError("Unexpected Apple route")

    def test_preflight_validates_material_and_reads_only_without_profile_install_or_distribution(self):
        self.runner.api = Mock(side_effect=self.api_response)
        with patch("runner.Path.home", side_effect=AssertionError("User profile installation forbidden")):
            self.runner.preflight()
        self.assertEqual(self.runner.api.call_count, 3)
        self.assertEqual(self.runner.installed_profiles, [])
        self.assertTrue(self.runner.api.call_args_list[-1].args[0].startswith("builds?"))
        self.assertEqual(self.runner.receipt["distributionPreflight"]["latestObservedBuild"], {
            "buildNumber": "7", "marketingVersion": "0.1.0", "processingState": "VALID",
            "uploadedAtUtc": "2026-10-20T04:00:00Z"})
        self.assertFalse(self.runner.receipt["distributionPreflight"]["uploadPermissionVerified"])
        self.assertFalse(self.runner.receipt["distributionPreflight"]["buildNumberReserved"])
        self.assertFalse(self.runner.receipt["uploadAccepted"])
        self.assertEqual(self.runner.receipt["appleProcessing"], "NOT_STARTED")
        public = json.dumps(self.runner.receipt)
        for forbidden in (*self.environment.values(), self.private_subject, "DO_NOT_PUBLISH"):
            if forbidden not in ("1234567890",):
                self.assertNotIn(forbidden, public)
        self.assertFalse(any(options.get("public_log") for _, options in self.commands))
        self.assertFalse(any(command[0] in ("xcodebuild", "xcrun", "xcodegen") for command, _ in self.commands))
        self.assertFalse(any(command[:2] == ["security", "list-keychains"] for command, _ in self.commands))
        self.assertEqual(list(self.runner.public.iterdir()), [])

    def test_certificate_guards_reject_expiry_future_validity_wrong_team_and_private_subject(self):
        now = dt.datetime(2026, 10, 22, tzinfo=dt.timezone.utc)
        result = validate_distribution_certificate(self.certificate, now)
        self.assertNotIn(self.private_subject, json.dumps(result))
        for changed in (self.certificate.replace("2030 GMT", "2020 GMT"),
                        self.certificate.replace("notBefore=Oct 20 00:00:00 2026", "notBefore=Oct 20 00:00:00 2027"),
                        self.certificate.replace("OU=X2JZ9N65V2", "OU=OTHERTEAM0"),
                        self.certificate.replace("CN=Apple Distribution:", "CN=Apple Development:"),
                        self.certificate + "    OU=X2JZ9N65V2\n",
                        self.certificate.replace("notAfter=", "private-date=")):
            with self.subTest(changed=changed[:20]), self.assertRaises(Failure):
                validate_distribution_certificate(changed, now)

    def test_preflight_requires_p256_api_key_and_matching_private_distribution_identity(self):
        original = self.fake_run
        for failure in ("curve", "identity", "subject-spoof"):
            def wrong(command, **kwargs):
                if failure == "curve" and "-text_pub" in command:
                    return b"Public-Key: (384 bit)\nASN1 OID: secp384r1\n"
                if failure == "identity" and command[:2] == ["security", "find-identity"]:
                    return b'"Apple Distribution: unrelated identity"'
                if failure == "subject-spoof" and command[:2] == ["security", "find-identity"]:
                    expected = hashlib.sha1(self.profile["DeveloperCertificates"][0]).hexdigest().upper()
                    return ('  1) ' + '0' * 40 + ' "Apple Distribution: ' + expected + '"\n').encode()
                return original(command, **kwargs)
            self.runner.run = Mock(side_effect=wrong)
            with self.subTest(failure=failure), self.assertRaises(Failure):
                self.runner.configure_signing(install_profiles=False)
            with patch("runner.subprocess.run", return_value=SimpleNamespace(returncode=0)):
                self.assertTrue(self.runner.cleanup())
            self.new_runner()

    def test_missing_secrets_and_invalid_api_identifiers_fail_before_any_tool(self):
        changes = [{name: ""} for name in ("NCL01_DISTRIBUTION_P12_BASE64", "NCL01_DISTRIBUTION_P12_PASSWORD",
                   "NCL01_APPSTORE_PROFILE_BASE64", "NCL01_ASC_PRIVATE_KEY_P8")]
        changes += [{"NCL01_ASC_KEY_ID": "unsafe/key"}, {"NCL01_ASC_ISSUER_ID": "invalid-issuer"}]
        for changed in changes:
            with self.subTest(changed=list(changed)), patch.dict(os.environ, changed), self.assertRaises(Failure):
                self.runner.configure_signing(install_profiles=False)
        self.runner.run.assert_not_called()

    def test_metadata_app_group_and_required_variable_mismatches_fail_without_mutation(self):
        for fault in ("app", "bundle", "group-id", "group", "external", "missing-app", "missing-group"):
            def response(route, body=None):
                result = self.api_response(route, body)
                if route.startswith("apps?") and fault == "app":
                    result["data"][0]["id"] = "9999999999"
                if route.startswith("apps?") and fault == "bundle":
                    result["data"][0]["attributes"]["bundleId"] = "com.other.app"
                if route.startswith("betaGroups/") and fault == "group-id":
                    result["data"]["id"] = "other-group"
                if route.startswith("betaGroups/") and fault == "group":
                    result["data"]["relationships"]["app"]["data"]["id"] = "9999999999"
                if route.startswith("betaGroups/") and fault == "external":
                    result["data"]["attributes"]["isInternalGroup"] = False
                return result
            self.runner.api = Mock(side_effect=response)
            changed = {"NCL01_ASC_APP_ID": ""} if fault == "missing-app" else (
                {"NCL01_INTERNAL_GROUP_ID": ""} if fault == "missing-group" else {})
            with self.subTest(fault=fault), patch.dict(os.environ, changed), self.assertRaises(Failure):
                self.runner.preflight()
            self.assertTrue(all(len(call.args) == 1 for call in self.runner.api.call_args_list))
            with patch("runner.subprocess.run", return_value=SimpleNamespace(returncode=0)):
                self.assertTrue(self.runner.cleanup())
            self.new_runner()

    def test_preflight_transport_rejects_every_body_and_other_route_before_authentication(self):
        self.runner.token = Mock(return_value="synthetic-private-token")
        route = "apps?filter%5BbundleId%5D=" + BUNDLE
        with patch("runner.urllib.request.build_opener") as opener:
            for body in ({}, {"data": []}, "DELETE"):
                with self.assertRaisesRegex(Failure, "PREFLIGHT_MUTATION_FORBIDDEN"):
                    self.runner.api(route, body)
            for other in ("apps", "apps?filter%5BbundleId%5D=com.other.app", "https://other.test/apps",
                          "betaGroups/synthetic-internal-group/relationships/builds", "users", route + "#fragment",
                          route + "&filter%5BbundleId%5D=" + BUNDLE):
                with self.subTest(route=other), self.assertRaisesRegex(Failure, "PREFLIGHT_ROUTE_FORBIDDEN"):
                    self.runner.api(other)
            opener.assert_not_called()
        self.runner.token.assert_not_called()

    def test_preflight_disallows_distribution_entrypoints_and_profile_install_before_tools(self):
        for operation in (self.runner.archive, self.runner.export_upload, self.runner.observe_processing,
                          lambda: self.runner.attach_internal_group("synthetic-build"), self.runner.configure_signing):
            with self.assertRaises(Failure):
                operation()
        self.runner.run.assert_not_called()

    def test_preflight_tool_output_stays_private_even_if_a_tool_fails(self):
        with patch("runner.subprocess.run", return_value=SimpleNamespace(returncode=1,
                   stdout=b"synthetic-private-stdout", stderr=b"synthetic-private-stderr")) as process:
            for options in ({"public_log": True}, {"altool_result": True}):
                with self.assertRaisesRegex(Failure, "PREFLIGHT_PRIVATE_TOOL_OUTPUT_REQUIRED"):
                    Runner.run(self.runner, ["openssl", "pkey"], **options)
            with self.assertRaisesRegex(Failure, "PREFLIGHT_TOOL_FORBIDDEN"):
                Runner.run(self.runner, ["xcrun", "altool"])
            process.assert_not_called()
            with self.assertRaisesRegex(Failure, "COMMAND_FAILED_PREFLIGHT"):
                Runner.run(self.runner, ["openssl", "pkey"])
        self.assertNotIn("synthetic-private", json.dumps(self.runner.receipt))
        self.assertEqual(list(self.runner.public.iterdir()), [])
        with patch("runner.subprocess.run", side_effect=subprocess.TimeoutExpired(
                ["openssl", "synthetic-private-argument"], 60, output=b"synthetic-private-output")):
            with self.assertRaisesRegex(Failure, "^COMMAND_TIMED_OUT_PREFLIGHT$"):
                Runner.run(self.runner, ["openssl", "pkey"])

    def test_preflight_transport_makes_explicit_gets_and_rejects_redirects_oversize_and_private_errors(self):
        self.runner.app_id = "1234567890"
        self.runner.token = Mock(return_value="synthetic-private-token")
        response = Mock()
        response.read.return_value = b'{"data": []}'
        opener = Mock()
        opener.open.return_value.__enter__ = Mock(return_value=response)
        opener.open.return_value.__exit__ = Mock(return_value=False)
        routes = ("apps?filter%5BbundleId%5D=" + BUNDLE,
                  "betaGroups/synthetic-internal-group?include=app",
                  "builds?filter%5Bapp%5D=1234567890&sort=-uploadedDate&include=preReleaseVersion&limit=10")
        with patch("runner.urllib.request.build_opener", return_value=opener):
            for route in routes:
                self.runner.api(route)
                request = opener.open.call_args.args[0]
                self.assertEqual(request.get_method(), "GET")
                self.assertIsNone(request.data)
                self.assertTrue(request.full_url.startswith("https://api.appstoreconnect.apple.com/v1/"))
            response.read.return_value = b"x" * 2_000_001
            with self.assertRaisesRegex(Failure, "PREFLIGHT_RESPONSE_TOO_LARGE"):
                self.runner.api(routes[0])
            opener.open.side_effect = urllib.error.HTTPError("https://api.appstoreconnect.apple.com", 403,
                                                            "synthetic-private-error", None, None)
            with self.assertRaisesRegex(Failure, "^ASC_HTTP_403_PREFLIGHT$"):
                self.runner.api(routes[0])
        with self.assertRaisesRegex(Failure, "^PREFLIGHT_REDIRECT_FORBIDDEN$"):
            PreflightNoRedirect().redirect_request(None, None, 302, "private", {}, "https://other.test")

    def test_latest_build_metadata_is_allowlisted_not_a_number_reservation(self):
        self.assertEqual(latest_build_metadata({"data": []}), None)
        result = self.builds()
        self.assertNotIn("DO_NOT_PUBLISH", json.dumps(latest_build_metadata(result)))
        for attribute, value in (("version", "7;private"), ("processingState", "private-state"),
                                 ("uploadedDate", "private-date"), ("uploadedDate", "2026-10-20T04:00:00")):
            changed = self.builds()
            changed["data"][0]["attributes"][attribute] = value
            with self.subTest(attribute=attribute), self.assertRaises(Failure):
                latest_build_metadata(changed)
        with self.assertRaises(Failure):
            latest_build_metadata({"data": self.builds()["data"] * 11})
        with self.assertRaises(Failure):
            latest_build_metadata({"data": self.builds()["data"], "included": []})

    def test_every_signing_setup_failure_still_removes_owned_temp_and_attempts_keychain_cleanup(self):
        for command in (["security", "cms"], ["security", "create-keychain"], ["security", "import"],
                        ["openssl", "pkey"], ["openssl", "x509"]):
            self.command_failure = command
            with self.subTest(command=command), self.assertRaises(Failure):
                self.runner.configure_signing(install_profiles=False)
            had_keychain = self.runner.keychain is not None and self.runner.keychain.exists()
            with patch("runner.subprocess.run", return_value=SimpleNamespace(returncode=0)) as cleanup:
                self.assertTrue(self.runner.cleanup())
                self.assertEqual(cleanup.call_count, 1 if had_keychain else 0)
            self.assertFalse(self.runner.temp.exists())
            self.assertFalse(self.runner.ownership.exists())
            self.new_runner()
        self.command_failure = None

    def test_cleanup_tool_failure_cannot_skip_temp_removal_or_claim_success(self):
        self.runner.configure_signing(install_profiles=False)
        with patch("runner.subprocess.run", side_effect=OSError("synthetic-private-cleanup-error")) as cleanup:
            self.assertFalse(self.runner.cleanup())
        self.assertEqual(cleanup.call_count, 1)
        self.assertFalse(self.runner.temp.exists())
        self.assertTrue(self.runner.ownership.exists())
        self.assertEqual(self.runner.receipt["credentialCleanup"], "FAIL")
        self.assertNotIn("synthetic-private-cleanup-error", json.dumps(self.runner.receipt))

    def test_interrupted_cleanup_attempts_every_owned_resource_even_after_tool_failure(self):
        self.runner.configure_signing(install_profiles=False)
        with patch("runner.subprocess.run", side_effect=OSError("synthetic-private-cleanup-error")) as cleanup:
            with self.assertRaisesRegex(Failure, "^CREDENTIAL_CLEANUP_FAILED$"):
                cleanup_owned()
        self.assertEqual(cleanup.call_count, 1)
        self.assertFalse(self.runner.temp.exists())
        self.assertTrue(self.runner.ownership.exists())

    def test_receipt_write_failure_is_failed_cleanup_after_private_temp_is_removed(self):
        self.runner.configure_signing(install_profiles=False)
        with patch("runner.subprocess.run", return_value=SimpleNamespace(returncode=0)), patch.object(
                self.runner, "save", side_effect=OSError("synthetic-private-write-error")):
            self.assertFalse(self.runner.cleanup())
        self.assertFalse(self.runner.temp.exists())
        self.assertFalse(self.runner.ownership.exists())
        self.assertEqual(self.runner.receipt["credentialCleanup"], "FAIL")
        self.assertNotIn("synthetic-private-write-error", json.dumps(self.runner.receipt))

    def test_preflight_cleanup_timeouts_are_bounded_and_recovery_is_idempotent(self):
        for recovery_first in (False, True):
            self.runner.configure_signing(install_profiles=False)
            with patch("runner.subprocess.run", side_effect=subprocess.TimeoutExpired(
                    ["security", "synthetic-private-argument"], 60)) as cleanup:
                if recovery_first:
                    with self.assertRaisesRegex(Failure, "^CREDENTIAL_CLEANUP_FAILED$"):
                        cleanup_owned()
                else:
                    self.assertFalse(self.runner.cleanup())
                    receipt = json.loads((self.runner.public / "receipt.json").read_text())
                    self.assertEqual(receipt["result"], "FAIL")
                    self.assertEqual(receipt["credentialCleanup"], "FAIL")
                self.assertEqual(cleanup.call_count, 1)
                self.assertEqual(cleanup.call_args.kwargs["timeout"], 60)
                self.assertEqual(cleanup.call_args.args[0][:2], ["security", "delete-keychain"])
            self.assertFalse(self.runner.temp.exists())
            self.assertTrue(self.runner.ownership.exists())
            with patch("runner.subprocess.run") as already_gone, redirect_stdout(io.StringIO()):
                self.assertEqual(cleanup_owned(), 0)
                self.assertEqual(cleanup_owned(), 0)
                already_gone.assert_not_called()
            self.assertFalse(self.runner.ownership.exists())
            self.new_runner()

    def test_preflight_recovery_refuses_search_list_profile_or_unknown_mode_in_ownership(self):
        for changed in ({"mode": "unknown"}, {"restoreKeychainSearchList": True}, {"profiles": ["forbidden"]}):
            owner = json.loads(self.runner.ownership.read_text())
            owner.update(changed)
            self.runner.ownership.write_text(json.dumps(owner))
            with patch("runner.subprocess.run") as command, self.assertRaises(Failure):
                cleanup_owned()
            command.assert_not_called()
            self.assertTrue(self.runner.temp.exists())
            self.runner.save_ownership()

    def test_upload_signing_and_cleanup_preserve_the_existing_search_list_behavior(self):
        with patch("runner.subprocess.run", return_value=SimpleNamespace(returncode=0)):
            self.assertTrue(self.runner.cleanup())
        self.new_runner("upload")
        self.runner.configure_signing(install_profiles=False)
        search_commands = [command for command, _ in self.commands if command[:2] == ["security", "list-keychains"]]
        self.assertEqual(len(search_commands), 2)
        self.assertNotIn("-s", search_commands[0])
        self.assertIn("-s", search_commands[1])
        with patch("runner.subprocess.run", return_value=SimpleNamespace(returncode=0)) as cleanup:
            self.assertTrue(self.runner.cleanup())
            self.assertEqual(cleanup.call_count, 2)
            self.assertEqual(cleanup.call_args_list[0].args[0],
                             ["security", "list-keychains", "-d", "user", "-s", "/synthetic/login.keychain-db"])
            self.assertNotIn("timeout", cleanup.call_args.kwargs)

    def test_late_ownership_failure_is_persisted_as_failure_then_recovers_without_rewriting_receipt(self):
        self.runner.api = Mock(side_effect=self.api_response)
        original_unlink = Path.unlink
        def unlink(path, **kwargs):
            if path == self.runner.ownership:
                raise OSError("synthetic-private-unlink-error")
            return original_unlink(path, **kwargs)
        argv = ["runner.py", "--mode", "preflight", "--candidate", "a" * 40, "--origin", "https://example.test",
                "--version", "0.1.0", "--build", "7"]
        with patch("runner.Runner", return_value=self.runner), patch("runner.sys.argv", argv), patch("runner.sys.platform", "darwin"), patch("runner.Path.unlink", unlink), patch("runner.subprocess.run", return_value=SimpleNamespace(returncode=0)), redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            self.assertEqual(main(), 1)
        receipt_file = self.runner.public / "receipt.json"
        persisted = receipt_file.read_bytes()
        result = json.loads(persisted)
        self.assertEqual(result["result"], "FAIL")
        self.assertEqual(result["credentialCleanup"], "FAIL")
        self.assertIn("OWNERSHIP_CLEANUP_FAILED", result["cleanupErrors"])
        self.assertNotIn("synthetic-private-unlink-error", persisted.decode())
        self.assertFalse(self.runner.temp.exists())
        with patch("runner.subprocess.run") as command, redirect_stdout(io.StringIO()):
            self.assertEqual(cleanup_owned(), 0)
            command.assert_not_called()
        self.assertEqual(receipt_file.read_bytes(), persisted)

    def test_failed_final_receipt_write_removes_stale_success_and_returns_failure(self):
        self.runner.api = Mock(side_effect=self.api_response)
        original_save = self.runner.save
        saves = []
        def save():
            saves.append(True)
            if len(saves) > 1:
                raise OSError("synthetic-private-final-write-error")
            original_save()
        argv = ["runner.py", "--mode", "preflight", "--candidate", "a" * 40, "--origin", "https://example.test",
                "--version", "0.1.0", "--build", "7"]
        output, errors = io.StringIO(), io.StringIO()
        with patch("runner.Runner", return_value=self.runner), patch("runner.sys.argv", argv), patch("runner.sys.platform", "darwin"), patch.object(self.runner, "save", side_effect=save), patch("runner.subprocess.run", return_value=SimpleNamespace(returncode=0)), redirect_stdout(output), redirect_stderr(errors):
            self.assertEqual(main(), 1)
        self.assertEqual(len(saves), 2)
        self.assertFalse((self.runner.public / "receipt.json").exists())
        self.assertFalse(self.runner.temp.exists())
        self.assertFalse(self.runner.ownership.exists())
        self.assertIn("NCL01_FINAL_RECEIPT_WRITE_FAILED", errors.getvalue())
        self.assertNotIn("synthetic-private-final-write-error", output.getvalue() + errors.getvalue())

    def test_wrong_platform_or_candidate_prevents_signing_and_apple_reads(self):
        for platform, source in (("linux", "a" * 40), ("darwin", "b" * 40)):
            fake = Mock()
            fake.receipt = {}
            fake.stage = "PREFLIGHT"
            fake.run.return_value = source.encode()
            fake.cleanup.return_value = True
            argv = ["runner.py", "--mode", "preflight", "--candidate", "a" * 40, "--origin", "https://example.test",
                    "--version", "0.1.0", "--build", "7"]
            with patch("runner.Runner", return_value=fake), patch("runner.sys.argv", argv), patch("runner.sys.platform", platform), redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                self.assertEqual(main(), 1)
            fake.preflight.assert_not_called()
            fake.configure_signing.assert_not_called()
            fake.api.assert_not_called()
            fake.cleanup.assert_called_once_with()

    def test_main_dispatches_only_preflight_and_always_cleans_without_exposing_unexpected_errors(self):
        for failure in ("none", "execution", "cleanup"):
            fake = Mock()
            fake.receipt = {}
            fake.stage = "SYNTHETIC_PREFLIGHT"
            fake.run.return_value = ("a" * 40).encode()
            fake.preflight.side_effect = RuntimeError("synthetic-private-main-error") if failure == "execution" else None
            fake.cleanup.return_value = True
            fake.cleanup.side_effect = RuntimeError("synthetic-private-main-error") if failure == "cleanup" else None
            argv = ["runner.py", "--mode", "preflight", "--candidate", "a" * 40, "--origin", "https://example.test",
                    "--version", "0.1.0", "--build", "7"]
            output, errors = io.StringIO(), io.StringIO()
            with patch("runner.Runner", return_value=fake), patch("runner.sys.argv", argv), patch("runner.sys.platform", "darwin"), redirect_stdout(output), redirect_stderr(errors):
                self.assertEqual(main(), 0 if failure == "none" else 1)
            fake.preflight.assert_called_once_with()
            fake.cleanup.assert_called_once_with()
            for forbidden in (fake.archive, fake.export_upload, fake.observe_processing, fake.attach_internal_group):
                forbidden.assert_not_called()
            self.assertNotIn("synthetic-private-main-error", output.getvalue() + errors.getvalue())


if __name__ == "__main__":
    unittest.main()
