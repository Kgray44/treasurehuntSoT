import { verifyCommunityBackupManifest } from "@/community/operations";

const id = process.argv[2];
if (!id) throw new Error("Provide a Harborlight backup identity.");
void verifyCommunityBackupManifest(id).then((result) => process.stdout.write(`${JSON.stringify(result)}\n`));
