"""Local stdio MCP launcher using the public Codex app-server protocol."""
import atexit
import importlib.util
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/launchdeck"
if not SKILL.exists():
    SKILL = ROOT.parents[1] / "skills/launchdeck"
spec = importlib.util.spec_from_file_location("launchdeck_planner", SKILL / "scripts/launchdeck.py")
planner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(planner)
STATE = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))) / "launchdeck-state"


class AppServer:
    def __init__(self, binary):
        self.pending, self.turns, self.attention = {}, {}, {}
        self.sequence = 0
        self.lock = threading.Lock()
        self.proc = subprocess.Popen([binary, "app-server", "--stdio"], stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8",
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        threading.Thread(target=self.read, daemon=True).start()
        threading.Thread(target=self.drain, daemon=True).start()
        atexit.register(self.close)
        try:
            self.call("initialize", {"clientInfo": {"name": "project_launchdeck", "version": "0.4.0"},
                "capabilities": {"experimentalApi": True}})
            self.send({"jsonrpc": "2.0", "method": "initialized", "params": {}})
        except Exception:
            self.close()
            raise

    def send(self, message):
        with self.lock:
            self.proc.stdin.write(json.dumps(message, ensure_ascii=False) + "\n")
            self.proc.stdin.flush()

    def drain(self):
        # Never log provider output, credentials, transcripts, or prompts.
        for _ in self.proc.stderr:
            pass

    def read(self):
        try:
            for line in self.proc.stdout:
                value = json.loads(line)
                if "id" in value and "method" not in value:
                    pending = self.pending.get(value["id"])
                    if pending:
                        pending.put(value)
                elif "id" in value:
                    params = value.get("params", {})
                    self.attention[params.get("threadId", "unknown")] = value["method"]
                    # No identity spoofing or automatic approval of host requests.
                    self.send({"jsonrpc": "2.0", "id": value["id"], "error": {
                        "code": -32000, "message": "Launchdeck cannot forward this approval or interactive request"}})
                elif value.get("method") in ("turn/started", "turn/completed"):
                    params = value["params"]
                    self.turns[params["threadId"]] = params["turn"]
        except (OSError, ValueError):
            pass
        finally:
            for pending in list(self.pending.values()):
                pending.put({"error": {"message": "App-server disconnected; reconcile before retrying"}})

    def call(self, method, params):
        with self.lock:
            self.sequence += 1
            number = self.sequence
            pending = self.pending[number] = queue.Queue()
        try:
            self.send({"jsonrpc": "2.0", "id": number, "method": method, "params": params})
            result = pending.get(timeout=30)
            if "error" in result:
                raise RuntimeError(result["error"].get("message", "App-server request failed"))
            return result.get("result", {})
        finally:
            self.pending.pop(number, None)

    def close(self):
        if self.proc.poll() is not None:
            return
        try:
            self.proc.stdin.close()
            self.proc.wait(timeout=5)
        except (OSError, subprocess.TimeoutExpired):
            self.proc.terminate()
            self.proc.wait(timeout=5)


class Launcher:
    def __init__(self, state=STATE):
        self.state = Path(state)
        self.binding = json.loads((self.state / "native-binding.json").read_text(encoding="utf-8"))
        required = ("desktopProjectId", "appServerProjectId", "workspaceRoot", "codexBinary", "desktopAssociationVerified")
        if any(not self.binding.get(key) for key in required):
            raise ValueError("Native project binding has not been independently verified")
        self.binding["workspaceRoot"] = os.path.normpath(self.binding["workspaceRoot"])
        self.binding["codexBinary"] = os.path.normpath(self.binding["codexBinary"])
        self.app = AppServer(self.binding["codexBinary"])
        self.journal = self.state / "launches.json"

    def project(self):
        project = self.app.call("project/read", {"projectId": self.binding["appServerProjectId"]})["project"]
        roots = [os.path.normcase(os.path.realpath(root["path"])) for root in project["roots"]]
        expected = os.path.normcase(os.path.realpath(self.binding["workspaceRoot"]))
        if planner.folded(project["name"]) != "voyagewright" or expected not in roots:
            raise ValueError("Configured VoyageWright project no longer matches its verified workspace")
        return {"projectId": self.binding["desktopProjectId"], "label": "VoyageWright",
            "projectKind": "local", "hostId": "local", "isGitRepository": True}

    def inventory(self, project):
        records = []
        for archived in (False, True):
            cursor = None
            while True:
                params = {"limit": 100, "archived": archived, "projectId": self.binding["appServerProjectId"],
                    "sourceKinds": ["cli", "vscode", "exec", "appServer", "subAgent", "subAgentReview",
                        "subAgentCompact", "subAgentThreadSpawn", "subAgentOther", "unknown"]}
                if cursor:
                    params["cursor"] = cursor
                page = self.app.call("thread/list", params)
                records.extend({"id": t["id"], "title": t.get("name") or "", "kind": "codex",
                    "projectId": project["projectId"]} for t in page["data"])
                cursor = page.get("nextCursor")
                if not cursor:
                    break
        return records

    def sidecar(self, key):
        return self.state / (key + ".json")

    def write_sidecar(self, key, data):
        # IDs and execution metadata only; no objective or context retained here.
        path = self.sidecar(key)
        temp = path.with_suffix(".tmp")
        with temp.open("w", encoding="utf-8") as file:
            json.dump(data, file)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temp, path)

    def record(self, key, **fields):
        return planner.execute("record", {"request_key": key, **fields}, self.journal)

    def worktree(self, key, request):
        root = self.binding["workspaceRoot"]
        if request.get("environment", "local") == "local":
            return root
        path = self.state / "worktrees" / key
        meta = self.sidecar(key)
        saved = json.loads(meta.read_text(encoding="utf-8")) if meta.exists() else {}
        if saved.get("worktreePath"):
            if not Path(saved["worktreePath"]).is_dir():
                raise ValueError("Recorded worktree is missing; no replacement created")
            return saved["worktreePath"]
        if path.exists():
            raise ValueError("Unrecorded worktree path exists; reconcile ownership")
        def git(*args):
            run = subprocess.run(["git", "-C", root, *args], capture_output=True, text=True)
            if run.returncode:
                raise RuntimeError("Owned worktree preparation failed; inspect Git locally")
            return run.stdout.strip()
        git("fetch", "origin", "main")
        sha = git("rev-parse", "FETCH_HEAD")
        path.parent.mkdir(parents=True, exist_ok=True)
        git("worktree", "add", "-b", "codex/launchdeck-" + key[3:19], str(path), sha)
        saved.update(worktreePath=str(path), mainSha=sha)
        self.write_sidecar(key, saved)
        return str(path)

    def status(self, key):
        receipt = planner.execute("status", {"request_key": key}, self.journal)["receipt"]
        if not receipt:
            raise ValueError("Unknown Launchdeck request")
        thread_id = receipt.get("threadId")
        if not thread_id:
            return {"request_key": key, "state": receipt["state"], "created": False,
                "needsReconciliation": True}
        thread = self.app.call("thread/read", {"threadId": thread_id, "includeTurns": False})["thread"]
        goal = self.app.call("thread/goal/get", {"threadId": thread_id}).get("goal")
        path = self.sidecar(key)
        meta = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        observed = self.app.turns.get(thread_id)
        return {"request_key": key, "state": receipt["state"], "threadId": thread_id,
            "title": thread.get("name"),
            "projectId": self.binding["desktopProjectId"] if self.binding.get("pluginOnlyAssociationVerified") is True else None,
            "requestedDesktopProjectId": self.binding["desktopProjectId"],
            "appServerProjectId": thread.get("projectId"), "cwd": thread["cwd"],
            "projectAssociation": "app-server assignment; desktop registration requires separate evidence",
            "appServerProjectVerified": thread.get("projectId") == self.binding["appServerProjectId"],
            "projectVerified": self.binding.get("pluginOnlyAssociationVerified") is True and thread.get("projectId") == self.binding["appServerProjectId"],
            "goal": {"status": goal["status"], "objectiveMatchesRequest": goal["objective"].startswith("Launchdeck request: " + key + "\n")}
                if goal else None,
            "execution": {"turnId": meta.get("turnId"), "accepted": bool(meta.get("turnId")),
                "status": observed["status"] if observed else thread["status"]["type"],
                "liveObservation": observed is not None,
                "needsAttention": self.app.attention.get(thread_id)},
            "worktreePath": meta.get("worktreePath"), "mainSha": meta.get("mainSha"),
            "inventoryComplete": False,
            "inventoryCoverage": "Mapped app-server project and all Launchdeck reservations; legacy desktop-only membership is not exposed by this API",
            "link": None}

    def launch(self, request, requested_project_id=None):
        if self.binding.get("pluginOnlyAssociationVerified") is not True:
            raise ValueError("Native desktop registration is unavailable through the plugin-only route; no conversation created")
        project = self.project()
        if requested_project_id and requested_project_id != project["projectId"]:
            raise ValueError("Wrong project rejected before reservation or creation")
        if request.get("goal", True) is not True:
            raise ValueError("Executable launches require a native Goal")
        objective = request.get("objective", "")
        if len(objective) > 3800:
            raise ValueError("Goal objective is too long; keep detail in scope and context sources")
        disposable = request.get("disposable_marker")
        if disposable and (request.get("read_only") is not True or request.get("environment", "local") != "local"):
            raise ValueError("Disposable tests must be read-only and use the existing local workspace")
        data = {"projects": [project], "preferred_project_id": project["projectId"],
            "threads": self.inventory(project), "inventory_complete": False, "request": request}
        key = planner.fingerprint(project, request)
        with planner.locked(self.state / (key + ".dispatch")):
            planned = planner.execute("reserve", data, self.journal)
            receipt = planned.get("receipt", {})
            thread_id = receipt.get("threadId")
            if planned["action"] != "dispatch_once" and not thread_id:
                # Ambiguous creation cannot be repaired by another creation call.
                return {"request_key": key, "state": planned["state"], "needsReconciliation": True,
                    "created": False, "error": "Reservation has no observed thread ID; no duplicate dispatched"}
            if receipt.get("state") == "verified":
                observed = self.status(key)
                if not observed["projectVerified"] or observed["title"] != planned["title"] or not observed["goal"] or not observed["goal"]["objectiveMatchesRequest"]:
                    return {**observed, "reused": True, "error": "Native state differs from the verified receipt; no overwrite or duplicate dispatch"}
                return {**observed, "reused": True}
            meta_path = self.sidecar(key)
            meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
            try:
                cwd = self.worktree(key, request)
                meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
                if not thread_id:
                    result = self.app.call("thread/start", {"cwd": cwd, "ephemeral": False,
                        "projectId": self.binding["appServerProjectId"],
                        "sandbox": "read-only" if request.get("read_only") else "workspace-write",
                        "developerInstructions": "Launchdeck request: " + key + ". Preserve the accepted scope and repository instructions. "
                            "The native Goal is already set by the launcher; do not replace it. Mark it complete only when its acceptance criteria are satisfied. "
                            "For a disposable marker test, use no tools and modify no files or resources."})
                    thread_id = result["thread"]["id"]
                    self.record(key, state="created", threadId=thread_id)
                else:
                    self.app.call("thread/resume", {"threadId": thread_id})
                self.app.call("thread/name/set", {"threadId": thread_id, "name": planned["title"]})
                self.app.call("thread/metadata/update", {"threadId": thread_id, "projectId": self.binding["appServerProjectId"]})
                goal_objective = "Launchdeck request: " + key + "\n" + objective
                goal = self.app.call("thread/goal/get", {"threadId": thread_id}).get("goal")
                if goal and goal["objective"] != goal_objective:
                    raise ValueError("Existing native Goal differs; refusing to overwrite it")
                if not goal:
                    goal_params = {"threadId": thread_id, "objective": goal_objective,
                        "status": "paused" if disposable else "active", "origin": "user"}
                    if request.get("token_budget") is not None:
                        goal_params["tokenBudget"] = request["token_budget"]
                    self.app.call("thread/goal/set", goal_params)
                # A recorded turn is never dispatched again, even after a restart.
                if not meta.get("turnId"):
                    history = self.app.call("thread/read", {"threadId": thread_id, "includeTurns": True})["thread"]
                    for existing_turn in history.get("turns", []):
                        if any(i.get("type") == "userMessage" and any(
                                c.get("text", "").startswith("Launchdeck request: " + key)
                                for c in i.get("content", [])) for i in existing_turn.get("items", [])):
                            meta["turnId"] = existing_turn["id"]
                            self.write_sidecar(key, meta)
                            break
                if not meta.get("turnId"):
                    prompt = "\n\n".join(p for p in planned["prompt"].split("\n\n") if not p.startswith("Create a native Goal"))
                    turn = self.app.call("turn/start", {"threadId": thread_id, "input": [{"type": "text", "text": prompt}]})["turn"]
                    meta.update(turnId=turn["id"], disposable=bool(disposable))
                    self.write_sidecar(key, meta)
                if disposable:
                    deadline = time.monotonic() + 15
                    while time.monotonic() < deadline:
                        turn = self.app.turns.get(thread_id)
                        if turn and turn["status"] in ("completed", "failed", "interrupted"):
                            if turn["status"] != "completed":
                                raise RuntimeError("Disposable execution did not complete")
                            messages = [i.get("text") for i in turn.get("items", []) if i.get("type") == "agentMessage"]
                            if disposable not in messages:
                                raise RuntimeError("Disposable execution returned no exact acceptance marker")
                            self.app.call("thread/goal/set", {"threadId": thread_id, "status": "complete", "origin": "user"})
                            break
                        time.sleep(.05)
                    else:
                        raise RuntimeError("Disposable execution pending; reconcile this existing thread")
                observed = self.status(key)
                if not observed["projectVerified"] or observed["title"] != planned["title"] or not observed["goal"]["objectiveMatchesRequest"]:
                    raise RuntimeError("Native launch postconditions failed")
                self.record(key, state="verified", threadId=thread_id, project_verified=True, title_verified=True, goal_verified=True)
                return {**self.status(key), "reused": planned["action"] != "dispatch_once"}
            except Exception as error:
                # Preserve returned identity immediately and leave unknown outcomes reserved.
                current = planner.execute("status", {"request_key": key}, self.journal)["receipt"]
                if current["state"] != "verified":
                    self.record(key, state="uncertain", **({"threadId": thread_id} if thread_id else {}))
                return {"request_key": key, "state": "uncertain", "threadId": thread_id,
                    "error": str(error), "needsReconciliation": True, "reused": bool(receipt)}


