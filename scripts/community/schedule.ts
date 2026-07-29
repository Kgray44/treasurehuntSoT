import { enqueueDueCommunitySchedules, seedCommunityOperationalSchedules } from "@/community/scheduler";

async function main() {
  if (process.argv.includes("--seed")) await seedCommunityOperationalSchedules();
  const result = await enqueueDueCommunitySchedules();
  process.stdout.write(`${JSON.stringify({ ...result, mode: "enqueue-only" })}\n`);
}

void main();
