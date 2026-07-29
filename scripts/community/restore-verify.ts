import { restoreCommunityBackupDrill } from "@/community/operations";

const id = process.argv[2];
if (!id) throw new Error("Provide a Harborlight backup identity.");
const drillIds = process.argv.slice(3);
if (drillIds.length !== 2) throw new Error("Provide exactly two isolated restore drill identities.");
void Promise.all(drillIds.map((drillId) => restoreCommunityBackupDrill(id, drillId))).then((result) =>
  process.stdout.write(`${JSON.stringify({ id, drills: result })}\n`),
);
