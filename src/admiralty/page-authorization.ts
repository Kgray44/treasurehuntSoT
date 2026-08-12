import { notFound } from "next/navigation";
import type { AdmiraltyCapabilityId } from "./capabilities";
import { requireAdmiraltyOperator } from "./authorization";
import { AdmiraltyError } from "./errors";

export async function admiraltyPageOperator(capability: AdmiraltyCapabilityId) {
  try {
    return await requireAdmiraltyOperator(capability);
  } catch (cause) {
    if (
      cause instanceof AdmiraltyError &&
      ["ADMIRALTY_AUTH_REQUIRED", "ADMIRALTY_CAPABILITY_DENIED"].includes(cause.code)
    )
      notFound();
    throw cause;
  }
}
