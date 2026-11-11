"""Synthetic offline tests. No native runtime, package, or loader is executed."""
import copy
import json
import tempfile
import unittest
from pathlib import Path

import jammy_native_runtime_inputs as inputs


class RuntimeInputsTests(unittest.TestCase):
    def setUp(self):
        self.plan = inputs.load_plan()
        pin = self.plan["inventory"]
        members = self.plan["members"]
        self.observed = {
            name: {field: row[field] for field in ("member", "bytes", "sha256")} | {"needed": []}
            for name, row in members.items()
        }
        self.observed["bwrap"].update(
            interpreter=self.plan["interpreter"]["target"],
            needed=["libselinux.so.1", "libcap.so.2", "libc.so.6"],
        )
        self.observed["libselinux.so.1"]["needed"] = ["libpcre2-8.so.0", "libc.so.6"]
        self.observed["libc.so.6"]["needed"] = ["ld-linux-x86-64.so.2"]
        self.receipt = {
            "source": pin["source"], "workflowSha": pin["source"], "runId": pin["run"],
            "attempt": 1, "manifestSha256": pin["manifestSha256"], "runner": pin["runner"],
            "status": "STATIC_INVENTORY_ONLY", "ownedScratchRemoved": True,
            "runtimeAdmitted": False, "qualification": False, "externalIsolationProved": False,
            "reuseAuthorized": False, "unverifiedRuntimeDenials": self.plan["requiredRuntimeDenials"],
            "members": self.observed,
        }

    def bind_fixture_receipt(self, record):
        data = json.dumps(record, sort_keys=True, separators=(",", ":")).encode("ascii")
        plan = copy.deepcopy(self.plan)
        plan["inventory"]["receiptSha256"] = inputs.sha256(data)
        return plan, data

    def listing(self):
        resolved = ("libselinux.so.1", "libpcre2-8.so.0", "libcap.so.2", "libc.so.6")
        lines = ["linux-vdso.so.1 (0x12)", self.plan["interpreter"]["target"]+" (0x34)"]
        for name in resolved:
            lines.append(f"{name} => {self.plan['members'][name]['target']} (0x56)")
        return ("\n".join(lines)+"\n").encode("ascii")

    def test_exact_inventory_and_static_scope(self):
        plan, data = self.bind_fixture_receipt(self.receipt)
        self.assertEqual(inputs.verify_inventory(plan, data), self.observed)
        with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_RECEIPT_PIN"):
            inputs.verify_inventory(plan, data+b" ")
        for key, value in (
            ("runtimeAdmitted", True), ("qualification", True), ("reuseAuthorized", True),
            ("ownedScratchRemoved", False), ("externalIsolationProved", True),
            ("unverifiedRuntimeDenials", []), ("attempt", 2), ("workflowSha", "0"*40),
        ):
            with self.subTest(key=key):
                altered = self.receipt | {key: value}
                with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_RECEIPT_SCOPE"):
                    inputs.verify_inventory(*self.bind_fixture_receipt(altered))

    def test_inventory_refuses_member_drift(self):
        altered = copy.deepcopy(self.receipt)
        altered["members"]["libc.so.6"]["sha256"] = "0"*64
        with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_MEMBER_IDENTITY"):
            inputs.verify_inventory(*self.bind_fixture_receipt(altered))

    def test_member_bytes_bind_exact_targets_and_loader_alias(self):
        plan = copy.deepcopy(self.plan)
        payloads = {name: name.encode() for name in plan["members"]}
        for name, data in payloads.items():
            plan["members"][name].update(bytes=len(data), sha256=inputs.sha256(data))
        stage = inputs.bind_member_bytes(plan, payloads)
        self.assertEqual(len(stage), 8)
        interpreter = plan["interpreter"]["target"]
        self.assertEqual(stage[interpreter], stage[plan["members"]["ld-linux-x86-64.so.2"]["target"]])
        with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_PAYLOAD_SET"):
            inputs.bind_member_bytes(plan, payloads | {"unplanned": b"extra"})
        with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_PAYLOAD_PIN"):
            inputs.bind_member_bytes(plan, payloads | {"bwrap": b"wrong"})

    def test_local_member_read_requires_exact_regular_file_size(self):
        with tempfile.TemporaryDirectory(dir=".") as scratch:
            path = Path(scratch).resolve()/"member"
            path.write_bytes(b"offline fixture")
            self.assertEqual(inputs.read_local_member(path, 15), b"offline fixture")
            with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_PAYLOAD_PATH"):
                inputs.read_local_member(path, 14)
            with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_PAYLOAD_PATH"):
                inputs.read_local_member(path.parent, 15)

    def test_loader_listing_requires_exact_private_reachable_set(self):
        listing = self.listing()
        resolved = inputs.verify_loader_listing(self.plan, self.observed, listing)
        self.assertEqual(len(resolved), 5)
        self.assertNotIn("libgcc_s.so.1", resolved)
        paths = self.plan["members"]
        for value in (
            listing.replace(paths["libc.so.6"]["target"].encode(), b"/lib/x86_64-linux-gnu/libc.so.6"),
            listing.replace(paths["libcap.so.2"]["target"].encode(), b"not found"),
            listing+b"linux-vdso.so.1 (0x12)\n",
            listing+b"libgcc_s.so.1 => "+paths["libgcc_s.so.1"]["target"].encode()+b" (0x70)\n",
            listing.split(b"libc.so.6 =>", 1)[0],
        ):
            with self.subTest(value=value):
                with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_LISTING_"):
                    inputs.verify_loader_listing(self.plan, self.observed, value)
        with self.assertRaisesRegex(ValueError, "RUNTIME_INPUT_LISTING_SIZE"):
            inputs.verify_loader_listing(self.plan, self.observed, listing, b"loader warning")
