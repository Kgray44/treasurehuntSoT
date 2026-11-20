import base64
import hashlib
import unittest
from unittest.mock import patch

import jammy_preflight_provider as provider

WORKFLOW = ".github/workflows/sounding-line-jammy-confined-preflight.yml"
REPO = {"id": 1303074266, "full_name": "Kgray44/treasurehuntSoT"}
OWNER = {"id": 64373011, "login": "Kgray44"}
SOURCE = "a" * 40
TREE = "b" * 40
DATA = b"disabled test fixture"
WORKFLOW_ID = 414024776
RUN_ID = 123


class ProviderPublicationTest(unittest.TestCase):
    def setUp(self):
        self.run = {
            "id": RUN_ID, "path": WORKFLOW, "workflow_id": WORKFLOW_ID, "head_branch": "main",
            "event": "workflow_dispatch", "run_attempt": 1, "head_sha": SOURCE,
            "repository": dict(REPO), "head_repository": dict(REPO), "actor": dict(OWNER),
            "triggering_actor": dict(OWNER),
        }
        self.commit = {"sha": SOURCE, "tree": {"sha": TREE}}
        self.workflow = {"id": WORKFLOW_ID, "path": WORKFLOW}
        self.file = {
            "type": "file", "path": WORKFLOW, "encoding": "base64", "size": len(DATA),
            "content": base64.b64encode(DATA).decode("ascii"),
        }
        self.responses = {
            f"actions/runs/{RUN_ID}": self.run,
            f"actions/workflows/{WORKFLOW_ID}": self.workflow,
            f"git/commits/{SOURCE}": self.commit,
            f"contents/{WORKFLOW}?ref={SOURCE}": self.file,
        }

    def authenticate(self):
        approval = {"workflowId": WORKFLOW_ID, "source": SOURCE, "tree": TREE,
                    "workflowSha256": hashlib.sha256(DATA).hexdigest()}
        with patch.object(provider, "metadata", side_effect=lambda _client, path, _token: self.responses[path]):
            return provider.authenticate_jammy_preflight_run(RUN_ID, approval, "test-token")

    def test_authenticates_exact_provider_run_and_publication(self):
        result = self.authenticate()
        self.assertEqual(result.run_id, RUN_ID)
        self.assertEqual(result.source, SOURCE)

    def test_rejects_rerun_and_substituted_trigger(self):
        self.run["run_attempt"] = 2
        with self.assertRaisesRegex(ValueError, "JAMMY_PROVIDER_RUN"):
            self.authenticate()
        self.run["run_attempt"] = 1
        self.run["triggering_actor"]["id"] += 1
        with self.assertRaisesRegex(ValueError, "JAMMY_PROVIDER_OWNER"):
            self.authenticate()

    def test_rejects_workflow_bytes_from_another_publication(self):
        self.file["content"] = base64.b64encode(b"x" * len(DATA)).decode("ascii")
        with self.assertRaisesRegex(ValueError, "JAMMY_PROVIDER_WORKFLOW_BYTES"):
            self.authenticate()

    def test_rejects_wrong_git_tree(self):
        self.commit["tree"] = {"sha": "c" * 40}
        with self.assertRaisesRegex(ValueError, "JAMMY_PROVIDER_TREE"):
            self.authenticate()


if __name__ == "__main__":
    unittest.main()
