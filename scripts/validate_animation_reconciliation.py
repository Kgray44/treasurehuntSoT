#!/usr/bin/env python3
"""Read-only validator for Project Lanternwake's 458 animation requirements.

The validator intentionally uses only the Python standard library and never
modifies its inputs.  It treats the 220 Codex audit records and the 238 OA
records as separately tagged obligations; a semantic mapping between them
never deduplicates either source record.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Mapping, Sequence


SCHEMA_VERSION = "lanternwake-reconciliation/v1"
OA_COUNT = 238
CODEX_COUNT = 220
ACCEPTED_TOTAL = OA_COUNT + CODEX_COUNT
EXPECTED_EXISTING_MAPPINGS = 97
EXPECTED_DEDICATED_MAPPINGS = 141

FROZEN_PREFIX_COUNTS: Mapping[str, int] = {
    "AS": 28,
    "AG": 2,
    "AR": 4,
    "AL": 3,
    "AC": 17,
    "AM": 14,
    "AK": 1,
    "AP": 6,
    "AD": 5,
    "AA": 1,
    "MX": 139,
}
FROZEN_CODEX_IDS = frozenset(
    f"{prefix}-{ordinal:03d}"
    for prefix, count in FROZEN_PREFIX_COUNTS.items()
    for ordinal in range(1, count + 1)
)
EXPECTED_OA_IDS = tuple(f"OA-{ordinal:03d}" for ordinal in range(1, OA_COUNT + 1))

MATRIX_ID_RE = re.compile(r"^(AA|AC|AD|AG|AK|AL|AM|AP|AR|AS|MX)-[0-9]{3,}$")
OA_ID_RE = re.compile(r"^OA-([0-9]{3})$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
DATE_RE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")

NORMALIZED_COLUMNS = (
    "Implementation Status",
    "Roadmap Phase",
    "Project Lanternwake Phase",
    "Architecture Dependency",
    "Scene Host Required",
    "Ownership Contract Required",
    "Target Contract Required",
    "Blocked By",
    "Implemented In Commit",
    "Validation Status",
)

FROZEN_MATRIX_COLUMNS = (
    "ID",
    "Audit categories",
    "Screen",
    "Role",
    "Component",
    "Animation or proposed animation",
    "Current library",
    "Correct library",
    "Current trigger",
    "Expected trigger",
    "Current replay policy",
    "Recommended replay policy",
    "Runs at all?",
    "Visible when run?",
    "Runs only once?",
    "Works after refresh?",
    "Works from every relevant section?",
    "Full mode result",
    "Gentle mode result",
    "Reduced mode result",
    "Mobile result",
    "Desktop result",
    "Required targets",
    "Missing targets",
    "Duplicate targets",
    "Ownership conflicts",
    "Cleanup status",
    "Fallback status",
    "Performance concerns",
    "Accessibility concerns",
    "Current quality",
    "Failure severity",
    "Recommended change",
    "Implementation complexity",
    "Implementation priority",
    "Test coverage",
    "Evidence",
    "Source files",
    "Phase 1 status",
    "Remaining limitation",
    "Current-main commit",
)

MATRIX_REQUIRED_COLUMNS = (
    *FROZEN_MATRIX_COLUMNS,
    *NORMALIZED_COLUMNS,
    "Acceptance Criteria",
    "Test Plan References",
    "OA Source IDs",
    "OA Mapping Cardinality",
    "Architecture Validation Status",
    "Architecture Evidence",
    "Validation Evidence",
    "Superseded By",
    "Disposition Decision ID",
    "Disposition Date",
    "Disposition Rationale",
    "Approval Reference",
)

LEDGER_COLUMNS = (
    "Schema Version",
    "Shard ID",
    "Source ID",
    "Source Ordinal",
    "Source Section",
    "Source Requirement",
    "Source SHA256",
    "Baseline Matrix IDs",
    "Baseline Coverage Status",
    "Current Matrix IDs",
    "New Matrix IDs",
    "Coverage Status",
    "Coverage Rationale",
    "Uncovered Scope",
    "Mapping Evidence",
    "Correct Libraries",
    "Trigger",
    "Replay Policy",
    "Reduced Motion Behavior",
    "Acceptance Criteria",
    "Test Plan References",
    "Roadmap Phase",
    "Project Lanternwake Phase",
    "Implementation Status",
    "Architecture Dependency",
    "Scene Host Required",
    "Ownership Contract Required",
    "Target Contract Required",
    "Architecture Validation Status",
    "Architecture Evidence",
    "Blocked By",
    "Implemented In Commit",
    "Validation Status",
    "Validation Evidence",
    "Superseded By",
    "Disposition Decision ID",
    "Disposition Date",
    "Disposition Rationale",
    "Approval Reference",
    "Notes",
)

MANIFEST_COLUMNS = ("Shard ID", "Source IDs")

IMPLEMENTATION_STATUSES = frozenset(
    {
        "not_started",
        "architecture_blocked",
        "architecture_ready",
        "partially_implemented",
        "implemented",
        "validated",
        "blocked",
        "blocked_external_asset",
        "blocked_environment",
        "superseded",
        "rejected",
        "superseded-approved",
        "rejected-approved",
    }
)
COVERAGE_STATUSES = frozenset(
    {"exact", "combined", "partial", "missing", "rejected", "superseded"}
)
VALIDATION_STATUSES = frozenset(
    {"not_started", "planned", "in_progress", "passed", "failed", "blocked", "not_applicable"}
)
BOOLEAN_VALUES = frozenset({"yes", "no"})
PHASES = frozenset(
    {"Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5", "Phase 6", "Not Applicable"}
)
LIBRARIES = frozenset(
    {
        "gsap",
        "motion",
        "st_page_flip",
        "rive",
        "lottie",
        "css",
        "web_animations_api",
        "web_audio",
        "dnd_kit",
        "none",
    }
)
TERMINAL_DISPOSITIONS = frozenset({"rejected", "superseded"})
APPROVED_TERMINAL_DISPOSITIONS: Mapping[str, str] = {
    "rejected-approved": "rejected",
    "superseded-approved": "superseded",
}
TERMINAL_IMPLEMENTATION_STATUSES = frozenset(
    {*TERMINAL_DISPOSITIONS, *APPROVED_TERMINAL_DISPOSITIONS}
)


@dataclass(frozen=True, order=True)
class Diagnostic:
    code: str
    source: str
    row: str
    message: str
    severity: str = field(default="error", compare=False)

    def as_dict(self) -> dict[str, str]:
        return {
            "severity": self.severity,
            "code": self.code,
            "source": self.source,
            "row": self.row,
            "message": self.message,
        }


@dataclass(frozen=True)
class OASourceRecord:
    source_id: str
    ordinal: int
    section: str
    requirement: str

    @property
    def digest(self) -> str:
        value = f"{self.source_id}\n{self.section}\n{self.requirement}"
        return hashlib.sha256(value.encode("utf-8")).hexdigest()


@dataclass
class ValidationReport:
    diagnostics: list[Diagnostic]
    accepted_unmapped: set[str]
    all_source_unresolved: set[str]
    matrix_rows: int
    existing_mappings: int
    dedicated_mappings: int
    coverage_totals: Counter[str]
    implementation_totals: Counter[str]

    @property
    def errors(self) -> list[Diagnostic]:
        return [item for item in self.diagnostics if item.severity == "error"]

    @property
    def warnings(self) -> list[Diagnostic]:
        return [item for item in self.diagnostics if item.severity == "warning"]

    @property
    def ok(self) -> bool:
        return not self.errors

    def as_dict(self) -> dict[str, object]:
        return {
            "ok": self.ok,
            "accepted_total": ACCEPTED_TOTAL,
            "codex_requirements": CODEX_COUNT,
            "oa_requirements": OA_COUNT,
            "current_matrix_rows": self.matrix_rows,
            "existing_mappings": self.existing_mappings,
            "dedicated_mappings": self.dedicated_mappings,
            "accepted_unmapped": len(self.accepted_unmapped),
            "all_source_unresolved": len(self.all_source_unresolved),
            "coverage_totals": dict(sorted(self.coverage_totals.items())),
            "implementation_totals": dict(sorted(self.implementation_totals.items())),
            "errors": len(self.errors),
            "warnings": len(self.warnings),
            "diagnostics": [item.as_dict() for item in sorted(self.diagnostics)],
        }


class ReconciliationValidator:
    def __init__(self, *, mode: str = "final") -> None:
        self.mode = mode
        self.diagnostics: list[Diagnostic] = []
        self.codex_failures: set[str] = set()
        self.oa_failures: set[str] = set()
        self.codex_terminal: set[str] = set()
        self.oa_terminal: set[str] = set()

    def add(
        self,
        code: str,
        source: str,
        row: str,
        message: str,
        *,
        record: str | None = None,
        severity: str = "error",
    ) -> None:
        self.diagnostics.append(Diagnostic(code, source, row, message, severity))
        if severity != "error" or record is None:
            return
        if record.startswith("CODEX/"):
            self.codex_failures.add(record)
        elif record.startswith("OA/"):
            self.oa_failures.add(record)

    def _read_csv(self, path: Path, source: str) -> tuple[list[str], list[dict[str, str]]]:
        try:
            with path.open("r", encoding="utf-8-sig", newline="") as handle:
                reader = csv.DictReader(handle)
                headers = list(reader.fieldnames or [])
                rows = [{key: (value or "").strip() for key, value in row.items()} for row in reader]
        except (OSError, UnicodeError, csv.Error) as exc:
            self.add("E-SCHEMA-001", source, "file", f"cannot read {path}: {exc}")
            return [], []
        if len(headers) != len(set(headers)):
            self.add("E-SCHEMA-001", source, "header", "duplicate CSV column names")
        return headers, rows

    def _require_columns(
        self, headers: Sequence[str], required: Sequence[str], source: str, *, exact_order: bool = False
    ) -> bool:
        missing = [name for name in required if name not in headers]
        for name in missing:
            self.add("E-SCHEMA-001", source, "header", f"missing required column: {name}")
        if exact_order and not missing and tuple(headers) != tuple(required):
            self.add("E-SCHEMA-001", source, "header", "columns do not match the frozen ordered schema")
            return False
        return not missing

    def _parse_oa_source(self, path: Path) -> dict[str, OASourceRecord]:
        try:
            lines = path.read_text(encoding="utf-8-sig").splitlines()
        except (OSError, UnicodeError) as exc:
            self.add("E-OA-001", "oa-source", "file", f"cannot read {path}: {exc}")
            return {}

        records: dict[str, OASourceRecord] = {}
        duplicates: set[str] = set()
        section = ""
        index = 0
        while index < len(lines):
            line = lines[index].strip()
            if line.startswith("## ") and not line.startswith("### "):
                section = line[3:].strip()
                index += 1
                continue
            match = re.fullmatch(r"###\s+(OA-[0-9]{3})", line)
            if not match:
                index += 1
                continue
            source_id = match.group(1)
            body: list[str] = []
            index += 1
            while index < len(lines) and not lines[index].lstrip().startswith("#"):
                if lines[index].strip():
                    body.append(lines[index].strip())
                index += 1
            requirement = " ".join(body).strip()
            ordinal = int(source_id[3:])
            if source_id in records:
                duplicates.add(source_id)
            else:
                records[source_id] = OASourceRecord(source_id, ordinal, section, requirement)

        for source_id in sorted(duplicates):
            self.add("E-OA-002", "oa-source", source_id, "duplicate OA source heading", record=f"OA/{source_id}")
        if len(records) != OA_COUNT:
            self.add("E-OA-001", "oa-source", "count", f"expected {OA_COUNT} unique records; found {len(records)}")
        actual = set(records)
        expected = set(EXPECTED_OA_IDS)
        if actual != expected:
            missing = sorted(expected - actual)
            extra = sorted(actual - expected)
            self.add(
                "E-OA-003",
                "oa-source",
                "range",
                f"OA range mismatch; missing={missing[:8]} extra={extra[:8]}",
            )
        for source_id, record in records.items():
            if not record.section or not record.requirement:
                self.add(
                    "E-REQUIREMENT-001",
                    "oa-source",
                    source_id,
                    "source section and requirement must be nonblank",
                    record=f"OA/{source_id}",
                )
        return records

    def _parse_list(
        self,
        value: str,
        *,
        source: str,
        row: str,
        field_name: str,
        item_pattern: re.Pattern[str] | None = None,
        allow_empty: bool = True,
        record: str | None = None,
    ) -> tuple[str, ...]:
        if not value:
            if not allow_empty:
                self.add("E-MAP-001", source, row, f"{field_name} is empty", record=record)
            return ()
        if any(token in value for token in (",", "[", "]", "{", "}")) or ".." in value:
            self.add(
                "E-SCHEMA-004",
                source,
                row,
                f"{field_name} must be a semicolon-delimited set, not prose/range/JSON",
                record=record,
            )
        items = tuple(item.strip() for item in value.split(";") if item.strip())
        if len(items) != len(set(items)):
            self.add("E-MAP-003", source, row, f"{field_name} contains duplicate items", record=record)
        if tuple(sorted(set(items))) != items:
            self.add("E-SCHEMA-004", source, row, f"{field_name} must be unique and lexically sorted", record=record)
        if item_pattern is not None:
            for item in items:
                if not item_pattern.fullmatch(item):
                    self.add("E-SCHEMA-004", source, row, f"invalid {field_name} item: {item}", record=record)
        return tuple(dict.fromkeys(items))

    def _enum(
        self,
        value: str,
        allowed: frozenset[str],
        source: str,
        row: str,
        field_name: str,
        *,
        code: str = "E-SCHEMA-003",
        record: str | None = None,
    ) -> bool:
        if value in allowed:
            return True
        self.add(code, source, row, f"invalid {field_name}: {value!r}", record=record)
        return False

    @staticmethod
    def _terminal_kind(status: str) -> str | None:
        if status in TERMINAL_DISPOSITIONS:
            return status
        return APPROVED_TERMINAL_DISPOSITIONS.get(status)

    def _validate_phases(self, row: Mapping[str, str], source: str, row_id: str, record: str) -> None:
        status = row.get("Implementation Status", "")
        for field_name in ("Roadmap Phase", "Project Lanternwake Phase"):
            value = row.get(field_name, "")
            if not self._enum(value, PHASES, source, row_id, field_name, code="E-PHASE-001", record=record):
                continue
            terminal_kind = self._terminal_kind(status)
            if value == "Not Applicable" and terminal_kind != "rejected":
                self.add(
                    "E-PHASE-001",
                    source,
                    row_id,
                    "Not Applicable is permitted only for rejected requirements",
                    record=record,
                )
            if terminal_kind == "superseded" and value == "Not Applicable":
                self.add("E-PHASE-001", source, row_id, "superseded rows use the replacement phase", record=record)

    def _validate_status(self, row: Mapping[str, str], source: str, row_id: str, record: str) -> None:
        status = row.get("Implementation Status", "")
        validation = row.get("Validation Status", "")
        architecture_validation = row.get("Architecture Validation Status", "")
        self._enum(status, IMPLEMENTATION_STATUSES, source, row_id, "Implementation Status", record=record)
        self._enum(validation, VALIDATION_STATUSES, source, row_id, "Validation Status", record=record)
        self._enum(
            architecture_validation,
            VALIDATION_STATUSES,
            source,
            row_id,
            "Architecture Validation Status",
            record=record,
        )
        for field_name in ("Scene Host Required", "Ownership Contract Required", "Target Contract Required"):
            self._enum(row.get(field_name, ""), BOOLEAN_VALUES, source, row_id, field_name, record=record)

        commits = self._parse_list(
            row.get("Implemented In Commit", ""),
            source=source,
            row=row_id,
            field_name="Implemented In Commit",
            item_pattern=COMMIT_RE,
            record=record,
        )
        evidence = (row.get("Architecture Evidence", "") + " " + row.get("Validation Evidence", "")).strip()
        terminal_kind = self._terminal_kind(status)
        if status in {"implemented", "validated"}:
            if not commits:
                self.add("E-STATUS-002", source, row_id, f"{status} requires a real 40-hex commit", record=record)
            if not evidence:
                self.add("E-STATUS-003", source, row_id, f"{status} requires implementation/test evidence", record=record)
        if status == "validated" and (validation != "passed" or not row.get("Validation Evidence", "")):
            self.add(
                "E-STATUS-003",
                source,
                row_id,
                "validated requires Validation Status=passed and Validation Evidence",
                record=record,
            )
        if terminal_kind:
            if validation != "not_applicable":
                self.add(
                    "E-DISPOSITION-003",
                    source,
                    row_id,
                    "approved terminal disposition requires Validation Status=not_applicable",
                    record=record,
                )
            if commits:
                self.add(
                    "E-DISPOSITION-003",
                    source,
                    row_id,
                    "approved terminal disposition cannot claim an implementation commit",
                    record=record,
                )
            required = (
                "Disposition Decision ID",
                "Disposition Date",
                "Disposition Rationale",
                "Approval Reference",
            )
            if not all(row.get(name, "") for name in required):
                self.add(
                    "E-DISPOSITION-001",
                    source,
                    row_id,
                    "approved terminal disposition requires decision, date, rationale, and approval",
                    record=record,
                )
            if terminal_kind == "superseded" and not row.get("Superseded By", ""):
                self.add(
                    "E-DISPOSITION-002",
                    source,
                    row_id,
                    "approved supersession requires an explicit replacement",
                    record=record,
                )
        if status == "partially_implemented":
            if source == "matrix":
                remaining = row.get("Remaining limitation", "") or row.get("Blocked By", "")
            else:
                remaining = row.get("Uncovered Scope", "") or row.get("Blocked By", "")
            if not evidence:
                self.add("E-STATUS-003", source, row_id, "partial implementation requires evidence", record=record)
            if not remaining:
                self.add(
                    "E-STATUS-004",
                    source,
                    row_id,
                    "partial implementation requires explicit remaining scope",
                    record=record,
                )
                self.add(
                    "W-STATUS-001",
                    source,
                    row_id,
                    "partial implementation has weak or missing remaining-scope detail",
                    severity="warning",
                )
        if status in {"blocked", "blocked_external_asset", "blocked_environment"} and not row.get(
            "Blocked By", ""
        ):
            self.add(
                "E-STATUS-004",
                source,
                row_id,
                f"{status} requires Blocked By",
                record=record,
            )
        if status == "architecture_blocked" and (
            not row.get("Architecture Dependency", "") or not row.get("Blocked By", "")
        ):
            self.add(
                "E-STATUS-004",
                source,
                row_id,
                "architecture_blocked requires Architecture Dependency and Blocked By",
                record=record,
            )
        if status == "architecture_ready":
            coverage = row.get("Coverage Status", "exact")
            if coverage not in {"exact", "combined", "partial"}:
                self.add(
                    "E-ARCH-001",
                    source,
                    row_id,
                    "architecture_ready requires exact, combined, or partial coverage",
                    record=record,
                )
            if architecture_validation != "passed" or not row.get("Architecture Evidence", ""):
                self.add(
                    "E-ARCH-001",
                    source,
                    row_id,
                    "architecture_ready requires passed architecture validation and evidence",
                    record=record,
                )
            if validation not in {"not_started", "planned"} or commits:
                self.add(
                    "E-ARCH-002",
                    source,
                    row_id,
                    "architecture_ready cannot carry visual validation or an implementation commit",
                    record=record,
                )
        if row.get("Project Lanternwake Phase") == "Phase 2" and not (
            evidence or row.get("Blocked By", "")
        ):
            self.add(
                "E-REQUIREMENT-001",
                source,
                row_id,
                "Phase 2 row requires evidence or an explicit blocker",
                record=record,
            )

    def _validate_required_text(self, row: Mapping[str, str], source: str, row_id: str, record: str) -> None:
        fields = (
            "Trigger",
            "Replay Policy",
            "Reduced Motion Behavior",
            "Acceptance Criteria",
            "Test Plan References",
        )
        if source == "matrix":
            fields = ("Acceptance Criteria", "Test Plan References")
            if row.get("Implementation Status", "") not in TERMINAL_IMPLEMENTATION_STATUSES:
                fields = (
                    "Expected trigger",
                    "Recommended replay policy",
                    "Reduced mode result",
                    *fields,
                )
        for field_name in fields:
            if not row.get(field_name, ""):
                self.add(
                    "E-REQUIREMENT-001",
                    source,
                    row_id,
                    f"{field_name} must be nonblank",
                    record=record,
                )

    def _validate_manifest(
        self, path: Path, ledger_rows: Sequence[Mapping[str, str]]
    ) -> dict[str, str]:
        headers, rows = self._read_csv(path, "shard-manifest")
        if not self._require_columns(headers, MANIFEST_COLUMNS, "shard-manifest", exact_order=True):
            return {}
        owner: dict[str, str] = {}
        seen_shards: set[str] = set()
        for line, row in enumerate(rows, start=2):
            shard = row.get("Shard ID", "")
            if not re.fullmatch(r"O[1-7]", shard):
                self.add("E-SHARD-001", "shard-manifest", str(line), f"invalid shard: {shard!r}")
            if shard in seen_shards:
                self.add("E-SHARD-003", "shard-manifest", str(line), f"duplicate shard row: {shard}")
            seen_shards.add(shard)
            ids = self._parse_list(
                row.get("Source IDs", ""),
                source="shard-manifest",
                row=str(line),
                field_name="Source IDs",
                item_pattern=OA_ID_RE,
                allow_empty=False,
            )
            for source_id in ids:
                if source_id in owner:
                    self.add(
                        "E-SHARD-003",
                        "shard-manifest",
                        source_id,
                        f"source overlaps {owner[source_id]} and {shard}",
                    )
                owner[source_id] = shard
        missing_shards = sorted({f"O{i}" for i in range(1, 8)} - seen_shards)
        if missing_shards:
            self.add("E-SHARD-001", "shard-manifest", "shards", f"missing shard rows: {missing_shards}")
        outside = sorted(set(owner) - set(EXPECTED_OA_IDS))
        missing = sorted(set(EXPECTED_OA_IDS) - set(owner))
        if outside or missing:
            self.add(
                "E-SHARD-002",
                "shard-manifest",
                "union",
                f"manifest union mismatch; missing={missing[:8]} outside={outside[:8]}",
            )
        for row in ledger_rows:
            source_id = row.get("Source ID", "")
            shard = row.get("Shard ID", "")
            if owner.get(source_id) != shard:
                self.add(
                    "E-SHARD-002",
                    "ledger",
                    source_id or "unknown",
                    f"ledger shard {shard!r} does not match manifest owner {owner.get(source_id)!r}",
                    record=f"OA/{source_id}",
                )
        return owner

    def validate(self, oa_source: Path, matrix: Path, ledger: Path, shard_manifest: Path) -> ValidationReport:
        sources = self._parse_oa_source(oa_source)
        matrix_headers, matrix_rows = self._read_csv(matrix, "matrix")
        ledger_headers, ledger_rows = self._read_csv(ledger, "ledger")
        matrix_schema_ok = self._require_columns(matrix_headers, MATRIX_REQUIRED_COLUMNS, "matrix")
        ledger_schema_ok = self._require_columns(
            ledger_headers, LEDGER_COLUMNS, "ledger", exact_order=True
        )
        self._validate_manifest(shard_manifest, ledger_rows if ledger_schema_ok else [])

        if not matrix_schema_ok:
            self.codex_failures.update(f"CODEX/{item}" for item in FROZEN_CODEX_IDS)
        if not ledger_schema_ok:
            self.oa_failures.update(f"OA/{item}" for item in EXPECTED_OA_IDS)

        matrix_by_id: dict[str, dict[str, str]] = {}
        reverse_edges: set[tuple[str, str]] = set()
        reverse_targets: defaultdict[str, set[str]] = defaultdict(set)
        matrix_lists: dict[str, tuple[str, ...]] = {}

        for line, row in enumerate(matrix_rows, start=2):
            row_id = row.get("ID", "") or f"line-{line}"
            record = f"CODEX/{row_id}" if row_id in FROZEN_CODEX_IDS else None
            if row_id in matrix_by_id:
                self.add("E-MATRIX-001", "matrix", row_id, "duplicate matrix ID", record=record)
                continue
            matrix_by_id[row_id] = row
            if not MATRIX_ID_RE.fullmatch(row_id):
                self.add("E-MATRIX-002", "matrix", row_id, "invalid matrix ID/prefix", record=record)
            oa_ids = self._parse_list(
                row.get("OA Source IDs", ""),
                source="matrix",
                row=row_id,
                field_name="OA Source IDs",
                item_pattern=OA_ID_RE,
                record=record,
            )
            matrix_lists[row_id] = oa_ids
            for source_id in oa_ids:
                edge = (source_id, row_id)
                if edge in reverse_edges:
                    self.add("E-MAP-003", "matrix", row_id, f"duplicate reverse edge {source_id}", record=record)
                reverse_edges.add(edge)
                reverse_targets[row_id].add(source_id)
            try:
                declared_cardinality = int(row.get("OA Mapping Cardinality", ""))
            except ValueError:
                declared_cardinality = -1
            if declared_cardinality != len(set(oa_ids)):
                self.add(
                    "E-MAP-006",
                    "matrix",
                    row_id,
                    f"OA Mapping Cardinality={declared_cardinality}; actual={len(set(oa_ids))}",
                    record=record,
                )
                self.oa_failures.update(f"OA/{source_id}" for source_id in oa_ids)
            if row_id not in FROZEN_CODEX_IDS and not oa_ids:
                self.add("E-MAP-007", "matrix", row_id, "new matrix row has no OA reverse mapping")
            if row_id not in FROZEN_CODEX_IDS and row_id.split("-", 1)[0] != "MX":
                self.add(
                    "W-PREFIX-001",
                    "matrix",
                    row_id,
                    "new rows normally continue the MX family",
                    severity="warning",
                )

            if record and matrix_schema_ok:
                if row.get("Implementation Status", "") in TERMINAL_IMPLEMENTATION_STATUSES:
                    self.codex_terminal.add(record)
                self._validate_phases(row, "matrix", row_id, record)
                self._validate_status(row, "matrix", row_id, record)
                self._validate_required_text(row, "matrix", row_id, record)
                if (
                    not row.get("Correct library", "")
                    and row.get("Implementation Status", "") not in TERMINAL_IMPLEMENTATION_STATUSES
                ):
                    self.add("E-LIBRARY-001", "matrix", row_id, "Correct library must be nonblank", record=record)

        present_frozen = set(matrix_by_id) & FROZEN_CODEX_IDS
        if len(present_frozen) != CODEX_COUNT:
            self.add(
                "E-CODEX-001",
                "matrix",
                "frozen-set",
                f"expected {CODEX_COUNT} frozen Codex IDs; found {len(present_frozen)}",
            )
        for missing_id in sorted(FROZEN_CODEX_IDS - set(matrix_by_id)):
            self.add(
                "E-CODEX-002",
                "matrix",
                missing_id,
                "frozen Codex ID is missing",
                record=f"CODEX/{missing_id}",
            )

        # New ordinals are append-only and gap-free inside each established family.
        by_prefix: defaultdict[str, list[int]] = defaultdict(list)
        for matrix_id in matrix_by_id:
            match = MATRIX_ID_RE.fullmatch(matrix_id)
            if match:
                by_prefix[match.group(1)].append(int(matrix_id.split("-")[1]))
        for prefix, ordinals in by_prefix.items():
            if sorted(ordinals) != list(range(1, max(ordinals) + 1)):
                self.add("E-MATRIX-003", "matrix", prefix, "matrix ordinals contain a gap or reuse")

        ledger_by_id: dict[str, dict[str, str]] = {}
        forward_edges: set[tuple[str, str]] = set()
        ledger_targets: dict[str, tuple[str, ...]] = {}
        coverage_totals: Counter[str] = Counter()
        implementation_totals: Counter[str] = Counter()
        existing_mappings = 0
        dedicated_mappings = 0

        for line, row in enumerate(ledger_rows, start=2):
            source_id = row.get("Source ID", "") or f"line-{line}"
            record = f"OA/{source_id}"
            if source_id in ledger_by_id:
                self.add("E-OA-002", "ledger", source_id, "duplicate OA ledger row", record=record)
                continue
            ledger_by_id[source_id] = row
            if not OA_ID_RE.fullmatch(source_id):
                self.add("E-OA-003", "ledger", source_id, "invalid OA source ID", record=record)
            if row.get("Schema Version") != SCHEMA_VERSION:
                self.add("E-SCHEMA-002", "ledger", source_id, "invalid Schema Version", record=record)

            source_record = sources.get(source_id)
            if source_record is None:
                self.add("E-OA-003", "ledger", source_id, "ledger row has no OA source", record=record)
            else:
                try:
                    ordinal = int(row.get("Source Ordinal", ""))
                except ValueError:
                    ordinal = -1
                if (
                    ordinal != source_record.ordinal
                    or row.get("Source Section") != source_record.section
                    or row.get("Source Requirement") != source_record.requirement
                    or row.get("Source SHA256") != source_record.digest
                ):
                    self.add(
                        "E-OA-004",
                        "ledger",
                        source_id,
                        "source ordinal/text/hash does not match the OA source",
                        record=record,
                    )

            baseline_ids = self._parse_list(
                row.get("Baseline Matrix IDs", ""),
                source="ledger",
                row=source_id,
                field_name="Baseline Matrix IDs",
                item_pattern=MATRIX_ID_RE,
                record=record,
            )
            current_ids = self._parse_list(
                row.get("Current Matrix IDs", ""),
                source="ledger",
                row=source_id,
                field_name="Current Matrix IDs",
                item_pattern=MATRIX_ID_RE,
                allow_empty=False,
                record=record,
            )
            new_ids = self._parse_list(
                row.get("New Matrix IDs", ""),
                source="ledger",
                row=source_id,
                field_name="New Matrix IDs",
                item_pattern=MATRIX_ID_RE,
                record=record,
            )
            ledger_targets[source_id] = current_ids
            if set(new_ids) != set(current_ids) - set(baseline_ids):
                self.add(
                    "E-HISTORY-001",
                    "ledger",
                    source_id,
                    "New Matrix IDs must equal Current Matrix IDs minus Baseline Matrix IDs",
                    record=record,
                )
            if any(item not in FROZEN_CODEX_IDS for item in baseline_ids):
                self.add("E-HISTORY-001", "ledger", source_id, "baseline mapping contains a non-frozen ID", record=record)
            if new_ids:
                dedicated_mappings += 1
                if len(new_ids) != 1:
                    self.add(
                        "E-MAP-006",
                        "ledger",
                        source_id,
                        "a dedicated OA mapping must add exactly one specificity row",
                        record=record,
                    )
            else:
                existing_mappings += 1
            for matrix_id in current_ids:
                edge = (source_id, matrix_id)
                if edge in forward_edges:
                    self.add("E-MAP-003", "ledger", source_id, f"duplicate forward edge {matrix_id}", record=record)
                forward_edges.add(edge)
                if matrix_id not in matrix_by_id:
                    self.add("E-MAP-002", "ledger", source_id, f"mapping target does not exist: {matrix_id}", record=record)

            coverage = row.get("Coverage Status", "")
            baseline_coverage = row.get("Baseline Coverage Status", "")
            status = row.get("Implementation Status", "")
            self._enum(coverage, COVERAGE_STATUSES, "ledger", source_id, "Coverage Status", record=record)
            self._enum(
                baseline_coverage,
                COVERAGE_STATUSES,
                "ledger",
                source_id,
                "Baseline Coverage Status",
                record=record,
            )
            coverage_totals[coverage] += 1
            implementation_totals[status] += 1
            terminal_kind = self._terminal_kind(status)
            if terminal_kind:
                self.oa_terminal.add(record)
            self._validate_phases(row, "ledger", source_id, record)
            self._validate_status(row, "ledger", source_id, record)
            self._validate_required_text(row, "ledger", source_id, record)
            for field_name in ("Coverage Rationale", "Mapping Evidence"):
                if not row.get(field_name, ""):
                    self.add(
                        "E-REQUIREMENT-001",
                        "ledger",
                        source_id,
                        f"{field_name} must be nonblank",
                        record=record,
                    )

            libraries = self._parse_list(
                row.get("Correct Libraries", ""),
                source="ledger",
                row=source_id,
                field_name="Correct Libraries",
                allow_empty=False,
                record=record,
            )
            for library in libraries:
                if library not in LIBRARIES:
                    self.add("E-LIBRARY-001", "ledger", source_id, f"invalid library: {library}", record=record)
            if "none" in libraries and (len(libraries) != 1 or terminal_kind != "rejected"):
                self.add("E-LIBRARY-001", "ledger", source_id, "none is valid only for rejected rows", record=record)

            if row.get("Disposition Date") and not DATE_RE.fullmatch(row["Disposition Date"]):
                self.add("E-SCHEMA-003", "ledger", source_id, "Disposition Date must be YYYY-MM-DD", record=record)
            if coverage == "partial" and not row.get("Uncovered Scope", ""):
                self.add("E-COVERAGE-003", "ledger", source_id, "partial requires Uncovered Scope", record=record)
            if coverage == "missing" and self.mode == "final":
                self.add("E-COVERAGE-004", "ledger", source_id, "missing cannot survive final mode", record=record)
            if terminal_kind and coverage != terminal_kind:
                self.add(
                    "E-STATUS-001",
                    "ledger",
                    source_id,
                    f"{terminal_kind} coverage/status mismatch",
                    record=record,
                )

        if len(ledger_by_id) != OA_COUNT:
            self.add("E-OA-001", "ledger", "count", f"expected {OA_COUNT} rows; found {len(ledger_by_id)}")
        missing_ledger = set(EXPECTED_OA_IDS) - set(ledger_by_id)
        if missing_ledger or set(ledger_by_id) - set(EXPECTED_OA_IDS):
            self.add("E-OA-003", "ledger", "range", "ledger OA union is not exactly OA-001..OA-238")
            self.oa_failures.update(f"OA/{item}" for item in missing_ledger)

        for edge in sorted(forward_edges - reverse_edges):
            self.add(
                "E-MAP-004",
                "mapping",
                edge[0],
                f"forward mapping lacks matrix reverse edge: {edge[1]}",
                record=f"OA/{edge[0]}",
            )
        for edge in sorted(reverse_edges - forward_edges):
            self.add(
                "E-MAP-005",
                "mapping",
                edge[0],
                f"matrix reverse mapping lacks ledger forward edge: {edge[1]}",
                record=f"OA/{edge[0]}",
            )

        active_by_target: defaultdict[str, set[str]] = defaultdict(set)
        for source_id, targets in ledger_targets.items():
            if (
                ledger_by_id.get(source_id, {}).get("Implementation Status")
                not in TERMINAL_IMPLEMENTATION_STATUSES
            ):
                for target in targets:
                    active_by_target[target].add(source_id)
        for source_id, row in ledger_by_id.items():
            coverage = row.get("Coverage Status", "")
            targets = ledger_targets.get(source_id, ())
            shared = any(len(active_by_target[target]) > 1 for target in targets)
            if coverage == "exact" and shared:
                self.add(
                    "E-COVERAGE-001",
                    "ledger",
                    source_id,
                    "exact coverage cannot share an active matrix target",
                    record=f"OA/{source_id}",
                )
            if coverage == "combined" and not shared:
                self.add(
                    "E-COVERAGE-002",
                    "ledger",
                    source_id,
                    "combined coverage requires a matrix target shared with another active OA",
                    record=f"OA/{source_id}",
                )

        if sum(coverage_totals.values()) != OA_COUNT:
            self.add("E-TOTAL-001", "ledger", "coverage", "coverage totals do not sum to 238")
        if sum(implementation_totals.values()) != OA_COUNT:
            self.add("E-TOTAL-002", "ledger", "implementation", "implementation totals do not sum to 238")
        if existing_mappings != EXPECTED_EXISTING_MAPPINGS or dedicated_mappings != EXPECTED_DEDICATED_MAPPINGS:
            self.add(
                "E-TOTAL-001",
                "mapping",
                "97+141",
                f"expected 97 existing and 141 dedicated mappings; found {existing_mappings}+{dedicated_mappings}",
            )
            self.oa_failures.update(f"OA/{item}" for item in EXPECTED_OA_IDS)

        tagged_union = {f"CODEX/{item}" for item in FROZEN_CODEX_IDS} | {
            f"OA/{item}" for item in EXPECTED_OA_IDS
        }
        if len(tagged_union) != ACCEPTED_TOTAL:
            self.add("E-DEDUP-001", "total", "union", "cross-source deduplication changed the denominator")
            self.add("E-TOTAL-003", "total", "union", f"tagged union is not {ACCEPTED_TOTAL}")

        all_unresolved = self.codex_failures | self.oa_failures
        accepted_unmapped = (self.codex_failures - self.codex_terminal) | (
            self.oa_failures - self.oa_terminal
        )
        if accepted_unmapped:
            self.add(
                "E-UNMAPPED-001",
                "total",
                "accepted_unmapped",
                f"accepted_unmapped={len(accepted_unmapped)}; expected 0",
            )
        if all_unresolved:
            self.add(
                "E-UNRESOLVED-001",
                "total",
                "all_source_unresolved",
                f"all_source_unresolved={len(all_unresolved)}; expected 0",
            )

        return ValidationReport(
            diagnostics=sorted(set(self.diagnostics)),
            accepted_unmapped=accepted_unmapped,
            all_source_unresolved=all_unresolved,
            matrix_rows=len(matrix_by_id),
            existing_mappings=existing_mappings,
            dedicated_mappings=dedicated_mappings,
            coverage_totals=coverage_totals,
            implementation_totals=implementation_totals,
        )


def build_parser() -> argparse.ArgumentParser:
    repository_root = Path(__file__).resolve().parents[1]
    docs = repository_root / "Development_Docs"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--oa-source",
        type=Path,
        default=docs / "KG_Original_Animation_Audit_Reconciliation_Source.md",
    )
    parser.add_argument(
        "--matrix", type=Path, default=docs / "Animation_System_Audit_Matrix.csv"
    )
    parser.add_argument(
        "--ledger",
        type=Path,
        default=docs / "Animation_Original_Audit_Reconciliation_Ledger.csv",
    )
    parser.add_argument(
        "--shard-manifest",
        type=Path,
        default=docs / "Project_Lanternwake_Phase_2_Reconciliation_Shard_Manifest.csv",
    )
    parser.add_argument("--mode", choices=("baseline", "final"), default="final")
    parser.add_argument(
        "--no-write",
        action="store_true",
        help="Document the no-write contract (the validator is always read-only).",
    )
    parser.add_argument("--json", action="store_true", help="Emit a deterministic JSON report.")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    report = ReconciliationValidator(mode=args.mode).validate(
        args.oa_source, args.matrix, args.ledger, args.shard_manifest
    )
    payload = report.as_dict()
    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        state = "PASSED" if report.ok else "FAILED"
        print(f"Lanternwake reconciliation validation {state}")
        print(
            " ".join(
                (
                    f"accepted_total={ACCEPTED_TOTAL}",
                    f"codex={CODEX_COUNT}",
                    f"oa={OA_COUNT}",
                    f"matrix_rows={report.matrix_rows}",
                    f"existing_mappings={report.existing_mappings}",
                    f"dedicated_mappings={report.dedicated_mappings}",
                    f"accepted_unmapped={len(report.accepted_unmapped)}",
                    f"all_source_unresolved={len(report.all_source_unresolved)}",
                )
            )
        )
        for item in sorted(report.diagnostics):
            print(f"{item.severity.upper()} {item.code} {item.source}:{item.row} {item.message}")
    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
