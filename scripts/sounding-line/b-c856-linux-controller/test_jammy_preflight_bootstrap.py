from contextlib import ExitStack
import hashlib
import io
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import jammy_preflight_custody as custody
import jammy_preflight_preparation as preparation
from jammy_preflight_supervisor import Run

NONCE = "a" * 32
RUN = 123


class CustodyBootstrapTest(unittest.TestCase):
    def setUp(self):
        self.root = SimpleNamespace(st_dev=10, st_ino=1, st_uid=1001, st_mode=0o40700)
        self.base = SimpleNamespace(st_dev=10, st_ino=2, st_uid=1001, st_mode=0o40700)
        self.lock = SimpleNamespace(st_dev=10, st_ino=3, st_uid=1001, st_mode=0o100600,
                                    st_size=0, st_nlink=1)
        stack = ExitStack()
        self.addCleanup(stack.close)
        for index, name in enumerate(("O_DIRECTORY", "O_CLOEXEC", "O_NOFOLLOW", "O_NONBLOCK"), 20):
            stack.enter_context(patch.object(os, name, 1 << index, create=True))
        for name in ("getuid", "geteuid"):
            stack.enter_context(patch.object(os, name, return_value=1001, create=True))
        stack.enter_context(patch.object(type(custody.base_path(RUN, NONCE)), "resolve", lambda path, strict: path))
        self.opened = stack.enter_context(patch.object(os, "open", side_effect=(7, 8, 9)))
        self.mkdir = stack.enter_context(patch.object(os, "mkdir"))
        self.fstat = stack.enter_context(patch.object(os, "fstat", side_effect=(self.root, self.base, self.lock)))
        real_stat = os.stat
        self.readback = iter((self.root, self.base, self.lock))

        def stat_fixture(path, *args, **kwargs):
            if kwargs.get("dir_fd") is not None or path == custody.base_path(RUN, NONCE).parent:
                return next(self.readback)
            return real_stat(path, *args, **kwargs)

        stack.enter_context(patch.object(os, "stat", side_effect=stat_fixture))
        self.sync = stack.enter_context(patch.object(os, "fsync"))
        self.close = stack.enter_context(patch.object(os, "close"))
        self.unlink = stack.enter_context(patch.object(os, "unlink"))
        self.rmdir = stack.enter_context(patch.object(os, "rmdir"))

    def test_binds_exclusive_private_directory_and_lock(self):
        binding = custody.provision_binding(RUN, NONCE)
        self.assertEqual(binding, custody.CustodyBinding((10, 2), (10, 3)))
        self.mkdir.assert_called_once_with(custody.base_path(RUN, NONCE).name, 0o700, dir_fd=7)
        lock = self.opened.call_args_list[-1]
        self.assertEqual(lock.args[0], custody.LOCK)
        self.assertTrue(lock.args[1] & os.O_EXCL)
        self.assertEqual(lock.args[2], 0o600)
        self.assertEqual(lock.kwargs["dir_fd"], 8)
        self.assertEqual([call.args[0] for call in self.sync.call_args_list], [9, 8, 7])
        self.assertEqual([call.args[0] for call in self.close.call_args_list], [9, 8, 7])

    def test_collision_preserves_existing_custody(self):
        self.mkdir.side_effect = FileExistsError()
        with self.assertRaisesRegex(ValueError, "LAUNCH_CUSTODY_BOOTSTRAP_COLLISION"):
            custody.provision_binding(RUN, NONCE)
        self.assertEqual(self.opened.call_count, 1)
        self.close.assert_called_once_with(7)
        self.unlink.assert_not_called()
        self.rmdir.assert_not_called()

    def test_replaced_lock_refuses_and_retains_directory(self):
        replacement = SimpleNamespace(st_dev=10, st_ino=9)
        self.readback = iter((self.root, self.base, replacement))
        with self.assertRaisesRegex(ValueError, "LAUNCH_CUSTODY_BOOTSTRAP_IDENTITY"):
            custody.provision_binding(RUN, NONCE)
        self.unlink.assert_not_called()
        self.rmdir.assert_not_called()

