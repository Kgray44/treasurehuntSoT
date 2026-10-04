import { z } from "zod";
import { logger } from "@/lib/logger";

const operationSchema = z.enum([
  "EVIDENCE",
  "OFFLINE_PACKAGE",
  "ONLINE_DATA",
  "BACKGROUND_SETUP",
  "NEARBY_PAIRING",
  "INSTALLATION",
  "LANDMARK",
  "NOTIFICATION_RETURN",
  "REMOTE_GEOCODING",
  "REMOTE_ROUTING",
  "REMOTE_ELEVATION",
]);
const outcomeSchema = z.enum([
  "SUCCEEDED",
  "DENIED",
  "REJECTED",
  "RATE_LIMITED",
  "FAILED",
  "RETURNED",
  "UNAVAILABLE",
  "EXPIRED",
]);
const eventSchema = z
  .strictObject({
    operation: operationSchema,
    outcome: outcomeSchema,
    durationBand: z.enum(["LT_50_MS", "LT_250_MS", "LT_1_S", "LT_5_S", "LT_30_S", "GE_30_S", "UNKNOWN"]),
    count: z.literal(1),
    authorizationCookie: z.enum(["ABSENT", "PRESENT"]).optional(),
  })
  .refine(
    (event) =>
      event.authorizationCookie === undefined ||
      (event.operation === "NOTIFICATION_RETURN" && event.outcome === "DENIED"),
  );
export type LandfallOperation = z.infer<typeof operationSchema>;
export type LandfallOperationalOutcome = z.infer<typeof outcomeSchema>;
type Sink = (event: z.infer<typeof eventSchema> & { event: "landfall.operation" }) => void;
const platformSink: Sink = (event) => {
  logger.info(event, "Landfall operational outcome");
};

/** The platform log sink receives finite categorical labels only, never identifiers or body data. */
export function recordLandfallOperation(input: unknown, sink: Sink = platformSink) {
  const event = eventSchema.safeParse(input);
  if (!event.success) return false;
  try {
    sink({ event: "landfall.operation", ...event.data });
    return true;
  } catch {
    return false;
  } // Diagnostic failure cannot change authority or an API response.
}
export function landfallDurationBand(ms: number): z.infer<typeof eventSchema>["durationBand"] {
  if (!Number.isFinite(ms) || ms < 0) return "UNKNOWN";
  return ms < 50
    ? "LT_50_MS"
    : ms < 250
      ? "LT_250_MS"
      : ms < 1000
        ? "LT_1_S"
        : ms < 5000
          ? "LT_5_S"
          : ms < 30000
            ? "LT_30_S"
            : "GE_30_S";
}
/** HTTP transport outcome only: a 200 never claims a successful provider, installation or arrival. */
export async function observeLandfallOperation<T extends Response>(
  operation: LandfallOperation,
  run: () => Promise<T>,
  sink: Sink = platformSink,
): Promise<T> {
  const start = performance.now();
  let outcome: LandfallOperationalOutcome = "FAILED";
  try {
    const response = await run();
    outcome =
      response.status === 429
        ? "RATE_LIMITED"
        : [401, 403].includes(response.status)
          ? "DENIED"
          : response.status >= 500
            ? "FAILED"
            : response.status >= 400
              ? "REJECTED"
              : response.status >= 300
                ? "RETURNED"
                : "SUCCEEDED";
    return response;
  } finally {
    recordLandfallOperation(
      { operation, outcome, durationBand: landfallDurationBand(performance.now() - start), count: 1 },
      sink,
    );
  }
}
