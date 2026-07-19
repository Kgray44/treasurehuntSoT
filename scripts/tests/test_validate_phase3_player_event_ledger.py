from __future__ import annotations

import csv
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "validate_phase3_player_event_ledger.py"
SPEC = importlib.util.spec_from_file_location(
    "validate_phase3_player_event_ledger", SCRIPT
)
assert SPEC and SPEC.loader
validator_module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = validator_module
SPEC.loader.exec_module(validator_module)


class Phase3LedgerFixture:
    def __init__(self, root: Path) -> None:
        self.path = root / "phase3-ledger.csv"
        self.rows = [
            self._row(event_type) for event_type in validator_module.EVENT_TYPES
        ]
        self.rows.extend(
            (
                self._row(
                    "JOURNAL_OPENING",
                    requirement_id="P3-JOURNAL-OPENING",
                    sections=("Journal",),
                ),
                self._row(
                    "PAGE_FLIP", requirement_id="P3-PAGE-FLIP", sections=("Journal",)
                ),
            )
        )
        self.write()

    @staticmethod
    def _sorted(items) -> str:
        return ";".join(sorted(items))

    def _row(
        self,
        event_type: str,
        *,
        requirement_id: str | None = None,
        sections=None,
    ) -> dict[str, str]:
        sections = sections or validator_module.SECTIONS
        return {
            "Requirement ID": requirement_id or f"P3-MATRIX-{event_type}",
            "Requirement Source": "Phase 3 brief section 33",
            "Event Type": event_type,
            "Scene Name": "progression-summary",
            "Global Presentation": "yes - readable global summary",
            "Relevant Section": self._sorted(sections),
            "Local Enhancement": "relevant section only",
            "Full Mode": "M1 full semantic outcome",
            "Gentle Mode": "M2 gentle semantic outcome",
            "Product Reduced": "M3 product-reduced semantic outcome",
            "Browser Reduced": "M4 browser reduced; M5 both reduced",
            "Replay": "supported without mutation",
            "Refresh Replay": "reconstructed from Player-safe history",
            "Skip": "settles readable state",
            "Interruption": "aborts and restores focus",
            "Offline/Reconnect": "sequence-sorted deduplicated delivery",
            "Required Targets": "progression-summary",
            "Target Contract": "one visible unique registered target",
            "Ownership Contract": "persistent host owns presentation",
            "Audio Labels": "intentional_silence",
            "Fallback": "readable static global summary",
            "Acknowledgment Policy": "eligible only after valid live receipt",
            "Viewports": self._sorted(validator_module.VIEWPORTS),
            "Unit Tests": "src/components/player/progression/contracts.test.ts",
            "Component Tests": "src/components/player/PlayerExperience.test.tsx",
            "E2E Tests": "tests/e2e/lanternwake-phase3.spec.ts",
            "Implementation Status": "validated",
            "Validation Status": "passed",
            "Source Files": "src/components/player/PlayerExperience.tsx",
            "Implemented Commit": "a" * 40,
            "Blocker": "",
            "Notes": "",
        }

    def write(self, headers=None) -> None:
        with self.path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=headers or validator_module.LEDGER_COLUMNS,
                lineterminator="\n",
                extrasaction="ignore",
            )
            writer.writeheader()
            writer.writerows(self.rows)

    def validate(self):
        return validator_module.Phase3PlayerEventLedgerValidator().validate(self.path)


