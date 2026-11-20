import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class CheckoutBootstrapTest(unittest.TestCase):
    def setUp(self):
        import jammy_preflight_checkout as bootstrap

        self.bootstrap = bootstrap
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.bundle = self.root / bootstrap.CONTROLLER
        self.bundle.mkdir(parents=True)
        self.entry = self.bundle / bootstrap.ENTRY
        self.data = b"# exact controller bytes\n"
        self.entry.write_bytes(self.data)
        self.publication = {"source": "a" * 40, "tree": "b" * 40}

    def verify(self, git_mode=b"100644", tree=b"b" * 40):
        digest = hashlib.sha1(b"blob " + str(len(self.data)).encode() + b"\0" + self.data).hexdigest()
        item = git_mode + b" blob " + digest.encode() + b" " + str(len(self.data)).encode()
        manifest = item + b"\t" + f"{self.bootstrap.CONTROLLER}/{self.bootstrap.ENTRY}".encode() + b"\0"
        revision = b"a" * 40 + b"\n" + tree + b"\n"
        with patch.object(self.bootstrap, "git", side_effect=(revision, manifest)):
            return self.bootstrap.verify_bundle(self.root, self.publication)

    def test_exact_checkout_preserves_only_the_tracked_entrypoint(self):
        self.assertEqual(self.verify(), self.entry)

    def test_untracked_module_refuses_even_when_tracked_hash_matches(self):
        (self.bundle / "provider.py").write_bytes(b"raise RuntimeError('fixture')")
        with self.assertRaisesRegex(ValueError, "JAMMY_CHECKOUT_FILE_SET"):
            self.verify()

    def test_same_size_mutation_and_nonregular_mode_refuse(self):
        self.entry.write_bytes(b"x" * len(self.data))
        with self.assertRaisesRegex(ValueError, "JAMMY_CHECKOUT_BLOB"):
            self.verify()
        with self.assertRaisesRegex(ValueError, "JAMMY_CHECKOUT_TREE_ENTRY"):
            self.verify(git_mode=b"120000")

    def test_wrong_git_tree_refuses_before_inspecting_worktree(self):
        with self.assertRaisesRegex(ValueError, "JAMMY_CHECKOUT_IDENTITY"):
            self.verify(tree=b"c" * 40)

    def test_failed_verification_does_not_handoff_to_application(self):
        import contextlib
        import io

        with (patch.object(self.bootstrap.sys, "platform", "linux"),
              patch.object(self.bootstrap, "current_publication", return_value=self.publication),
              patch.object(self.bootstrap, "verify_bundle", side_effect=ValueError("JAMMY_CHECKOUT_BLOB")),
              patch.object(os, "execv") as execute, contextlib.redirect_stdout(io.StringIO()) as output):
            self.assertEqual(self.bootstrap.main(["recover"]), 1)
            execute.assert_not_called()
            self.assertIn("JAMMY_CHECKOUT_BLOB", output.getvalue())