TOOL = {"name": "launch_codex_task", "description": "Development candidate: normal launches are blocked because plugin-only native desktop registration is unverified. "
    "Contains local app-server Goal, execution and receipt components. "
    "Receive the settled context as a structured Project Trim request. Retry with the identical request to repair/reuse its receipt; never switch the source Chat into Work. "
    "Status reads an existing request_key. Local desktop binding is required; no remote/API-session fallback.",
    "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
    "inputSchema": {"type": "object", "additionalProperties": False, "properties": {
        "action": {"type": "string", "enum": ["launch", "status"], "default": "launch"},
        "requested_project_id": {"type": "string"}, "request_key": {"type": "string"},
        "request": {"type": "object", "required": ["initiatives", "objective", "acceptance"], "properties": {
            "initiatives": {"type": "array", "items": {"type": "string"}}, "objective": {"type": "string"},
            "acceptance": {"type": "array", "items": {"type": "string"}}, "phase": {"type": ["string", "integer"]},
            "phase_name": {"type": "string"}, "purpose": {"type": "string"},
            "scope": {"type": "array", "items": {"type": "string"}}, "constraints": {"type": "array", "items": {"type": "string"}},
            "sources": {"type": "array", "items": {"type": "string"}}, "environment": {"type": "string", "enum": ["local", "worktree"]},
            "worktree_authorized": {"type": "boolean"}, "read_only": {"type": "boolean"},
            "disposable_marker": {"type": "string", "description": "Only for explicitly authorized harmless tests; exact reply completes the test Goal."}}}}}}


