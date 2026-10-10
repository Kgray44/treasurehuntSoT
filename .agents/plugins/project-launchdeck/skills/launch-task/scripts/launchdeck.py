"""Pure launch planning and durable reservations; no native/network side effects."""
import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import time
import unicodedata


def clean(value):
    if not isinstance(value, str):
        raise ValueError("Expected text")
    return " ".join(unicodedata.normalize("NFKC", value).split())


def folded(value):
    return clean(value).casefold()


def text_list(request, name, required=False):
    values = request.get(name, [])
    if not isinstance(values, list) or any(not isinstance(v, str) for v in values):
        raise ValueError(name + " must be an array of text")
    values = [v.strip() for v in values if v.strip()]
    if required and not values:
        raise ValueError(name + " is required")
    return values


def route(data):
    candidates = [p for p in data.get("projects", [])
                  if p.get("projectKind") in ("local", "remote")
                  and folded(p.get("label", "")) == "voyagewright"
                  and p.get("projectId")]
    preferred = [p for p in candidates
                 if p["projectId"] == data.get("preferred_project_id")]
    if len(preferred) == 1:
        return preferred[0]
    if len(candidates) != 1:
        raise ValueError("Need one verified VoyageWright Codex destination")
    return candidates[0]


def title_base(request):
    names = text_list(request, "initiatives", True)
    names = [clean(re.sub(r"\bvoyagewright\b", "", n, flags=re.I)).strip(" ·+-") for n in names]
    if any(not n for n in names):
        raise ValueError("Need an initiative name beyond VoyageWright")
    subject = " + ".join(names)
    phase = request.get("phase")
    if phase is not None:
        phase = clean(str(phase))
        if not re.fullmatch(r"[0-9]+(?:\.[0-9]+)*[A-Za-z]?", phase):
            raise ValueError("Invalid phase number")
        phase_name = clean(request.get("phase_name", ""))
        if not phase_name:
            raise ValueError("Phase name required from current governing source")
        title = subject + " Phase " + phase + ": " + phase_name
    else:
        purpose = clean(request.get("purpose", ""))
        if not purpose:
            raise ValueError("Purpose required for a non-phase chat")
        title = subject + ": " + purpose
    if "voyagewright" in folded(title):
        raise ValueError("VoyageWright cannot appear in the chat title")
    return title


def allocate(base, occupied):
    occupied = {folded(t) for t in occupied}
    if folded(base) not in occupied:
        return base
    version = 2
    while folded(base + " V" + str(version)) in occupied:
        version += 1
    return base + " V" + str(version)


