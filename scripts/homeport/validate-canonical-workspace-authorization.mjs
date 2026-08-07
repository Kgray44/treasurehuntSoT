import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ordinaryRoots = [
  "src/app/captain",
  "src/app/api/captain",
  "src/app/api/helper",
  "src/app/studio",
  "src/app/api/studio",
  "src/app/api/media",
  "src/private-content/authorization.ts",
];
const privilegedExceptions = new Set([
  "src/app/studio/private-content/operations/page.tsx",
  "src/app/api/studio/private-content/operations/route.ts",
]);

function filesUnder(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return [relative];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.posix.join(relative.replaceAll("\\", "/"), entry.name);
    return entry.isDirectory() ? filesUnder(child) : /\.(?:ts|tsx)$/u.test(entry.name) ? [child] : [];
  });
}

const files = [...new Set(ordinaryRoots.flatMap(filesUnder))].filter(
  (file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx") && !privilegedExceptions.has(file),
);
const failures = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  if (/\brequireGm(?:Capability)?\s*\(/u.test(source))
    failures.push(`${file}: ordinary flow still uses legacy GameMaster authorization`);
  if (/redirect\(\s*["']\/(?:captain|studio)\/sign-in/u.test(source))
    failures.push(`${file}: ordinary flow redirects to a workspace-specific sign-in`);
  if (/\/api\/gm\/login/u.test(source)) failures.push(`${file}: ordinary flow still calls the legacy staff login`);
}

const compatibilityRoutes = ["src/app/captain/sign-in/page.tsx", "src/app/studio/sign-in/page.tsx"];
for (const file of compatibilityRoutes) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  if (!source.includes("resolveCapability") || !source.includes("signInHref"))
    failures.push(`${file}: compatibility entry does not converge on canonical account sign-in`);
  if (source.includes("StaffSignIn")) failures.push(`${file}: compatibility entry renders a second credential form`);
}

const retainedLegacy = {
  COMPATIBILITY_ADAPTER_ONLY: ["src/app/api/gm", "src/homeport/current-user.server.ts"],
  INTERNAL_MIGRATION_ONLY: ["src/lib/security.ts"],
  PRIVILEGED_ADMIN_ONLY: [...privilegedExceptions],
  REMOVED_FROM_ORDINARY_FLOW: ["src/components/platform/StaffSignIn.tsx", "src/components/gm/Quartermaster.tsx"],
};

if (failures.length) {
  console.error(JSON.stringify({ status: "CANONICAL_WORKSPACE_AUTHORIZATION_INVALID", failures }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "CANONICAL_WORKSPACE_AUTHORIZATION_VALID",
      auditedOrdinaryFiles: files.length,
      retainedLegacy,
      ordinaryLegacyRequirements: 0,
      ordinaryWorkspaceSignInRedirects: 0,
    },
    null,
    2,
  ),
);
