import registry from "../../Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_4_District_Registry.json";

export const communityDistrictIds = [
  "HARBOR_HOME",
  "FEATURED",
  "CHRONICLES",
  "ARTIFACTS",
  "TEMPLATES",
  "MAPS_AND_LOCATION_PACKS",
  "AUDIO_AND_REVEAL_ASSETS",
  "CREATORS",
  "COLLECTIONS",
  "GUIDES",
  "SHIPWRIGHTS_WORKSHOP",
  "VOYAGE_LOGS",
] as const;

export type CommunityDistrictId = (typeof communityDistrictIds)[number];
export type CommunityDistrict = Readonly<{
  id: CommunityDistrictId;
  label: string;
  route: string;
  parent: CommunityDistrictId | null;
  status: string;
  visibleEntry: boolean;
  emptyAction: { label: string; href: string };
}>;

const idSet = new Set<string>(communityDistrictIds);

export const communityDistricts: readonly CommunityDistrict[] = registry.districts.map((district) => {
  if (!idSet.has(district.id)) throw new Error(`Unknown Community district ${district.id}.`);
  return {
    id: district.id as CommunityDistrictId,
    label: district.label,
    route: district.route,
    parent: district.parent as CommunityDistrictId | null,
    status: district.status,
    visibleEntry: district.visibleEntry,
    emptyAction: district.emptyAction,
  };
});

export const visibleCommunityDistricts = communityDistricts.filter(
  (district) => district.visibleEntry && district.status.startsWith("ACTIVE_"),
);

export function communityDistrict(id: CommunityDistrictId) {
  const district = communityDistricts.find((candidate) => candidate.id === id);
  if (!district) throw new Error(`Community district ${id} is not registered.`);
  return district;
}
