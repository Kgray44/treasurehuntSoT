import io
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import jammy_preflight_workflow as workflow


class WorkflowEvidenceTest(unittest.TestCase):
    def test_approved_workflow_keeps_normal_cancellation_recovery_on_the_same_job(self):
        document = (workflow.ROOT / ".github/workflows/sounding-line-jammy-confined-preflight.yml").read_text(encoding="utf-8")
        lines = document.splitlines()
        job_gate = next(line for line in lines if line.startswith("    if:"))
        self.assertNotIn("always()", job_gate)
        for binding in ("!cancelled()", "github.event_name == 'workflow_dispatch'",
                        "github.repository == 'Kgray44/treasurehuntSoT'",
                        "github.ref == 'refs/heads/main'", "github.actor == 'Kgray44'",
                        "github.triggering_actor == 'Kgray44'", "github.run_attempt == 1",
                        "inputs.source_sha == github.sha", "inputs.operation == 'confined-loader-and-denials-only'"):
            self.assertIn(binding, job_gate)
        launch = document.split("id: preflight", 1)[1].split("- name: Reconcile", 1)[0]
        self.assertIn("success() && !cancelled()", launch)
        self.assertIn('exec /usr/bin/python3 -IB -c "${entry%.}" launch', launch)
        recovery = document.split("- name: Reconcile", 1)[1]
        self.assertIn("always() && (failure() || cancelled())", recovery)
        self.assertIn("steps.preflight.outputs.intent_sha256", recovery)
        self.assertIn("steps.preflight.outputs.custody_sha256", recovery)

    def test_rehearsal_and_native_execution_have_separate_operation_conditions(self):
        document = (workflow.ROOT / ".github/workflows/sounding-line-jammy-confined-preflight.yml").read_text(encoding="utf-8")
        rehearsal = document.split("id: rehearsal", 1)[1].split("id: preflight", 1)[0]
        exercise, recovery = rehearsal.split("- name: Verify same-job", 1)
        self.assertIn("!cancelled() && inputs.operation == 'recovery-transport-only'", exercise)
        self.assertIn('exec /usr/bin/python3 -IB -c "${entry%.}" exercise', exercise)
        self.assertIn("always() && inputs.operation == 'recovery-transport-only'", recovery)
        self.assertIn("steps.rehearsal.outputs.intent_sha256", recovery)
        self.assertIn("REHEARSAL_CANCELLED: ${{ job.status == 'cancelled' && "
                      "steps.rehearsal.outcome == 'cancelled' }}", recovery)
        self.assertNotIn("JAMMY_PREFLIGHT_APPROVAL", rehearsal)
        native = document.split("id: preflight", 1)[1]
        self.assertIn("!cancelled() && inputs.operation == 'confined-loader-and-denials-only'", native)

    def test_bound_native_entry_can_reach_environment_approval(self):
        self.assertIs(workflow.entry.worker.NATIVE_ENABLED, True)
        with (patch.object(workflow.sys, "platform", "linux"),
              patch.dict(os.environ, {"GITHUB_ACTIONS": "true"}, clear=True),
              patch.object(workflow, "approved_ingress", side_effect=ValueError("JAMMY_ENTRY_APPROVAL_SIZE"))):
            with self.assertRaisesRegex(ValueError, "JAMMY_ENTRY_APPROVAL_SIZE"):
                workflow.run_step("launch", io.StringIO())

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
        with (patch.object(workflow.entry.worker, "NATIVE_ENABLED", False),
              patch.object(workflow, "approved_ingress") as ingress):
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

    def test_intent_digest_is_written_to_both_workflow_channels(self):
        digest = "d" * 64
        provider, step = io.StringIO(), io.StringIO()
        sink = workflow.WorkflowEvidence(provider, step)
        line = f"jammyPreflightIntentSha256={digest}\n"
        self.assertEqual(sink.write(line), len(line))
        sink.flush()
        self.assertEqual(step.getvalue(), f"intent_sha256={digest}\n")
        self.assertEqual(provider.getvalue(), line)

    def test_recovery_uses_intent_only_when_final_digest_is_absent(self):
        publication = {"source": "a" * 40}
        envelope = {"publication": publication, "dispatch": {}, "inventoryReceipt": "YQ=="}
        environment = {"JAMMY_PREFLIGHT_APPROVAL": json.dumps(envelope), "REQUESTED_SOURCE": "a" * 40,
                       "REQUESTED_OPERATION": workflow.OPERATION, "PRIOR_INTENT_SHA256": "e" * 64}
        with (patch.dict(os.environ, environment, clear=True),
              patch.object(workflow.entry, "validate_approval", return_value=(123, publication))):
            run, actual, stream = workflow.approved_ingress("recover")
            self.assertEqual((run, actual), (123, publication))
            self.assertEqual(json.load(stream)["intentReceiptSha256"], "e" * 64)
        environment["PRIOR_CUSTODY_SHA256"] = "f" * 64
        with (patch.dict(os.environ, environment, clear=True),
              patch.object(workflow.entry, "validate_approval", return_value=(123, publication))):
            run, actual, stream = workflow.approved_ingress("recover")
            proof = json.load(stream)
            self.assertEqual(proof["custodyReceiptSha256"], "f" * 64)
            self.assertNotIn("intentReceiptSha256", proof)
