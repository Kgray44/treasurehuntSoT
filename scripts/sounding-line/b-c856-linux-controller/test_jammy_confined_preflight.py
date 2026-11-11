import errno
import os
import stat
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import jammy_confined_preflight as preflight

PATH = ("/sys/fs/cgroup/user.slice/user-1001.slice/user@1001.service/"
        "app.slice/sounding-line-native-preflight-123.service")
ABSTRACT = "\0sounding-line-native-preflight-" + "a" * 32
HOST = dict.fromkeys(preflight.NAMESPACES, 10)
PRIVATE = dict.fromkeys(preflight.NAMESPACES, 11)


def fail_with(number):
    return OSError(number, os.strerror(number))


class ConfinedPreflightTest(unittest.TestCase):
    def test_host_observation_requires_every_control(self):
        with (patch.object(preflight, "connect") as connect,
              patch.object(preflight, "open_control", return_value=stat.S_IFREG) as opened,
              patch.object(preflight, "namespace_ids", return_value=HOST)):
            self.assertEqual(preflight.observe_host_controls(PATH, ABSTRACT), HOST)
            self.assertEqual([row.args[0] for row in connect.call_args_list],
                             [*preflight.MANAGER_ENDPOINTS, ABSTRACT])
            self.assertEqual([row.args for row in opened.call_args_list],
                             [(PATH + "/" + control, os.O_RDONLY) for control in preflight.CONTROLS])
            opened.side_effect = fail_with(errno.ENOENT)
            with self.assertRaises(FileNotFoundError):
                preflight.observe_host_controls(PATH, ABSTRACT)

    def test_rejects_unbound_targets_before_observation(self):
        with patch.object(preflight, "connect") as connect:
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_CONTROL_PATH"):
                preflight.observe_host_controls(PATH + "/../other", ABSTRACT)
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_ABSTRACT_ENDPOINT"):
                preflight.observe_host_controls(PATH, "/tmp/bus")
            connect.assert_not_called()

    def test_denial_rejects_success_and_unrelated_failure(self):
        with self.assertRaisesRegex(ValueError, "PROBE_SUCCEEDED"):
            preflight.denied(lambda: None, {errno.EPERM}, "PROBE")
        with self.assertRaisesRegex(ValueError, "PROBE_UNEXPECTED_ERRNO"):
            preflight.denied(Mock(side_effect=fail_with(errno.EINVAL)), {errno.EPERM}, "PROBE")

    def test_mount_escape_detaches_only_its_mount(self):
        libc = Mock()
        libc.mount.return_value = 0
        libc.umount2.return_value = 0
        with self.assertRaisesRegex(ValueError, "REMOUNT_SUCCEEDED"):
            preflight.denied(lambda: preflight.fresh_cgroup_mount_attempt(libc, b"/probe"),
                             {errno.EPERM}, "REMOUNT")
        libc.umount2.assert_called_once_with(b"/probe", 2)
        libc.umount2.return_value = -1
        with self.assertRaisesRegex(ValueError, "PREFLIGHT_CGROUP_MOUNT_CLEANUP"):
            preflight.fresh_cgroup_mount_attempt(libc, b"/probe")

    def test_successful_fs_context_is_closed_and_refused(self):
        with (patch.object(preflight, "syscall", return_value=12),
              patch.object(preflight.os, "close") as closed):
            with self.assertRaisesRegex(ValueError, "FSOPEN_SUCCEEDED"):
                preflight.denied(lambda: preflight.fsopen_attempt(Mock()), {errno.EPERM}, "FSOPEN")
            closed.assert_called_once_with(12)
            closed.side_effect = fail_with(errno.EPERM)
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_DESCRIPTOR_CLEANUP"):
                preflight.denied(lambda: preflight.fsopen_attempt(Mock()), {errno.EPERM}, "FSOPEN")

    def test_successful_clone_is_reaped_and_refused(self):
        with (patch.object(preflight, "syscall", return_value=22),
              patch.object(preflight.os, "waitpid", return_value=(22, 97 << 8)) as reaped):
            with self.assertRaisesRegex(ValueError, "MIGRATION_SUCCEEDED"):
                preflight.denied(lambda: preflight.clone_policy_attempt(Mock(), 9),
                                 {errno.EPERM}, "MIGRATION")
            reaped.assert_called_once_with(22, 0)
            reaped.side_effect = fail_with(errno.EPERM)
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_MIGRATION_CLEANUP"):
                preflight.denied(lambda: preflight.clone_policy_attempt(Mock(), 9),
                                 {errno.EPERM}, "MIGRATION")

    def test_worker_refuses_shared_namespace(self):
        with patch.object(preflight, "namespace_ids", return_value={**PRIVATE, "net": HOST["net"]}):
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_NAMESPACE_IDENTITY"):
                preflight.probe_denials(PATH, ABSTRACT, HOST)

    def test_worker_reports_four_denial_families_and_closes_sacrificial_descriptor(self):
        def connect(endpoint):
            raise fail_with(errno.ECONNREFUSED if endpoint == ABSTRACT else errno.ENOENT)

        def listdir(path):
            if path == "/proc/1/fd":
                raise fail_with(errno.EACCES)
            return ["0", "1", "2", "3"]

        with (patch.object(preflight, "namespace_ids", return_value=PRIVATE),
              patch.object(preflight.os, "uname", create=True,
                           return_value=SimpleNamespace(machine="x86_64")),
              patch.object(preflight.os, "listdir", side_effect=listdir),
              patch.object(preflight.os, "fstat", side_effect=fail_with(errno.EBADF)) as fstat,
              patch.object(preflight.os, "getpid", return_value=2),
              patch.object(preflight, "connect", side_effect=connect),
              patch.object(preflight, "open_control", side_effect=fail_with(errno.ENOENT)),
              patch.object(preflight.os, "stat", side_effect=fail_with(errno.EACCES)),
              patch.object(preflight.ctypes, "CDLL"),
              patch.object(preflight, "fresh_cgroup_mount_attempt", side_effect=fail_with(errno.EPERM)),
              patch.object(preflight, "fsopen_attempt", side_effect=fail_with(errno.EPERM)),
              patch.object(preflight, "syscall", side_effect=fail_with(errno.EPERM)),
              patch.object(preflight.os, "O_DIRECTORY", 65536, create=True),
              patch.object(preflight.os, "O_CLOEXEC", 524288, create=True),
              patch.object(preflight.os, "O_NOFOLLOW", 131072, create=True),
              patch.object(preflight.os, "open", return_value=3),
              patch.object(preflight.os, "close") as close,
              patch.object(preflight, "clone_policy_attempt", side_effect=fail_with(errno.EPERM)) as migration):
            result = preflight.probe_denials(PATH, ABSTRACT, HOST)
            self.assertEqual(result["abstractManager"], errno.errorcode[errno.ECONNREFUSED])
            self.assertEqual(result["freshCgroupMountPolicy"], "EPERM")
            self.assertEqual(result[PATH + "/cgroup.procs"], "ENOENT")
            self.assertEqual(result[PATH + "/memory.swap.max"], "ENOENT")
            self.assertEqual(result["clone3PolicyWithPrivateDirectory"], "EPERM")
            close.assert_called_once_with(3)
            migration.side_effect = fail_with(errno.EINVAL)
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_CLONE_POLICY_UNEXPECTED_ERRNO"):
                preflight.probe_denials(PATH, ABSTRACT, HOST)
            self.assertEqual(close.call_count, 2)
            fstat.side_effect = None
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_INHERITED_FD_SUCCEEDED"):
                preflight.probe_denials(PATH, ABSTRACT, HOST)

    def test_runtime_listing_checks_receipt_before_accepting_output(self):
        with (patch.object(preflight, "load_plan", return_value="plan"),
              patch.object(preflight, "verify_inventory", return_value="observed") as verify,
              patch.object(preflight, "verify_loader_listing", return_value={"lib": "/lib"}) as listing):
            self.assertEqual(preflight.verify_runtime_output(b"receipt", 0, b"out", b"", 0,
                                                             b"bubblewrap 0.12.0\n", b""),
                             {"resolvedLibraries": {"lib": "/lib"}, "reportedVersion": "bubblewrap 0.12.0"})
            verify.assert_called_once_with("plan", b"receipt")
            listing.assert_called_once_with("plan", "observed", b"out", b"")
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_BWRAP_VERSION"):
                preflight.verify_runtime_output(b"receipt", 0, b"out", b"", 0, b"bubblewrap 0.12.0\n", b"warning")
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_BWRAP_VERSION"):
                preflight.verify_runtime_output(b"receipt", 0, b"out", b"", 0, b"bubblewrap 1.2.3\n", b"")
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_CHILD_STATUS"):
                preflight.verify_runtime_output(b"receipt", 1, b"out", b"", 0, b"bubblewrap 0.12.0\n", b"")
            verify.side_effect = ValueError("RUNTIME_INPUT_RECEIPT_PIN")
            with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_RECEIPT_PIN"):
                preflight.verify_runtime_output(b"bad", 0, b"out", b"", 0, b"bubblewrap 0.12.0\n", b"")


if __name__ == "__main__":
    unittest.main()
