import io
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import jammy_preflight_workflow as workflow


class WorkflowEvidenceTest(unittest.TestCase):
    def test_launch_digest_is_retained_in_step_output_before_returning(self):
        digest = "a" * 64
        provider, step = io.StringIO(), io.StringIO()
        sink = workflow.WorkflowEvidence(provider, step)
        line = f"jammyPreflightCustodySha256={digest}\n"
        self.assertEqual(sink.write(line), len(line))
        sink.flush()
        self.assertEqual(step.getvalue(), f"custody_sha256={digest}\n")
        self.assertEqual(provider.getvalue(), line)

    def test_invalid_digest_never_writes_either_channel(self):
        provider, step = io.StringIO(), io.StringIO()
        with self.assertRaisesRegex(ValueError, "JAMMY_ENTRY_WORKFLOW_EVIDENCE"):
            workflow.WorkflowEvidence(provider, step).write("anything")
        self.assertEqual(provider.getvalue(), "")
        self.assertEqual(step.getvalue(), "")

    def test_dormant_launch_refuses_before_reading_runner_credentials(self):
        with patch.object(workflow, "approved_ingress") as ingress:
            with self.assertRaisesRegex(ValueError, "LAUNCH_ACTION_NOT_AUTHORIZED"):
                workflow.run_step("launch", io.StringIO())
        ingress.assert_not_called()

    def test_exact_checkout_probe_never_inherits_provider_token(self):
        publication = {"source": "a" * 40, "tree": "b" * 40}
        revision = SimpleNamespace(returncode=0, stdout="a" * 40 + "\n" + "b" * 40 + "\n")
        clean = SimpleNamespace(returncode=0)
        with (patch.dict(os.environ, {"JAMMY_PREFLIGHT_TOKEN": "secret", "GIT_DIR": "/wrong"}),
              patch.object(workflow.subprocess, "run", side_effect=(revision, clean)) as command):
            workflow.verify_checkout(publication)
            self.assertEqual(command.call_count, 2)
            for call in command.call_args_list:
                self.assertNotIn("JAMMY_PREFLIGHT_TOKEN", call.kwargs["env"])
                self.assertNotIn("GIT_DIR", call.kwargs["env"])
                self.assertEqual(call.kwargs["env"]["GIT_NO_REPLACE_OBJECTS"], "1")

    def test_mismatched_checkout_refuses_before_dirty_probe(self):
        publication = {"source": "a" * 40, "tree": "b" * 40}
        revision = SimpleNamespace(returncode=0, stdout="a" * 40 + "\n" + "c" * 40 + "\n")
        with patch.object(workflow.subprocess, "run", return_value=revision) as command:
            with self.assertRaisesRegex(ValueError, "JAMMY_ENTRY_CHECKOUT_IDENTITY"):
                workflow.verify_checkout(publication)
            command.assert_called_once()

    def test_recovery_uses_the_digest_from_the_previous_step_output(self):
        publication = {"workflowId": 414024776, "source": "a" * 40, "tree": "b" * 40,
                       "workflowSha256": "c" * 64}
        dispatch = {"runId": 123}
        envelope = {"publication": publication, "dispatch": dispatch, "inventoryReceipt": "YQ=="}
        digest = "d" * 64
        environment = {"JAMMY_PREFLIGHT_APPROVAL": json.dumps(envelope), "REQUESTED_SOURCE": "a" * 40,
                       "REQUESTED_OPERATION": workflow.OPERATION, "PRIOR_CUSTODY_SHA256": digest}
        with (patch.dict(os.environ, environment, clear=True),
              patch.object(workflow.entry, "validate_approval", return_value=(123, publication))):
            run, actual, stream = workflow.approved_ingress("recover")
            self.assertEqual((run, actual), (123, publication))
            self.assertEqual(json.load(stream), {"publication": publication, "dispatch": dispatch,
                                                  "custodyReceiptSha256": digest})
            self.assertNotIn("JAMMY_PREFLIGHT_APPROVAL", os.environ)
