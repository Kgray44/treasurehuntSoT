import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const exec = promisify(execFile);
const forbiddenName =
  /(?:\.ftprivate|\.ftkey|(?:^|\/)(?:private-content|private-exports|decrypted-private-content)(?:\/|$))/i;
const sentinel = "SEALED-HOLD-SYNTHETIC-PRIVATE-SENTINEL-73A9C1";
const pem =
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----\s*(?:[A-Za-z0-9+/]{20,}={0,2}\s*)+-----END (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/m;

async function main() {
  const { stdout } = await exec("git", ["diff", "--cached", "--name-only", "-z"], {
    cwd: process.cwd(),
    windowsHide: true,
  });
  const names = stdout.split("\0").filter(Boolean);
  for (const name of names) {
    const normalizedName = name.replaceAll("\\", "/");
    const implementationFile = /^(?:src|scripts|tests)\/.*private-content\//.test(normalizedName);
    if ((!implementationFile && forbiddenName.test(name)) || path.isAbsolute(name))
      throw new Error("Staged protected-content path detected.");
    const content = await exec("git", ["show", `:${name}`], {
      cwd: process.cwd(),
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    }).catch(() => ({ stdout: "" }));
    const syntheticFixture =
      /^(?:src|scripts|tests)\/.*private-content\//.test(normalizedName) ||
      normalizedName === "Development_Docs/Private_Content_Test_Plan.md";
    if (pem.test(content.stdout) || (content.stdout.includes(sentinel) && !syntheticFixture))
      throw new Error("Staged protected-content content detected.");
  }
  process.stdout.write("Private-content staged-diff scan passed.\n");
}
void main().catch(() => {
  process.stderr.write("Private-content staged-diff scan failed.\n");
  process.exitCode = 1;
});
