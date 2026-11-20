import errno
import hashlib
import os
from datetime import datetime, timezone
import unittest

import jammy_preflight_preparation as prep
from unittest.mock import Mock, patch



class RuntimePreparationTest(unittest.TestCase):
    def prepare(self, verify_receipt, collect):
        body = b"selected payload"
        plan = {"inventory": {"manifestSha256": "a" * 64, "run": 42904385774}, "members": {
            "loader": {"target": "/lib/loader", "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest()}
        }, "interpreter": {"target": "/lib64/loader", "member": "loader"}}
        provider_run = Mock()
        with (patch.object(prep, "authenticate_jammy_preflight_run", return_value=provider_run),
              patch.object(prep, "verify_runner"),
              patch.object(prep, "load_plan", return_value=plan),
              patch.object(prep, "verify_inventory", side_effect=verify_receipt),
              patch.object(prep, "read_inventory_inputs", return_value=({}, b"verifier")),
              patch.object(prep, "collect_inventory", side_effect=collect)):
            return prep.prepare_runtime_inputs(123, {"workflowId": 414024776, "tree": "b" * 40,
                                                    "workflowSha256": "c" * 64},
                                               "token", b"original receipt", "pinned-image")

    def test_provider_os_error_is_classified_before_acquisition(self):
        original = ConnectionResetError(errno.ECONNRESET, "internal socket detail")
        with (patch.object(prep, "authenticate_jammy_preflight_run", side_effect=original),
              patch.object(prep, "collect_inventory") as collect):
            with self.assertRaisesRegex(ValueError, f"^JAMMY_PREPARATION_PROVIDER_{errno.errorcode[original.errno]}$") as failure:
                prep.prepare_runtime_inputs(123, {}, "token", b"receipt", "image")
        self.assertIs(failure.exception.__cause__, original)
        collect.assert_not_called()

    def test_inventory_os_error_remains_distinct_from_provider_error(self):
        original = PermissionError(errno.EACCES, "private local path")
        with self.assertRaisesRegex(ValueError, "^JAMMY_PREPARATION_INVENTORY_EACCES$") as failure:
            self.prepare(lambda *_, **_options: {}, Mock(side_effect=original))
        self.assertIs(failure.exception.__cause__, original)

    def test_invalid_receipt_refuses_before_acquisition(self):
        collect = Mock()
        with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_RECEIPT_PIN"):
            self.prepare(ValueError("RUNTIME_INPUT_RECEIPT_PIN"), collect)
        collect.assert_not_called()

    def test_authenticates_exact_member_bytes_before_handoff(self):
        members = {"loader": {"bytes": 16}}
        collect = lambda *_, **_options: ({"ownedScratchRemoved": True, "members": members}, {"loader": b"selected payload"})
        result = self.prepare(lambda *_, **_options: members, collect)
        self.assertEqual(result.members, {"loader": b"selected payload"})
        self.assertEqual(result.receipt, b"original receipt")
        with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_PAYLOAD_PIN"):
            self.prepare(lambda *_, **_options: members,
                         lambda *_, **_options: ({"ownedScratchRemoved": True, "members": members},
                                     {"loader": b"tampered payload"}))

    def test_rejects_reacquired_inventory_metadata_drift(self):
        with self.assertRaisesRegex(ValueError, "JAMMY_PREPARATION_INVENTORY_DRIFT"):
            self.prepare(lambda *_, **_options: {"loader": {"soname": "original"}},
                         lambda *_, **_options: ({"ownedScratchRemoved": True, "members": {}}, {}))

    def test_archive_replay_uses_original_inventory_time(self):
        expected = {"loader": {"bytes": 16}}
        collect = Mock(return_value=({"ownedScratchRemoved": True, "members": expected},
                                     {"loader": b"selected payload"}))
        self.prepare(lambda *_, **_options: expected, collect)
        collect.assert_called_once_with({}, b"verifier",
                                       snapshot_attested_at=datetime(2026, 11, 10, 21, 22, 19, tzinfo=timezone.utc))

    def test_reads_the_installed_manifest_and_verifier_at_their_exact_pins(self):
        from jammy_native_inventory import VERIFIER_SHA256
        from jammy_native_runtime_inputs import load_plan

        manifest, verifier = prep.read_inventory_inputs(load_plan()["inventory"]["manifestSha256"])
        self.assertEqual(manifest["kind"], "SOUNDING_LINE_JAMMY_STATIC_NATIVE_INVENTORY_V1")
        self.assertEqual(hashlib.sha256(verifier).hexdigest(), VERIFIER_SHA256)

    def test_dormant_wrapper_refuses_before_preparation_or_writes(self):
        evidence = Mock()
        with (patch.object(prep.worker, "NATIVE_ENABLED", False),
              patch.object(prep, "prepare_runtime_inputs") as prepare):
            with self.assertRaisesRegex(ValueError, "LAUNCH_ACTION_NOT_AUTHORIZED"):
                prep.run_published_preflight(123, {}, "token", b"inventory", 7, evidence)
        prepare.assert_not_called()
        evidence.write.assert_not_called()

    def test_controller_starts_only_after_custody_digest_is_written_and_flushed(self):
        from pathlib import Path

        receipt = b"original"
        prepared = Mock(receipt=receipt, members={"loader": b"bytes"})
        prepared.run.source = "a" * 40
        scope = Mock()
        digest = "b" * 64
        events = []
        evidence = Mock()
        evidence.write.side_effect = lambda data: events.append(data) or len(data)
        evidence.flush.side_effect = lambda: events.append("flushed")
        controller = Mock(side_effect=lambda *args, **kwargs: events.append("controller") or {"diagnostic": True})
        env = {"RUNNER_TRACKING_ID": "tracking", "RUNNER_TEMP": str(Path.cwd()), "ImageVersion": "image"}
        with (patch.object(prep.worker, "NATIVE_ENABLED", True),
              patch.dict(os.environ, env, clear=True),
              patch.object(prep, "prepare_runtime_inputs", return_value=prepared),
              patch.object(prep, "provision_preflight_scope", return_value=(scope, digest)),
              patch.object(prep.worker, "controller", controller)):
            self.assertEqual(prep.run_published_preflight(123, {}, "token", receipt, 7, evidence), {"diagnostic": True})
            controller.assert_called_once_with(scope, prepared.run.source, receipt, prepared.members,
                                               "tracking", "image", Path.cwd(), authorized_run=prepared.run)
            self.assertEqual(events, [f"jammyPreflightCustodySha256={digest}\n", "flushed", "controller"])
            controller.reset_mock()
            evidence.flush.side_effect = OSError("provider evidence write failed")
            with self.assertRaises(OSError):
                prep.run_published_preflight(123, {}, "token", receipt, 7, evidence)
            controller.assert_not_called()
