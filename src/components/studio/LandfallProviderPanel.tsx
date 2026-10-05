"use client";
import { useState } from "react";
import type { LandfallDefinition, LandfallWorldspace } from "@/landfall/schema";
import { landfallProviderCatalog } from "@/landfall/provider-catalog";
import type { LandfallProviderPlan } from "@/landfall/provider-policy";
import { localLandfallProviderPreflight } from "@/landfall/local-provider-preflight";

const catalog = landfallProviderCatalog().filter((provider) => !provider.simulation);
const defaultPlan: LandfallProviderPlan = {
  version: 1,
  requirements: [],
  offline: { requested: false, maxBytes: 64 * 1024 * 1024, retentionHours: 24, mapIds: [], routeIds: [], assetIds: [] },
};
export function LandfallProviderPanel({
  definition,
  worldspace,
  onChange,
}: {
  definition: LandfallDefinition;
  worldspace: LandfallWorldspace;
  onChange: (definition: LandfallDefinition) => unknown;
}) {
  const options = catalog.filter((provider) => provider.worldspaceKinds.includes(worldspace.kind));
  const [selected, setSelected] = useState(options[0]?.id ?? "semantic-chart");
  const plan = definition.providerPlan ?? defaultPlan;
  const requirements = plan.requirements.filter((requirement) => requirement.worldspaceId === worldspace.id);
  const update = (next: LandfallProviderPlan) => onChange({ ...definition, providerPlan: next });
  const enableNative = (enabled: boolean) =>
    onChange({
      ...definition,
      worldspaces: definition.worldspaces.map((world) =>
        world.id !== worldspace.id
          ? world
          : {
              ...world,
              observationPolicy: {
                ...world.observationPolicy,
                allowedSources: enabled
                  ? [...new Set([...world.observationPolicy.allowedSources, "NATIVE_LOCATION" as const])]
                  : world.observationPolicy.allowedSources.filter((source) => source !== "NATIVE_LOCATION"),
              },
            },
      ),
      waypoints: definition.waypoints.map((waypoint) =>
        waypoint.worldspaceId !== worldspace.id
          ? waypoint
          : {
              ...waypoint,
              evidenceProfile: {
                ...waypoint.evidenceProfile,
                acceptedSources: enabled
                  ? [...new Set([...waypoint.evidenceProfile.acceptedSources, "NATIVE_LOCATION" as const])]
                  : waypoint.evidenceProfile.acceptedSources.filter((source) => source !== "NATIVE_LOCATION"),
              },
            },
      ),
    });
  const mapAssets = [
    ...new Set(
      definition.maps
        .filter((map) => map.worldspaceId === worldspace.id)
        .flatMap((map) => [
          "assetId" in map.source ? map.source.assetId : undefined,
          ...(map.overlays ?? []).map((overlay) => overlay.assetId),
        ])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  return (
    <section aria-label="Navigation providers and offline regions">
      <h3>Navigation providers and offline regions</h3>
      <p>
        Provider selection declares requirements. Drydock checks availability and fallback; a catalog entry does not
        mean a service, credential, or device is ready. Credentials are configured by the deployment operator.
      </p>
      {worldspace.kind === "PHYSICAL" && (
        <label>
          <input
            type="checkbox"
            checked={worldspace.observationPolicy.allowedSources.includes("NATIVE_LOCATION")}
            onChange={(event) => enableNative(event.target.checked)}
          />{" "}
          Allow native foreground location for this Worldspace and its waypoints. Browser and native GPS count as one
          check.
        </label>
      )}
      <label>
        Optional provider{" "}
        <select
          value={options.some((provider) => provider.id === selected) ? selected : options[0]?.id}
          onChange={(event) => setSelected(event.target.value)}
        >
          {options.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label} · {provider.family.toLowerCase().replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          const provider = options.find((item) => item.id === selected) ?? options[0];
          if (provider && !requirements.some((requirement) => requirement.providerId === provider.id))
            update({
              ...plan,
              requirements: [
                ...plan.requirements,
                {
                  worldspaceId: worldspace.id,
                  family: provider.family,
                  providerId: provider.id,
                  capability: provider.capabilities[0],
                  required: false,
                  fallback: ["MAP_DATA", "GEOCODING", "ROUTING", "ELEVATION", "VIRTUAL_REGION"].includes(
                    provider.family,
                  )
                    ? "AUTHORED"
                    : "PLAYER",
                  offlineRequired: false,
                  hardwareDisclosed: false,
                },
              ],
            });
        }}
      >
        Add provider requirement
      </button>
      <ul>
        {requirements.map((requirement) => {
          const index = plan.requirements.indexOf(requirement);
          const provider = catalog.find((provider) => provider.id === requirement.providerId);
          const change = (patch: Partial<typeof requirement>) =>
            update({
              ...plan,
              requirements: plan.requirements.map((item, itemIndex) =>
                itemIndex === index ? { ...item, ...patch } : item,
              ),
            });
          return (
            <li key={`${requirement.providerId}:${index}`}>
              <strong>{provider?.label ?? requirement.family}</strong>
              <p>
                {localLandfallProviderPreflight(definition, requirement).length
                  ? "Authored data is available for this capability. Players can use only places and maps released to their journey."
                  : "Readiness is not established here. Device capabilities, external services and credentials need their own runtime check."}
              </p>
              <label>
                Capability{" "}
                <select value={requirement.capability} onChange={(event) => change({ capability: event.target.value })}>
                  {provider?.capabilities.map((capability) => (
                    <option key={capability}>{capability}</option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={requirement.required}
                  onChange={(event) => change({ required: event.target.checked })}
                />{" "}
                Required for this journey
              </label>
              <label>
                Accessible fallback{" "}
                <select
                  value={requirement.fallback}
                  onChange={(event) => change({ fallback: event.target.value as typeof requirement.fallback })}
                >
                  {["PLAYER", "CAPTAIN", "AUTHORED", "NONE"].map((value) => (
                    <option key={value} value={value}>
                      {value.toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={requirement.offlineRequired}
                  onChange={(event) => change({ offlineRequired: event.target.checked })}
                />{" "}
                Must work offline
              </label>
              {provider?.hardware !== "NONE" && (
                <label>
                  <input
                    type="checkbox"
                    checked={requirement.hardwareDisclosed}
                    onChange={(event) => change({ hardwareDisclosed: event.target.checked })}
                  />{" "}
                  I disclosed the optional hardware and accessible fallback to Players
                </label>
              )}
              <p>
                {provider?.privacy === "THIRD_PARTY"
                  ? "This provider can receive location or journey context. Players must explicitly allow that sharing."
                  : "This provider keeps navigation context within the app or the authorized server."}{" "}
                {provider?.family === "GEOFENCE"
                  ? "Broad geofence reminders require a fresh foreground check and never record arrival."
                  : ""}
              </p>
              <button
                type="button"
                onClick={() =>
                  update({ ...plan, requirements: plan.requirements.filter((_, itemIndex) => itemIndex !== index) })
                }
              >
                Remove requirement
              </button>
            </li>
          );
        })}
      </ul>
      <label>
        <input
          type="checkbox"
          checked={plan.offline.requested}
          onChange={(event) =>
            update({
              ...plan,
              offline: {
                ...plan.offline,
                requested: event.target.checked,
                mapIds: definition.maps.filter((map) => map.worldspaceId === worldspace.id).map((map) => map.id),
                routeIds: definition.routes
                  .filter((route) => route.worldspaceId === worldspace.id)
                  .map((route) => route.id),
              },
            })
          }
        />{" "}
        Offer authorized offline regions
      </label>
      {plan.offline.requested && (
        <>
          <label>
            Authorization hours{" "}
            <input
              type="number"
              min={1}
              max={24}
              value={Math.min(24, plan.offline.retentionHours)}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isInteger(value) && value >= 1 && value <= 24)
                  update({ ...plan, offline: { ...plan.offline, retentionHours: value } });
              }}
            />
          </label>
          <label>
            Maximum package MB{" "}
            <input
              type="number"
              min={1}
              max={256}
              value={plan.offline.maxBytes / 1024 / 1024}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isInteger(value) && value >= 1 && value <= 256)
                  update({ ...plan, offline: { ...plan.offline, maxBytes: value * 1024 * 1024 } });
              }}
            />
          </label>
          <p>
            Only currently released chart data can be downloaded. Public map tiles require a connection. Select assets
            only when you have permission to retain them offline; large or unavailable assets are reported as partial.
          </p>
          {mapAssets.map((assetId) => (
            <label key={assetId}>
              <input
                type="checkbox"
                checked={plan.offline.assetIds.includes(assetId)}
                onChange={(event) =>
                  update({
                    ...plan,
                    offline: {
                      ...plan.offline,
                      assetIds: event.target.checked
                        ? [...new Set([...plan.offline.assetIds, assetId])]
                        : plan.offline.assetIds.filter((id) => id !== assetId),
                    },
                  })
                }
              />{" "}
              Authorized offline map asset {assetId}
            </label>
          ))}
        </>
      )}
    </section>
  );
}
