#!/usr/bin/env python3
"""Read-only validator for the Project Lanternwake Phase 3 coverage ledger.

The validator freezes the ordered 32-column schema and the 17-event by
six-section baseline denominator. It never modifies the ledger.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Mapping, Sequence

LEDGER_COLUMNS = (
    "Requirement ID",
    "Requirement Source",
    "Event Type",
    "Scene Name",
    "Global Presentation",
    "Relevant Section",
    "Local Enhancement",
    "Full Mode",
    "Gentle Mode",
    "Product Reduced",
    "Browser Reduced",
    "Replay",
    "Refresh Replay",
    "Skip",
    "Interruption",
    "Offline/Reconnect",
    "Required Targets",
    "Target Contract",
    "Ownership Contract",
    "Audio Labels",
    "Fallback",
    "Acknowledgment Policy",
    "Viewports",
    "Unit Tests",
    "Component Tests",
    "E2E Tests",
    "Implementation Status",
    "Validation Status",
    "Source Files",
    "Implemented Commit",
    "Blocker",
    "Notes",
)

EVENT_TYPES = (
    "ARTIFACT_AWARDED",
    "ARTIFACT_CONNECTED",
    "ARTIFACT_SILHOUETTE_REVEALED",
    "CAMPAIGN_PAUSED",
    "CAMPAIGN_RESUMED",
    "CHAPTER_RELEASED",
    "CHAPTER_SOLVED",
    "FINALE_REQUIREMENT_UPDATED",
    "FINALE_TEASED",
    "JOURNAL_ANNOTATION_ADDED",
    "MAP_LOCATION_REVEALED",
    "MAP_ROUTE_REVEALED",
    "PLAYER_LOG_ENTRY_ADDED",
    "SIDE_QUEST_COMPLETED",
    "SIDE_QUEST_DISCOVERED",
    "SIDE_QUEST_UPDATED",
    "STATE_REVERTED",
)

SECTIONS = (
    "Journal",
    "Voyage Chart",
    "Treasure Altar",
    "Side-Quest Ledger",
    "Ship's Log",
    "Finale Chamber",
)

SPECIAL_EVENT_TYPES = frozenset({"JOURNAL_OPENING", "PAGE_FLIP", "NOT_APPLICABLE"})
IMPLEMENTATION_STATUSES = frozenset(
    {
        "not_started",
        "architecture_blocked",
        "architecture_ready",
        "partially_implemented",
        "implemented",
        "validated",
        "blocked_external_asset",
        "blocked_environment",
        "superseded",
        "rejected",
    }
)
VALIDATION_STATUSES = frozenset(
    {
        "not_started",
        "planned",
        "in_progress",
        "passed",
        "failed",
        "blocked",
        "not_applicable",
    }
)
BLOCKED_IMPLEMENTATION_STATUSES = frozenset(
    {"architecture_blocked", "blocked_external_asset", "blocked_environment"}
)
VIEWPORTS = frozenset(
    {"2560x1440", "1920x1080", "1440x900", "430x932", "390x844", "844x390"}
)
BASELINE_VIEWPORT = "1440x900"
REQUIREMENT_ID_RE = re.compile(r"^(?:(?:MX|OA)-[0-9]{3,}|P3-[A-Z0-9][A-Z0-9_-]*)$")
EVENT_RE = re.compile(r"^[A-Z][A-Z0-9_]*$")
TARGET_RE = re.compile(r"^(?:none|[a-z0-9][a-z0-9_.:-]*)$")
AUDIO_RE = re.compile(r"^(?:intentional_silence|[a-z0-9][a-z0-9_-]*)$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
MODE_TOKENS: Mapping[str, tuple[str, ...]] = {
    "Full Mode": ("M1",),
    "Gentle Mode": ("M2",),
    "Product Reduced": ("M3",),
    "Browser Reduced": ("M4", "M5"),
}
REQUIRED_TEXT_FIELDS = (
    "Requirement Source",
    "Scene Name",
    "Global Presentation",
    "Local Enhancement",
    "Full Mode",
    "Gentle Mode",
    "Product Reduced",
    "Browser Reduced",
    "Replay",
    "Refresh Replay",
    "Skip",
    "Interruption",
    "Offline/Reconnect",
    "Target Contract",
    "Ownership Contract",
    "Fallback",
    "Acknowledgment Policy",
)
LIST_FIELDS = (
    "Event Type",
    "Relevant Section",
    "Required Targets",
    "Audio Labels",
    "Viewports",
    "Unit Tests",
    "Component Tests",
    "E2E Tests",
    "Source Files",
    "Implemented Commit",
)


@dataclass(frozen=True, order=True)
class Diagnostic:
    code: str
    row: str
    field: str
    message: str
    severity: str = field(default="error", compare=False)

    def as_dict(self) -> dict[str, str]:
        return {
            "severity": self.severity,
            "code": self.code,
            "row": self.row,
            "field": self.field,
            "message": self.message,
        }


@dataclass
class ValidationReport:
    diagnostics: list[Diagnostic]
    row_count: int
    matrix_cases: set[tuple[str, str]]
    event_types: set[str]
    sections: set[str]
    opening_rows: int
    page_flip_rows: int
    implementation_totals: Counter[str]
    validation_totals: Counter[str]

    @property
    def errors(self) -> list[Diagnostic]:
        return [item for item in self.diagnostics if item.severity == "error"]

    @property
    def ok(self) -> bool:
        return not self.errors

    def as_dict(self) -> dict[str, object]:
        return {
            "ok": self.ok,
            "rows": self.row_count,
            "expected_event_types": len(EVENT_TYPES),
            "expected_sections": len(SECTIONS),
            "expected_matrix_cases": len(EVENT_TYPES) * len(SECTIONS),
            "matrix_cases": len(self.matrix_cases),
            "event_types": sorted(self.event_types),
            "sections": sorted(self.sections),
            "journal_opening_rows": self.opening_rows,
            "page_flip_rows": self.page_flip_rows,
            "implementation_totals": dict(sorted(self.implementation_totals.items())),
            "validation_totals": dict(sorted(self.validation_totals.items())),
            "errors": len(self.errors),
            "diagnostics": [item.as_dict() for item in sorted(self.diagnostics)],
        }


class Phase3PlayerEventLedgerValidator:
    def __init__(self) -> None:
        self.diagnostics: list[Diagnostic] = []

    def add(self, code: str, row: str, field_name: str, message: str) -> None:
        self.diagnostics.append(Diagnostic(code, row, field_name, message))

    def _read(self, path: Path) -> tuple[list[str], list[dict[str, str]]]:
        try:
            with path.open("r", encoding="utf-8-sig", newline="") as handle:
                reader = csv.DictReader(handle)
                headers = list(reader.fieldnames or [])
                rows = [
                    {key: (value or "").strip() for key, value in row.items()}
                    for row in reader
                ]
        except (OSError, UnicodeError, csv.Error) as exc:
            self.add("E-P3-SCHEMA", "file", "ledger", f"cannot read {path}: {exc}")
            return [], []

        if len(headers) != len(set(headers)):
            self.add("E-P3-SCHEMA", "header", "ledger", "duplicate column names")
        if tuple(headers) != LEDGER_COLUMNS:
            missing = [name for name in LEDGER_COLUMNS if name not in headers]
            extra = [name for name in headers if name not in LEDGER_COLUMNS]
            self.add(
                "E-P3-SCHEMA",
                "header",
                "ledger",
                "columns do not match the exact ordered 32-column schema; "
                f"missing={missing} extra={extra}",
            )
        return headers, rows

    def _parse_list(
        self,
        value: str,
        *,
        row_id: str,
        field_name: str,
        required: bool = True,
    ) -> tuple[str, ...]:
        if not value:
            if required:
                self.add("E-P3-REQUIRED", row_id, field_name, "value is required")
            return ()
        if any(token in value for token in (",", "[", "]", "{", "}")) or ".." in value:
            self.add(
                "E-P3-LIST",
                row_id,
                field_name,
                "lists must use semicolons, not commas, ranges, or JSON",
            )
        items = tuple(item.strip() for item in value.split(";") if item.strip())
        if len(items) != len(set(items)):
            self.add("E-P3-LIST", row_id, field_name, "list items must be unique")
        if items != tuple(sorted(set(items))):
            self.add(
                "E-P3-LIST", row_id, field_name, "list items must be lexically sorted"
            )
        return tuple(dict.fromkeys(items))

    def _validate_path_list(
        self, items: Iterable[str], row_id: str, field_name: str
    ) -> None:
        for item in items:
            if item == "not_applicable":
                continue
            path = Path(item)
            if (
                not item
                or "\\" in item
                or path.is_absolute()
                or item.startswith("/")
                or ":" in item
                or ".." in path.parts
            ):
                self.add(
                    "E-P3-LIST",
                    row_id,
                    field_name,
                    f"path must be repository-relative with forward slashes: {item!r}",
                )

    def _parse_explicit_matrix_cases(
        self, notes: str, row_id: str
    ) -> tuple[tuple[str, str], ...]:
        segments = [segment.strip() for segment in notes.split("|")]
        values = [
            segment[len("matrix-cases=") :].strip()
            for segment in segments
            if segment.startswith("matrix-cases=")
        ]
        if len(values) > 1:
            self.add(
                "E-P3-MATRIX",
                row_id,
                "Notes",
                "only one matrix-cases= segment is allowed",
            )
        if not values:
            return ()
        raw_cases = self._parse_list(
            values[0], row_id=row_id, field_name="Notes.matrix-cases"
        )
        parsed: list[tuple[str, str]] = []
        for raw_case in raw_cases:
            if raw_case.count("@") != 1:
                self.add(
                    "E-P3-MATRIX",
                    row_id,
                    "Notes",
                    f"matrix case must use EVENT@Section: {raw_case!r}",
                )
                continue
            event_type, section = (part.strip() for part in raw_case.split("@", 1))
            if event_type not in EVENT_TYPES:
                self.add(
                    "E-P3-MATRIX",
                    row_id,
                    "Notes",
                    f"unknown matrix event: {event_type!r}",
                )
                continue
            if section not in SECTIONS:
                self.add(
                    "E-P3-MATRIX",
                    row_id,
                    "Notes",
                    f"unknown matrix section: {section!r}",
                )
                continue
            parsed.append((event_type, section))
        return tuple(parsed)

    def _validate_row(
        self, row: Mapping[str, str], ordinal: int
    ) -> tuple[str, tuple[tuple[str, str], ...], set[str], set[str]]:
        provisional_id = row.get("Requirement ID", "") or f"row-{ordinal}"
        requirement_id = row.get("Requirement ID", "")
        if not REQUIREMENT_ID_RE.fullmatch(requirement_id):
            self.add(
                "E-P3-IDENTITY",
                provisional_id,
                "Requirement ID",
                "expected MX-NNN, OA-NNN, or stable uppercase P3-* identity",
            )

        for field_name in REQUIRED_TEXT_FIELDS:
            if not row.get(field_name, ""):
                self.add(
                    "E-P3-REQUIRED", provisional_id, field_name, "value is required"
                )

        for field_name, tokens in MODE_TOKENS.items():
            value = row.get(field_name, "")
            for token in tokens:
                if not re.search(rf"\b{re.escape(token)}\b", value):
                    self.add(
                        "E-P3-MODE",
                        provisional_id,
                        field_name,
                        f"must explicitly account for {token}",
                    )

        parsed_lists = {
            field_name: self._parse_list(
                row.get(field_name, ""),
                row_id=provisional_id,
                field_name=field_name,
                required=field_name != "Implemented Commit",
            )
            for field_name in LIST_FIELDS
        }

        event_types = set(parsed_lists["Event Type"])
        invalid_events = event_types - set(EVENT_TYPES) - SPECIAL_EVENT_TYPES
        for event_type in sorted(invalid_events):
            if not EVENT_RE.fullmatch(event_type):
                detail = "event types must be uppercase underscore tokens"
            else:
                detail = "event type is not in the frozen Phase 3 vocabulary"
            self.add(
                "E-P3-ENUM", provisional_id, "Event Type", f"{event_type!r}: {detail}"
            )

        sections = set(parsed_lists["Relevant Section"])
        for section in sorted(sections - set(SECTIONS)):
            self.add(
                "E-P3-ENUM",
                provisional_id,
                "Relevant Section",
                f"unknown section: {section!r}",
            )

        for target in parsed_lists["Required Targets"]:
            if not TARGET_RE.fullmatch(target):
                self.add(
                    "E-P3-LIST",
                    provisional_id,
                    "Required Targets",
                    f"invalid target token: {target!r}",
                )
        for label in parsed_lists["Audio Labels"]:
            if not AUDIO_RE.fullmatch(label):
                self.add(
                    "E-P3-LIST",
                    provisional_id,
                    "Audio Labels",
                    f"invalid audio label: {label!r}",
                )

        viewport_set = set(parsed_lists["Viewports"])
        for viewport in sorted(viewport_set - VIEWPORTS):
            self.add(
                "E-P3-ENUM",
                provisional_id,
                "Viewports",
                f"unknown viewport: {viewport!r}",
            )

        for field_name in (
            "Unit Tests",
            "Component Tests",
            "E2E Tests",
            "Source Files",
        ):
            self._validate_path_list(
                parsed_lists[field_name], provisional_id, field_name
            )

        commits = parsed_lists["Implemented Commit"]
        for commit in commits:
            if not COMMIT_RE.fullmatch(commit):
                self.add(
                    "E-P3-COMMIT",
                    provisional_id,
                    "Implemented Commit",
                    f"commit must be lowercase 40-hex: {commit!r}",
                )

        implementation = row.get("Implementation Status", "")
        validation = row.get("Validation Status", "")
        if implementation not in IMPLEMENTATION_STATUSES:
            self.add(
                "E-P3-STATUS",
                provisional_id,
                "Implementation Status",
                f"invalid status: {implementation!r}",
            )
        if validation not in VALIDATION_STATUSES:
            self.add(
                "E-P3-STATUS",
                provisional_id,
                "Validation Status",
                f"invalid status: {validation!r}",
            )

        blocker = row.get("Blocker", "")
        if implementation in BLOCKED_IMPLEMENTATION_STATUSES and not blocker:
            self.add(
                "E-P3-BLOCKER",
                provisional_id,
                "Blocker",
                f"{implementation} requires a concrete blocker",
            )
        if validation in {"failed", "blocked"} and not blocker:
            self.add(
                "E-P3-BLOCKER",
                provisional_id,
                "Blocker",
                f"Validation Status={validation} requires a concrete blocker",
            )
        if implementation in {"implemented", "validated"} and not commits:
            self.add(
                "E-P3-COMMIT",
                provisional_id,
                "Implemented Commit",
                f"{implementation} requires at least one implementation commit",
            )
        if implementation == "validated" and validation != "passed":
            self.add(
                "E-P3-STATUS",
                provisional_id,
                "Validation Status",
                "validated requires Validation Status=passed",
            )
        if implementation in {"superseded", "rejected"} and not row.get("Notes", ""):
            self.add(
                "E-P3-REQUIRED",
                provisional_id,
                "Notes",
                f"{implementation} requires a disposition rationale",
            )
        if implementation == "partially_implemented" and not row.get("Notes", ""):
            self.add(
                "E-P3-REQUIRED",
                provisional_id,
                "Notes",
                "partially_implemented requires explicit remaining-scope evidence",
            )
        if implementation in {"partially_implemented", "implemented", "validated"}:
            source_files = {
                item
                for item in parsed_lists["Source Files"]
                if item != "not_applicable"
            }
            if not source_files:
                self.add(
                    "E-P3-REQUIRED",
                    provisional_id,
                    "Source Files",
                    f"{implementation} requires at least one concrete source-file reference",
                )
        if implementation in {"implemented", "validated"}:
            tests = {
                item
                for field_name in ("Unit Tests", "Component Tests", "E2E Tests")
                for item in parsed_lists[field_name]
                if item != "not_applicable"
            }
            if not tests:
                self.add(
                    "E-P3-REQUIRED",
                    provisional_id,
                    "Unit Tests/Component Tests/E2E Tests",
                    f"{implementation} requires at least one concrete test reference",
                )

        direct_matrix_events = event_types & set(EVENT_TYPES)
        direct_cases = tuple(
            (event_type, section)
            for event_type in sorted(direct_matrix_events)
            for section in sorted(sections & set(SECTIONS))
        )
        explicit_cases = self._parse_explicit_matrix_cases(
            row.get("Notes", ""), provisional_id
        )
        if direct_cases and explicit_cases:
            self.add(
                "E-P3-MATRIX",
                provisional_id,
                "Notes",
                "use direct Event Type/Relevant Section coverage or matrix-cases=, not both",
            )
        cases = explicit_cases or direct_cases
        if cases:
            if BASELINE_VIEWPORT not in viewport_set:
                self.add(
                    "E-P3-COVERAGE",
                    provisional_id,
                    "Viewports",
                    f"matrix coverage requires baseline viewport {BASELINE_VIEWPORT}",
                )
            if row.get("Global Presentation", "").strip().lower() in {
                "no",
                "none",
                "not_applicable",
                "not applicable",
            }:
                self.add(
                    "E-P3-COVERAGE",
                    provisional_id,
                    "Global Presentation",
                    "every matrix case requires a global readable presentation",
                )
            if row.get("Fallback", "").strip().lower() in {
                "no",
                "none",
                "not_applicable",
                "not applicable",
            }:
                self.add(
                    "E-P3-COVERAGE",
                    provisional_id,
                    "Fallback",
                    "every matrix case requires a readable fallback",
                )
        return provisional_id, cases, event_types, sections

    def validate(self, ledger_path: Path) -> ValidationReport:
        self.diagnostics = []
        _, rows = self._read(ledger_path)
        seen_ids: dict[str, int] = {}
        case_owners: defaultdict[tuple[str, str], list[str]] = defaultdict(list)
        event_types: set[str] = set()
        sections: set[str] = set()
        implementation_totals: Counter[str] = Counter()
        validation_totals: Counter[str] = Counter()
        opening_rows = 0
        page_flip_rows = 0

        for ordinal, row in enumerate(rows, start=2):
            row_id, cases, row_event_types, row_sections = self._validate_row(
                row, ordinal
            )
            if row_id in seen_ids:
                self.add(
                    "E-P3-IDENTITY",
                    row_id,
                    "Requirement ID",
                    f"duplicate stable identity; first appears at CSV row {seen_ids[row_id]}",
                )
            else:
                seen_ids[row_id] = ordinal
            for case in cases:
                case_owners[case].append(row_id)
            event_types.update(row_event_types & set(EVENT_TYPES))
            event_types.update(event_type for event_type, _ in cases)
            sections.update(row_sections & set(SECTIONS))
            sections.update(section for _, section in cases)
            opening_rows += int("JOURNAL_OPENING" in row_event_types)
            page_flip_rows += int("PAGE_FLIP" in row_event_types)
            implementation_totals[row.get("Implementation Status", "")] += 1
            validation_totals[row.get("Validation Status", "")] += 1

        expected = {
            (event_type, section) for event_type in EVENT_TYPES for section in SECTIONS
        }
        actual = set(case_owners)
        missing = sorted(expected - actual)
        if missing:
            rendered = ";".join(f"{event}@{section}" for event, section in missing)
            self.add(
                "E-P3-MATRIX",
                "matrix",
                "coverage",
                f"missing {len(missing)} of 102 required cases: {rendered}",
            )
        extras = sorted(actual - expected)
        if extras:
            rendered = ";".join(f"{event}@{section}" for event, section in extras)
            self.add(
                "E-P3-MATRIX",
                "matrix",
                "coverage",
                f"unexpected matrix cases: {rendered}",
            )
        duplicates = {
            case: owners for case, owners in case_owners.items() if len(owners) != 1
        }
        for (event_type, section), owners in sorted(duplicates.items()):
            self.add(
                "E-P3-MATRIX",
                "matrix",
                "coverage",
                f"{event_type}@{section} has {len(owners)} owners: {';'.join(owners)}",
            )
        if len(actual) != 102:
            self.add(
                "E-P3-MATRIX",
                "matrix",
                "coverage",
                f"expected exactly 102 unique cases; found {len(actual)}",
            )
        if opening_rows == 0:
            self.add(
                "E-P3-COVERAGE",
                "ledger",
                "Event Type",
                "at least one JOURNAL_OPENING requirement row is required",
            )
        if page_flip_rows == 0:
            self.add(
                "E-P3-COVERAGE",
                "ledger",
                "Event Type",
                "at least one PAGE_FLIP requirement row is required",
            )
        covered_viewports = {
            viewport
            for row in rows
            for viewport in row.get("Viewports", "").split(";")
            if viewport in VIEWPORTS
        }
        if covered_viewports != VIEWPORTS:
            self.add(
                "E-P3-COVERAGE",
                "ledger",
                "Viewports",
                f"ledger-wide viewport coverage is incomplete; missing={sorted(VIEWPORTS - covered_viewports)}",
            )

        return ValidationReport(
            diagnostics=sorted(set(self.diagnostics)),
            row_count=len(rows),
            matrix_cases=actual,
            event_types=event_types,
            sections=sections,
            opening_rows=opening_rows,
            page_flip_rows=page_flip_rows,
            implementation_totals=implementation_totals,
            validation_totals=validation_totals,
        )


def build_parser() -> argparse.ArgumentParser:
    repository_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--ledger",
        type=Path,
        default=repository_root
        / "Development_Docs"
        / "Project_Lanternwake_Phase_3_Player_Event_Coverage_Ledger.csv",
    )
    parser.add_argument(
        "--no-write",
        action="store_true",
        help="Document the no-write contract; validation is always read-only.",
    )
    parser.add_argument("--json", action="store_true", help="Emit deterministic JSON.")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    report = Phase3PlayerEventLedgerValidator().validate(args.ledger)
    if args.json:
        print(json.dumps(report.as_dict(), indent=2, sort_keys=True))
    else:
        state = "PASSED" if report.ok else "FAILED"
        print(f"Lanternwake Phase 3 Player event ledger validation {state}")
        print(
            " ".join(
                (
                    f"rows={report.row_count}",
                    f"event_types={len(report.event_types)}/17",
                    f"sections={len(report.sections)}/6",
                    f"matrix_cases={len(report.matrix_cases)}/102",
                    f"journal_opening_rows={report.opening_rows}",
                    f"page_flip_rows={report.page_flip_rows}",
                )
            )
        )
        for item in sorted(report.diagnostics):
            print(
                f"{item.severity.upper()} {item.code} {item.row}:{item.field} {item.message}"
            )
    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
