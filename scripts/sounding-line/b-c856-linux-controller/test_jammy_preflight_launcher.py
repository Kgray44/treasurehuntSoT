import errno
import os
import stat
import unittest
from contextlib import ExitStack
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import jammy_preflight_launcher as launch
from jammy_preflight_supervisor import Run, Scope

SOURCE = "0f5ec2311999324d933ad334c8d9b794b2ad51ec"
RUN = Run(SOURCE, SOURCE, 321, 1, "Kgray44", "Kgray44", "Kgray44/treasurehuntSoT",
          "refs/heads/main", "workflow_dispatch", "confined-loader-and-denials-only")
SCOPE = Scope(RUN, "a" * 32)
LEASE = launch.RecoveryLease(SOURCE, 321, 1, SCOPE.nonce, (10, 20), (10, 21), (10, 22), (10, 23), "b" * 64)


class RecoveryTest(unittest.TestCase):
    def setUp(self):
        self.clock = Mock(return_value=0)
        self.sleep = Mock()
        self.quiescent = Mock(return_value=True)
        self.mounts = Mock(return_value=True)
        self.fragment = Mock(return_value=True)
        self.scratch = Mock(return_value=True)

    def recover(self, lease=LEASE):
        return launch.recover(SCOPE, lease, clock=self.clock, sleep=self.sleep, quiescent=self.quiescent,
                              mounts_gone=self.mounts, remove_fragment=self.fragment,
                              remove_scratch=self.scratch)

    def test_abrupt_controller_uses_full_service_window_before_removal(self):
        timeline = Mock()
        for name in ("sleep", "quiescent", "mounts", "fragment", "scratch"):
            timeline.attach_mock(getattr(self, name), name)
        self.assertTrue(self.recover())
        self.assertEqual([name for name, _, _ in timeline.mock_calls],
                         ["sleep", "quiescent", "mounts", "fragment", "quiescent", "scratch"])
        self.sleep.assert_called_once_with(27)

    def test_wrong_run_attempt_and_owner_refuse_before_wait(self):
        for lease in (replace(LEASE, attempt=2), replace(LEASE, run=999), replace(LEASE, nonce="b" * 32)):
            with self.assertRaisesRegex(ValueError, "LAUNCH_RECOVERY_SCOPE"):
                self.recover(lease)
        self.sleep.assert_not_called()
        self.fragment.assert_not_called()

    def test_live_cgroup_or_mount_retains_all_custody(self):
        self.quiescent.return_value = False
        with self.assertRaisesRegex(ValueError, "LAUNCH_RECOVERY_NOT_QUIESCENT"):
            self.recover()
        self.quiescent.return_value = True
        self.mounts.return_value = False
        with self.assertRaisesRegex(ValueError, "LAUNCH_RECOVERY_NOT_QUIESCENT"):
            self.recover()
        self.fragment.assert_not_called()
        self.scratch.assert_not_called()

    def test_manager_reappearance_preserves_scratch(self):
        self.quiescent.side_effect = [True, False]
        with self.assertRaisesRegex(ValueError, "LAUNCH_RECOVERY_UNIT_RECHECK"):
            self.recover()
        self.fragment.assert_called_once()
        self.scratch.assert_not_called()

    def test_watchdog_refuses_live_or_unrelated_process(self):
        poll = Mock()
        poll.poll.return_value = [(8, 1)]
        recovery = Mock(return_value=True)
        with (patch.object(launch.select, "POLLIN", 1, create=True),
              patch.object(launch, "verify_pidfd") as verify):
            with self.assertRaisesRegex(ValueError, "LAUNCH_WATCHDOG_CONTROLLER_STILL_LIVE"):
                launch.watchdog_wait(SCOPE, LEASE, 51, 7, poll_factory=lambda: poll,
                                      recover_owned=recovery)
            recovery.assert_not_called()
            verify.assert_called_once_with(51, 7)
            poll.poll.return_value = [(7, 1)]
            self.assertTrue(launch.watchdog_wait(SCOPE, LEASE, 51, 7, poll_factory=lambda: poll,
                                                 recover_owned=recovery))
            recovery.assert_called_once_with(SCOPE, LEASE)

    def test_watchdog_completion_requires_an_explicit_success_byte(self):
        poll = Mock()
        recovery = Mock(return_value=True)
        with (patch.object(launch.select, "POLLIN", 1, create=True),
              patch.object(launch, "verify_pidfd"), patch.object(launch.os, "read") as read):
            poll.poll.side_effect = [[(9, 1)], [(7, 1)]]
            read.return_value = b""
            self.assertTrue(launch.watchdog_wait(SCOPE, LEASE, 51, 7, poll_factory=lambda: poll,
                                                recover_owned=recovery, completion_fd=9))
            recovery.assert_called_once_with(SCOPE, LEASE)
            recovery.reset_mock()
            poll.poll.side_effect = [[(9, 1)]]
            read.return_value = b"C"
            self.assertTrue(launch.watchdog_wait(SCOPE, LEASE, 51, 7, poll_factory=lambda: poll,
                                                recover_owned=recovery, completion_fd=9))
            recovery.assert_not_called()

    def test_fragment_publication_never_replaces_existing_entry(self):
        armed = launch.ArmedWatchdog(52, LEASE)
        with (patch.object(launch.os, "WNOHANG", 1, create=True),
              patch.object(launch.os, "waitpid", return_value=(0, 0)),
              patch.object(launch, "has_identity", return_value=True),
              patch.object(launch, "observe_quiescence", return_value=True),
              patch.object(launch, "verify_fragment"),
              patch.object(launch.os, "link", side_effect=FileExistsError) as link):
            with self.assertRaises(FileExistsError):
                launch.publish_fragment(SCOPE, LEASE, armed)
            link.assert_called_once_with(SCOPE.scratch / launch.FRAGMENT, Path(RUN.fragment),
                                         follow_symlinks=False)

    def test_dead_watchdog_never_publishes_fragment(self):
        with (patch.object(launch.os, "WNOHANG", 1, create=True),
              patch.object(launch.os, "waitpid", return_value=(52, 1)),
              patch.object(launch.os, "link") as link):
            with self.assertRaisesRegex(ValueError, "LAUNCH_WATCHDOG_MISSING"):
                launch.publish_fragment(SCOPE, LEASE, launch.ArmedWatchdog(52, LEASE))
            link.assert_not_called()

    def test_foreign_inode_or_symlink_is_never_unlinked(self):
        with (patch.object(launch.os, "stat") as observed, patch.object(launch.os, "unlink") as unlink):
            for info in (SimpleNamespace(st_dev=10, st_ino=99, st_mode=stat.S_IFREG),
                         SimpleNamespace(st_dev=10, st_ino=21, st_mode=stat.S_IFLNK)):
                observed.return_value = info
                with self.assertRaisesRegex(ValueError, "LAUNCH_RECOVERY_FOREIGN_ENTRY"):
                    launch.unlink_owned(8, "unit.fragment", LEASE.fragment)
            unlink.assert_not_called()
            observed.return_value = SimpleNamespace(st_dev=10, st_ino=21, st_mode=stat.S_IFREG)
            launch.unlink_owned(8, "unit.fragment", LEASE.fragment)
            unlink.assert_called_once_with("unit.fragment", dir_fd=8)


