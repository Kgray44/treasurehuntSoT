import { scanBuildOutput } from "../../src/private-content/security";
async function main() {
  const hits = await scanBuildOutput();
  for (const hit of hits) process.stderr.write(`${hit.path}: ${hit.rule}\n`);
  if (hits.length) process.exitCode = 1;
  else process.stdout.write("Private-content build scan passed.\n");
}
void main();
