from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "validate_animation_reconciliation.py"
SPEC = importlib.util.spec_from_file_location("validate_animation_reconciliation", SCRIPT)
assert SPEC and SPEC.loader
validator_module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = validator_module
SPEC.loader.exec_module(validator_module)


class ReconciliationFixture:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.source = root / "oa.md"
        self.matrix = root / "matrix.csv"
        self.ledger = root / "ledger.csv"
        self.manifest = root / "manifest.csv"
        self.source_records: dict[str, tuple[str, str]] = {}
        self.matrix_rows: list[dict[str, str]] = []
        self.ledger_rows: list[dict[str, str]] = []
        self.manifest_rows: list[dict[str, str]] = []
        self._build()

    @staticmethod
    def write_csv(path: Path, headers: tuple[str, ...] | list[str], rows: list[dict[str, str]]) -> None:
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(
                handle, fieldnames=headers, lineterminator="\n", extrasaction="ignore"
            )
            writer.writeheader()
            writer.writerows(rows)

    def write_source(self) -> None:
        lines = ["# OA source", ""]
        last_section = None
        for source_id in sorted(self.source_records):
            section, requirement = self.source_records[source_id]
            if section != last_section:
                lines.extend((f"## {section}", ""))
                last_section = section
            lines.extend((f"### {source_id}", requirement, ""))
        self.source.write_text("\n".join(lines), encoding="utf-8")

    def write_matrix(self, headers: list[str] | None = None) -> None:
        self.write_csv(self.matrix, headers or list(validator_module.MATRIX_REQUIRED_COLUMNS), self.matrix_rows)

    def write_ledger(self, headers: list[str] | None = None) -> None:
        self.write_csv(self.ledger, headers or list(validator_module.LEDGER_COLUMNS), self.ledger_rows)

    def write_manifest(self, headers: list[str] | None = None) -> None:
        self.write_csv(self.manifest, headers or list(validator_module.MANIFEST_COLUMNS), self.manifest_rows)

    def _matrix_row(self, matrix_id: str, oa_ids: str = "") -> dict[str, str]:
        return {
            "ID": matrix_id,
            "Correct library": "GSAP",
            "Expected trigger": "Named semantic trigger",
            "Recommended replay policy": "Presentation-only replay",
            "Reduced mode result": "Readable static state",
            "Implementation Status": "not_started",
            "Roadmap Phase": "Phase 3",
            "Project Lanternwake Phase": "Phase 3",
            "Architecture Dependency": "SceneHost v2",
            "Scene Host Required": "yes",
            "Ownership Contract Required": "yes",
            "Target Contract Required": "yes",
            "Blocked By": "",
            "Implemented In Commit": "",
            "Validation Status": "planned",
            "Acceptance Criteria": "Semantic state is readable after the trigger.",
            "Test Plan References": "Animation_System_Test_Plan.md section 17",
            "OA Source IDs": oa_ids,
            "OA Mapping Cardinality": "1" if oa_ids else "0",
            "Architecture Validation Status": "planned",
            "Architecture Evidence": "",
            "Validation Evidence": "",
        }

    def _ledger_row(
        self,
        ordinal: int,
        matrix_id: str,
        *,
        baseline: bool,
        shard: str,
    ) -> dict[str, str]:
        source_id = f"OA-{ordinal:03d}"
        section, requirement = self.source_records[source_id]
        digest = hashlib.sha256(
            f"{source_id}\n{section}\n{requirement}".encode("utf-8")
        ).hexdigest()
        return {
            "Schema Version": validator_module.SCHEMA_VERSION,
            "Shard ID": shard,
            "Source ID": source_id,
            "Source Ordinal": str(ordinal),
            "Source Section": section,
            "Source Requirement": requirement,
            "Source SHA256": digest,
            "Baseline Matrix IDs": matrix_id if baseline else "",
            "Baseline Coverage Status": "exact" if baseline else "missing",
            "Current Matrix IDs": matrix_id,
            "New Matrix IDs": "" if baseline else matrix_id,
            "Coverage Status": "exact",
            "Coverage Rationale": "One current matrix row preserves this requirement.",
            "Uncovered Scope": "",
            "Mapping Evidence": "Reviewed mapping fixture.",
            "Correct Libraries": "gsap",
            "Trigger": "Named semantic trigger",
            "Replay Policy": "Presentation-only replay",
            "Reduced Motion Behavior": "Readable static state",
            "Acceptance Criteria": "Semantic state is readable after the trigger.",
            "Test Plan References": "Animation_System_Test_Plan.md section 17",
            "Roadmap Phase": "Phase 3",
            "Project Lanternwake Phase": "Phase 3",
            "Implementation Status": "not_started",
            "Architecture Dependency": "SceneHost v2",
            "Scene Host Required": "yes",
            "Ownership Contract Required": "yes",
            "Target Contract Required": "yes",
            "Architecture Validation Status": "planned",
            "Architecture Evidence": "",
            "Blocked By": "",
            "Implemented In Commit": "",
            "Validation Status": "planned",
            "Validation Evidence": "",
            "Superseded By": "",
            "Disposition Decision ID": "",
            "Disposition Date": "",
            "Disposition Rationale": "",
            "Approval Reference": "",
            "Notes": "",
        }

    def _build(self) -> None:
        for ordinal in range(1, validator_module.OA_COUNT + 1):
            self.source_records[f"OA-{ordinal:03d}"] = (
                f"Section {(ordinal - 1) // 30 + 1}",
                f"Requirement {ordinal:03d}.",
            )
        self.write_source()

        frozen_ids = sorted(validator_module.FROZEN_CODEX_IDS)
        reverse: dict[str, str] = {}
        for ordinal in range(1, validator_module.EXPECTED_EXISTING_MAPPINGS + 1):
            reverse[frozen_ids[ordinal - 1]] = f"OA-{ordinal:03d}"
        for matrix_id in frozen_ids:
            self.matrix_rows.append(self._matrix_row(matrix_id, reverse.get(matrix_id, "")))
        for ordinal in range(
            validator_module.EXPECTED_EXISTING_MAPPINGS + 1, validator_module.OA_COUNT + 1
        ):
            matrix_id = f"MX-{139 + ordinal - validator_module.EXPECTED_EXISTING_MAPPINGS:03d}"
            self.matrix_rows.append(self._matrix_row(matrix_id, f"OA-{ordinal:03d}"))

        shard_ids: dict[str, list[str]] = {f"O{index}": [] for index in range(1, 8)}
        for ordinal in range(1, validator_module.OA_COUNT + 1):
            source_id = f"OA-{ordinal:03d}"
            shard = f"O{(ordinal - 1) % 7 + 1}"
            shard_ids[shard].append(source_id)
            if ordinal <= validator_module.EXPECTED_EXISTING_MAPPINGS:
                matrix_id = frozen_ids[ordinal - 1]
                baseline = True
            else:
                matrix_id = f"MX-{139 + ordinal - validator_module.EXPECTED_EXISTING_MAPPINGS:03d}"
                baseline = False
            self.ledger_rows.append(
                self._ledger_row(ordinal, matrix_id, baseline=baseline, shard=shard)
            )
        self.manifest_rows = [
            {"Shard ID": shard, "Source IDs": ";".join(source_ids)}
            for shard, source_ids in shard_ids.items()
        ]
        self.write_matrix()
        self.write_ledger()
        self.write_manifest()

    def validate(self, mode: str = "final"):
        return validator_module.ReconciliationValidator(mode=mode).validate(
            self.source, self.matrix, self.ledger, self.manifest
        )


class ReconciliationValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.fixture = ReconciliationFixture(Path(self.temp.name))

    def tearDown(self) -> None:
        self.temp.cleanup()

    @staticmethod
    def codes(report) -> set[str]:
        return {item.code for item in report.diagnostics}

    def test_green_fixture_and_cli_are_deterministic_and_read_only(self) -> None:
        self.assertEqual(len(validator_module.FROZEN_MATRIX_COLUMNS), 41)
        self.assertEqual(len(validator_module.MATRIX_REQUIRED_COLUMNS), 63)
        self.assertNotIn("Status Hazard", validator_module.MATRIX_REQUIRED_COLUMNS)
        report = self.fixture.validate()
        self.assertTrue(report.ok, [item.as_dict() for item in report.errors])
        self.assertEqual(report.accepted_unmapped, set())
        self.assertEqual(report.all_source_unresolved, set())
        self.assertEqual(report.matrix_rows, 361)
        self.assertEqual(report.existing_mappings, 97)
        self.assertEqual(report.dedicated_mappings, 141)

        paths = (self.fixture.source, self.fixture.matrix, self.fixture.ledger, self.fixture.manifest)
        before = {path: (path.stat().st_mtime_ns, path.read_bytes()) for path in paths}
        command = [
            sys.executable,
            str(SCRIPT),
            "--oa-source",
            str(self.fixture.source),
            "--matrix",
            str(self.fixture.matrix),
            "--ledger",
            str(self.fixture.ledger),
            "--shard-manifest",
            str(self.fixture.manifest),
            "--mode",
            "final",
            "--no-write",
            "--json",
        ]
        first = subprocess.run(command, check=False, capture_output=True, text=True)
        second = subprocess.run(command, check=False, capture_output=True, text=True)
        self.assertEqual(first.returncode, 0, first.stderr + first.stdout)
        self.assertEqual(first.stdout, second.stdout)
        payload = json.loads(first.stdout)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["accepted_total"], 458)
        after = {path: (path.stat().st_mtime_ns, path.read_bytes()) for path in paths}
        self.assertEqual(before, after)

    def test_partial_matrix_row_uses_frozen_remaining_limitation(self) -> None:
        row = next(
            item
            for item in self.fixture.matrix_rows
            if item["ID"] in validator_module.FROZEN_CODEX_IDS
        )
        row["Implementation Status"] = "partially_implemented"
        row["Architecture Evidence"] = "src/components/example.tsx wrapper boundary"
        row["Remaining limitation"] = "The later visual and browser proof remain."
        self.fixture.write_matrix()

        report = self.fixture.validate()
        row_diagnostics = [item for item in report.diagnostics if item.row == row["ID"]]
        self.assertFalse(
            any(item.code in {"E-STATUS-003", "E-STATUS-004", "W-STATUS-001"} for item in row_diagnostics),
            [item.as_dict() for item in row_diagnostics],
        )

    def test_source_count_gap_and_text_hash_mismatch(self) -> None:
        del self.fixture.source_records["OA-238"]
        self.fixture.write_source()
        self.fixture.ledger_rows[0]["Source SHA256"] = "0" * 64
        self.fixture.write_ledger()
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-OA-001", "E-OA-003", "E-OA-004"} <= codes)

    def test_schema_and_frozen_codex_subset(self) -> None:
        headers = [item for item in validator_module.MATRIX_REQUIRED_COLUMNS if item != "Roadmap Phase"]
        self.fixture.matrix_rows = [
            row for row in self.fixture.matrix_rows if row["ID"] != "AA-001"
        ]
        self.fixture.write_matrix(list(headers))
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-SCHEMA-001", "E-CODEX-001", "E-CODEX-002"} <= codes)

    def test_mapping_forward_reverse_cardinality_and_orphan(self) -> None:
        target = self.fixture.ledger_rows[0]["Current Matrix IDs"]
        target_row = next(row for row in self.fixture.matrix_rows if row["ID"] == target)
        target_row["OA Source IDs"] = ""
        target_row["OA Mapping Cardinality"] = "4"
        orphan = self.fixture._matrix_row("MX-281")
        self.fixture.matrix_rows.append(orphan)
        self.fixture.write_matrix()
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-MAP-004", "E-MAP-006", "E-MAP-007"} <= codes)

    def test_coverage_exact_combined_partial_and_missing_rules(self) -> None:
        first, second, third, fourth = self.fixture.ledger_rows[:4]
        shared_target = first["Current Matrix IDs"]
        second["Current Matrix IDs"] = shared_target
        second["Baseline Matrix IDs"] = shared_target
        second["Coverage Status"] = "exact"
        target_row = next(row for row in self.fixture.matrix_rows if row["ID"] == shared_target)
        target_row["OA Source IDs"] = "OA-001;OA-002"
        target_row["OA Mapping Cardinality"] = "2"
        old_second_target = next(
            row for row in self.fixture.matrix_rows if row["OA Source IDs"] == "OA-002"
        )
        old_second_target["OA Source IDs"] = ""
        old_second_target["OA Mapping Cardinality"] = "0"
        third["Coverage Status"] = "combined"
        fourth["Coverage Status"] = "partial"
        fourth["Uncovered Scope"] = ""
        self.fixture.ledger_rows[4]["Coverage Status"] = "missing"
        self.fixture.write_ledger()
        self.fixture.write_matrix()
        codes = self.codes(self.fixture.validate())
        self.assertTrue(
            {
                "E-COVERAGE-001",
                "E-COVERAGE-002",
                "E-COVERAGE-003",
                "E-COVERAGE-004",
            }
            <= codes
        )

    def test_status_commit_validation_and_blocker_rules(self) -> None:
        implemented, validated, blocked, architecture_blocked, asset, environment = (
            self.fixture.ledger_rows[:6]
        )
        implemented["Implementation Status"] = "implemented"
        validated["Implementation Status"] = "validated"
        validated["Implemented In Commit"] = "a" * 40
        blocked["Implementation Status"] = "blocked"
        architecture_blocked["Implementation Status"] = "architecture_blocked"
        architecture_blocked["Architecture Dependency"] = ""
        asset["Implementation Status"] = "blocked_external_asset"
        environment["Implementation Status"] = "blocked_environment"
        self.fixture.write_ledger()
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-STATUS-002", "E-STATUS-003", "E-STATUS-004"} <= codes)

    def test_phase3_blocked_statuses_preserve_prior_vocabulary_and_require_blockers(self) -> None:
        asset, environment = self.fixture.ledger_rows[:2]
        asset["Implementation Status"] = "blocked_external_asset"
        asset["Blocked By"] = "Phase 5 production Rive binary"
        environment["Implementation Status"] = "blocked_environment"
        environment["Blocked By"] = "Production browser evidence unavailable"
        self.fixture.write_ledger()

        report = self.fixture.validate()
        row_diagnostics = [
            item
            for item in report.diagnostics
            if item.row in {asset["Source ID"], environment["Source ID"]}
        ]
        self.assertFalse(
            any(item.code in {"E-SCHEMA-003", "E-STATUS-004"} for item in row_diagnostics),
            [item.as_dict() for item in row_diagnostics],
        )

    def test_architecture_ready_requires_architecture_evidence_without_visual_claim(self) -> None:
        row = self.fixture.ledger_rows[0]
        row["Implementation Status"] = "architecture_ready"
        row["Architecture Validation Status"] = "planned"
        row["Architecture Evidence"] = ""
        row["Validation Status"] = "passed"
        row["Implemented In Commit"] = "a" * 40
        row["Validation Evidence"] = "visual animation passed"
        self.fixture.write_ledger()
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-ARCH-001", "E-ARCH-002"} <= codes)

    def test_rejected_and_superseded_dispositions_require_evidence(self) -> None:
        rejected, superseded = self.fixture.ledger_rows[:2]
        rejected["Coverage Status"] = "rejected"
        rejected["Implementation Status"] = "rejected"
        rejected["Roadmap Phase"] = "Not Applicable"
        rejected["Project Lanternwake Phase"] = "Not Applicable"
        rejected["Correct Libraries"] = "none"
        superseded["Coverage Status"] = "superseded"
        superseded["Implementation Status"] = "superseded"
        self.fixture.write_ledger()
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-DISPOSITION-001", "E-DISPOSITION-002"} <= codes)

    def test_approved_terminal_dispositions_require_complete_evidence(self) -> None:
        rejected, superseded = self.fixture.ledger_rows[:2]
        rejected.update(
            {
                "Implementation Status": "rejected-approved",
                "Coverage Status": "rejected",
                "Validation Status": "not_applicable",
                "Implemented In Commit": "",
            }
        )
        superseded.update(
            {
                "Implementation Status": "superseded-approved",
                "Coverage Status": "superseded",
                "Validation Status": "not_applicable",
                "Implemented In Commit": "",
                "Superseded By": "MX-001",
            }
        )
        self.fixture.write_ledger()
        codes = self.codes(self.fixture.validate())
        self.assertIn("E-DISPOSITION-001", codes)

        decision = {
            "Disposition Decision ID": "P6-DISPOSITION-2026-07-22",
            "Disposition Date": "2026-07-22",
            "Disposition Rationale": "The requirement is explicitly terminal by approved design decision.",
            "Approval Reference": "Development_Docs/Project_Lanternwake_Completion_Receipt.md",
        }
        rejected.update(decision)
        superseded.update(decision)
        self.fixture.write_ledger()
        report = self.fixture.validate()
        self.assertTrue(report.ok, [item.as_dict() for item in report.errors])

    def test_final_repository_ledgers_are_resolved_and_hash_preserving(self) -> None:
        root = SCRIPT.parents[1]
        report = validator_module.ReconciliationValidator(mode="final").validate(
            root / "Development_Docs/KG_Original_Animation_Audit_Reconciliation_Source.md",
            root / "Development_Docs/Animation_System_Audit_Matrix.csv",
            root / "Development_Docs/Animation_Original_Audit_Reconciliation_Ledger.csv",
            root / "Development_Docs/Project_Lanternwake_Phase_2_Reconciliation_Shard_Manifest.csv",
        )
        self.assertTrue(report.ok, [item.as_dict() for item in report.errors])
        self.assertEqual(report.matrix_rows, 361)
        self.assertEqual(report.existing_mappings, 97)
        self.assertEqual(report.dedicated_mappings, 141)
        self.assertEqual(report.accepted_unmapped, set())
        self.assertEqual(report.all_source_unresolved, set())

    def test_phase_library_enums_and_required_semantic_fields(self) -> None:
        row = self.fixture.ledger_rows[0]
        row["Roadmap Phase"] = "Phase 3: Invented Name"
        row["Correct Libraries"] = "magic"
        row["Trigger"] = ""
        self.fixture.write_ledger()
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-PHASE-001", "E-LIBRARY-001", "E-REQUIREMENT-001"} <= codes)

    def test_list_serialization_schema_version_and_exact_header(self) -> None:
        row = self.fixture.ledger_rows[0]
        row["Schema Version"] = "v2"
        row["Current Matrix IDs"] = row["Current Matrix IDs"] + ", MX-999"
        headers = list(validator_module.LEDGER_COLUMNS)
        headers[0], headers[1] = headers[1], headers[0]
        self.fixture.write_ledger(headers)
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-SCHEMA-001", "E-SCHEMA-002", "E-SCHEMA-004"} <= codes)

    def test_shard_manifest_union_overlap_and_ledger_owner(self) -> None:
        self.fixture.manifest_rows[0]["Source IDs"] += ";OA-002"
        self.fixture.ledger_rows[2]["Shard ID"] = "O7"
        self.fixture.write_manifest()
        self.fixture.write_ledger()
        codes = self.codes(self.fixture.validate())
        self.assertTrue({"E-SHARD-002", "E-SHARD-003"} <= codes)

    def test_final_mode_rejects_missing_but_baseline_mode_allows_it(self) -> None:
        row = self.fixture.ledger_rows[0]
        row["Coverage Status"] = "missing"
        self.fixture.write_ledger()
        self.assertIn("E-COVERAGE-004", self.codes(self.fixture.validate("final")))
        self.assertNotIn("E-COVERAGE-004", self.codes(self.fixture.validate("baseline")))


if __name__ == "__main__":
    unittest.main()
