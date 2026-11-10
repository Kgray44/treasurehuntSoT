import struct
import unittest
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
        value = {"host": {}, "request": {}}
        with (patch.object(worker, "read_lease", return_value=LEASE),
              patch.object(worker, "read_child_input", return_value=value),
              patch.object(worker, "verify_request", return_value=(b"receipt", {})),
              patch.object(worker, "exec_loader_worker") as execute):
            with self.assertRaisesRegex(ValueError, "LAUNCH_LOADER_MODE"):
                worker.namespace_child(SCOPE, "/bin/sh", 8)
            execute.assert_not_called()
            worker.namespace_child(SCOPE, "version", 8)
            execute.assert_called_once_with(SCOPE, LEASE, {}, b"receipt", {}, 1)

    def test_namespace_probe_cannot_take_loader_request(self):
        with (patch.object(worker, "read_lease", return_value=LEASE),
              patch.object(worker, "read_child_input", return_value={"host": {}, "request": {}}),
              patch.object(worker, "run_denial_worker") as run):
            with self.assertRaisesRegex(ValueError, "LAUNCH_DENIAL_CHILD_FIELDS"):
                worker.namespace_child(SCOPE, "denials", 8)
            run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
