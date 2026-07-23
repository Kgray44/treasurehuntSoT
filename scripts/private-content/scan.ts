import { scanPrivateContentReport } from "../../src/private-content/security";
async function main() {
  const report = await scanPrivateContentReport();
  for (const hit of report.violations) process.stderr.write(`${hit.path}: ${hit.rule}\n`);
  for (const entry of report.classifications) process.stdout.write(`${entry.classification}: ${entry.path}\n`);
  if (report.violations.length) process.exitCode = 1;
  else process.stdout.write("Private-content repository scan passed.\n");
}
void main();