class PreparationTest(unittest.TestCase):
    def setUp(self):
        stack = ExitStack()
        self.addCleanup(stack.close)
        self.scope = Scope(replace(RUN, unit_nonce=SCOPE.nonce), SCOPE.nonce)
        parent = SimpleNamespace(st_dev=10, st_ino=1, st_mode=stat.S_IFDIR | 0o700, st_uid=1001)
        scratch = SimpleNamespace(st_dev=10, st_ino=20, st_mode=stat.S_IFDIR | 0o700, st_uid=1001)
        stack.enter_context(patch.object(launch, "unit_fragment", return_value=b"unit"))
        stack.enter_context(patch.object(launch, "absent", return_value=True))
        stack.enter_context(patch.object(Path, "lstat", return_value=parent))
        stack.enter_context(patch.object(Path, "resolve", lambda path, strict: path))
        for name, value in (("O_NOFOLLOW", 1 << 20), ("O_DIRECTORY", 1 << 21), ("O_CLOEXEC", 1 << 22)):
            stack.enter_context(patch.object(launch.os, name, value, create=True))
        stack.enter_context(patch.object(launch.os, "geteuid", return_value=1001, create=True))
        self.open = stack.enter_context(patch.object(launch.os, "open", side_effect=[8, 9]))
        self.fstat = stack.enter_context(patch.object(launch.os, "fstat", side_effect=[parent, scratch]))
        self.mkdir = stack.enter_context(patch.object(launch.os, "mkdir"))
        self.stat = stack.enter_context(patch.object(launch.os, "stat", return_value=scratch))
        self.close = stack.enter_context(patch.object(launch.os, "close"))
        self.unlink = stack.enter_context(patch.object(launch, "unlink_owned"))

    def prepare(self):
        return launch.prepare_lease(self.scope, "/unused", "tracking", controller_pid=51)

    def test_failed_scratch_open_retains_unbound_custody(self):
        failure = OSError(errno.EMFILE, "scratch open failed")
        self.open.side_effect = [8, failure]
        with self.assertRaises(launch.PreflightFailure) as error:
            self.prepare()
        self.assertIs(error.exception.primary, failure)
        self.assertEqual(str(error.exception.cleanup[0][1]), "LAUNCH_CUSTODY_SCRATCH_UNBOUND")
        self.unlink.assert_not_called()
        self.close.assert_called_once_with(8)

    def test_failed_scratch_identity_read_retains_unbound_custody(self):
        self.stat.side_effect = OSError(errno.EIO, "scratch stat failed")
        with self.assertRaises(launch.PreflightFailure) as error:
            self.prepare()
        self.assertEqual(str(error.exception.cleanup[0][1]), "LAUNCH_CUSTODY_SCRATCH_UNBOUND")
        self.assertEqual(self.open.call_count, 1)
        self.unlink.assert_not_called()

    def test_preexisting_scratch_is_not_cleaned_up(self):
        self.mkdir.side_effect = FileExistsError()
        with self.assertRaises(FileExistsError):
            self.prepare()
        self.stat.assert_not_called()
        self.unlink.assert_not_called()

    def test_bound_scratch_can_be_rolled_back_on_later_failure(self):
        self.mkdir.side_effect = [None, OSError(errno.EIO, "root mkdir failed")]
        with self.assertRaises(OSError):
            self.prepare()
        self.unlink.assert_called_once_with(8, self.scope.scratch.name, (10, 20), directory=True)
        self.assertEqual([call.args for call in self.close.call_args_list], [(9,), (8,)])


