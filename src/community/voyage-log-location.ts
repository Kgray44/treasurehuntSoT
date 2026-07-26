import { CommunityError, locationClasses } from "./domain";

export type VoyageLogLocationClassification = (typeof locationClasses)[number];
export type VoyageLogLocationInput = Readonly<{
  classification: VoyageLogLocationClassification;
  label?: string;
  generalizedLabel?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  publicLocationPermission?: boolean;
  routeGeometry?: unknown;
}>;

const unsafePlaceTerms = /\b(home|house|school|workplace|office|meeting[ -]?point|invitation|clue|route|address)\b/iu;

function safeLabel(value: string | undefined, field: string) {
  const normalized = value?.normalize("NFKC").trim();
  if (
    !normalized ||
    normalized.length > 140 ||
    /[\u0000-\u001f\u007f-\u009f]/u.test(normalized) ||
    unsafePlaceTerms.test(normalized)
  )
    throw new CommunityError("COMMUNITY_LOCATION_UNSAFE", `${field} is not safe for public sharing.`);
  return normalized;
}

function hasAnyCoordinates(input: VoyageLogLocationInput) {
  return input.latitude !== undefined || input.longitude !== undefined || input.altitude !== undefined;
}

/** Validates a public projection boundary; private source coordinates never cross it. */
export function publicVoyageLogLocation(input: VoyageLogLocationInput): Readonly<Record<string, string | number>> {
  if (!locationClasses.includes(input.classification))
    throw new CommunityError("COMMUNITY_LOCATION_UNSAFE", "Location classification is invalid.");
  if (input.routeGeometry !== undefined)
    throw new CommunityError("COMMUNITY_LOCATION_UNSAFE", "Private route geometry cannot be published.");
  if (input.classification === "PRIVATE_REAL_WORLD") {
    if (input.label || input.generalizedLabel || hasAnyCoordinates(input))
      throw new CommunityError("COMMUNITY_LOCATION_UNSAFE", "Private real-world locations must be omitted.");
    return Object.freeze({});
  }
  if (input.classification === "FICTIONAL" || input.classification === "GENERIC") {
    if (hasAnyCoordinates(input))
      throw new CommunityError(
        "COMMUNITY_LOCATION_UNSAFE",
        "Only explicitly permitted public real-world locations may contain coordinates.",
      );
    return Object.freeze({ classification: input.classification, label: safeLabel(input.label, "Location label") });
  }
  if (input.classification === "APPROXIMATE_REAL_WORLD") {
    if (hasAnyCoordinates(input))
      throw new CommunityError("COMMUNITY_LOCATION_UNSAFE", "Approximate locations cannot contain exact coordinates.");
    return Object.freeze({
      classification: input.classification,
      label: safeLabel(input.generalizedLabel, "Generalized location"),
    });
  }
  if (!input.publicLocationPermission || input.latitude === undefined || input.longitude === undefined)
    throw new CommunityError(
      "COMMUNITY_LOCATION_PERMISSION_REQUIRED",
      "Exact public coordinates require explicit public-location permission.",
    );
  if (
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude) ||
    Math.abs(input.latitude) > 90 ||
    Math.abs(input.longitude) > 180 ||
    input.altitude !== undefined
  )
    throw new CommunityError(
      "COMMUNITY_LOCATION_UNSAFE",
      "Public coordinates are invalid or include unsafe altitude data.",
    );
  return Object.freeze({
    classification: input.classification,
    label: safeLabel(input.label, "Public location"),
    latitude: input.latitude,
    longitude: input.longitude,
  });
}