class CustodyReceiptTest(unittest.TestCase):
    def setUp(self):
        self.run = Run("a" * 40, "a" * 40, RUN, 1, "Kgray44", "Kgray44", "Kgray44/treasurehuntSoT",
                       "refs/heads/main", "workflow_dispatch", "confined-loader-and-denials-only")
        self.binding = custody.CustodyBinding((10, 2), (10, 3))
        self.approval = {"workflowId": 414024776, "source": self.run.source, "tree": "b" * 40,
                         "workflowSha256": "c" * 64}
        self.prepared = preparation.PreparedRuntimeInputs(
            self.run, b"inventory", {}, self.approval["workflowId"], self.approval["tree"], self.approval["workflowSha256"])
        stack = ExitStack()
        self.addCleanup(stack.close)
        for index, name in enumerate(("O_NOFOLLOW", "O_CLOEXEC", "O_NONBLOCK"), 20):
            stack.enter_context(patch.object(os, name, 1 << index, create=True))
        stack.enter_context(patch.object(preparation.secrets, "token_hex", return_value=NONCE))
        stack.enter_context(patch.object(preparation, "boot_id", return_value="recorded-boot"))
        stack.enter_context(patch.object(preparation, "capture_owner", return_value=[51, 100]))
        root = SimpleNamespace(st_dev=10, st_ino=1, st_uid=1001, st_mode=0o40700)
        self.file = SimpleNamespace(st_dev=10, st_ino=2, st_uid=1001, st_mode=0o100600, st_nlink=1)
        self.file.st_size = 0
        self.provision = stack.enter_context(patch.object(preparation, "provision_binding", return_value=self.binding))
        self.opened = stack.enter_context(patch.object(os, "open", return_value=9))
        self.fstat = stack.enter_context(patch.object(os, "fstat", side_effect=lambda fd: root if fd == 7 else self.file))
        real_stat = os.stat
        stack.enter_context(patch.object(os, "stat", side_effect=lambda path, *args, **kw:
                                         self.file if kw.get("dir_fd") == 7 else real_stat(path, *args, **kw)))
        self.close = stack.enter_context(patch.object(os, "close"))
        self.events = []
        self.writes = []
        stack.enter_context(patch.object(os, "write", side_effect=self.record))
        stack.enter_context(patch.object(os, "fsync", side_effect=lambda fd: self.events.append(("fsync", fd))))

    def record(self, fd, data):
        self.events.append(("write", fd))
        self.raw = data
        self.writes.append(data)
        self.file.st_size = len(data)
        return len(data)

    def test_persists_exact_publication_and_binding_before_returning_scope(self):
        scope, digest = preparation.provision_preflight_scope(self.prepared, 7, io.StringIO())
        self.assertEqual(digest, hashlib.sha256(self.raw).hexdigest())
        proof = json.loads(self.raw)
        self.assertEqual(scope.custody, self.binding)
        self.assertEqual(proof["workflowSha256"], self.approval["workflowSha256"])
        self.assertEqual(proof["unit"], scope.run.unit)
        self.assertEqual(proof["boot"], "recorded-boot")
        self.assertEqual(proof["inventoryReceiptSha256"], hashlib.sha256(b"inventory").hexdigest())
        self.assertEqual(self.events, [("write", 9), ("fsync", 9), ("fsync", 7)] * 2)
        self.assertTrue(self.opened.call_args.args[1] & os.O_EXCL)
        self.assertEqual([call.args for call in self.close.call_args_list], [(9,), (9,)])

    def test_intent_evidence_failure_prevents_private_runtime_creation(self):
        evidence = Mock()
        evidence.write.side_effect = lambda line: len(line)
        evidence.flush.side_effect = OSError("runner output unavailable")
        with self.assertRaises(OSError):
            preparation.provision_preflight_scope(self.prepared, 7, evidence)
        self.provision.assert_not_called()

    def test_existing_receipt_refuses_before_private_custody_is_created(self):
        self.opened.side_effect = FileExistsError()
        with self.assertRaisesRegex(ValueError, "JAMMY_PREPARATION_CUSTODY_COLLISION"):
            preparation.provision_preflight_scope(self.prepared, 7, io.StringIO())
        self.provision.assert_not_called()

    def recover(self, digest):
        class Receipt(io.BytesIO):
            def fileno(self):
                return 9

        inventory = {"receiptSha256": hashlib.sha256(b"inventory").hexdigest()}
        with (patch.object(preparation, "authenticate_jammy_preflight_run", return_value=self.run),
              patch.object(os, "fdopen", return_value=Receipt(self.raw)),
              patch.object(preparation, "load_plan", return_value={"inventory": inventory}),
              patch.object(preparation, "recover_after_cancellation", return_value=True) as recovery):
            try:
                return preparation.recover_preflight_scope(RUN, self.approval, "token", 7, digest)
            finally:
                self.recovery = recovery

    def test_independent_recovery_reopens_exact_prior_scope(self):
        scope, digest = preparation.provision_preflight_scope(self.prepared, 7, io.StringIO())
        self.assertTrue(self.recover(digest))
        self.recovery.assert_called_once_with(scope, bootstrap_owner=[51, 100])

    def test_changed_boot_or_substituted_receipt_never_attempt_cleanup(self):
        _, digest = preparation.provision_preflight_scope(self.prepared, 7, io.StringIO())
        with self.assertRaisesRegex(ValueError, "JAMMY_PREPARATION_CUSTODY_DIGEST"):
            self.recover("0" * 64)
        self.recovery.assert_not_called()
        with (patch.object(preparation, "boot_id", return_value="different-boot"),
              self.assertRaisesRegex(ValueError, "JAMMY_PREPARATION_CUSTODY_RECEIPT")):
            self.recover(digest)
        self.recovery.assert_not_called()

    def reconcile_intent(self, raw, digest, absent=None):
        inventory = {"receiptSha256": hashlib.sha256(b"inventory").hexdigest()}
        with (patch.object(preparation, "authenticate_jammy_preflight_run", return_value=self.run),
              patch.object(preparation, "read_custody_receipt", return_value=raw),
              patch.object(preparation, "load_plan", return_value={"inventory": inventory}),
              patch.object(preparation, "verify_owner_gone") as gone,
              patch.object(preparation, "require_absent_intent_base", side_effect=absent) as check):
            try:
                return preparation.reconcile_preflight_intent(RUN, self.approval, "token", 7, digest)
            finally:
                self.owner_check = gone
                self.absence_check = check

    def test_reconciles_only_the_exact_empty_final_receipt_and_absent_base(self):
        target = io.StringIO()
        self.provision.side_effect = OSError("interrupted before private custody")
        with self.assertRaises(OSError):
            preparation.provision_preflight_scope(self.prepared, 7, target)
        raw = self.writes[0]
        digest = hashlib.sha256(raw).hexdigest()
        self.assertEqual(target.getvalue(), f"jammyPreflightIntentSha256={digest}\n")
        self.file.st_size = 0
        self.assertTrue(self.reconcile_intent(raw, digest))
        self.owner_check.assert_called_once_with([51, 100])
        self.absence_check.assert_called_once_with(self.run, NONCE)
        self.file.st_ino += 1
        with self.assertRaisesRegex(ValueError, "JAMMY_PREPARATION_INTENT_HELD"):
            self.reconcile_intent(raw, digest)
        self.absence_check.assert_not_called()

    def test_intent_does_not_reconcile_a_substituted_receipt_or_a_present_base(self):
        with self.assertRaisesRegex(ValueError, "JAMMY_PREPARATION_INTENT_DIGEST"):
            self.reconcile_intent(b"substituted", "0" * 64)
        self.owner_check.assert_not_called()
        self.provision.side_effect = OSError("partial bootstrap")
        with self.assertRaises(OSError):
            preparation.provision_preflight_scope(self.prepared, 7, io.StringIO())
        raw = self.writes[0]
        self.file.st_size = 0
        with self.assertRaisesRegex(ValueError, "JAMMY_PREPARATION_INTENT_HELD"):
            self.reconcile_intent(raw, hashlib.sha256(raw).hexdigest(),
                                  ValueError("JAMMY_PREPARATION_INTENT_HELD"))
