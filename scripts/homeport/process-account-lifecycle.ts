import { db } from "@/lib/db";
import { processDueAccountDeletions } from "@/wayfarer/account-lifecycle";

async function main() {
  const startedAt = new Date();
  const result = await processDueAccountDeletions(startedAt);
  process.stdout.write(
    `${JSON.stringify({
      operation: "homeport.account-lifecycle.process-due-deletions",
      startedAt: startedAt.toISOString(),
      processed: result.processed,
      status: "complete",
    })}\n`,
  );
}

void main()
  .catch((cause: unknown) => {
    const message = cause instanceof Error ? cause.message : "Unknown account lifecycle processing failure.";
    process.stderr.write(
      `${JSON.stringify({
        operation: "homeport.account-lifecycle.process-due-deletions",
        status: "failed",
        message,
      })}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