class DenialTest(unittest.TestCase):
    def test_unit_fragment_keeps_exact_bounds_and_no_shell(self):
        # POSIX path semantics for rendering fixed future Linux arguments.
        from pathlib import PurePosixPath

        with patch.object(launch, "Path", PurePosixPath):
            fragment = launch.unit_fragment(SCOPE, "/trusted/jammy_preflight_worker.py", "tracking-id")
            for item in (b"JobTimeoutSec=8s", b"TimeoutStartSec=5s", b"RuntimeMaxSec=12s", b"TimeoutStopSec=2s",
                         b"MemorySwapMax=0", b"MemoryMax=128M", b"TasksMax=8", b"KillMode=control-group"):
                self.assertIn(item + b"\n", fragment)
            with self.assertRaisesRegex(ValueError, "LAUNCH_UNIT_ARGUMENT"):
                launch.unit_fragment(SCOPE, "/trusted/../jammy_preflight_worker.py", "tracking-id")
            with self.assertRaisesRegex(ValueError, "LAUNCH_UNIT_ARGUMENT"):
                launch.unit_fragment(SCOPE, "/trusted/jammy_preflight_worker.py", "bad\nExecStart=other")

    def test_canary_mount_must_be_exact_readonly_cgroup(self):
        target = Mock()
        target.__str__ = Mock(return_value="/probe")
        target.stat.return_value = SimpleNamespace(st_dev=12, st_ino=25)
        row = {"path": "/probe", "type": "cgroup2", "flags": {"ro"}}
        with patch.object(launch, "read_mounts", return_value=[row]):
            launch.validate_canary_mount(target, (12, 25), readonly=True)
            row["flags"] = {"rw"}
            with self.assertRaisesRegex(ValueError, "LAUNCH_CANARY_MOUNT"):
                launch.validate_canary_mount(target, (12, 25), readonly=True)
            row.update(flags={"ro"}, type="tmpfs")
            with self.assertRaisesRegex(ValueError, "LAUNCH_CANARY_MOUNT"):
                launch.validate_canary_mount(target, (12, 25), readonly=True)

    def test_manager_probe_refuses_success_and_unexpected_errors(self):
        def refused(endpoint):
            number = errno.ECONNREFUSED if endpoint == SCOPE.abstract_endpoint else errno.ENOENT
            raise OSError(number, os.strerror(number))

        with patch.object(launch, "connect", side_effect=refused) as connect:
            self.assertEqual(launch.manager_denials(SCOPE), {"sameUidManagerAccess": True})
            connect.side_effect = OSError(errno.EINVAL, "wrong protocol")
            with self.assertRaisesRegex(ValueError, "LAUNCH_MANAGER_PATH_UNEXPECTED_ERRNO"):
                launch.manager_denials(SCOPE)
            connect.side_effect = None
            with self.assertRaisesRegex(ValueError, "LAUNCH_MANAGER_PATH_SUCCEEDED"):
                launch.manager_denials(SCOPE)


if __name__ == "__main__":
    unittest.main()
