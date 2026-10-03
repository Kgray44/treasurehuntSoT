import { NextResponse } from "next/server";
import { configuredRasterMap } from "@/landfall/map-data-configuration";

export const dynamic = "force-dynamic";
/** Public metadata only. No credentials, location, cookies or provider requests. */
export function GET() {
  return NextResponse.json(
    configuredRasterMap({
      LANDFALL_RASTER_TILE_TEMPLATE: process.env.LANDFALL_RASTER_TILE_TEMPLATE,
      LANDFALL_RASTER_ATTRIBUTION_LABEL: process.env.LANDFALL_RASTER_ATTRIBUTION_LABEL,
      LANDFALL_RASTER_ATTRIBUTION_URL: process.env.LANDFALL_RASTER_ATTRIBUTION_URL,
      LANDFALL_RASTER_MAX_ZOOM: process.env.LANDFALL_RASTER_MAX_ZOOM,
    }),
    { headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" } },
  );
}
