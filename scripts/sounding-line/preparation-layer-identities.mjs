// Declared immutable identity families from the protected preparation policy.
// These names do not authenticate a preparation or authorize reuse.
export const PREPARATION_LAYER_IDENTITIES = Object.freeze({
  dependency: Object.freeze(["package", "lockfile", "node-npm", "os-arch", "install-policy"]),
  "prisma-client": Object.freeze(["dependency", "prisma", "schema", "generator", "os-arch"]),
  "browser-chromium": Object.freeze(["playwright", "browser-revision", "os-arch", "browser-policy"]),
  "browser-webkit": Object.freeze(["playwright", "browser-revision", "os-arch", "browser-policy"]),
  "sqlite-baseline": Object.freeze(["schema", "migrations", "seed-fixture", "prisma-client", "baseline-policy"]),
});
