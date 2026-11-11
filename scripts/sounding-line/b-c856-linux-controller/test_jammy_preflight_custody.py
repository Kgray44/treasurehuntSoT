import os
import sys
import unittest
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import Mock, patch

import jammy_preflight_custody as custody
import jammy_preflight_launcher as launcher
from jammy_preflight_supervisor import Scope
from test_jammy_preflight_launcher import LEASE, RUN, SCOPE

BOUND = Scope(RUN, SCOPE.nonce, custody=custody.CustodyBinding((10, 1), (10, 2)))
OWNERS = {"boot": "recorded-boot", "owners": [[51, 100], [52, 200]]}


class FixtureJournal(custody.Journal):
    def __init__(self):
        super().__init__(BOUND, 8)
        self.records = {}
        self.current_scratch = None

    def read(self, phase):
        return self.records.get(phase)

    def write(self, phase, value):
        if phase in self.records:
            raise AssertionError("overwrote phase")
        self.records[phase] = value

    def scratch_identity(self):
        return self.current_scratch


class CustodyTest(unittest.TestCase):
    def setUp(self):
        self.journal = FixtureJournal()

    def empty_recovery(self, entries=()):
        with (patch.object(os, "O_DIRECTORY", 1 << 20, create=True),
              patch.object(os, "O_NOFOLLOW", 1 << 21, create=True),
              patch.object(os, "O_CLOEXEC", 1 << 22, create=True),
              patch.object(os, "open", return_value=9),
              patch.object(os, "fstat", return_value=SimpleNamespace(st_dev=10, st_ino=20)),
              patch.object(os, "listdir", return_value=list(entries)),
              patch.object(os, "rmdir") as remove, patch.object(os, "fsync"), patch.object(os, "close")):
            try:
                self.journal.recover_empty()
            finally:
                self.removals = remove.call_args_list

    def test_preexisting_scratch_cannot_be_reserved(self):
        self.journal.current_scratch = LEASE.scratch
        with self.assertRaisesRegex(ValueError, "LAUNCH_CUSTODY_ALREADY_RESERVED"):
            self.journal.reserve(OWNERS)
        self.assertEqual(self.journal.records, {})

    def test_contended_lock_exposes_no_journal_to_recovery(self):
        lock = Mock(LOCK_EX=1, LOCK_NB=2)
        lock.flock.side_effect = BlockingIOError()
        base = SimpleNamespace(st_dev=10, st_ino=1, st_uid=1001, st_mode=0o40700)
        file = SimpleNamespace(st_dev=10, st_ino=2, st_uid=1001, st_mode=0o100600,
                               st_nlink=1, st_size=0)
        with (patch.dict(sys.modules, {"fcntl": lock}),
              patch.object(type(BOUND.scratch), "resolve", lambda path, strict: path),
              patch.object(os, "O_DIRECTORY", 1 << 20, create=True),
              patch.object(os, "O_NOFOLLOW", 1 << 21, create=True),
              patch.object(os, "O_CLOEXEC", 1 << 22, create=True),
              patch.object(os, "O_NONBLOCK", 1 << 23, create=True),
              patch.object(os, "geteuid", return_value=1001, create=True),
              patch.object(os, "open", side_effect=[8, 9]),
              patch.object(os, "fstat", side_effect=[base, file]),
              patch.object(os, "close") as close):
            with self.assertRaisesRegex(ValueError, "LAUNCH_CUSTODY_LOCK_BUSY"):
                with custody.custody(BOUND):
                    self.fail("contended custody yielded a journal")
        self.assertEqual([call.args for call in close.call_args_list], [(9,), (8,)])

    def test_record_is_fsynced_before_no_replace_publication(self):
        journal = custody.Journal(BOUND, 8)
        events = []
        info = SimpleNamespace(st_dev=10, st_ino=12)
        with (patch.object(journal, "read", return_value=None),
              patch.object(os, "O_NOFOLLOW", 1 << 21, create=True),
              patch.object(os, "O_CLOEXEC", 1 << 22, create=True),
              patch.object(os, "open", return_value=9),
              patch.object(os, "write", side_effect=lambda fd, data: len(data)),
              patch.object(os, "fsync", side_effect=lambda fd: events.append(("fsync", fd))),
              patch.object(os, "link", side_effect=lambda *a, **kw: events.append(("link", a))),
              patch.object(os, "stat", return_value=info), patch.object(os, "fstat", return_value=info),
              patch.object(os, "unlink", side_effect=lambda *a, **kw: events.append(("unlink", a))),
              patch.object(os, "close")):
            journal.write("reserved", OWNERS)
        self.assertEqual(events, [("fsync", 9), ("link", ("reserved.pending", "reserved")),
                                  ("fsync", 8), ("unlink", ("reserved.pending",)), ("fsync", 8)])

    def test_process_loss_after_mkdir_before_binding_recovers_only_empty_scratch(self):
        self.journal.reserve(OWNERS)
        self.journal.current_scratch = LEASE.scratch
        self.empty_recovery()
        self.assertEqual(len(self.removals), 1)
        self.assertEqual(self.journal.records["retired"], {"admitted": False})
        with self.assertRaisesRegex(ValueError, "LAUNCH_CUSTODY_ADMIT_PHASE"):
            self.journal.admit(LEASE.scratch, launcher.lease_record(LEASE))

    def test_bound_replacement_and_nonempty_scratch_are_preserved(self):
        self.journal.reserve(OWNERS)
        self.journal.current_scratch = LEASE.scratch
        self.journal.bind(LEASE.scratch)
        self.journal.current_scratch = (10, 99)
        with self.assertRaisesRegex(ValueError, "LAUNCH_CUSTODY_SCRATCH_REPLACED"):
            self.empty_recovery()
        self.assertEqual(self.removals, [])
        self.journal.current_scratch = LEASE.scratch
        with self.assertRaisesRegex(ValueError, "LAUNCH_CUSTODY_SCRATCH_AMBIGUOUS"):
            self.empty_recovery(("unclassified",))
        self.assertEqual(self.removals, [])
        self.assertNotIn("retired", self.journal.records)

    def test_admission_record_is_committed_before_publish_under_the_same_lock(self):
        self.journal.reserve(OWNERS)
        self.journal.current_scratch = LEASE.scratch
        self.journal.bind(LEASE.scratch)
        events = []

        @contextmanager
        def locked(scope):
            events.append("lock")
            yield self.journal
            events.append("unlock")

        def publish(*args):
            self.assertEqual(self.journal.records["admitted"], launcher.lease_record(LEASE))
            with self.assertRaisesRegex(ValueError, "LAUNCH_CUSTODY_RECOVERY_PHASE"):
                self.journal.recover_empty()
            events.append("publish")

        watchdog = Mock()
        with (patch.object(launcher, "custody", locked), patch.object(launcher, "publish_fragment", publish),
              patch.object(launcher, "start_owned_unit", side_effect=lambda *args, **kwargs: events.append("start"))):
            launcher.admit_owned_unit(BOUND, LEASE, watchdog)
        self.assertEqual(events, ["lock", "publish", "start", "unlock"])

    def test_independent_recovery_requires_both_original_processes_to_be_gone(self):
        with (patch.object(custody, "boot_id", return_value="recorded-boot"),
              patch.object(custody, "process_identity", side_effect=[None, ("S", 200)])):
            with self.assertRaisesRegex(ValueError, "LAUNCH_CUSTODY_ORIGINAL_PROCESSES_LIVE"):
                custody.verify_owners_gone(OWNERS)
        with (patch.object(custody, "boot_id", return_value="recorded-boot"),
              patch.object(custody, "process_identity", side_effect=[("S", 101), ("Z", 200)])):
            custody.verify_owners_gone(OWNERS)
        with patch.object(custody, "boot_id", return_value="different-boot"):
            with self.assertRaisesRegex(ValueError, "LAUNCH_CUSTODY_OWNER_RECORD"):
                custody.verify_owners_gone(OWNERS)

    def test_independent_recovery_replays_admitted_lease_after_original_owners_exit(self):
        self.journal.reserve(OWNERS)
        self.journal.current_scratch = LEASE.scratch
        self.journal.bind(LEASE.scratch)
        self.journal.admit(LEASE.scratch, launcher.lease_record(LEASE))

        @contextmanager
        def locked(scope):
            yield self.journal

        def cleanup(*args, **kwargs):
            self.journal.current_scratch = None
            return True

        with (patch.object(launcher, "custody", locked), patch.object(launcher, "verify_owners_gone") as gone,
              patch.object(launcher, "recover_bound", side_effect=cleanup) as recover,
              patch.object(launcher, "absent", return_value=True)):
            self.assertTrue(launcher.recover_after_cancellation(BOUND))
            self.assertTrue(launcher.recover_after_cancellation(BOUND))
            gone.assert_called_with(OWNERS)
            recover.assert_called_once_with(BOUND, LEASE)
        self.assertEqual(self.journal.records["retired"], {"admitted": True})


if __name__ == "__main__":
    unittest.main()
