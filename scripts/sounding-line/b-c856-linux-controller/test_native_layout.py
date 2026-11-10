import unittest
from native_layout import LayoutError, archive_relative, loader_rows, publisher_projection


class ProducerTests(unittest.TestCase):
    def test_native_library_resolution_requires_fixed_system_paths(self):
        rows = (
            "linux-vdso.so.1 (0x123)\n"
            "libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x123)\n"
            "/lib64/ld-linux-x86-64.so.2 (0x123)\n"
        )
        self.assertEqual(loader_rows(rows), (
            "/lib/x86_64-linux-gnu/libc.so.6", "/lib64/ld-linux-x86-64.so.2",
        ))
        for invalid in ("libevil.so => /tmp/libevil.so (0x123)", "libc.so.6 => not found",
                        "libc.so.6 => /lib/x86_64-linux-gnu/../../tmp/fake (0x123)"):
            with self.assertRaises(LayoutError):
                loader_rows(invalid)

    def test_producer_projection_uses_free_bytes_and_counts_native_tar(self):
        g = 1 << 30
        self.assertEqual(publisher_projection(7*g, 2*g, 2*g)["additionalBytes"], 4*g)
        with self.assertRaises(LayoutError):
            publisher_projection(5*g, 2*g, 2*g)
        with self.assertRaises(LayoutError):
            publisher_projection(13*g, 4*g, 4*g)

    def test_no_build_and_package_credentials_or_symlink_shims_in_scope(self):
        self.assertEqual(archive_relative("node_modules/.prisma/client/index.js"),
                         "node_modules/.prisma/client/index.js")
        self.assertEqual(archive_relative("src/app/[id]/page.tsx"), "src/app/[id]/page.tsx")
        for value in (".env.local", "node_modules/pkg/.npmrc", ".git/config", "../../host", "etc/shadow"):
            with self.assertRaises(LayoutError):
                archive_relative(value)
