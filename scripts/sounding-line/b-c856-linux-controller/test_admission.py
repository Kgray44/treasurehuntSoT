import unittest
from admission import GIB, MIB, MAX_ARCHIVE, MAX_CAPSULE, BudgetError, storage_plan, artifact_identity


class AdmissionTests(unittest.TestCase):
    def test_advertised_total_is_not_available_space(self):
        with self.assertRaises(BudgetError):
            storage_plan(14_000_000_000, 5*GIB, MAX_ARCHIVE, MAX_CAPSULE)
        result = storage_plan(14_000_000_000, 12*GIB, 1*GIB, 5*GIB)
        self.assertLessEqual(result["projectedAdditionalBytes"], 12*GIB)
        self.assertGreaterEqual(result["projectedFreeAfterBytes"], 2*GIB)

    def test_oversized_archive_or_capsule_refused_before_transfer(self):
        for archived, native in [(MAX_ARCHIVE+1, MIB), (MIB, MAX_CAPSULE+1)]:
            with self.assertRaises(BudgetError):
                storage_plan(14_000_000_000, 12*GIB, archived, native)

    def test_run_and_artifact_are_both_bound(self):
        chosen = {"run": 45, "artifact": 32, "sha256": "e"*64, "bytes": 12345,
                  "producer": "f"*40, "workflow": 85}
        run = {"id": 45, "head_sha": "f"*40, "workflow_id": 85, "run_attempt": 1,
               "conclusion": "success", "status": "completed", "event": "workflow_dispatch",
               "repository": {"full_name": "Kgray44/treasurehuntSoT", "id": 123},
               "head_repository": {"full_name": "Kgray44/treasurehuntSoT", "id": 123},
               "actor": {"login": "Kgray44"}, "triggering_actor": {"login": "Kgray44"},
               "head_branch": "main"}
        artifact = {"id": 32, "name": "sounding-line-b-c856-runtime-capsule",
                    "workflow_run": {"id": 45, "head_sha": "f"*40,
                                     "repository_id": 123, "head_repository_id": 123},
                    "digest": "sha256:"+"e"*64, "expired": False, "size_in_bytes": 12345}
        artifact_identity(chosen, run, artifact)
        for changed in ({**artifact, "digest": "sha256:"+"a"*64},
                        {**artifact, "workflow_run": {**artifact["workflow_run"], "id": 99}}):
            with self.assertRaises(BudgetError):
                artifact_identity(chosen, run, changed)
        with self.assertRaises(BudgetError):
            artifact_identity(chosen, {**run, "head_branch": "foreign"}, artifact)
