import { PrismaClient } from "@prisma/client";
import path from "node:path";

const taskRoot = path.resolve(process.env.ADMIRALTY_PHASE3_TASK_ROOT ?? required("ADMIRALTY_S1_TASK_ROOT"));
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectAdmiralty");
if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`ADMIRALTY_S1_TASK_ROOT_REFUSED:${taskRoot}`);

const databasePath = path.join(taskRoot, "database", "admiralty-phase2.db");
const client = new PrismaClient({ datasources: { db: { url: `file:${databasePath.replaceAll("\\", "/")}` } } });

try {
  await client.$connect();
  const caseRequests = await client.supportCase.findMany({
    where: { supportAccessRequestId: { not: null } },
    select: { supportAccessRequestId: true },
  });
  const requestIds = caseRequests.flatMap((supportCase) =>
    supportCase.supportAccessRequestId ? [supportCase.supportAccessRequestId] : [],
  );
  await client.$transaction([
    client.supportRepairExecution.deleteMany(),
    client.supportRepairLease.deleteMany(),
    client.supportFindingEvidence.deleteMany(),
    client.supportRepairProposal.deleteMany(),
    client.supportDiagnosis.deleteMany(),
    client.supportFinding.deleteMany(),
    client.supportEvidenceReference.deleteMany(),
    client.supportObservation.deleteMany(),
    client.supportExecutionSession.deleteMany(),
    client.supportExecutionGrant.deleteMany(),
    client.supportCase.deleteMany(),
    client.supportAccessGrant.deleteMany({ where: { requestId: { in: requestIds } } }),
    client.supportAccessRequest.deleteMany({ where: { id: { in: requestIds } } }),
  ]);
  process.stdout.write(
    `${JSON.stringify({ status: "ADMIRALTY_SUPPORT_PILOT_S1_FIXTURE_RESET", removedCaseRequests: requestIds.length })}\n`,
  );
} finally {
  await client.$disconnect();
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