class Phase3PlayerEventLedgerValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.fixture = Phase3LedgerFixture(Path(self.temp.name))

    def tearDown(self) -> None:
        self.temp.cleanup()

    @staticmethod
    def codes(report) -> set[str]:
        return {item.code for item in report.diagnostics}

    def test_green_fixture_cli_is_deterministic_and_read_only(self) -> None:
        self.assertEqual(len(validator_module.LEDGER_COLUMNS), 32)
        self.assertEqual(len(validator_module.EVENT_TYPES), 17)
        self.assertEqual(len(validator_module.SECTIONS), 6)
        report = self.fixture.validate()
        self.assertTrue(report.ok, [item.as_dict() for item in report.errors])
        self.assertEqual(len(report.matrix_cases), 102)
        self.assertEqual(report.event_types, set(validator_module.EVENT_TYPES))
        self.assertEqual(report.sections, set(validator_module.SECTIONS))

        before = (self.fixture.path.stat().st_mtime_ns, self.fixture.path.read_bytes())
        command = [
            sys.executable,
            str(SCRIPT),
            "--ledger",
            str(self.fixture.path),
            "--no-write",
            "--json",
        ]
        first = subprocess.run(command, check=False, capture_output=True, text=True)
        second = subprocess.run(command, check=False, capture_output=True, text=True)
        self.assertEqual(first.returncode, 0, first.stderr + first.stdout)
        self.assertEqual(first.stdout, second.stdout)
        payload = json.loads(first.stdout)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["matrix_cases"], 102)
        after = (self.fixture.path.stat().st_mtime_ns, self.fixture.path.read_bytes())
        self.assertEqual(before, after)

    def test_header_must_match_exact_32_column_order(self) -> None:
        headers = list(validator_module.LEDGER_COLUMNS)
        headers[0], headers[1] = headers[1], headers[0]
        self.fixture.write(headers)
        self.assertIn("E-P3-SCHEMA", self.codes(self.fixture.validate()))

    def test_requirement_identity_must_be_stable_unique_and_well_formed(self) -> None:
        self.fixture.rows[0]["Requirement ID"] = "free form identity"
        self.fixture.rows[1]["Requirement ID"] = self.fixture.rows[2]["Requirement ID"]
        self.fixture.write()
        diagnostics = self.fixture.validate().diagnostics
        identity = [item for item in diagnostics if item.code == "E-P3-IDENTITY"]
        self.assertGreaterEqual(len(identity), 2)

    def test_lists_are_semicolon_delimited_unique_sorted_and_canonical(self) -> None:
        row = self.fixture.rows[0]
        row["Event Type"] = "invented-event"
        row["Relevant Section"] = "Journal;Invented Room"
        row["Required Targets"] = "z-target;a-target"
        row["Audio Labels"] = "cue,other"
        row["Viewports"] = "1440x900;999x999"
        self.fixture.write()
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-P3-ENUM", "E-P3-LIST"} <= codes)

    def test_matrix_reports_missing_and_duplicate_cases(self) -> None:
        event = validator_module.EVENT_TYPES[0]
        row = self.fixture.rows[0]
        row["Relevant Section"] = self.fixture._sorted(
            section for section in validator_module.SECTIONS if section != "Journal"
        )
        duplicate = deepcopy(self.fixture.rows[1])
        duplicate["Requirement ID"] = "P3-MATRIX-DUPLICATE"
        duplicate["Event Type"] = validator_module.EVENT_TYPES[1]
        duplicate["Relevant Section"] = "Journal"
        self.fixture.rows.append(duplicate)
        self.fixture.write()

        report = self.fixture.validate()
        matrix_messages = [
            item.message for item in report.diagnostics if item.code == "E-P3-MATRIX"
        ]
        self.assertTrue(
            any(
                f"{event}@Journal" in message and "missing" in message
                for message in matrix_messages
            )
        )
        self.assertTrue(any("has 2 owners" in message for message in matrix_messages))

    def test_explicit_matrix_case_references_are_supported(self) -> None:
        row = self.fixture.rows[0]
        event = row["Event Type"]
        cases = sorted(f"{event}@{section}" for section in validator_module.SECTIONS)
        row["Event Type"] = "NOT_APPLICABLE"
        row["Relevant Section"] = self.fixture._sorted(validator_module.SECTIONS)
        row["Notes"] = (
            f"matrix-cases={';'.join(cases)} | carried by a cross-cutting requirement"
        )
        self.fixture.write()
        report = self.fixture.validate()
        self.assertTrue(report.ok, [item.as_dict() for item in report.errors])
        self.assertIn(event, report.event_types)

    def test_explicit_matrix_case_grammar_is_strict(self) -> None:
        row = self.fixture.rows[0]
        row["Event Type"] = "NOT_APPLICABLE"
        row["Notes"] = "matrix-cases=CHAPTER_RELEASED/Journal"
        self.fixture.write()
        codes = self.codes(self.fixture.validate())
        self.assertIn("E-P3-MATRIX", codes)

    def test_opening_pageflip_and_six_viewport_union_are_required(self) -> None:
        self.fixture.rows = self.fixture.rows[:17]
        for row in self.fixture.rows:
            row["Viewports"] = "1440x900"
        self.fixture.write()
        report = self.fixture.validate()
        coverage_messages = [
            item.message for item in report.diagnostics if item.code == "E-P3-COVERAGE"
        ]
        self.assertTrue(
            any("JOURNAL_OPENING" in message for message in coverage_messages)
        )
        self.assertTrue(any("PAGE_FLIP" in message for message in coverage_messages))
        self.assertTrue(
            any(
                "viewport coverage is incomplete" in message
                for message in coverage_messages
            )
        )

    def test_modes_and_semantic_contract_fields_are_required(self) -> None:
        row = self.fixture.rows[0]
        row["Full Mode"] = "full outcome without identifier"
        row["Browser Reduced"] = "M4 browser reduced"
        row["Acknowledgment Policy"] = ""
        self.fixture.write()
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-P3-MODE", "E-P3-REQUIRED"} <= codes)

    def test_matrix_case_requires_baseline_viewport_global_presentation_and_fallback(
        self,
    ) -> None:
        row = self.fixture.rows[0]
        row["Viewports"] = self.fixture._sorted(
            viewport
            for viewport in validator_module.VIEWPORTS
            if viewport != "1440x900"
        )
        row["Global Presentation"] = "none"
        row["Fallback"] = "not_applicable"
        self.fixture.write()
        coverage = [
            item
            for item in self.fixture.validate().diagnostics
            if item.code == "E-P3-COVERAGE"
        ]
        self.assertGreaterEqual(len(coverage), 3)

    def test_blocked_and_failed_statuses_require_concrete_blockers(self) -> None:
        for row, status in zip(
            self.fixture.rows[:3],
            ("architecture_blocked", "blocked_external_asset", "blocked_environment"),
        ):
            row["Implementation Status"] = status
            row["Implemented Commit"] = ""
        self.fixture.rows[3]["Validation Status"] = "blocked"
        self.fixture.write()
        blocker_diagnostics = [
            item
            for item in self.fixture.validate().diagnostics
            if item.code == "E-P3-BLOCKER"
        ]
        self.assertEqual(len(blocker_diagnostics), 4)

    def test_status_commit_source_test_and_validation_rules_are_strict(self) -> None:
        row = self.fixture.rows[0]
        row["Implementation Status"] = "validated"
        row["Validation Status"] = "planned"
        row["Implemented Commit"] = "short"
        row["Source Files"] = "not_applicable"
        row["Unit Tests"] = "not_applicable"
        row["Component Tests"] = "not_applicable"
        row["E2E Tests"] = "not_applicable"
        self.fixture.write()
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-P3-COMMIT", "E-P3-REQUIRED", "E-P3-STATUS"} <= codes)

    def test_partial_status_allows_blank_commit_with_source_and_remaining_scope(
        self,
    ) -> None:
        row = self.fixture.rows[0]
        row["Implementation Status"] = "partially_implemented"
        row["Validation Status"] = "in_progress"
        row["Implemented Commit"] = ""
        row["Notes"] = "Exact production viewport evidence remains pending."
        self.fixture.write()

        diagnostics = [
            item
            for item in self.fixture.validate().diagnostics
            if item.row == row["Requirement ID"]
        ]
        self.assertFalse(
            any(item.code in {"E-P3-COMMIT", "E-P3-REQUIRED"} for item in diagnostics),
            [item.as_dict() for item in diagnostics],
        )

    def test_paths_targets_audio_and_commit_tokens_are_validated(self) -> None:
        row = self.fixture.rows[0]
        row["Source Files"] = "C:\\absolute\\file.ts"
        row["Unit Tests"] = "../outside.test.ts"
        row["Required Targets"] = "Invalid Target"
        row["Audio Labels"] = "Bad Cue"
        row["Implemented Commit"] = "A" * 40
        self.fixture.write()
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-P3-LIST", "E-P3-COMMIT"} <= codes)


if __name__ == "__main__":
    unittest.main()
