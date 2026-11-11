import os
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import jammy_preflight_supervisor as supervisor

SOURCE = "0f5ec2311999324d933ad334c8d9b794b2ad51ec"
RUN = supervisor.Run(SOURCE, SOURCE, 321, 1, "Kgray44", "Kgray44", "Kgray44/treasurehuntSoT",
                     "refs/heads/main", "workflow_dispatch", "confined-loader-and-denials-only")
ROOT = {"mounts": supervisor.mount_rows(
    "20 19 0:10 / / ro,nosuid,nodev,relatime - tmpfs tmpfs ro\n"
    "21 20 0:11 / /proc ro,nosuid,nodev,noexec - proc proc rw\n"),
    "privatePropagation": True, "scratchOutsideRoot": True, "bytes": 16777216, "inodes": 256,
    "hostNamespaces": dict.fromkeys(supervisor.NAMESPACES, 10),
    "workerNamespaces": dict.fromkeys(supervisor.NAMESPACES, 11)}
CONTROLS = {"managerEndpoints": supervisor.MANAGER_ENDPOINTS, "managerAuthenticated": True,
            "abstractConnected": True, "sourceLeaf": RUN.cgroup + "/preflight-source",
            "targetLeaf": RUN.cgroup + "/preflight-target", "cgroupV2MountAttested": True,
            "remountCanarySucceeded": True, "canaryMovedAndReadBack": True,
            "limitChangedAndReadBack": True, "canaryReaped": True, "leavesRemoved": True}
DENIALS = dict.fromkeys(("sameUidManagerAccess", "cgroupRemount", "cgroupMigration",
                       "cgroupLimitMutation"), True)


