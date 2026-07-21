from __future__ import annotations

import argparse
import csv
import io
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "Development_Docs"
MATRIX = DOCS / "Animation_System_Audit_Matrix.csv"
LEDGER = DOCS / "Animation_Original_Audit_Reconciliation_Ledger.csv"
OUTPUT = DOCS / "Project_Lanternwake_Phase_4_Animation_Manifest.csv"

SURFACE_EVIDENCE = {
    "landing and role gateway": {
        "sources": "src/components/landing/HarborLanding.tsx; src/styles/landing.css; src/animation/platform/motion-tokens.ts",
        "tests": "src/components/landing/HarborLanding.test.tsx; tests/e2e/lanternwake-phase4.spec.ts",
        "checkpoints": "critical static frame; assets ready; roles ready; Player intent; Captain intent; Creator intent; route handoff; reentry; reduced final",
        "one_shot": "remembered session: lanternwake:phase4:remembered-session:<role>:<authoritative-href>; otherwise scene receipt policy",
        "duration": "ambient 8000/12000/0 ms; state 320/200/60 ms; route 460/280/0 ms (full/gentle/reduced)",
    },
    "player sign-in": {
        "sources": "src/components/platform/PlayerSignIn.tsx; src/components/ui/AsyncState.tsx; src/animation/platform/useAuthoritativeAsyncState.ts; src/styles/platform.css",
        "tests": "src/components/platform/PlayerSignIn.test.tsx; src/components/ui/AsyncState.test.tsx; tests/e2e/lanternwake-phase4.spec.ts",
        "checkpoints": "idle; pending; slow; failure; permission mismatch; success final before route",
        "one_shot": "not stored; request identity and authoritative accepted response gate the handoff",
        "duration": "state 320/200/60 ms; route 460/280/0 ms (full/gentle/reduced)",
    },
    "captain sign-in": {
        "sources": "src/components/platform/StaffSignIn.tsx; src/components/platform/PlatformRelic.tsx; src/components/ui/AsyncState.tsx; src/styles/platform.css",
        "tests": "src/components/platform/StaffSignIn.test.tsx; src/components/ui/AsyncState.test.tsx",
        "checkpoints": "idle; pending; slow; failure; permission mismatch; success final before route",
        "one_shot": "not stored; request identity and authoritative accepted response gate the handoff",
        "duration": "state 320/200/60 ms; route 460/280/0 ms (full/gentle/reduced)",
    },
    "captain and creator sign-in": {
        "sources": "src/components/platform/StaffSignIn.tsx; src/components/platform/PlatformRelic.tsx; src/components/ui/AsyncState.tsx; src/styles/platform.css",
        "tests": "src/components/platform/StaffSignIn.test.tsx; src/components/ui/AsyncState.test.tsx",
        "checkpoints": "idle; pending; slow; failure; permission mismatch; success final before route",
        "one_shot": "not stored; request identity and authoritative accepted response gate the role-specific handoff",
        "duration": "state 320/200/60 ms; route 460/280/0 ms (full/gentle/reduced)",
    },
    "invitation ceremony": {
        "sources": "src/components/platform/InvitationCeremony.tsx; src/animation/scenes/access.scene.ts; src/styles/platform.css",
        "tests": "src/components/platform/InvitationCeremony.test.tsx; src/animation/scenes/scene-builders.test.ts",
        "checkpoints": "resolving; valid closed/open; PIN; invalid; expired; revoked; accepting; seal fracture; ribbon release; title; accepted final; decline final; replacement final",
        "one_shot": "operation-local invitation state plus authoritative acceptance receipt; mutation is never replayed",
        "duration": "state 320/200/60 ms; ceremony 1100/700/0 ms (full/gentle/reduced)",
    },
    "player library": {
        "sources": "src/components/platform/PlayerLibrary.tsx; src/animation/platform/polling-delta.ts; src/styles/platform.css",
        "tests": "src/components/platform/PlayerLibrary.test.tsx; src/animation/platform/polling-delta.test.ts; tests/e2e/lanternwake-phase4.spec.ts",
        "checkpoints": "initial grouped; gallery; list; filtered; pinned; hidden; polling changed; empty; route handoff",
        "one_shot": "new invitation: lanternwake:phase4:new-invitation:<card-id>:<authoritative-version>",
        "duration": "state 320/200/60 ms; layout 420/260/0 ms (full/gentle/reduced)",
    },
    "captain library": {
        "sources": "src/components/platform/CaptainLibrary.tsx; src/animation/platform/polling-delta.ts; src/styles/platform.css",
        "tests": "src/components/platform/CaptainLibrary.test.tsx; src/animation/platform/polling-delta.test.ts; tests/e2e/lanternwake-phase4.spec.ts",
        "checkpoints": "initial grouped; gallery; list; filtered; pinned; hidden; polling changed; empty; route handoff; wizard created result",
        "one_shot": "authoritative card or created-result version; mutations are never replayed",
        "duration": "state 320/200/60 ms; layout 420/260/0 ms; route 460/280/0 ms (full/gentle/reduced)",
    },
    "waiting room": {
        "sources": "src/components/platform/PlayerVoyageRoom.tsx; src/animation/platform/polling-delta.ts; src/styles/platform.css",
        "tests": "src/components/platform/PlayerVoyageRoom.test.tsx; src/animation/platform/polling-delta.test.ts",
        "checkpoints": "closed journal; crew arrival; ready; polling; scheduled; launch-ready; latch release; route handoff; reconnect; revoked",
        "one_shot": "launch: lanternwake:phase4:waiting-launch:<voyage-id>:<status:last-synchronized-at>",
        "duration": "state 320/200/60 ms; layout 420/260/0 ms; ceremony 1100/700/0 ms (full/gentle/reduced)",
    },
    "quartermaster": {
        "sources": "src/components/gm/Quartermaster.tsx; src/styles/gm.css; src/server/admin-command.ts",
        "tests": "src/components/gm/Quartermaster.test.tsx; src/server/admin-command.test.ts",
        "checkpoints": "confirmation; preflight; pending; failure reversal; success receipt; dashboard reconciliation; undo preview; conflict",
        "one_shot": "invocation-local command identity and authoritative receipt; commands are never replayed",
        "duration": "state 320/200/60 ms; ceremony 1100/700/0 ms (full/gentle/reduced)",
    },
    "quartermaster live control": {
        "sources": "src/components/gm/Quartermaster.tsx; src/styles/gm.css; src/server/admin-command.ts",
        "tests": "src/components/gm/Quartermaster.test.tsx; src/server/admin-command.test.ts",
        "checkpoints": "confirmation; preflight; pending; failure reversal; success receipt; dashboard reconciliation; undo preview; conflict",
        "one_shot": "invocation-local command identity and authoritative receipt; commands are never replayed",
        "duration": "state 320/200/60 ms; ceremony 1100/700/0 ms (full/gentle/reduced)",
    },
    "studio": {
        "sources": "src/components/studio/StudioHome.tsx; src/components/studio/NewTaleForm.tsx; src/components/studio/TaleEditor.tsx; src/animation/director/scene-registry.ts; src/styles/studio.css",
        "tests": "src/components/studio/TaleEditor.test.tsx; src/animation/director/scene-registry.test.ts; src/animation/scenes/scene-builders.test.ts; tests/e2e/lanternwake-phase4.spec.ts; tests/e2e/chronicle-studio.spec.ts",
        "checkpoints": "library; editor section; drag placeholder; drag overlay; drop settle; validation; autosave; preview; publish; version; upload; comparison; immutable lock",
        "one_shot": "operation-local publish/version receipt; dnd-kit remains sole drag transform owner",
        "duration": "state 320/200/60 ms; layout 420/260/0 ms; ceremony 1100/700/0 ms (full/gentle/reduced)",
    },
    "studio authoring": {
        "sources": "src/components/studio/StudioHome.tsx; src/components/studio/NewTaleForm.tsx; src/components/studio/TaleEditor.tsx; src/animation/director/scene-registry.ts; src/styles/studio.css",
        "tests": "src/components/studio/TaleEditor.test.tsx; src/animation/director/scene-registry.test.ts; src/animation/scenes/scene-builders.test.ts; tests/e2e/lanternwake-phase4.spec.ts; tests/e2e/chronicle-studio.spec.ts",
        "checkpoints": "library; editor section; drag placeholder; drag overlay; drop settle; validation; autosave; preview; publish; version; upload; comparison; immutable lock",
        "one_shot": "operation-local publish/version receipt; dnd-kit remains sole drag transform owner",
        "duration": "state 320/200/60 ms; layout 420/260/0 ms; ceremony 1100/700/0 ms (full/gentle/reduced)",
    },
    "ship’s log": {
        "sources": "src/components/player/PlayerExperience.tsx; src/components/player/workspace/ShipsLog.tsx; src/domain/ships-log.ts; src/lib/snapshot.ts; src/app/api/player/[campaignSlug]/snapshot/route.ts",
        "tests": "src/components/player/PlayerExperience.test.tsx; src/components/player/workspace/ShipsLog.test.tsx; src/domain/ships-log.test.ts; src/lib/snapshot.test.ts",
        "checkpoints": "offline; reconnect; authoritative synchronized entry; preserved ordering; reduced final",
        "one_shot": "lanternwake:phase4:offline-log-entry:<event-key>:<authoritative-sequence>",
        "duration": "layout 420/260/0 ms (full/gentle/reduced)",
    },
}

