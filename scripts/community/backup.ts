import { createCommunityBackupManifest } from "@/community/operations";

void createCommunityBackupManifest().then((result) => process.stdout.write(`${JSON.stringify(result)}\n`));
