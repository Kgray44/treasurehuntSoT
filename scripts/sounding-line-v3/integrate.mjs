#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repository = "Kgray44/treasurehuntSoT";
const required = "Sounding Line V3 / Verification";
const actionsApp = 15368;
const api = (route, ...args) => JSON.parse(execFileSync("gh", [
  "api", "repos/" + repository + "/" + route, ...args,
], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }));
const pull = (number) => api("pulls/" + number);

export function prerequisites(body) {
  const dependencies = new Set();
  for (const line of (body ?? "").split(/\r?\n/)) {
    if (!/^\s*Depends on:/i.test(line)) continue;
    const list = line.slice(line.indexOf(":") + 1).trim();
    if (!/^#[1-9]\d*(?:\s*,\s*#[1-9]\d*)*$/.test(list))
      throw new Error("Use Depends on: #123, #456.");
    for (const item of list.split(",")) dependencies.add(Number(item.trim().slice(1)));
  }
  return [...dependencies];
}

function verifyProtection() {
  const protection = api("branches/main/protection");
  if (!protection.enforce_admins?.enabled || !protection.required_status_checks?.strict ||
      !protection.required_status_checks.checks?.some((check) => check.context === required && check.app_id === actionsApp))
    throw new Error("Strict V3 protection by GitHub Actions is required before integrating.");
}

function decisionPassed(head) {
  const { check_runs: checks } = api("commits/" + head + "/check-runs?per_page=100&filter=latest");
  const decisions = checks.filter((check) => check.name === required && check.app.id === actionsApp)
    .sort((a, b) => b.id - a.id);
  return decisions[0]?.conclusion === "success";
}

export function disposition(pr, getDependency) {
  if (pr.state !== "open" || pr.draft || pr.base.ref !== "main") return "not an active main candidate";
  if (pr.head.repo?.full_name !== pr.base.repo.full_name) return "fork branch requires a manual update";
  for (const number of prerequisites(pr.body)) {
    if (number === pr.number) return "self dependency";
    const dependency = getDependency(number);
    if (!dependency.merged || dependency.base.ref !== "main") return "waiting for #" + number + " to land on main";
  }
  if (pr.mergeable === false) return "merge conflict";
  if (pr.mergeable === null) return "GitHub is calculating mergeability";
  if (pr.mergeable_state === "behind") return "behind";
  if (pr.mergeable_state !== "clean") return "GitHub merge state is " + pr.mergeable_state;
  return "ready";
}

function integrate(number, apply) {
  const pr = pull(number);
  const state = disposition(pr, pull);
  if (!["behind", "ready"].includes(state)) return state;
  if (!decisionPassed(pr.head.sha) && (!pr.merge_commit_sha || !decisionPassed(pr.merge_commit_sha)))
    return "waiting for a successful V3 check on the current candidate";
  if (!apply) return state === "behind" ? "will request base update" : "ready for protected merge";
  if (state === "behind") {
    api("pulls/" + number + "/update-branch", "-X", "PUT", "-f", "expected_head_sha=" + pr.head.sha);
    return "base update requested; waiting for exact-tree verification";
  }
  const tested = api("git/commits/" + pr.merge_commit_sha).tree.sha;
  const result = api("pulls/" + number + "/merge", "-X", "PUT", "-f", "sha=" + pr.head.sha, "-f", "merge_method=squash");
  if (!result.merged) throw new Error("GitHub did not merge the candidate.");
  const landed = api("git/commits/" + result.sha).tree.sha;
  if (landed !== tested) throw new Error("Landed tree differs from the proposed tree at " + result.sha + ". Stop and investigate.");
  return "merged and matched tree " + landed + " at " + result.sha;
}

function main(args) {
  const apply = args.includes("--apply");
  const numbers = args.filter((arg) => arg !== "--apply");
  if (!numbers.length || numbers.some((value) => !/^[1-9]\d*$/.test(value)))
    throw new Error("Usage: npm run sl:integrate -- [--apply] <PR number>...");
  verifyProtection();
  for (const number of new Set(numbers.map(Number))) {
    try {
      console.log("#%d %s", number, integrate(number, apply));
    } catch (error) {
      if (error.message.startsWith("Landed tree")) throw error;
      console.error("#%d held: %s", number, error.message);
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