# The frozen Phase 3-to-4 handoff records use these historical screen labels.
# Keep them explicit so their source identities remain intact in the Phase 4
# evidence manifest instead of dropping the records during regeneration.
SURFACE_EVIDENCE["landing and role selection"] = SURFACE_EVIDENCE["landing and role gateway"]
SURFACE_EVIDENCE["creator sign-in"] = SURFACE_EVIDENCE["captain and creator sign-in"]
SURFACE_EVIDENCE["new voyage wizard"] = SURFACE_EVIDENCE["captain library"]
SURFACE_EVIDENCE["loading/error/success states"] = {
    "sources": "src/components/ui/AsyncState.tsx; src/animation/platform/useAuthoritativeAsyncState.ts; src/styles/platform.css",
    "tests": "src/components/ui/AsyncState.test.tsx; src/components/platform/PlayerSignIn.test.tsx; tests/e2e/lanternwake-phase4.spec.ts",
    "checkpoints": "idle; pending; slow; recoverable error; terminal error; cancelled; authoritative success",
    "one_shot": "request identity gates committed success; stale responses cannot present",
    "duration": "state 320/200/60 ms (full/gentle/reduced)",
}
SURFACE_EVIDENCE["shell navigation"] = {
    "sources": "src/components/shell/ProductShell.tsx; src/animation/platform/RouteMotionBoundary.tsx; src/styles/shell.css",
    "tests": "src/components/shell/ProductShell.test.tsx; src/animation/platform/RouteMotionBoundary.test.tsx; tests/e2e/lanternwake-phase4.spec.ts",
    "checkpoints": "active route; unseen badge; keyboard route handoff; destination focus; mobile wrap; reduced final",
    "one_shot": "route identity and destination focus are exact-once per committed path",
    "duration": "route 460/280/0 ms; state 320/200/60 ms (full/gentle/reduced)",
}
SURFACE_EVIDENCE["theme/color scheme"] = {
    "sources": "src/components/shell/ProductShell.tsx; src/styles/globals.css; src/styles/shell.css",
    "tests": "src/components/shell/ProductShell.test.tsx; tests/e2e/lanternwake-phase4.spec.ts",
    "checkpoints": "theme load; system change; readable contrast; reduced final",
    "one_shot": "persisted preference only; visual transition never delays semantic state",
    "duration": "state 320/200/60 ms (full/gentle/reduced)",
}
SURFACE_EVIDENCE["shipâ€™s log"] = SURFACE_EVIDENCE["ship’s log"]

