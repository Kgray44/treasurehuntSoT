from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).parents[1] / "sync_codex_chats.py"
SPEC = importlib.util.spec_from_file_location("chat_sync", SCRIPT)
sync = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = sync
SPEC.loader.exec_module(sync)


def chat(cid="c1", title="Forever Treasure Companion", messages=None, metadata=None, updated=2):
    messages = messages or [("user", "Forever Treasure Companion treasurehuntSoT request"), ("assistant", "Done")]
    mapping = {}
    parent = None
    for index, (role, text) in enumerate(messages):
        node = f"n{index}"
        mapping[node] = {
            "id": node,
            "parent": parent,
            "children": [],
            "message": {"author": {"role": role}, "create_time": index + 1, "content": {"content_type": "text", "parts": [text]}},
        }
        if parent:
            mapping[parent]["children"].append(node)
        parent = node
    result = {"id": cid, "title": title, "create_time": 1, "update_time": updated, "current_node": parent, "mapping": mapping}
    if metadata is not None:
        result["metadata"] = metadata
    return result


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp.name)
        (self.repo / ".codex").mkdir()
        self.config = {
            "archive_directory": "Codex_Chats",
            "automatic_push": False,
            "remote": "origin",
            "project_names": ["Forever Treasure Companion"],
            "project_identifiers": ["forever-project"],
            "repository_identifiers": ["Kgray44/treasurehuntSoT"],
            "project_keywords": ["Forever Treasure Companion", "treasurehuntSoT"],
            "workspace_paths": [str(self.repo)],
            "include_conversation_ids": [],
            "exclude_conversation_ids": [],
            "redact_secrets": True,
            "include_tool_output": True,
            "import_directories": ["Codex_Chats/imports"],
        }

    def tearDown(self):
        self.temp.cleanup()

    def source(self, value, name="conversations.json"):
        path = self.repo / name
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def run_sync(self, source, **kwargs):
        return sync.synchronize(self.repo, self.config, [source], no_commit=True, **kwargs)[0]

    def manifest(self):
        return json.loads((self.repo / "Codex_Chats/manifest.json").read_text(encoding="utf-8"))

    def init_git(self):
        subprocess.run(["git", "init", "-b", "main"], cwd=self.repo, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.email", "test@example.invalid"], cwd=self.repo, check=True)
        subprocess.run(["git", "config", "user.name", "Test"], cwd=self.repo, check=True)

    def git_commit_all(self, message):
        subprocess.run(["git", "add", "-A"], cwd=self.repo, check=True)
        subprocess.run(["git", "commit", "-m", message], cwd=self.repo, check=True, capture_output=True)

    def test_01_first_import_creates_conversation(self):
        report = self.run_sync(self.source([chat()]))
        self.assertEqual(report["added"], 1)
        self.assertEqual(len(list((self.repo / "Codex_Chats/chats").glob("*.md"))), 1)

    def test_02_identical_reimport_has_no_tracked_changes(self):
        source = self.source([chat()])
        self.run_sync(source)
        before = {p.relative_to(self.repo): p.read_bytes() for p in (self.repo / "Codex_Chats").rglob("*") if p.is_file()}
        report = self.run_sync(source)
        after = {p.relative_to(self.repo): p.read_bytes() for p in (self.repo / "Codex_Chats").rglob("*") if p.is_file()}
        self.assertEqual(before, after)
        self.assertEqual(report["unchanged"], 1)

    def test_03_new_message_updates_existing_file(self):
        source = self.source([chat()])
        self.run_sync(source)
        source.write_text(json.dumps([chat(messages=[("user", "Forever Treasure Companion treasurehuntSoT request"), ("assistant", "Done"), ("user", "More")], updated=3)]), encoding="utf-8")
        report = self.run_sync(source)
        self.assertEqual(report["updated"], 1)
        self.assertEqual(self.manifest()["conversations"][0]["message_count"], 3)

    def test_04_title_change_does_not_duplicate(self):
        source = self.source([chat()]); self.run_sync(source)
        old_path = self.manifest()["conversations"][0]["archive_path"]
        source.write_text(json.dumps([chat(title="Renamed Forever Treasure Companion")]), encoding="utf-8")
        self.run_sync(source)
        self.assertEqual(self.manifest()["conversations"][0]["archive_path"], old_path)
        self.assertEqual(len(list((self.repo / "Codex_Chats/chats").glob("*.md"))), 1)

    def test_05_same_title_different_ids_stay_separate(self):
        self.run_sync(self.source([chat("a"), chat("b")]))
        self.assertEqual(len(self.manifest()["conversations"]), 2)

    def test_06_unrelated_conversation_excluded(self):
        report = self.run_sync(self.source([chat(title="Cooking", messages=[("user", "make soup")])]))
        self.assertEqual((report["excluded"], report["added"]), (1, 0))

    def test_07_ambiguous_reported_not_archived(self):
        report = self.run_sync(self.source([chat(title="Maybe", messages=[("user", "Forever Treasure Companion")])]))
        self.assertEqual(report["ambiguous"], 1)
        self.assertEqual(report["added"], 0)
        self.assertEqual(report["ambiguous_candidates"][0]["conversation_id"], "c1")

    def test_08_explicit_include_override(self):
        self.config["include_conversation_ids"] = ["c1"]
        report = self.run_sync(self.source([chat(title="Cooking", messages=[("user", "soup")])]))
        self.assertEqual(report["added"], 1)

    def test_09_explicit_exclude_override(self):
        self.config["exclude_conversation_ids"] = ["c1"]
        report = self.run_sync(self.source([chat()]))
        self.assertEqual(report["excluded"], 1)

    def test_10_sensitive_values_redacted_or_block_push(self):
        value = chat(messages=[("user", "Forever Treasure Companion treasurehuntSoT\napi_key=sk-proj-abcdefghijklmnopqrstuvwxyz123456")])
        report = self.run_sync(self.source([value]))
        text = next((self.repo / "Codex_Chats/chats").glob("*.md")).read_text(encoding="utf-8")
        self.assertNotIn("abcdefghijklmnopqrstuvwxyz123456", text)
        self.assertGreater(report["redacted"], 0)
        jwt = "ey" + "JhbGciOiJIUzI1NiJ9" + ".abcdefghijklmnop.qrstuvwxyz12"
        scan = sync.redact_secrets(jwt)
        self.assertIn("possible_jwt", scan.suspected_categories)

    def test_11_partial_export_does_not_delete_archive(self):
        source = self.source([chat("a"), chat("b")]); self.run_sync(source)
        source.write_text(json.dumps([chat("a")]), encoding="utf-8"); self.run_sync(source)
        self.assertEqual(len(self.manifest()["conversations"]), 2)

    def test_12_corrupt_source_fails_without_archive_change(self):
        source = self.source([chat()]); self.run_sync(source)
        before = (self.repo / "Codex_Chats/manifest.json").read_bytes()
        source.write_text("[{bad", encoding="utf-8")
        with self.assertRaises(sync.SourceError):
            self.run_sync(source)
        self.assertEqual(before, (self.repo / "Codex_Chats/manifest.json").read_bytes())

    def test_13_interrupted_batch_restores_manifest(self):
        target = self.repo / "manifest.json"; target.write_text("old", encoding="utf-8")
        other = self.repo / "chat.md"; other.write_text("old-chat", encoding="utf-8")
        batch = sync.AtomicBatch(); batch.add(other, b"new-chat"); batch.add(target, b"new")
        real_replace = os.replace
        calls = 0
        def fail_second(src, dst):
            nonlocal calls
            calls += 1
            if calls == 2: raise OSError("simulated interruption")
            return real_replace(src, dst)
        with mock.patch.object(sync.os, "replace", side_effect=fail_second):
            with self.assertRaises(OSError): batch.commit()
        self.assertEqual(target.read_text(), "old")
        self.assertEqual(other.read_text(), "old-chat")

    def test_14_unrelated_git_changes_untouched(self):
        subprocess.run(["git", "init", "-b", "main"], cwd=self.repo, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.email", "test@example.invalid"], cwd=self.repo, check=True)
        subprocess.run(["git", "config", "user.name", "Test"], cwd=self.repo, check=True)
        (self.repo / "unrelated.txt").write_text("base")
        subprocess.run(["git", "add", "unrelated.txt"], cwd=self.repo, check=True)
        subprocess.run(["git", "commit", "-m", "base"], cwd=self.repo, check=True, capture_output=True)
        (self.repo / "unrelated.txt").write_text("user change")
        archive = self.repo / "Codex_Chats/chats/a.md"; archive.parent.mkdir(parents=True); archive.write_text("archive")
        cfg = dict(self.config); cfg["remote"] = "missing"
        with mock.patch.object(sync, "ensure_git_safe", return_value="main"):
            result = sync.commit_archive(self.repo, ["Codex_Chats/chats/a.md"], cfg, push=False)
        self.assertTrue(result["commit_created"])
        self.assertEqual((self.repo / "unrelated.txt").read_text(), "user change")
        self.assertIn("unrelated.txt", subprocess.run(["git", "status", "--short"], cwd=self.repo, text=True, capture_output=True).stdout)

    def test_15_no_commit_when_hashes_unchanged(self):
        source = self.source([chat()]); self.run_sync(source)
        report = self.run_sync(source)
        self.assertFalse(report["commit_created"])
        self.assertEqual(report["files_changed"], [])

    def test_16_windows_paths_and_unicode_titles_portable(self):
        self.assertEqual(sync.normalize_path(r"C:\Work\Repo"), "c:/work/repo")
        slug = sync.portable_slug("Café: Map? CON / 宝")
        self.assertNotRegex(slug, r'[<>:"/\\|?*]')
        self.assertLessEqual(len(slug), 64)

    def test_17_duplicate_records_reconciled_deterministically(self):
        warnings = []
        a = sync.parse_chatgpt_conversation(chat(updated=1), "a", "1" * 64, None)
        b = sync.parse_chatgpt_conversation(chat(messages=[("user", "Forever Treasure Companion treasurehuntSoT"), ("assistant", "new")], updated=3), "b", "2" * 64, None)
        chosen = sync.reconcile_duplicates([a, b], warnings)
        self.assertEqual(chosen[0].source_identifier, "b")
        self.assertTrue(warnings)

    def test_18_multiple_runs_idempotent(self):
        source = self.source([chat()]); self.run_sync(source)
        hashes = []
        for _ in range(3):
            self.run_sync(source)
            hashes.append(sync.sha256_file(self.repo / "Codex_Chats/manifest.json"))
        self.assertEqual(len(set(hashes)), 1)

    def test_19_concurrent_runs_locked(self):
        lock_path = self.repo / ".codex/chat-sync-cache/sync.lock"
        with sync.FileLock(lock_path):
            with self.assertRaises(sync.SyncError):
                with sync.FileLock(lock_path): pass
        self.assertFalse(lock_path.exists())

    def test_20_manifest_schema_validation_succeeds(self):
        self.run_sync(self.source([chat()]))
        self.assertEqual(sync.validate_manifest(self.manifest(), self.repo), [])
        schema = json.loads((SCRIPT.parents[1] / "Codex_Chats/schema/manifest.schema.json").read_text(encoding="utf-8"))
        self.assertEqual(schema["properties"]["schema_version"]["const"], "1.0")

    def test_21_development_docs_lifecycle_and_safety_exclusions(self):
        self.init_git()
        docs = self.repo / "Development_Docs"
        docs.mkdir()
        (docs / ".gitignore").write_text(".env\n~$*\n__pycache__/\ncredentials.*\n", encoding="utf-8")
        (self.repo / "base.txt").write_text("base", encoding="utf-8")
        self.git_commit_all("base")

        test_document = docs / "sync-test.md"
        test_document.write_text("first version\n", encoding="utf-8")
        report = sync.audit_development_docs(self.repo, self.config)
        self.assertEqual([item["path"] for item in report["changes"]["added"]], ["Development_Docs/sync-test.md"])
        self.assertIn("Development_Docs/sync-test.md", report["eligible_paths"])
        self.git_commit_all("add test document")

        test_document.write_text("second version\n", encoding="utf-8")
        report = sync.audit_development_docs(self.repo, self.config)
        self.assertEqual([item["path"] for item in report["changes"]["modified"]], ["Development_Docs/sync-test.md"])
        self.git_commit_all("modify test document")

        design = docs / "Design"
        design.mkdir()
        renamed = design / "renamed-sync-test.md"
        test_document.rename(renamed)
        report = sync.audit_development_docs(self.repo, self.config)
        self.assertEqual(len(report["changes"]["renamed"]), 1)
        self.assertEqual(report["changes"]["renamed"][0]["path"], "Development_Docs/Design/renamed-sync-test.md")
        self.assertEqual(report["changes"]["renamed"][0]["original_path"], "Development_Docs/sync-test.md")
        self.git_commit_all("rename test document")

        renamed.unlink()
        (docs / ".env").write_text("PASSWORD=local-only\n", encoding="utf-8")
        (docs / "~$notes.docx").write_bytes(b"office lock")
        cache = docs / "__pycache__"
        cache.mkdir()
        (cache / "cached.pyc").write_bytes(b"cache")
        (docs / "planning.md").write_text("api_key=ghp_" + "A" * 30, encoding="utf-8")
        (self.repo / "unrelated.txt").write_text("leave me alone", encoding="utf-8")
        report = sync.audit_development_docs(self.repo, self.config)
        self.assertEqual([item["path"] for item in report["changes"]["deleted"]], ["Development_Docs/Design/renamed-sync-test.md"])
        excluded = {item["path"] for item in report["excluded"]}
        self.assertIn("Development_Docs/.env", excluded)
        self.assertIn("Development_Docs/~$notes.docx", excluded)
        self.assertIn("Development_Docs/__pycache__/cached.pyc", excluded)
        self.assertIn("Development_Docs/planning.md", excluded)
        self.assertNotIn("Development_Docs/planning.md", report["eligible_paths"])

        subprocess.run(["git", "add", "-A", "--", *report["eligible_paths"]], cwd=self.repo, check=True)
        staged = subprocess.run(
            ["git", "diff", "--cached", "--name-only"], cwd=self.repo, check=True, text=True, capture_output=True
        ).stdout.splitlines()
        self.assertEqual(staged, ["Development_Docs/Design/renamed-sync-test.md"])
        self.assertNotIn("unrelated.txt", staged)

    def test_22_development_docs_large_file_and_empty_commit_protection(self):
        self.init_git()
        docs = self.repo / "Development_Docs"
        docs.mkdir()
        (docs / ".gitignore").write_text(".env\n", encoding="utf-8")
        self.git_commit_all("base")
        self.config["development_docs_warn_size_bytes"] = 10
        self.config["development_docs_max_git_size_bytes"] = 20
        (docs / "oversized.bin").write_bytes(b"ordinary documentation bytes")
        report = sync.audit_development_docs(self.repo, self.config)
        self.assertEqual(report["large_files"][0]["path"], "Development_Docs/oversized.bin")
        self.assertNotIn("Development_Docs/oversized.bin", report["eligible_paths"])
        self.assertTrue(any(item["path"] == "Development_Docs/oversized.bin" for item in report["excluded"]))
        result = sync.commit_archive(self.repo, [], self.config, push=False)
        self.assertFalse(result["commit_created"])
        self.assertEqual(subprocess.run(["git", "rev-list", "--count", "HEAD"], cwd=self.repo, check=True, text=True, capture_output=True).stdout.strip(), "1")

    def test_23_development_docs_are_part_of_the_existing_sync_run(self):
        self.init_git()
        docs = self.repo / "Development_Docs"
        docs.mkdir()
        (docs / ".gitignore").write_text(".env\n", encoding="utf-8")
        self.git_commit_all("base")
        (docs / "decision.md").write_text("Use the shared synchronization workflow.\n", encoding="utf-8")
        source = self.source([chat(title="Cooking", messages=[("user", "make soup")])])
        report, git_files = sync.synchronize(self.repo, self.config, [source], no_commit=True)
        self.assertEqual(report["excluded"], 1)
        self.assertEqual(report["development_docs"]["eligible_paths"], ["Development_Docs/decision.md"])
        self.assertEqual(git_files, ["Development_Docs/decision.md"])

    def test_24_development_docs_change_after_scan_stops_commit(self):
        self.init_git()
        docs = self.repo / "Development_Docs"
        docs.mkdir()
        (docs / ".gitignore").write_text(".env\n", encoding="utf-8")
        self.git_commit_all("base")
        document = docs / "decision.md"
        document.write_text("version one\n", encoding="utf-8")
        report = sync.audit_development_docs(self.repo, self.config)
        document.write_text("version two\n", encoding="utf-8")
        with mock.patch.object(sync, "ensure_git_safe", return_value="main"):
            with self.assertRaises(sync.GitSafetyError):
                sync.commit_archive(
                    self.repo,
                    report["eligible_paths"],
                    self.config,
                    push=False,
                    expected_fingerprints=report["eligible_fingerprints"],
                )
        self.assertEqual(
            subprocess.run(["git", "diff", "--cached", "--name-only"], cwd=self.repo, check=True, text=True, capture_output=True).stdout,
            "",
        )


if __name__ == "__main__":
    unittest.main()
