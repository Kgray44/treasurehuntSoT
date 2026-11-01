// Ordinary transport uses the installed reader closure, never all repository refs.
// Finite campaign profiles retain their existing, separately governed routes.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selectedCheckout } from "./experience-selected-checkout.mjs";
import { EXPERIENCE_CHECKOUT_ROOTS, EXPERIENCE_READER_REVISIONS } from "./experience-checkout-roots.mjs";
import { PR776_CONTROLLER } from "./experience-pr776-controller-reconciliation.mjs";
import { documentationCheckoutReadSet } from "./ordinary-documentation-checkout-profile.mjs";

const repository = "Kgray44/treasurehuntSoT";
const need = (value, code) => {
  if (!value) throw new Error(`SOUNDING_LINE_ORDINARY_CHECKOUT_${code}`);
};
const oid = (value) => /^[a-f0-9]{40}$/u.test(value ?? "");
export function ordinaryCheckoutProfile({ baseSha, candidateSha, env = process.env, event, purpose = "verification" }) {
  need(["verification", "campaign-custody"].includes(purpose), "INVALID_PURPOSE");
  need(purpose !== "campaign-custody" || env.GITHUB_JOB === "campaign-custody", "CUSTODY_JOB_REQUIRED");
  need(oid(baseSha) && oid(candidateSha), "INVALID_IDENTITY");
  need(env.GITHUB_REPOSITORY === repository && env.GITHUB_SHA === baseSha, "UNTRUSTED_BASE");
  need(env.GITHUB_REF === "refs/heads/main", "UNTRUSTED_REF");
  event ??= JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const pull = event.pull_request;
  const dispatch = env.GITHUB_EVENT_NAME === "workflow_dispatch";
  need(
    dispatch
      ? event.inputs?.base_sha === baseSha && event.inputs?.candidate_sha === candidateSha
      : env.GITHUB_EVENT_NAME === "pull_request_target" &&
          pull?.base?.sha === baseSha &&
          pull?.head?.sha === candidateSha &&
          pull?.base?.repo?.full_name === repository &&
          pull?.head?.repo?.full_name === repository,
    "UNTRUSTED_EVENT",
  );
  const pr = dispatch ? Number(event.inputs?.pr_number) : pull?.number;
  need(Number.isSafeInteger(pr) && pr > 0 && ![721, 776].includes(pr), "FINITE_PROFILE_REQUIRED");
  return {
    selectReadSet: ({ command, readOnlyCommand, root, git, baseSha, candidateSha }) =>
      documentationCheckoutReadSet({
        command,
        readOnlyCommand,
        root,
        git,
        baseSha,
        candidateSha,
        prNumber: pr,
        purpose,
      }),
    roots: [
      ...EXPERIENCE_CHECKOUT_ROOTS,
      PR776_CONTROLLER.ancestor,
      PR776_CONTROLLER.oldBase,
      "f265f062767d40618df9152aa8900eaf17bfa92d",
    ],
    readerRevisions: [
      ...EXPERIENCE_READER_REVISIONS,
      PR776_CONTROLLER.ancestor,
      PR776_CONTROLLER.oldBase,
      "f265f062767d40618df9152aa8900eaf17bfa92d",
    ],
    budgetMs: 600000,
    stallBudgetMs: 600000,
    readerPaths: [
      ...["e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab", "bfea71aad2c7fafdec0590ba1ac09ee3399e08d5"].map((revision) => ({
        revision,
        path: ".github/workflows/sounding-line-ordinary.yml",
      })),
      ...[
        "Development_Docs/document-index.json",
        "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
      ].map((file) => ({ revision: PR776_CONTROLLER.ancestor, path: file })),
    ],
    // This is the ordinary checkout's previous contract: full current snapshots
    // and readable history. Evidence preservation is still decided by the verifier;
    // a Crossdeck-specific transport assertion cannot grant ordinary acceptance.
    preservation: async () => ({ preservationPins: 0, historicalManifestPinsRetained: [] }),
  };
}

export async function ordinaryCheckout({ root, baseSha, candidateSha, env, event, signal, purpose }) {
  const profile = ordinaryCheckoutProfile({ baseSha, candidateSha, env, event, purpose });
  return selectedCheckout({
    ...profile,
    root,
    baseSha,
    candidateSha,
    remote: `https://github.com/${repository}.git`,
    signal,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.slice(2);
    need(
      args[index]?.startsWith("--") &&
        ["workspace", "base", "candidate", "purpose"].includes(key) &&
        !Object.hasOwn(options, key) &&
        typeof args[index + 1] === "string",
      "INVALID_ARGUMENTS",
    );
    options[key] = args[index + 1];
  }
  need(typeof options.workspace === "string", "INVALID_ARGUMENTS");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGTERM", cancel);
  process.once("SIGINT", cancel);
  try {
    console.log(
      JSON.stringify(
        await ordinaryCheckout({
          root: path.resolve(options.workspace),
          baseSha: options.base,
          candidateSha: options.candidate,
          purpose: options.purpose,
          signal: controller.signal,
        }),
      ),
    );
  } finally {
    process.removeListener("SIGTERM", cancel);
    process.removeListener("SIGINT", cancel);
  }
}
