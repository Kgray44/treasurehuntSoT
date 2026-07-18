import { requireGmCapability, type GmCapability } from "@/lib/security";

export const visionPermissions = [
  "visionWaypoint.create",
  "visionWaypoint.read",
  "visionWaypoint.editDraft",
  "visionWaypoint.publish",
  "visionWaypoint.deprecate",
  "visionWaypoint.bindToStory",
  "visionWaypoint.viewDiagnostics",
  "visionWaypoint.administer",
] as const;

export type VisionPermission = (typeof visionPermissions)[number];

const capabilityForPermission: Record<VisionPermission, GmCapability> = {
  "visionWaypoint.create": "CREATE_TALES",
  "visionWaypoint.read": "CREATE_TALES",
  "visionWaypoint.editDraft": "CREATE_TALES",
  "visionWaypoint.publish": "PUBLISH_TALES",
  "visionWaypoint.deprecate": "PUBLISH_TALES",
  "visionWaypoint.bindToStory": "CREATE_TALES",
  "visionWaypoint.viewDiagnostics": "CAPTAIN",
  "visionWaypoint.administer": "PUBLISH_TALES",
};

export function capabilityForVisionPermission(permission: VisionPermission) {
  return capabilityForPermission[permission];
}

export async function requireVisionPermission(permission: VisionPermission) {
  return requireGmCapability(capabilityForVisionPermission(permission));
}
