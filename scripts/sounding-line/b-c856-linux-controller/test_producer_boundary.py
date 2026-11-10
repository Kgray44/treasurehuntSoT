import tempfile
import unittest
from pathlib import Path
from producer_driver import system_destinations
from producer_boundary import BoundaryError, GIB, admitted_host_space, create_owned_scratch, verify_owned_scratch


class BoundaryTests(unittest.TestCase):
    def test_disk_reserve_covers_all_bounded_exports(self):
        with self.assertRaises(BoundaryError):
            admitted_host_space(3*GIB)
        self.assertGreater(admitted_host_space(5*GIB), 4*GIB)

    def test_failed_ownership_write_rolls_back_before_setup(self):
        with tempfile.TemporaryDirectory(dir=".") as root:
            target = Path(root).resolve()/"owned"
            def fail(*_):
                raise OSError("synthetic marker failure")
            with self.assertRaises(OSError):
                create_owned_scratch(target, "1234", marker_writer=fail)
            self.assertFalse(target.exists())
            create_owned_scratch(target, "1234")
            self.assertTrue(verify_owned_scratch(target, "1234"))
            self.assertFalse(verify_owned_scratch(target, "5678"))

    def test_host_proof_scope_includes_all_native_roles(self):
        system = {
            "usr/bin/python3",
            "children/app/usr/lib/python3.12/abc.py",
            "children/browser/usr/lib/x86_64-linux-gnu/libX11.so.6",
            "children/app/lib/x86_64-linux-gnu/libc.so.6",
            "lib64/ld-linux-x86-64.so.2",
        }
        other = {
            "usr/bin/bwrap",
            "children/browser/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "children/app/usr/bin/node",
            "children/browser/source/usr/bin/python3",
        }
        self.assertEqual(system_destinations(system | other), system)