def serve():
    launcher = None
    try:
        for line in sys.stdin:
            request = json.loads(line)
            if "id" not in request:
                continue
            number, method = request["id"], request["method"]
            try:
                if method == "initialize":
                    result = {"protocolVersion": request["params"]["protocolVersion"], "capabilities": {"tools": {}},
                        "serverInfo": {"name": "project-launchdeck", "version": "0.4.0"}}
                elif method == "ping":
                    result = {}
                elif method == "tools/list":
                    result = {"tools": [TOOL]}
                elif method == "tools/call":
                    if request["params"]["name"] != TOOL["name"]:
                        raise ValueError("Unknown Launchdeck tool")
                    args = request["params"].get("arguments", {})
                    if args.get("action", "launch") not in ("launch", "status"):
                        raise ValueError("Unsupported Launchdeck action")
                    if launcher is None:
                        launcher = Launcher()
                    if args.get("action", "launch") == "status":
                        value = launcher.status(args["request_key"])
                    else:
                        value = launcher.launch(args["request"], args.get("requested_project_id"))
                    result = {"content": [{"type": "text", "text": json.dumps(value)}], "structuredContent": value,
                        "isError": bool(value.get("error"))}
                else:
                    raise ValueError("Unsupported MCP method")
                response = {"jsonrpc": "2.0", "id": number, "result": result}
            except Exception as error:
                if method == "tools/call":
                    response = {"jsonrpc": "2.0", "id": number, "result": {"isError": True,
                        "content": [{"type": "text", "text": json.dumps({"error": str(error), "created": False})}]}}
                else:
                    response = {"jsonrpc": "2.0", "id": number, "error": {"code": -32602, "message": str(error)}}
            print(json.dumps(response, ensure_ascii=False), flush=True)
    finally:
        if launcher:
            launcher.app.close()


if __name__ == "__main__":
    serve()
