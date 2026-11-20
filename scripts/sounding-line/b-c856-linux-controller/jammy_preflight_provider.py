"""Authenticate registered Jammy publication inputs without enabling the workflow."""
import base64
import binascii
import hashlib
import json
import re
import urllib.error
import urllib.request
from weakref import WeakValueDictionary

from admission import REPOSITORY, need
from jammy_preflight_supervisor import Run, verify_run
from provider import API, METADATA_LIMIT, metadata as action_metadata, opener

WORKFLOW_PATH = ".github/workflows/sounding-line-jammy-confined-preflight.yml"
OWNER = "Kgray44"
OWNER_ID = 64373011
REPOSITORY_ID = 1303074266
OPERATION = "confined-loader-and-denials-only"
MAX_WORKFLOW_BYTES = 64 * 1024
_launch_authorizations = WeakValueDictionary()


def metadata(client, path, token):
    if re.fullmatch(r"actions/(?:runs|workflows)/[1-9][0-9]{0,14}", path):
        return action_metadata(client, path, token)
    need(path == "branches/main" or re.fullmatch(r"git/commits/[a-f0-9]{40}", path) or
         re.fullmatch(rf"contents/{re.escape(WORKFLOW_PATH)}\?ref=[a-f0-9]{{40}}", path),
         "JAMMY_PROVIDER_API_PATH")
    request = urllib.request.Request(API + path, headers={
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Authorization": "Bearer " + token,
        "User-Agent": "sounding-line-jammy-preflight",
    })
    try:
        with client.open(request, timeout=12) as response:
            need(response.status == 200 and response.geturl() == API + path, "JAMMY_PROVIDER_METADATA_STATUS")
            raw = response.read(METADATA_LIMIT + 1)
    except (urllib.error.URLError, TimeoutError):
        raise ValueError("JAMMY_PROVIDER_METADATA_UNAVAILABLE") from None
    need(0 < len(raw) <= METADATA_LIMIT, "JAMMY_PROVIDER_METADATA_BOUND")
    return json.loads(raw)


def verify_workflow_file(record, expected_hash):
    need(type(record) is dict and record.get("type") == "file" and record.get("path") == WORKFLOW_PATH and
         record.get("encoding") == "base64" and type(record.get("size")) is int and
         0 < record["size"] <= MAX_WORKFLOW_BYTES and type(record.get("content")) is str,
         "JAMMY_PROVIDER_WORKFLOW_BYTES")
    encoded = record["content"].replace("\n", "").replace("\r", "")
    need(len(encoded) == 4 * ((record["size"] + 2) // 3), "JAMMY_PROVIDER_WORKFLOW_BYTES")
    try:
        content = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("JAMMY_PROVIDER_WORKFLOW_BYTES") from None
    need(len(content) == record["size"] and hashlib.sha256(content).hexdigest() == expected_hash,
         "JAMMY_PROVIDER_WORKFLOW_BYTES")


def authenticate_jammy_preflight_run(run_id, approval, token, *, launch=False):
    """Compare provider records to a separately approved publication and dispatch."""
    need(type(run_id) is int and 0 < run_id < 10**15 and type(approval) is dict and
         set(approval) == {"workflowId", "source", "tree", "workflowSha256"} and
         type(approval["workflowId"]) is int and 0 < approval["workflowId"] < 10**15 and
         all(type(approval[name]) is str and re.fullmatch(pattern, approval[name]) for name, pattern in (
             ("source", r"[a-f0-9]{40}"), ("tree", r"[a-f0-9]{40}"), ("workflowSha256", r"[a-f0-9]{64}"))),
         "JAMMY_PROVIDER_APPROVAL")
    workflow_id = approval["workflowId"]
    source = approval["source"]
    client = opener()

    run = metadata(client, f"actions/runs/{run_id}", token)
    need(type(run) is dict and run.get("id") == run_id and run.get("workflow_id") == workflow_id and
         run.get("head_sha") == source and run.get("head_branch") == "main" and
         run.get("event") == "workflow_dispatch" and type(run.get("run_attempt")) is int and
         run["run_attempt"] == 1 and run.get("path") in (WORKFLOW_PATH, f"{WORKFLOW_PATH}@refs/heads/main"),
         "JAMMY_PROVIDER_RUN")
    for key in ("actor", "triggering_actor"):
        account = run.get(key)
        need(type(account) is dict and account.get("id") == OWNER_ID and account.get("login") == OWNER,
             "JAMMY_PROVIDER_OWNER")
    for key in ("repository", "head_repository"):
        repository = run.get(key)
        need(type(repository) is dict and repository.get("id") == REPOSITORY_ID and
             repository.get("full_name") == REPOSITORY, "JAMMY_PROVIDER_REPOSITORY")

    workflow = metadata(client, f"actions/workflows/{workflow_id}", token)
    need(type(workflow) is dict and workflow.get("id") == workflow_id and workflow.get("path") == WORKFLOW_PATH,
         "JAMMY_PROVIDER_WORKFLOW")
    commit = metadata(client, f"git/commits/{source}", token)
    tree = commit.get("tree") if type(commit) is dict else None
    need(type(tree) is dict and commit.get("sha") == source and tree.get("sha") == approval["tree"],
         "JAMMY_PROVIDER_TREE")
    verify_workflow_file(metadata(client, f"contents/{WORKFLOW_PATH}?ref={source}", token),
                         approval["workflowSha256"])
    result = Run(source, source, run_id, 1, OWNER, OWNER, REPOSITORY, "refs/heads/main",
                 "workflow_dispatch", OPERATION)
    verify_run(result, source)
    if launch:
        branch = metadata(client, "branches/main", token)
        need(type(branch) is dict and branch.get("name") == "main" and branch.get("protected") is True and
             type(branch.get("commit")) is dict and branch["commit"].get("sha") == source,
             "JAMMY_PROVIDER_PROTECTED_MAIN")
        _launch_authorizations[id(result)] = result
    return result


def consume_launch_authorization(run):
    """Only the provider-authenticated object can authorize this in-process controller."""
    return run is not None and _launch_authorizations.pop(id(run), None) is run
