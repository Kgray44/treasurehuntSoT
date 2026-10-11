"""Exercise the actual distributed archive and preservation invariants."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("packager", ROOT / "package-launchdeck.py")
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)


class PackageTests(unittest.TestCase):
    def test_archive_equivalence_reproducibility_and_planner_execution(self):
        with tempfile.TemporaryDirectory() as temp:
            first = packager.package(Path(temp) / "first.zip")
            second = packager.package(Path(temp) / "second.zip")
            self.assertEqual(first["sha256"], second["sha256"])
            with zipfile.ZipFile(first["archive"]) as archive:
                names = archive.namelist()
                self.assertFalse(any(n.endswith("/mcp.json") or n.endswith("/.mcp.json") or "/server/" in n for n in names))
                for file in packager.SKILL.rglob("*"):
                    if file.is_file():
                        self.assertEqual(file.read_bytes(), archive.read("project-launchdeck/skills/launchdeck/" + file.relative_to(packager.SKILL).as_posix()))
                self.assertIn("project-launchdeck/skills/project-trim/SKILL.md", names)
                self.assertIn("project-launchdeck/skills/launch-task/SKILL.md", names)
                archive.extractall(Path(temp) / "extracted")
            request = {"projects": [{"projectId": "test", "label": "VoyageWright", "projectKind": "local"}],
                       "request": {"initiatives": ["Parallax"], "phase": "2", "phase_name": "Spatial Studio",
                                   "objective": "Read-only acceptance", "acceptance": ["Exact marker"]}}
            plugin = Path(temp) / "extracted/project-launchdeck"
            results = []
            for skill in ("launchdeck", "launch-task"):
                result = subprocess.run([sys.executable, "-B", str(plugin / "skills" / skill / "scripts/launchdeck.py"), "plan"],
                                        input=json.dumps(request), capture_output=True, text=True, check=True)
                results.append(json.loads(result.stdout))
            self.assertEqual(results[0], results[1])
            self.assertEqual(results[0]["title"], "Parallax Phase 2: Spatial Studio")

    def test_optional_adapter_export_still_includes_blocked_implementation(self):
        with tempfile.TemporaryDirectory() as temp:
            result = packager.package(Path(temp) / "development.zip", include_adapter=True)
            with zipfile.ZipFile(result["archive"]) as archive:
                self.assertIn("project-launchdeck/mcp.json", archive.namelist())
                server = archive.read("project-launchdeck/server/launchdeck_mcp.py").decode()
                self.assertIn('pluginOnlyAssociationVerified', server)
                self.assertIn('no conversation created', server)

    def test_original_assets_apps_and_prompts_preserved(self):
        baseline = ROOT.parents[1] / "outputs/launchdeck-skill/baseline"
        if not baseline.exists():
            self.skipTest("Account baseline is integration evidence, unavailable in fresh source clones")
        for path in (".app.json", "assets/logo.svg", "assets/logo-dark.svg"):
            self.assertEqual((baseline / path).read_bytes(), (packager.ROOT / path).read_bytes())
        before = json.loads((baseline / "plugin.json").read_text())
        after = json.loads((packager.ROOT / "plugin.json").read_text())
        before["version"] = after["version"]
        before["extensions"]["com.openai"]["interface"]["longDescription"] = after["extensions"]["com.openai"]["interface"]["longDescription"]
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main(verbosity=2)