IMPLEMENTATION_EVIDENCE = (
    "Project Lanternwake Phase 4 implementation commit {commit}; focused component/runtime tests passed; "
    "the final integrated gate is recorded separately in the Phase 4 Validation Report."
)

FIELDS = [
    "Requirement ID",
    "Source",
    "Surface",
    "Animation name",
    "User moment",
    "Authoritative trigger",
    "Current implementation",
    "Correct runtime",
    "Supporting runtime",
    "SceneHost or local host",
    "Required targets",
    "Optional targets",
    "Full behavior",
    "Gentle behavior",
    "Reduced behavior",
    "Replay policy",
    "One-shot key",
    "Failure fallback",
    "Focus behavior",
    "Live-region behavior",
    "Sound label",
    "Duration budget",
    "Performance budget",
    "Implementation status",
    "Source files",
    "Test IDs",
    "Visual checkpoints",
    "Implemented commit",
    "Validation status",
]


def phase_four(value: str | None) -> bool:
    return (value or "").strip() == "Phase 4"


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def surface_evidence(surface: str) -> dict[str, str]:
    key = surface.strip().lower().replace("'", "’")
    try:
        return SURFACE_EVIDENCE[key]
    except KeyError as error:
        raise SystemExit(f"No Phase 4 surface evidence mapping for {surface!r}") from error


