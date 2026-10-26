/** Presentation follows the authenticated Crossdeck projection, never a URL role
 * or another device's claim. Chronicle authorization remains server-owned.
 */
export function isChronicleLensCompanion(raw: unknown, surfaceId: string | null, voyageId: string): boolean {
  if (!surfaceId || !Array.isArray(raw)) return false;
  return raw.some((value: unknown) => {
    if (!value || typeof value !== "object") return false;
    const surface = value as Record<string, unknown>;
    return (
      surface.surfaceId === surfaceId &&
      surface.voyageId === voyageId &&
      surface.thisSession === true &&
      surface.role === "CHRONICLE_LENS" &&
      surface.presence === "ACTIVE"
    );
  });
}