def fingerprint(project, request):
    payload = {"projectId": project["projectId"], "hostId": project.get("hostId"),
               "request": request}
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return "ld-" + hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def plan(data, receipts=None):
    receipts = receipts or {}
    project = route(data)
    request = data["request"]
    if not isinstance(request, dict):
        raise ValueError("request must be an object")
    objective = request.get("objective", "")
    if not isinstance(objective, str) or not objective.strip():
        raise ValueError("Objective required")
    acceptance = text_list(request, "acceptance", True)
    environment = request.get("environment", "local")
    if environment not in ("local", "worktree"):
        raise ValueError("Unsupported environment")
    if environment == "worktree" and (request.get("worktree_authorized") is not True
                                     or project.get("isGitRepository") is not True):
        raise ValueError("Worktree requires explicit authorization and Git project")
    budget = request.get("token_budget")
    if budget is not None and (type(budget) is not int or budget < 1
                              or request.get("token_budget_explicit") is not True):
        raise ValueError("Token budget requires a positive explicit human budget")
    if request.get("new_run") is not None and (
            not isinstance(request["new_run"], str) or not request["new_run"].strip()
            or request.get("new_run_authorized") is not True):
        raise ValueError("New run requires explicit human authorization")
    if "goal" in request and type(request["goal"]) is not bool:
        raise ValueError("goal must be boolean")
    profiles = {"product-phase", "bug-repair", "documentation-only", "infrastructure",
                "security-sensitive", "integration", "release-closure"}
    profile = request.get("context_profile", "product-phase" if request.get("phase") is not None else "bug-repair")
    execution = request.get("execution_profile", "STANDARD_AUTONOMOUS")
    if profile not in profiles or execution not in {"STANDARD_AUTONOMOUS", "UNATTENDED_CONTINUATION"}:
        raise ValueError("Invalid Project Trim profile")
    key = fingerprint(project, request)
    previous = receipts.get(key)
    occupied = [t["title"] for t in data.get("threads", [])
                if t.get("kind") == "codex" and t.get("projectId") == project["projectId"]
                and isinstance(t.get("title"), str)]
    occupied += [r["title"] for k, r in receipts.items()
                 if k != key and r.get("projectId") == project["projectId"]
                 and r.get("state") != "not_created"]
    title = (previous["title"] if previous and previous["state"] != "not_created"
             else allocate(title_base(request), occupied))
    prompt = ["Launchdeck request: " + key]
    if request.get("goal", True):
        goal = "Create a native Goal for the objective below before implementation. "
        goal += ("Use token_budget=" + str(budget) + ". " if budget is not None
                 else "Omit token_budget. ")
        goal += "If unavailable, report Goal unavailable and proceed with the authorized task."
        prompt.append(goal)
    prompt += ["Objective\n" + objective.strip()]
    prompt.append("Project Trim\nProfile: " + profile + "; execution: " + execution +
                  ". Read current repository AGENTS.md and relevant task authority. "
                  "Use a source-bound minimum-sufficient context packet; if helpers are absent, "
                  "label a compact summary and expand conservatively for unknown/stale context. "
                  "Reuse fresh read/search bindings. Efficiency budgets are advisory.")
    for label, field in [("Scope", "scope"), ("Constraints and gates", "constraints")]:
        values = text_list(request, field)
        if values:
            prompt.append(label + "\n" + "\n".join("- " + v for v in values))
    prompt.append("Acceptance\n" + "\n".join("- " + v for v in acceptance))
    sources = text_list(request, "sources")
    if sources:
        prompt.append("Sources\n" + "\n".join("- " + v for v in sources))
    result = {"request_key": key, "title": title,
              "target": {"type": "project", "projectId": project["projectId"],
                         "environment": {"type": environment}},
              "hostId": project.get("hostId"), "prompt": "\n\n".join(prompt),
              "inventory_complete": data.get("inventory_complete") is True,
              "state": previous.get("state", "prepared") if previous else "prepared"}
    non_goals = text_list(request, "non_goals")
    deliverables = text_list(request, "deliverables") or text_list(request, "scope") or acceptance
    if non_goals:
        prompt.append("Non-goals\n" + "\n".join("- " + v for v in non_goals))
    if request.get("deliverables"):
        prompt.append("Deliverables\n" + "\n".join("- " + v for v in deliverables))
    authority = request.get("completion_authority", "Current repository/task governance and applicable Sounding Line authority")
    if not isinstance(authority, str) or not authority.strip():
        raise ValueError("Completion authority must be text")
    prompt.append("Completion authority\n" + authority)
    result["prompt"] = "\n\n".join(prompt)
    result["task_contract"] = {"schemaVersion": "1.0", "kind": "LAUNCHDECK_PROJECT_TRIM_ADAPTATION",
                               "project": " + ".join(text_list(request, "initiatives", True)),
                               "increment": "Phase " + str(request["phase"]) if request.get("phase") is not None
                                            else request["purpose"],
                               "title": title, "executionProfile": execution,
                               "contextProfile": profile, "packetRequired": True,
                               "uniqueScope": text_list(request, "scope") or [objective.strip()],
                               "uniqueNonGoals": non_goals, "deliverables": deliverables,
                               "completionAuthority": authority}
    byte_count = len(result["prompt"].encode("utf-8"))
    result["inspection"] = {"promptBytes": byte_count, "words": len(result["prompt"].split()),
                            "coarseTokenProxy": (byte_count + 3) // 4,
                            "proxyMethod": "UTF8_BYTES_DIV_4_NOT_BILLING",
                            "actualUsage": None, "accountingMethod": "UNAVAILABLE",
                            "advisoryOnly": True, "blocksProgress": False}
    if previous:
        result["receipt"] = previous
    return result


def load_journal(path):
    if not path.exists():
        return {"schema": 1, "receipts": {}}
    value = json.loads(path.read_text(encoding="utf-8"))
    if value.get("schema") != 1 or not isinstance(value.get("receipts"), dict):
        raise ValueError("Unrecognized journal; do not overwrite")
    return value


