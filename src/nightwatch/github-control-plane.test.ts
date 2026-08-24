import { describe, expect, it } from "vitest";
import { GitHubCliControlPlane } from "./github-control-plane";

const identity = {
  candidateSha: "a".repeat(40),
  candidateTreeSha: "b".repeat(40),
  baseSha: "c".repeat(40),
  baseTreeSha: "d".repeat(40),
  candidateRef: "refs/heads/codex/project-nightwatch-fast-lane",
};

describe("GitHubCliControlPlane", () => {
  it("labels and dispatches an exact ordinary candidate through a unique Mainline Train", () => {
    const plane = new GitHubCliControlPlane("Kgray44/treasurehuntSoT");
    const transactionId = "01234567-89ab-cdef-0123-456789abcdef";
    const internal = plane as unknown as {
      candidatePullRequest: (ref: string, sha: string) => { number: number };
      gh: (args: string[]) => string;
      dispatch: (workflow: string, title: string, inputs: Record<string, string>) => { runId: string };
    };
    internal.candidatePullRequest = () => ({ number: 410 });
    internal.gh = (args) => {
      expect(args).toContain("repos/Kgray44/treasurehuntSoT/issues/410/labels");
      expect(args).toContain("labels[]=nw-train-01234567-89ab-cdef-0123-456789abcdef");
      return "";
    };
    internal.dispatch = (workflow, title, inputs) => {
      expect(workflow).toBe("sounding-line-mainline-train.yml");
      expect(title).toBe("Sounding Line mainline train nw-01234567-89ab-cdef-0123-456789abcdef");
      expect(inputs).toEqual({
        train_id: "nw-01234567-89ab-cdef-0123-456789abcdef",
        label: "nw-train-01234567-89ab-cdef-0123-456789abcdef",
      });
      return { runId: "mainline-train-run" };
    };
    expect(plane.dispatchMainlineTrain({ ...identity, transactionId, dispatchKey: "nightwatch:train" })).toEqual({
      runId: "mainline-train-run",
    });
  });

  it("binds authority dispatch to the exact certified protected-main baseline run", () => {
    const plane = new GitHubCliControlPlane("Kgray44/treasurehuntSoT");
    const internal = plane as unknown as {
      candidatePullRequest: (ref: string, sha: string) => { number: number };
      baselineCertification: (value: typeof identity) => { runId: string; certificationId: string };
      dispatch: (workflow: string, title: string, inputs: Record<string, string>) => { runId: string };
    };
    internal.candidatePullRequest = (ref, sha) => {
      expect(ref).toBe(identity.candidateRef);
      expect(sha).toBe(identity.candidateSha);
      return { number: 410 };
    };
    internal.baselineCertification = (value) => {
      expect(value).toMatchObject(identity);
      return { runId: "32526739730", certificationId: "baseline:certified" };
    };
    let observed: Record<string, string> | undefined;
    internal.dispatch = (workflow, title, inputs) => {
      expect(workflow).toBe("sounding-line-authoritative.yml");
      expect(title).toContain("nightwatch:exact-authority");
      observed = inputs;
      return { runId: "authority-run" };
    };

    expect(plane.dispatchAuthority({ ...identity, dispatchKey: "nightwatch:exact-authority" })).toEqual({
      runId: "authority-run",
    });
    expect(observed).toMatchObject({
      candidate_sha: identity.candidateSha,
      candidate_ref: identity.candidateRef,
      base_sha: identity.baseSha,
      baseline_run_id: "32526739730",
      authority_mode: "candidate",
    });
  });
});
