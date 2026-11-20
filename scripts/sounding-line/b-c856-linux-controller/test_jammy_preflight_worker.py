import struct
import unittest
from dataclasses import replace
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import Mock, patch

import jammy_preflight_worker as worker
from test_jammy_preflight_launcher import LEASE, RUN, SCOPE


class ProtocolTest(unittest.TestCase):
    def test_frame_roundtrip_with_fragmented_header_and_payload(self):
        channel = Mock()
        data = worker.encode({"ready": 51})
        channel.recv.side_effect = [b"\x00", struct.pack("!I", len(data))[1:], data[:3], data[3:]]
        with patch.object(worker.time, "monotonic", return_value=10):
            self.assertEqual(worker.receive(channel, 32, 12), {"ready": 51})
            worker.transmit(channel, {"ready": 51}, 32, 12)
        channel.sendall.assert_called_once_with(struct.pack("!I", len(data)) + data)

    def test_frame_refuses_oversize_before_reading_body(self):
        channel = Mock()
        channel.recv.return_value = struct.pack("!I", 100)
        with patch.object(worker.time, "monotonic", return_value=10):
            with self.assertRaisesRegex(ValueError, "LAUNCH_CHANNEL_SIZE"):
                worker.receive(channel, 32, 12)
        channel.recv.assert_called_once_with(4)

    def test_frame_refuses_eof_and_expired_budget(self):
        channel = Mock()
        channel.recv.return_value = b""
        with patch.object(worker.time, "monotonic", return_value=10):
            with self.assertRaisesRegex(ValueError, "LAUNCH_CHANNEL_DEADLINE"):
                worker.receive(channel, 32, 9)
            channel.recv.assert_not_called()
            with self.assertRaisesRegex(ValueError, "LAUNCH_CHANNEL_EOF"):
                worker.receive(channel, 32, 12)

    def test_request_refuses_extra_or_missing_member_before_unpacking(self):
        with patch.object(worker, "unpack") as unpack:
            with self.assertRaisesRegex(ValueError, "LAUNCH_REQUEST_MEMBERS"):
                worker.verify_request({"receipt": "fake", "members": {"other": "fake"}})
            unpack.assert_not_called()

    def test_loader_child_dispatch_only_has_two_fixed_modes(self):
        value = {"host": {}, "request": {}, "barrier": [9, 10]}
        with (patch.object(worker, "read_lease", return_value=LEASE),
              patch.object(worker, "read_child_input", return_value=value),
              patch.object(worker, "verify_request", return_value=(b"receipt", {})),
              patch.object(worker, "exec_loader_worker") as execute):
            with self.assertRaisesRegex(ValueError, "LAUNCH_LOADER_MODE"):
                worker.namespace_child(SCOPE, "/bin/sh", 8)
            execute.assert_not_called()
            worker.namespace_child(SCOPE, "version", 8)
            execute.assert_called_once_with(SCOPE, LEASE, {}, b"receipt", {}, 1, (9, 10))

    def test_dormant_entrypoints_refuse_before_any_native_calls(self):
        with (patch.object(worker, "NATIVE_ENABLED", False),
              patch.object(worker, "verify_run") as verify):
            with self.assertRaisesRegex(ValueError, "LAUNCH_ACTION_NOT_AUTHORIZED"):
                worker.controller(SCOPE, RUN.source, b"", {}, "", "", Path("/unused"))
            with self.assertRaisesRegex(ValueError, "LAUNCH_ACTION_NOT_AUTHORIZED"):
                worker.main([])
            verify.assert_not_called()

    def test_namespace_probe_cannot_take_loader_request(self):
        with (patch.object(worker, "read_lease", return_value=LEASE),
              patch.object(worker, "read_child_input",
                           return_value={"host": {}, "request": {}, "barrier": [9, 10]}),
              patch.object(worker, "run_denial_worker") as run):
            with self.assertRaisesRegex(ValueError, "LAUNCH_DENIAL_CHILD_FIELDS"):
                worker.namespace_child(SCOPE, "denials", 8)
            run.assert_not_called()


    def test_locally_constructed_scope_is_rejected_before_runtime_access(self):
        with patch.object(worker.os, "statvfs", create=True) as statvfs:
            with self.assertRaisesRegex(ValueError, "LAUNCH_PROVIDER_NOT_AUTHENTICATED"):
                worker.controller(SCOPE, RUN.source, b"", {}, "", "", Path("/unused"), authorized_run=RUN)
        statvfs.assert_not_called()

    def test_controller_keeps_primary_when_recovery_and_watchdog_both_fail(self):
        from jammy_preflight_custody import CustodyBinding

        scope = replace(SCOPE, custody=CustodyBinding((10, 1), (10, 2)))
        plan = {"runner": {"architecture": "x86_64", "kernel": "kernel", "uid": 1001, "image": "image"},
                "limits": {"hostScratchBytes": 1, "minimumHostFreeBytesAfterScratch": 1}}
        primary = ValueError("worker admission failed")
        recovery = ValueError("passive recovery failed")
        retirement = OSError("watchdog retirement failed")
        with (patch.object(worker, "NATIVE_ENABLED", True),
              patch.object(worker, "consume_launch_authorization", return_value=True),
              patch.object(worker, "load_supervisor_plan", return_value=plan),
              patch.object(worker.os, "uname", return_value=SimpleNamespace(
                  sysname="Linux", machine="x86_64", release="kernel"), create=True),
              patch.object(worker.os, "geteuid", return_value=1001, create=True),
              patch.object(worker.os, "statvfs", return_value=SimpleNamespace(f_bavail=2, f_frsize=2), create=True),
              patch.object(worker, "build_request"),
              patch.object(worker.socket, "AF_UNIX", 1, create=True),
              patch.object(worker.socket, "socket"),
              patch.object(worker, "arm_watchdog", return_value=SimpleNamespace(lease=LEASE)),
              patch.object(worker, "admit_owned_unit", side_effect=primary),
              patch.object(worker, "recover", side_effect=recovery),
              patch.object(worker, "finish_watchdog", side_effect=retirement)):
            with self.assertRaises(worker.PreflightFailure) as error:
                worker.controller(scope, RUN.source, b"receipt", {}, "tracking", "image", Path("/tmp"),
                                  authorized_run=replace(scope.run, unit_nonce=None))
        self.assertIs(error.exception.primary, primary)
        self.assertEqual(error.exception.cleanup, (("passive_recovery", recovery), ("watchdog_retirement", retirement)))


if __name__ == "__main__":
    unittest.main()