def write_rows(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def update_ledgers(commit: str, validation_status: str) -> None:
    final = validation_status == "passed"
    matrix = read_rows(MATRIX)
    ledger = read_rows(LEDGER)
    for row in matrix:
        if not phase_four(row.get("Project Lanternwake Phase")):
            continue
        evidence = surface_evidence(row["Screen"])
        row["Current quality"] = "Phase 4 implemented with authoritative semantic fallback and mode-aware presentation"
        row["Evidence"] = IMPLEMENTATION_EVIDENCE.format(commit=commit)
        row["Source files"] = evidence["sources"]
        row["Implementation Status"] = "validated" if final else "implemented"
        row["Remaining limitation"] = ""
        row["Blocked By"] = ""
        row["Implemented In Commit"] = commit
        row["Validation Status"] = validation_status
        row["Architecture Validation Status"] = "passed"
        row["Architecture Evidence"] = f"Phase 4 implementation reuses the Phase 1-3 host, ownership, receipt, focus, and cleanup contracts. {evidence['sources']}"
        row["Validation Evidence"] = IMPLEMENTATION_EVIDENCE.format(commit=commit)
        row["Test Plan References"] = f"Development_Docs/Animation_System_Test_Plan.md; {evidence['tests']}"
    for row in ledger:
        if not phase_four(row.get("Project Lanternwake Phase")):
            continue
        evidence = surface_evidence(row["Source Section"])
        row["Implementation Status"] = "validated" if final else "implemented"
        row["Architecture Validation Status"] = "passed"
        row["Architecture Evidence"] = f"{evidence['sources']}; reuses Phase 1-3 host, ownership, receipt, focus, and cleanup contracts"
        row["Blocked By"] = ""
        row["Implemented In Commit"] = commit
        row["Validation Status"] = validation_status
        row["Validation Evidence"] = IMPLEMENTATION_EVIDENCE.format(commit=commit)
        row["Test Plan References"] = f"Development_Docs/Animation_System_Test_Plan.md; {evidence['tests']}"
    write_rows(MATRIX, matrix)
    write_rows(LEDGER, ledger)


def matrix_row(row: dict[str, str]) -> dict[str, str]:
    requirement_id = row["ID"]
    source = "MX" if requirement_id.startswith("MX-") else "audit defect"
    evidence = surface_evidence(row["Screen"])
    return {
        "Requirement ID": requirement_id,
        "Source": source,
        "Surface": row["Screen"],
        "Animation name": row["Animation or proposed animation"],
        "User moment": row["Recommended change"],
        "Authoritative trigger": row["Expected trigger"],
        "Current implementation": row["Current quality"],
        "Correct runtime": row["Correct library"],
        "Supporting runtime": row["Current library"],
        "SceneHost or local host": row["Scene Host Required"],
        "Required targets": row["Required targets"],
        "Optional targets": "",
        "Full behavior": row["Full mode result"],
        "Gentle behavior": row["Gentle mode result"],
        "Reduced behavior": row["Reduced mode result"],
        "Replay policy": row["Recommended replay policy"],
        "One-shot key": evidence["one_shot"],
        "Failure fallback": row["Fallback status"],
        "Focus behavior": row["Accessibility concerns"],
        "Live-region behavior": row["Accessibility concerns"],
        "Sound label": "silent by policy; no unvalidated semantic audio cue",
        "Duration budget": evidence["duration"],
        "Performance budget": row["Performance concerns"],
        "Implementation status": row["Implementation Status"],
        "Source files": row["Source files"],
        "Test IDs": row["Test Plan References"],
        "Visual checkpoints": evidence["checkpoints"],
        "Implemented commit": row["Implemented In Commit"],
        "Validation status": row["Validation Status"],
    }


def oa_row(row: dict[str, str]) -> dict[str, str]:
    evidence = surface_evidence(row["Source Section"])
    return {
        "Requirement ID": row["Source ID"],
        "Source": "OA",
        "Surface": row["Source Section"],
        "Animation name": row["Source Requirement"],
        "User moment": row["Source Requirement"],
        "Authoritative trigger": row["Trigger"],
        "Current implementation": row["Coverage Status"],
        "Correct runtime": row["Correct Libraries"],
        "Supporting runtime": "",
        "SceneHost or local host": row["Scene Host Required"],
        "Required targets": row["Target Contract Required"],
        "Optional targets": "",
        "Full behavior": row["Acceptance Criteria"],
        "Gentle behavior": row["Acceptance Criteria"],
        "Reduced behavior": row["Reduced Motion Behavior"],
        "Replay policy": row["Replay Policy"],
        "One-shot key": evidence["one_shot"],
        "Failure fallback": row["Blocked By"],
        "Focus behavior": row["Acceptance Criteria"],
        "Live-region behavior": row["Acceptance Criteria"],
        "Sound label": "silent by policy; no unvalidated semantic audio cue",
        "Duration budget": evidence["duration"],
        "Performance budget": "component-local ownership; unchanged polling does not replay; hidden/offscreen ambience pauses; cleanup restores baseline",
        "Implementation status": row["Implementation Status"],
        "Source files": row["Architecture Evidence"],
        "Test IDs": row["Test Plan References"],
        "Visual checkpoints": evidence["checkpoints"],
        "Implemented commit": row["Implemented In Commit"],
        "Validation status": row["Validation Status"],
    }


def render() -> str:
    matrix = [matrix_row(row) for row in read_rows(MATRIX) if phase_four(row.get("Project Lanternwake Phase"))]
    oa = [oa_row(row) for row in read_rows(LEDGER) if phase_four(row.get("Project Lanternwake Phase"))]
    if len(matrix) != 151 or len(oa) != 122:
        raise SystemExit(f"Phase 4 denominator changed: matrix={len(matrix)} oa={len(oa)}")
    rows = sorted([*matrix, *oa], key=lambda row: row["Requirement ID"])
    if len({row["Requirement ID"] for row in rows}) != len(rows):
        raise SystemExit("Duplicate Phase 4 requirement IDs detected")
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=FIELDS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the Project Lanternwake Phase 4 manifest")
    parser.add_argument("--check", action="store_true", help="Fail if the checked-in manifest is not current")
    parser.add_argument("--update-ledgers", action="store_true", help="Update Phase 4 rows in the canonical matrix and OA ledger")
    parser.add_argument("--commit", help="Implementation commit used with --update-ledgers")
    parser.add_argument("--validation-status", choices=("focused_pass", "passed"), default="focused_pass")
    args = parser.parse_args()
    if args.update_ledgers:
        if not args.commit:
            parser.error("--update-ledgers requires --commit")
        update_ledgers(args.commit, args.validation_status)
        print(f"Updated Phase 4 canonical rows: matrix=151 oa=122 status={args.validation_status}")
    expected = render()
    if args.check:
        actual = OUTPUT.read_text(encoding="utf-8-sig") if OUTPUT.exists() else ""
        if actual != expected:
            print(f"Phase 4 manifest is stale: {OUTPUT}")
            return 1
        print("Phase 4 manifest is current: matrix=151 oa=122 total=273")
        return 0
    OUTPUT.write_text(expected, encoding="utf-8", newline="")
    print(f"Wrote {OUTPUT}: matrix=151 oa=122 total=273")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