class SupervisorTest(unittest.TestCase):
    def setUp(self):
        self.scope = supervisor.Scope(RUN, "a" * 32)
        self.ops = Mock()
        self.ops.reserve.side_effect = self.reserve
        self.ops.configure_unit.side_effect = self.configure
        self.ops.start_blocked.return_value = 51
        self.ops.verify_effective_limits.return_value = True
        self.ops.positive_controls.return_value = CONTROLS
        self.ops.stage_and_seal.return_value = ROOT
        self.ops.verify_private_files.return_value = True
        self.ops.denial_controls.return_value = DENIALS
        self.ops.loader_commands.return_value = ((0, b"listing", b""), (0, b"version", b""))
        for name in supervisor.CLEANUP:
            getattr(self.ops, name).return_value = True
        for name, value in (("verify_inventory", {}), ("bind_member_bytes", {"/usr/bin/bwrap": b"stub"}),
                            ("verify_runtime_output", {"reportedVersion": "bubblewrap 0.12.0"})):
            stub = patch.object(supervisor, name, return_value=value)
            setattr(self, name, stub.start())
            self.addCleanup(stub.stop)

    def reserve(self, run, runner, limits, timeout):
        self.scope = supervisor.Scope(run, "a" * 32)
        return self.scope

    def configure(self, scope, timeout):
        scope.owned.scratch = (10, 20)
        scope.owned.fragment = (10, 21)
        return supervisor.unit_properties(scope.run)

    def run_fixture(self, run=RUN, clock=lambda: 0):
        return supervisor.supervise(run, SOURCE, b"fixture", self.ops, clock=clock)

    def test_limits_and_positive_controls_precede_staging_and_loader(self):
        result = self.run_fixture()
        actions = [name for name, _, _ in self.ops.mock_calls]
        self.assertEqual(actions, ["reserve", "configure_unit", "acquire_public_members", "start_blocked",
                                   "verify_effective_limits", "positive_controls", "stage_and_seal",
                                   "verify_private_files", "denial_controls", "verify_effective_limits",
                                   "loader_commands", "verify_effective_limits", *supervisor.CLEANUP])
        self.assertTrue(result["cleanupVerified"])
        self.assertFalse(result["externalIsolationProved"])
        self.assertFalse(result["qualification"])
        self.assertFalse(result["reuseAuthorized"])
        self.verify_runtime_output.assert_called_once_with(b"fixture", 0, b"listing", b"", 0, b"version", b"")

    def test_rejects_nonowner_rerun_or_invalid_receipt_before_any_operations(self):
        for run in (replace(RUN, attempt=2), replace(RUN, triggering_actor="elsewhere"),
                    replace(RUN, workflow_source="a" * 40), replace(RUN, run_id=True)):
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_RUN_BINDING"):
                self.run_fixture(run)
        self.verify_inventory.side_effect = ValueError("RUNTIME_INPUT_RECEIPT_PIN")
        with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_RECEIPT_PIN"):
            self.run_fixture()
        self.assertEqual(self.ops.mock_calls, [])

    def test_unverified_cgroup_prevents_any_member_stage(self):
        self.ops.verify_effective_limits.return_value = None
        with self.assertRaises(supervisor.PreflightFailure) as result:
            self.run_fixture()
        self.assertEqual(str(result.exception.primary), "PREFLIGHT_EFFECTIVE_LIMITS")
        self.ops.stage_and_seal.assert_not_called()
        self.ops.verify_scratch_gone.assert_called_once()

    def test_controls_and_denials_are_independent_gates(self):
        self.ops.positive_controls.return_value = {**CONTROLS, "targetLeaf": RUN.cgroup}
        with self.assertRaises(supervisor.PreflightFailure) as result:
            self.run_fixture()
        self.assertEqual(str(result.exception.primary), "PREFLIGHT_CGROUP_POSITIVE")
        self.ops.stage_and_seal.assert_not_called()
        self.ops.positive_controls.return_value = CONTROLS
        self.ops.denial_controls.return_value = {**DENIALS, "cgroupMigration": "EPERM"}
        with self.assertRaises(supervisor.PreflightFailure) as result:
            self.run_fixture()
        self.assertEqual(str(result.exception.primary), "PREFLIGHT_NATIVE_DENIALS")
        self.ops.loader_commands.assert_not_called()

    def test_private_root_rejects_host_mounts_and_namespace_alias(self):
        root = {**ROOT, "mounts": [*ROOT["mounts"], ROOT["mounts"][0]]}
        with self.assertRaises(ValueError):
            supervisor.verify_root(root, supervisor.load_supervisor_plan())
        root = {**ROOT, "workerNamespaces": {**ROOT["workerNamespaces"], "net": 10}}
        with self.assertRaisesRegex(ValueError, "PREFLIGHT_PRIVATE_NAMESPACES"):
            supervisor.verify_root(root, supervisor.load_supervisor_plan())

    def test_exact_private_tree_refuses_unpinned_and_missing_files(self):
        real_lstat = Path.lstat

        def private_lstat(path):
            fields = list(real_lstat(path))
            fields[0] &= ~0o7022
            return os.stat_result(fields)

        with (tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temp,
              patch.object(Path, "lstat", private_lstat)):
            root = Path(temp)
            for name in ("proc", "probe", "usr", "usr/bin"):
                (root / name).mkdir()
            executable = root / "usr/bin/bwrap"
            executable.write_bytes(b"pin")
            self.assertTrue(supervisor.attest_private_files(root, {"/usr/bin/bwrap": b"pin"}))
            executable.write_bytes(b"bad")
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_ROOT_FILE_HASH"):
                supervisor.attest_private_files(root, {"/usr/bin/bwrap": b"pin"})
            executable.unlink()
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_ROOT_FILE_COVERAGE"):
                supervisor.attest_private_files(root, {"/usr/bin/bwrap": b"pin"})

    def test_limits_require_exact_membership_and_kernel_values(self):
        group = Path("/fake/cgroup") / RUN.cgroup.lstrip("/")
        values = {Path("/fake/proc/51/cgroup"): "0::" + RUN.cgroup + "/preflight-worker",
                  group / "memory.swap.max": "0", group / "memory.max": "134217728",
                  group / "pids.max": "8", group / "memory.swap.current": "0"}

        def read(path, name):
            return values[path / name]

        with (patch.object(Path, "resolve", lambda path, strict: path),
              patch.object(supervisor, "read_control", side_effect=read)):
            self.assertTrue(supervisor.verify_limits(RUN, 51, "preflight-worker",
                                                     proc=Path("/fake/proc"), sysfs=Path("/fake/cgroup")))
            values[group / "memory.swap.max"] = "max"
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_CGROUP_LIMITS"):
                supervisor.verify_limits(RUN, 51, "preflight-worker",
                                         proc=Path("/fake/proc"), sysfs=Path("/fake/cgroup"))
            values[Path("/fake/proc/51/cgroup")] = "0::/outside"
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_CGROUP_MEMBERSHIP"):
                supervisor.verify_limits(RUN, 51, "preflight-worker",
                                         proc=Path("/fake/proc"), sysfs=Path("/fake/cgroup"))

    def test_cleanup_preserves_primary_and_holds_custody_if_live(self):
        cancelled = KeyboardInterrupt()
        self.ops.stage_and_seal.side_effect = cancelled
        self.ops.verify_processes_gone.return_value = False
        with self.assertRaises(supervisor.PreflightFailure) as result:
            self.run_fixture()
        self.assertIs(result.exception.primary, cancelled)
        self.assertEqual([name for name, _ in result.exception.cleanup],
                         ["verify_processes_gone", "remove_fragment", "remove_scratch"])
        self.ops.stop_unit.assert_called_once_with(self.scope, timeout=3)
        self.ops.remove_fragment.assert_not_called()
        self.ops.remove_scratch.assert_not_called()
        self.ops.verify_scratch_gone.assert_called_once()

    def test_cleanup_failure_cannot_report_success(self):
        self.ops.verify_unit_unloaded.side_effect = TimeoutError("busy")
        with self.assertRaises(supervisor.PreflightFailure) as result:
            self.run_fixture()
        self.assertIsNone(result.exception.primary)
        self.assertEqual([name for name, _ in result.exception.cleanup],
                         ["verify_unit_unloaded", "remove_scratch"])
        self.ops.remove_fragment.assert_called_once()
        self.ops.remove_scratch.assert_not_called()

    def test_expired_deadline_enters_cleanup_without_new_operation(self):
        clock = Mock(side_effect=[0, 0, 299])
        with self.assertRaises(supervisor.PreflightFailure) as result:
            self.run_fixture(clock=clock)
        self.assertEqual(str(result.exception.primary), "PREFLIGHT_DEADLINE")
        self.ops.configure_unit.assert_not_called()
        self.assertEqual(len(self.ops.mock_calls), 1)

    def test_unit_collision_never_stops_or_removes_foreign_unit(self):
        def collision(scope, timeout):
            scope.owned.scratch = (10, 20)
            raise FileExistsError("foreign fragment")

        self.ops.configure_unit.side_effect = collision
        with self.assertRaises(supervisor.PreflightFailure) as result:
            self.run_fixture()
        self.assertIsInstance(result.exception.primary, FileExistsError)
        self.ops.stop_unit.assert_not_called()
        self.ops.remove_fragment.assert_not_called()
        self.ops.remove_scratch.assert_called_once_with(self.scope, timeout=3)

    def test_empty_or_incomplete_pidfds_cannot_claim_exit(self):
        for fds, count in (([], 0), ([], 1), ([3, 3], 2), ([3], 2)):
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_PIDFD_COVERAGE"):
                supervisor.verify_pidfds_gone(fds, count)

    def test_readable_non_pidfd_never_claims_process_exit(self):
        with (patch.object(supervisor.os, "dup", return_value=8),
              patch.object(supervisor.os, "close") as close,
              patch.object(supervisor.os, "readlink", return_value="pipe:[55]")):
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_PIDFD_IDENTITY"):
                supervisor.TrackedProcess(51, 7)
            close.assert_called_once_with(8)

    def test_exit_check_uses_private_duplicate_even_if_borrowed_fd_is_reused(self):
        poll = Mock()
        poll.poll.return_value = [(7, 1)]  # unrelated exited pidfd reused number 7
        with (patch.object(supervisor.select, "poll", return_value=poll, create=True),
              patch.object(supervisor.select, "POLLIN", 1, create=True),
              patch.object(supervisor.os, "dup", return_value=8),
              patch.object(supervisor.os, "close") as close,
              patch.object(supervisor, "verify_pidfd") as verify):
            tracked = supervisor.TrackedProcess(51, 7)
            verify.assert_called_once_with(51, 8)
            self.assertFalse(supervisor.verify_pidfds_gone([tracked], 1))
            poll.register.assert_called_once_with(8, 1)
            poll.poll.return_value = [(8, 1)]
            self.assertTrue(supervisor.verify_pidfds_gone([tracked], 1))
            tracked.release()
            close.assert_called_once_with(8)
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_PIDFD_RELEASED"):
                supervisor.verify_pidfds_gone([tracked], 1)

    def test_active_unit_collision_never_sends_stop(self):
        self.scope.owned.start_requested = True
        self.scope.owned.invocation = "a" * 32
        with (patch.object(supervisor, "has_identity", return_value=True),
              patch.object(supervisor, "bounded_command",
                           return_value=(0, b"InvocationID=" + b"b" * 32 + b"\n", b"")) as command):
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_STOP_ACTIVE_UNIT"):
                supervisor.stop_owned_unit(self.scope, 2)
            self.assertEqual(command.call_count, 1)
            self.assertIn("show", command.call_args.args[0])

    def test_worker_root_descriptor_mismatch_closes_descriptor(self):
        with (patch.object(supervisor, "verify_pidfd") as verify,
              patch.object(supervisor.os, "O_DIRECTORY", 65536, create=True),
              patch.object(supervisor.os, "O_CLOEXEC", 524288, create=True),
              patch.object(supervisor.os, "open", return_value=8),
              patch.object(supervisor.os, "fstat", return_value=SimpleNamespace(st_dev=11, st_ino=5)),
              patch.object(supervisor.os, "close") as close,
              patch.object(supervisor, "attest_private_files") as attest):
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_WORKER_ROOT_IDENTITY"):
                supervisor.attest_worker_root(51, 7, (10, 5), {})
            verify.assert_called_once_with(51, 7)
            close.assert_called_once_with(8)
            attest.assert_not_called()

    def test_stage_refuses_unpinned_targets_before_mount(self):
        with patch.object(supervisor, "host_mount") as mount:
            with self.assertRaisesRegex(ValueError, "PREFLIGHT_STAGE_TARGETS"):
                supervisor.stage_private_root(self.scope, {"/etc/ld.so.preload": b"extra"}, {})
            mount.assert_not_called()


if __name__ == "__main__":
    unittest.main()
