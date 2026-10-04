import { z } from "zod";
const eventSchema = z
  .strictObject({
    outcome: z.enum(["RETURNED", "UNAVAILABLE", "DENIED", "EXPIRED", "FAILED"]),
    durationBand: z.enum(["LT_50_MS", "LT_250_MS", "LT_1_S", "LT_5_S", "LT_30_S", "GE_30_S", "UNKNOWN"]),
    authorizationCookie: z.enum(["ABSENT", "PRESENT"]).optional(),
  })
  .refine((event) => event.authorizationCookie === undefined || event.outcome === "DENIED");
export const nativeReturnObservationSchema = z.strictObject({
  version: z.literal(1),
  sourceSha: z.string().regex(/^[a-f0-9]{40}$/),
  events: z.array(eventSchema).max(32),
});

/** Project only existing platform return outcomes from this owned server's log stream. */
export function nativeReturnLogObservation(line: string) {
  if (line.length > 16384) return null;
  try {
    const value = JSON.parse(line);
    if (
      value?.event !== "landfall.operation" ||
      value.operation !== "NOTIFICATION_RETURN" ||
      value.count !== 1 ||
      value.msg !== "Landfall operational outcome" ||
      value.level !== 30
    )
      return null;
    const result = eventSchema.safeParse({
      outcome: value.outcome,
      durationBand: value.durationBand,
      ...(value.authorizationCookie === undefined ? {} : { authorizationCookie: value.authorizationCookie }),
    });
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
