import { scanPrivateContent } from "../../src/private-content/security";
async function main() { const hits = await scanPrivateContent(); for (const hit of hits) process.stderr.write(`${hit.path}: ${hit.rule}\n`); if (hits.length) process.exitCode = 1; else process.stdout.write("Private-content repository scan passed.\n"); }
void main();
