import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor

SCRIPT = Path(__file__).resolve().parents[2] / "skills/launchdeck/scripts/launchdeck.py"
spec = importlib.util.spec_from_file_location("launchdeck", SCRIPT)
ld = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ld)


class LaunchdeckTests(unittest.TestCase):
    def setUp(self):
        self.data = {"projects": [{"projectId": "real-codex", "label": "VoyageWright",
                                  "projectKind": "local", "hostId": "local", "isGitRepository": True},
                                 {"projectId": "wrong-chatgpt", "label": "VoyageWright",
                                  "projectKind": "chatgpt"}], "threads": [],
                     "request": {"initiatives": ["Landfall"], "phase": "2", "phase_name": "Anchor Test",
                                 "objective": "Complete the agreed phase",
                                 "constraints": ["Do not merge, tag, or release"],
                                 "acceptance": ["Required validation passes"]}}
        self.temp = tempfile.TemporaryDirectory()
        self.journal = str(Path(self.temp.name) / "launches.json")

    def tearDown(self):
        self.temp.cleanup()

    def test_routes_codex_not_chatgpt(self):
        self.assertEqual(ld.plan(self.data)["target"]["projectId"], "real-codex")

    def test_missing_route_stops(self):
        self.data["projects"] = self.data["projects"][1:]
        with self.assertRaises(ValueError):
            ld.plan(self.data)

    def test_verified_route_cannot_fall_back_to_same_name(self):
        self.data["preferred_project_id"] = "missing-verified-project"
        with self.assertRaisesRegex(ValueError, "do not substitute"):
            ld.plan(self.data)

    def test_dependencies_reach_prompt_and_contract(self):
        self.data["request"]["dependencies"] = ["Parallax Phase 1 accepted source abc123"]
        result = ld.plan(self.data)
        self.assertIn(self.data["request"]["dependencies"][0], result["prompt"])
        self.assertEqual(result["task_contract"]["dependencies"], self.data["request"]["dependencies"])

    def test_successive_collisions_reach_v3(self):
        base = ld.plan(self.data)["title"]
        self.data["threads"] = [{"kind": "codex", "projectId": "real-codex", "title": t}
                                for t in (base, base + " V2")]
        self.assertEqual(ld.plan(self.data)["title"], base + " V3")

    def test_ambiguous_route_stops(self):
        self.data["projects"].append({"projectId": "second", "label": "VoyageWright", "projectKind": "local"})
        with self.assertRaises(ValueError):
            ld.plan(self.data)
        self.data["preferred_project_id"] = "real-codex"
        self.assertEqual(ld.plan(self.data)["target"]["projectId"], "real-codex")

    def test_phase_name_and_no_repeated_brand(self):
        self.data["request"]["initiatives"] = ["VoyageWright Landfall"]
        self.assertEqual(ld.plan(self.data)["title"], "Landfall Phase 2: Anchor Test")

    def test_corrections_for_multiple_initiatives(self):
        self.data["request"].pop("phase")
        self.data["request"].update(initiatives=["Crossdeck", "Parallax"], purpose="Corrections")
        self.assertEqual(ld.plan(self.data)["title"], "Crossdeck + Parallax: Corrections")

    def test_collision_lowest_free_suffix(self):
        self.data["threads"] = [{"kind": "codex", "projectId": "real-codex", "title": t}
                                for t in ["LANDFALL  PHASE 2: ANCHOR TEST", "Landfall Phase 2: Anchor Test V3"]]
        self.assertEqual(ld.plan(self.data)["title"], "Landfall Phase 2: Anchor Test V2")

    def test_other_project_does_not_occupy_title(self):
        self.data["threads"] = [{"kind": "codex", "projectId": "other", "title": "Landfall Phase 2: Anchor Test"}]
        self.assertEqual(ld.plan(self.data)["title"], "Landfall Phase 2: Anchor Test")

    def test_retry_keeps_key_and_does_not_dispatch(self):
        first = ld.execute("reserve", self.data, self.journal)
        second = ld.execute("reserve", self.data, self.journal)
        self.assertEqual(first["request_key"], second["request_key"])
        self.assertEqual(first["action"], "dispatch_once")
        self.assertEqual(second["action"], "reconcile_or_reuse")

    def test_uncertain_outcome_blocks_retry(self):
        key = ld.execute("reserve", self.data, self.journal)["request_key"]
        ld.execute("record", {"request_key": key, "state": "uncertain"}, self.journal)
        self.assertEqual(ld.execute("reserve", self.data, self.journal)["action"], "reconcile_or_reuse")
        with self.assertRaises(ValueError):
            ld.execute("record", {"request_key": key, "state": "not_created"}, self.journal)

    def test_proven_rejection_allows_retry(self):
        key = ld.execute("reserve", self.data, self.journal)["request_key"]
        ld.execute("record", {"request_key": key, "state": "not_created", "no_side_effect_proven": True}, self.journal)
        self.assertEqual(ld.execute("reserve", self.data, self.journal)["action"], "dispatch_once")

    def test_new_requests_reserve_different_titles(self):
        ld.execute("reserve", self.data, self.journal)
        self.data["request"]["objective"] = "Complete a different agreed outcome"
        self.assertEqual(ld.execute("reserve", self.data, self.journal)["title"], "Landfall Phase 2: Anchor Test V2")

    def test_gate_and_acceptance_preserved(self):
        result = ld.plan(self.data)
        self.assertIn("Do not merge, tag, or release", result["prompt"])
        self.assertIn("Required validation passes", result["prompt"])
        self.assertIn("Omit token_budget", result["prompt"])

    def test_no_unrequested_worktree(self):
        self.data["request"]["environment"] = "worktree"
        with self.assertRaises(ValueError):
            ld.plan(self.data)
        self.data["request"]["worktree_authorized"] = True
        self.assertEqual(ld.plan(self.data)["target"]["environment"]["type"], "worktree")

    def test_budget_requires_explicit_authorization(self):
        self.data["request"]["token_budget"] = 1000
        with self.assertRaises(ValueError):
            ld.plan(self.data)
        self.data["request"]["token_budget_explicit"] = True
        self.assertIn("token_budget=1000", ld.plan(self.data)["prompt"])

    def test_new_run_requires_authorization(self):
        old = ld.plan(self.data)["request_key"]
        self.data["request"]["new_run"] = "Human requested repeat 2026-10-10"
        with self.assertRaises(ValueError):
            ld.plan(self.data)
        self.data["request"]["new_run_authorized"] = True
        self.assertNotEqual(old, ld.plan(self.data)["request_key"])

    def test_verified_needs_real_evidence(self):
        key = ld.execute("reserve", self.data, self.journal)["request_key"]
        with self.assertRaises(ValueError):
            ld.execute("record", {"request_key": key, "state": "verified", "threadId": "thread"}, self.journal)
        receipt = ld.execute("record", {"request_key": key, "state": "verified", "threadId": "thread",
                            "project_verified": True, "title_verified": True, "goal_verified": False}, self.journal)
        self.assertFalse(receipt["receipt"]["goal_verified"])
        with self.assertRaises(ValueError):
            ld.execute("record", {"request_key": key, "state": "not_created", "no_side_effect_proven": True}, self.journal)

    def test_client_id_stays_pending(self):
        key = ld.execute("reserve", self.data, self.journal)["request_key"]
        receipt = ld.execute("record", {"request_key": key, "state": "pending", "clientThreadId": "client"}, self.journal)
        self.assertNotIn("threadId", receipt["receipt"])
        self.assertEqual(ld.execute("reserve", self.data, self.journal)["action"], "reconcile_or_reuse")

    def test_corrupt_journal_is_preserved(self):
        Path(self.journal).write_text("broken", encoding="utf-8")
        with self.assertRaises(ValueError):
            ld.execute("reserve", self.data, self.journal)
        self.assertEqual(Path(self.journal).read_text(), "broken")

    def test_lock_conflict_stops(self):
        Path(self.journal + ".lock").write_text("another owner")
        with self.assertRaises(FileExistsError):
            ld.execute("reserve", self.data, self.journal)

    def test_inventory_limit_disclosed(self):
        self.assertFalse(ld.plan(self.data)["inventory_complete"])

    def test_no_prompt_persisted_in_journal(self):
        ld.execute("reserve", self.data, self.journal)
        journal = json.loads(Path(self.journal).read_text())
        self.assertNotIn(self.data["request"]["objective"], json.dumps(journal))

    def test_trim_contract_retains_non_goals_and_deliverables(self):
        self.data["request"].update(non_goals=["No Phase 3"], deliverables=["Owner-reviewable receipt"],
                                    context_profile="integration", execution_profile="UNATTENDED_CONTINUATION")
        result = ld.plan(self.data)
        self.assertEqual(result["task_contract"]["uniqueNonGoals"], ["No Phase 3"])
        self.assertIn("No Phase 3", result["prompt"])
        self.assertIn("Owner-reviewable receipt", result["prompt"])
        self.assertEqual(result["task_contract"]["contextProfile"], "integration")
        self.assertEqual(result["task_contract"]["executionProfile"], "UNATTENDED_CONTINUATION")

    def test_invalid_trim_profile_stops(self):
        self.data["request"]["context_profile"] = "imaginary"
        with self.assertRaises(ValueError):
            ld.plan(self.data)

    def test_prompt_size_is_not_usage_or_hard_budget(self):
        result = ld.plan(self.data)
        self.assertIsNone(result["inspection"]["actualUsage"])
        self.assertEqual(result["inspection"]["promptBytes"], len(result["prompt"].encode("utf-8")))
        self.assertFalse(result["inspection"]["blocksProgress"])
        self.assertEqual(result["inspection"]["accountingMethod"], "UNAVAILABLE")

    def test_uncertainty_cannot_erase_existing_native_ids(self):
        key = ld.execute("reserve", self.data, self.journal)["request_key"]
        ld.execute("record", {"request_key": key, "state": "created", "threadId": "observed"}, self.journal)
        ld.execute("record", {"request_key": key, "state": "uncertain"}, self.journal)
        with self.assertRaises(ValueError):
            ld.execute("record", {"request_key": key, "state": "not_created", "no_side_effect_proven": True}, self.journal)

    def test_retry_reallocates_title_after_another_launch(self):
        key = ld.execute("reserve", self.data, self.journal)["request_key"]
        ld.execute("record", {"request_key": key, "state": "not_created", "no_side_effect_proven": True}, self.journal)
        other = copy.deepcopy(self.data)
        other["request"]["objective"] = "Another accepted task"
        self.assertEqual(ld.execute("reserve", other, self.journal)["title"], "Landfall Phase 2: Anchor Test")
        self.assertEqual(ld.execute("reserve", self.data, self.journal)["title"], "Landfall Phase 2: Anchor Test V2")

    def test_native_title_repair_updates_receipt_without_relaunch(self):
        key = ld.execute("reserve", self.data, self.journal)["request_key"]
        ld.execute("record", {"request_key": key, "state": "verified", "threadId": "observed",
                            "title": "Landfall Phase 2: Anchor Test V2", "title_verified": True,
                            "project_verified": True}, self.journal)
        result = ld.execute("reserve", self.data, self.journal)
        self.assertEqual(result["title"], "Landfall Phase 2: Anchor Test V2")
        self.assertEqual(result["action"], "reconcile_or_reuse")

    def test_simultaneous_distinct_requests_get_distinct_titles(self):
        requests = [copy.deepcopy(self.data) for _ in range(3)]
        for index, item in enumerate(requests):
            item["request"]["objective"] += " " + str(index)
        with ThreadPoolExecutor(max_workers=3) as pool:
            results = list(pool.map(lambda item: ld.execute("reserve", item, self.journal), requests))
        self.assertEqual(len({item["title"] for item in results}), 3)
        self.assertEqual(len({item["request_key"] for item in results}), 3)
        self.assertTrue(all(item["action"] == "dispatch_once" for item in results))

    def test_simultaneous_retries_dispatch_only_once(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: ld.execute("reserve", self.data, self.journal), range(4)))
        self.assertEqual(sum(item["action"] == "dispatch_once" for item in results), 1)

    def test_case_sensitive_scope_gets_distinct_request_key(self):
        first = ld.plan(self.data)["request_key"]
        self.data["request"]["sources"] = ["src/Foo.ts"]
        second = ld.plan(self.data)["request_key"]
        self.data["request"]["sources"] = ["src/foo.ts"]
        self.assertNotEqual(first, second)
        self.assertNotEqual(second, ld.plan(self.data)["request_key"])

    def test_phase_requires_governing_name(self):
        self.data["request"].pop("phase_name")
        with self.assertRaises(ValueError):
            ld.plan(self.data)

    def test_native_identifier_cannot_be_replaced(self):
        key = ld.execute("reserve", self.data, self.journal)["request_key"]
        ld.execute("record", {"request_key": key, "state": "created", "threadId": "observed"}, self.journal)
        with self.assertRaises(ValueError):
            ld.execute("record", {"request_key": key, "state": "created", "threadId": "different"}, self.journal)
        self.assertEqual(ld.execute("status", {"request_key": key}, self.journal)["receipt"]["threadId"], "observed")

    def test_native_identifier_and_flags_need_typed_evidence(self):
        key = ld.execute("reserve", self.data, self.journal)["request_key"]
        for field, value in [("threadId", ""), ("project_verified", "true")]:
            with self.assertRaises(ValueError):
                ld.execute("record", {"request_key": key, "state": "uncertain", field: value}, self.journal)

    def test_failed_revalidation_retains_identity_and_prevents_redispatch(self):
        key = ld.execute("reserve", self.data, self.journal)["request_key"]
        ld.execute("record", {"request_key": key, "state": "verified", "threadId": "observed",
                            "project_verified": True, "title_verified": True}, self.journal)
        with self.assertRaises(ValueError):
            ld.execute("record", {"request_key": key, "state": "uncertain",
                                 "project_verified": False}, self.journal)
        ld.execute("record", {"request_key": key, "state": "uncertain",
                             "project_verified": False, "revalidation_failed": True}, self.journal)
        result = ld.execute("reserve", self.data, self.journal)
        self.assertEqual(result["action"], "reconcile_or_reuse")
        self.assertEqual(result["receipt"]["threadId"], "observed")
        self.assertFalse(result["receipt"]["project_verified"])
        with self.assertRaises(ValueError):
            ld.execute("record", {"request_key": key, "state": "not_created",
                                 "no_side_effect_proven": True}, self.journal)

    def test_adapter_blocks_before_any_reservation_or_native_call(self):
        adapter_path = Path(__file__).resolve().parents[1] / "project-launchdeck/server/launchdeck_mcp.py"
        adapter_spec = importlib.util.spec_from_file_location("launchdeck_adapter", adapter_path)
        adapter = importlib.util.module_from_spec(adapter_spec)
        adapter_spec.loader.exec_module(adapter)
        launcher = adapter.Launcher.__new__(adapter.Launcher)
        launcher.binding = {"desktopAssociationVerified": True, "pluginOnlyAssociationVerified": False}
        # No app, journal or project object exists: the gate must stop before using any.
        with self.assertRaisesRegex(ValueError, "no conversation created"):
            launcher.launch(self.data["request"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