@contextlib.contextmanager
def locked(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    lock = path.with_name(path.name + ".lock")
    deadline = time.monotonic() + 5
    while True:
        try:
            fd = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            break
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise FileExistsError("Journal is owned by another launcher; no dispatch occurred")
            time.sleep(0.025)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(str(os.getpid()))
        yield
    finally:
        lock.unlink()


def save_journal(path, journal):
    fd, temp = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(journal, stream, ensure_ascii=False, separators=(",", ":"))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def execute(operation, data, journal_path=None):
    path = Path(journal_path) if journal_path else None
    if path is not None and not path.is_absolute():
        raise ValueError("Journal path must be absolute")
    if operation == "plan":
        return plan(data, load_journal(path)["receipts"] if path else {})
    if path is None:
        raise ValueError("An explicit owner-local journal path is required")
    if operation == "status":
        receipt = load_journal(path)["receipts"].get(data["request_key"])
        return {"receipt": receipt}
    with locked(path):
        journal = load_journal(path)
        receipts = journal["receipts"]
        if operation == "reserve":
            result = plan(data, receipts)
            key = result["request_key"]
            old = receipts.get(key)
            if old and old["state"] != "not_created":
                result["action"] = "reconcile_or_reuse"
                return result
            receipts[key] = {"request_key": key, "projectId": result["target"]["projectId"],
                             "hostId": result["hostId"], "title": result["title"],
                             "state": "reserved"}
            result.update(state="reserved", action="dispatch_once")
        elif operation == "record":
            key = data["request_key"]
            if key not in receipts:
                raise ValueError("No reservation for this request")
            receipt = receipts[key]
            state = data["state"]
            allowed = {"reserved": {"pending", "created", "verified", "uncertain", "not_created"},
                       "pending": {"pending", "created", "verified", "uncertain"},
                       "created": {"created", "verified", "uncertain"},
                       "verified": {"verified"},
                       "uncertain": {"pending", "created", "verified", "uncertain", "not_created"},
                       "not_created": {"not_created"}}
            invalidated = (receipt["state"] == "verified" and state == "uncertain"
                           and data.get("revalidation_failed") is True
                           and any(data.get(field) is False for field in
                                   ("goal_verified", "project_verified", "title_verified")))
            if state not in allowed.get(receipt["state"], set()) and not invalidated:
                raise ValueError("Unsafe receipt transition")
            if state == "not_created" and data.get("no_side_effect_proven") is not True:
                raise ValueError("Retry requires proof of no side effect")
            if state == "not_created" and any(receipt.get(k) for k in ("threadId", "clientThreadId", "operationId")):
                raise ValueError("Returned native identifiers require reconciliation, not a retry reset")
            for field in ("threadId", "clientThreadId", "operationId"):
                if field in data:
                    if not isinstance(data[field], str) or not data[field].strip():
                        raise ValueError("Native identifiers must be observed nonempty text")
                    if receipt.get(field) and receipt[field] != data[field]:
                        raise ValueError("Cannot replace an existing native identifier")
            for field in ("goal_verified", "project_verified", "title_verified"):
                if field in data and type(data[field]) is not bool:
                    raise ValueError("Evidence flags must be boolean")
            merged = {**receipt, **{k: v for k, v in data.items() if k in
                      ("threadId", "clientThreadId", "operationId", "goal_verified",
                       "project_verified", "title_verified")}}
            if "title" in data:
                repaired = clean(data["title"])
                base = re.sub(r" V[0-9]+$", "", receipt["title"])
                if data.get("title_verified") is not True or "voyagewright" in folded(repaired):
                    raise ValueError("Title repair needs observed native title evidence")
                if not re.fullmatch(re.escape(base) + r"(?: V(?:[2-9]|[1-9][0-9]+))?", repaired):
                    raise ValueError("Title repair must retain initiative and phase/purpose")
                merged["title"] = repaired
            if state in ("created", "verified") and not merged.get("threadId"):
                raise ValueError("Ready threadId required")
            if state == "pending" and not (merged.get("threadId") or merged.get("clientThreadId")
                                            or merged.get("operationId")):
                raise ValueError("Pending setup identifier required")
            if state == "verified" and (merged.get("project_verified") is not True
                                        or merged.get("title_verified") is not True):
                raise ValueError("Project and title evidence required")
            merged["state"] = state
            receipts[key] = merged
            result = {"receipt": merged}
        else:
            raise ValueError("Unknown operation")
        save_journal(path, journal)
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["plan", "reserve", "record", "status"])
    parser.add_argument("--journal")
    args = parser.parse_args()
    try:
        result = execute(args.operation, json.load(sys.stdin), args.journal)
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(json.dumps({"error": str(error), "action": "stop_and_reconcile"}))
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
