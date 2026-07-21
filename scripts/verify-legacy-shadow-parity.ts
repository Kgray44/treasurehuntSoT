import { db } from "@/lib/db";
import { shadowCompareLegacyCampaign } from "@/chronicle/shadow-parity";

async function main() {
  const selector = process.argv[2];
  const campaigns = await db.campaign.findMany({
    where: selector ? { slug: selector } : undefined,
    select: { slug: true },
    orderBy: { slug: "asc" },
  });
  if (selector && !campaigns.length) throw new Error(`No legacy Campaign has slug ${selector}.`);
  const reports = await Promise.all(campaigns.map((campaign) => shadowCompareLegacyCampaign(campaign.slug)));
  process.stdout.write(`${JSON.stringify({ reports }, null, 2)}\n`);
  if (reports.some((report) => !report.semanticMatch)) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Shadow parity verification failed."}\n`);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
