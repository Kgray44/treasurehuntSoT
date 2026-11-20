import base64
import io
import json
import os
import unittest
from contextlib import ExitStack
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

import jammy_preflight_entry as entry
from jammy_preflight_supervisor import PreflightFailure


class PreflightEntryTest(unittest.TestCase):
    def approval(self):
        return {
            "publication": {"workflowId": 414024776, "source": "a" * 40, "tree": "b" * 40,
                            "workflowSha256": "c" * 64},
            "dispatch": {"workflowId": 414024776, "source": "a" * 40, "runId": 123, "attempt": 1,
                         "repository": "Kgray44/treasurehuntSoT", "ref": "refs/heads/main",
                         "operation": "confined-loader-and-denials-only"},
            "inventoryReceipt": base64.b64encode(b"original inventory receipt").decode("ascii"),
        }

    def test_dispatch_must_bind_the_current_attempt_and_approved_source(self):
        approval = self.approval()
        with patch.dict(os.environ, {"GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "1",
                                     "GITHUB_SHA": "a" * 40, "GITHUB_REF": "refs/heads/main",
                                     "GITHUB_REPOSITORY": "Kgray44/treasurehuntSoT",
                                     "GITHUB_EVENT_NAME": "workflow_dispatch"}, clear=True):
            self.assertEqual(entry.validate_approval(approval), (123, approval["publication"]))
            for field, value in (("attempt", 2), ("runId", 124), ("source", "d" * 40)):
                with self.subTest(field=field):
                    approval = self.approval()
                    approval["dispatch"][field] = value
                    with self.assertRaisesRegex(ValueError, "JAMMY_ENTRY_DISPATCH"):
                        entry.validate_approval(approval)

    def test_disabled_launch_refuses_before_ingress_or_token_reads(self):
        with patch.object(entry, "read_approval") as read:
            with self.assertRaisesRegex(ValueError, "LAUNCH_ACTION_NOT_AUTHORIZED"):
                entry.run("launch", "/unused", io.BytesIO(), io.StringIO())
        read.assert_not_called()

    def test_failure_receipt_keeps_primary_and_both_cleanup_stages(self):
        error = PreflightFailure(ValueError("LAUNCH_WORKER_READY"),
                                 [("passive_recovery", ValueError("LAUNCH_RECOVERY_UNVERIFIED")),
                                  ("watchdog_retirement", OSError("secret detail"))])
        record = entry.failure_record(error)
        self.assertEqual(record["primary"], "LAUNCH_WORKER_READY")
        self.assertEqual(record["cleanup"], [
            {"stage": "passive_recovery", "code": "LAUNCH_RECOVERY_UNVERIFIED"},
            {"stage": "watchdog_retirement", "code": "JAMMY_ENTRY_OS_ERROR"},
        ])
        self.assertNotIn("secret detail", json.dumps(record))

    def test_recovery_forwards_the_separately_retained_digest(self):
        approval = self.approval()
        del approval["inventoryReceipt"]
        digest = "e" * 64
        approval["custodyReceiptSha256"] = digest
        environment = {"GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "1", "GITHUB_SHA": "a" * 40,
                       "GITHUB_REF": "refs/heads/main", "GITHUB_REPOSITORY": "Kgray44/treasurehuntSoT",
                       "GITHUB_EVENT_NAME": "workflow_dispatch", "JAMMY_PREFLIGHT_TOKEN": "fixture-token"}
        with ExitStack() as stack:
            stack.enter_context(patch.object(entry.sys, "platform", "linux"))
            for index, name in enumerate(("O_DIRECTORY", "O_NOFOLLOW", "O_CLOEXEC"), 20):
                stack.enter_context(patch.object(os, name, 1 << index, create=True))
            stack.enter_context(patch.dict(os.environ, environment, clear=True))
            directory = str(Path.cwd())
            opened = stack.enter_context(patch.object(os, "open", return_value=7))
            close = stack.enter_context(patch.object(os, "close"))

            def recover(*args):
                self.assertNotIn("JAMMY_PREFLIGHT_TOKEN", os.environ)
                return True

            recovered = stack.enter_context(patch.object(entry, "recover_preflight_scope", side_effect=recover))
            result = entry.run("recover", directory, io.BytesIO(json.dumps(approval).encode()), io.StringIO())
        recovered.assert_called_once_with(123, approval["publication"], "fixture-token", 7, digest)
        self.assertTrue(opened.call_args.args[1] & (1 << 21))
        close.assert_called_once_with(7)
        self.assertTrue(result["cleanupVerified"])
        self.assertFalse(result["qualification"])

    def test_ingress_rejects_duplicate_approval_keys(self):
        data = b'{"publication":{},"publication":{},"dispatch":{},"inventoryReceipt":"YQ=="}'
        with self.assertRaisesRegex(ValueError, "JAMMY_ENTRY_APPROVAL_DUPLICATE"):
            entry.read_approval(io.BytesIO(data), "launch")

    def test_real_command_remains_dormant_in_isolated_python(self):
        script = Path(entry.__file__).resolve()
        result = subprocess.run([sys.executable, "-IB", str(script), "launch", "unused"],
                                input=b"invalid JSON", capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stderr, b"")
        self.assertEqual(json.loads(result.stdout)["primary"], "LAUNCH_ACTION_NOT_AUTHORIZED")

    def test_nested_controller_failure_keeps_inner_primary_and_cleanup(self):
        inner = PreflightFailure(ValueError("PREFLIGHT_COMMAND_TIMEOUT"),
                                 [("trusted_command_reap", OSError("private"))])
        outer = PreflightFailure(inner, [("passive_recovery", ValueError("LAUNCH_RECOVERY_UNVERIFIED"))])
        self.assertEqual(entry.failure_record(outer)["primary"], "PREFLIGHT_COMMAND_TIMEOUT")
        self.assertEqual([item["stage"] for item in entry.failure_record(outer)["cleanup"]],
                         ["trusted_command_reap", "passive_recovery"])
