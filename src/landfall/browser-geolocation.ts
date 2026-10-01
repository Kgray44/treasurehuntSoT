import type { LandfallObservation } from "@/landfall/observation";
import type { LandfallWorldspace } from "@/landfall/schema";

type GeolocationLike = Pick<Geolocation, "watchPosition" | "clearWatch">;
export type ForegroundPermission = "PROMPT" | "GRANTED" | "DENIED" | "UNAVAILABLE";

/** Call start only from an explicit Player action; stop on pause, unmount, or permission revocation. */
export class BrowserGeolocationProvider {
  private watchId: number | null = null;
  private permission: ForegroundPermission = "PROMPT";
  constructor(
    private readonly geolocation: GeolocationLike | null,
    private readonly worldspace: LandfallWorldspace,
  ) {
    if (worldspace.kind !== "PHYSICAL" || worldspace.coordinateReference.type !== "WGS84")
      throw new Error("LANDFALL_BROWSER_REQUIRES_WGS84");
    if (!geolocation) this.permission = "UNAVAILABLE";
  }
  get permissionState(): ForegroundPermission {
    return this.permission;
  }
  get active(): boolean {
    return this.watchId !== null;
  }
  start(
    identity: { sessionId: string; publishedVersionId: string },
    emit: (observation: LandfallObservation) => void,
    onState: (state: ForegroundPermission) => void,
  ): void {
    if (!this.geolocation) {
      this.permission = "UNAVAILABLE";
      onState(this.permission);
      return;
    }
    if (this.watchId !== null) return;
    try {
      this.watchId = this.geolocation.watchPosition(
        (position) => {
          this.permission = "GRANTED";
          onState(this.permission);
          emit({
            schemaVersion: 1,
            id: crypto.randomUUID(),
            sessionId: identity.sessionId,
            publishedVersionId: identity.publishedVersionId,
            worldspaceId: this.worldspace.id,
            providerId: "browser-geolocation",
            source: "BROWSER_GEOLOCATION",
            kind: "PHYSICAL_POSITION",
            observedAt: new Date(position.timestamp).toISOString(),
            coordinate: {
              type: "WGS84",
              worldspaceId: this.worldspace.id,
              referenceId: this.worldspace.coordinateReference.id,
              referenceVersion: this.worldspace.coordinateReference.version,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            accuracyMeters: position.coords.accuracy,
            ...(position.coords.heading !== null && Number.isFinite(position.coords.heading)
              ? { headingDegrees: position.coords.heading }
              : {}),
            ...(position.coords.speed !== null && Number.isFinite(position.coords.speed) && position.coords.speed >= 0
              ? { speedMetersPerSecond: position.coords.speed }
              : {}),
            ...(position.coords.altitude !== null &&
            Number.isFinite(position.coords.altitude) &&
            position.coords.altitudeAccuracy !== null &&
            Number.isFinite(position.coords.altitudeAccuracy) &&
            position.coords.altitudeAccuracy > 0
              ? { altitudeMeters: position.coords.altitude, altitudeAccuracyMeters: position.coords.altitudeAccuracy }
              : {}),
          });
        },
        (error) => {
          this.permission = error.code === 1 ? "DENIED" : "UNAVAILABLE";
          this.stop();
          onState(this.permission);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
      );
    } catch {
      this.permission = "UNAVAILABLE";
      this.stop();
      onState(this.permission);
      return;
    }
    if (this.permission === "DENIED" || this.permission === "UNAVAILABLE") this.stop();
  }
  stop(): void {
    if (this.watchId !== null && this.geolocation) this.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }
}
