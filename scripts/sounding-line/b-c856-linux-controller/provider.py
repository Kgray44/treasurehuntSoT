"""Read an exact GitHub workflow artifact without forwarding provider credentials."""
import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request
from admission import REPOSITORY, WORKFLOW_PATH, artifact_identity, need

API = "https://api.github.com/repos/" + REPOSITORY + "/"
METADATA_LIMIT = 1 << 20
PROVIDER_BLOB_SUFFIX = (".blob.core.windows.net", ".actions.githubusercontent.com")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def opener():
    return urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


def token_request(path, token):
    need(path.startswith("actions/") and "?" not in path and ".." not in path, "PROVIDER_API_PATH")
    return urllib.request.Request(API + path, headers={
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Authorization": "Bearer " + token,
        "User-Agent": "sounding-line-b-c856",
    })


def metadata(client, path, token):
    try:
        with client.open(token_request(path, token), timeout=12) as response:
            need(response.status == 200 and response.geturl() == API + path, "PROVIDER_METADATA_STATUS")
            body = response.read(METADATA_LIMIT + 1)
    except (urllib.error.URLError, TimeoutError):
        raise ValueError("PROVIDER_METADATA_UNAVAILABLE") from None
    need(0 < len(body) <= METADATA_LIMIT, "PROVIDER_METADATA_BOUND")
    return json.loads(body)


def validate_location(location):
    url = urllib.parse.urlsplit(location)
    need(url.scheme == "https" and url.username is None and url.password is None and
         url.port in (None, 443) and not url.fragment and bool(url.query) and bool(url.path) and
         url.hostname is not None and url.hostname.endswith(PROVIDER_BLOB_SUFFIX), "PROVIDER_REDIRECT_SCOPE")
    return location


def artifact_metadata(choice, token):
    client = opener()
    run = metadata(client, f"actions/runs/{choice['run']}", token)
    artifact = metadata(client, f"actions/artifacts/{choice['artifact']}", token)
    workflow = metadata(client, f"actions/workflows/{choice['workflow']}", token)
    need(workflow["id"] == choice["workflow"] and workflow["path"] == WORKFLOW_PATH and
         run["path"].split("@", 1)[0] == WORKFLOW_PATH, "PRODUCER_WORKFLOW_PATH")
    repository = artifact_identity(choice, run, artifact)
    return {"repositoryId": repository, "artifactId": artifact["id"], "producerRunId": run["id"],
            "producerWorkflowId": workflow["id"], "producerHeadSha": run["head_sha"],
            "artifactDigest": artifact["digest"], "artifactBytes": artifact["size_in_bytes"]}


def download(choice, token, destination):
    client = opener()
    try:
        path = f"actions/artifacts/{choice['artifact']}/zip"
        try:
            with client.open(token_request(path, token), timeout=12):
                raise ValueError("PROVIDER_EXPECTED_REDIRECT")
        except urllib.error.HTTPError as error:
            with error:
                need(error.code == 302 and bool(error.headers.get("Location")), "PROVIDER_REDIRECT_STATUS")
                location = validate_location(error.headers["Location"])
        # Deliberately create a fresh request with zero bearer headers.
        request = urllib.request.Request(location, headers={"User-Agent": "sounding-line-b-c856"})
        with client.open(request, timeout=12) as source, destination.open("xb") as sink:
            need(source.status == 200 and source.geturl() == location and
                 source.headers.get("Content-Encoding") in (None, "identity"), "PROVIDER_ARCHIVE_STATUS")
            length = source.headers.get("Content-Length")
            need(length is None or length == str(choice["bytes"]), "PROVIDER_CONTENT_LENGTH")
            digest = hashlib.sha256()
            count = 0
            while True:
                chunk = source.read(min(1 << 20, choice["bytes"] - count + 1))
                if not chunk:
                    break
                count += len(chunk)
                need(count <= choice["bytes"], "PROVIDER_ARCHIVE_BOUND")
                digest.update(chunk)
                sink.write(chunk)
        need(count == choice["bytes"] and digest.hexdigest() == choice["sha256"], "PROVIDER_ARCHIVE_DIGEST")
    except (urllib.error.URLError, TimeoutError):
        # A signed redirect is effectively an access token. Never include it in receipts or logs.
        raise ValueError("PROVIDER_ARCHIVE_UNAVAILABLE") from None
