import { z } from "zod";

const publicHttps = (value: string) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      !/^(?:localhost|.*\.localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|\[)/i.test(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
};
export const rasterMapConfigurationSchema = z.strictObject({
  state: z.literal("CONFIGURED"),
  id: z.literal("deployment-raster"),
  tileTemplate: z
    .string()
    .min(1)
    .max(2048)
    .refine(
      (value) =>
        ["{z}", "{x}", "{y}"].every((token) => value.split(token).length === 2) &&
        !/[{}]/.test(value.replaceAll("{z}", "0").replaceAll("{x}", "0").replaceAll("{y}", "0")) &&
        publicHttps(value.replaceAll("{z}", "0").replaceAll("{x}", "0").replaceAll("{y}", "0")) &&
        !/[{}]/.test(new URL(value).host),
    ),
  attributionLabel: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .refine((value) => !/[<>]/.test(value) && !Array.from(value).some((character) => character.charCodeAt(0) < 32)),
  attributionUrl: z.string().max(2048).refine(publicHttps),
  maxZoom: z.number().int().min(1).max(22),
  offlineRights: z.literal("PROHIBITED"),
});
export type RasterMapConfiguration = z.infer<typeof rasterMapConfigurationSchema>;
export const mapDataConfigurationSchema = z.discriminatedUnion("state", [
  rasterMapConfigurationSchema,
  z.strictObject({ state: z.literal("NOT_CONFIGURED") }),
]);

/** Public deployment data only; absent/unsafe settings fail closed without echoing input. */
export function configuredRasterMap(env: Record<string, string | undefined>) {
  const parsed = rasterMapConfigurationSchema.safeParse({
    state: "CONFIGURED",
    id: "deployment-raster",
    tileTemplate: env.LANDFALL_RASTER_TILE_TEMPLATE,
    attributionLabel: env.LANDFALL_RASTER_ATTRIBUTION_LABEL,
    attributionUrl: env.LANDFALL_RASTER_ATTRIBUTION_URL,
    maxZoom: Number(env.LANDFALL_RASTER_MAX_ZOOM ?? "19"),
    offlineRights: "PROHIBITED",
  });
  return parsed.success ? parsed.data : { state: "NOT_CONFIGURED" as const };
}
