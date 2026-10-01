import type { LandfallObservation } from "@/landfall/observation";
import type { LandfallEvidenceProfile } from "@/landfall/schema";

/** Bounded, typed corroboration. Samples from one source or one underlying evidence item
 * are never counted as independent sources; contextual priors are not new evidence. */
export class LandfallEvidenceFusion {
  private readonly latest = new Map<
    LandfallObservation["source"],
    {
      observation: LandfallObservation;
      present: boolean;
    }
  >();

  reset(): void {
    this.latest.clear();
  }

  consider(
    observation: LandfallObservation,
    present: boolean | null,
    profile: LandfallEvidenceProfile,
    now: number,
  ): "SUPPORTED" | "INSUFFICIENT" | "CONFLICT" {
    for (const [source, item] of this.latest) {
      if (
        now - Date.parse(item.observation.observedAt) > profile.maximumAgeSeconds * 1000 ||
        (item.observation.expiresAt && Date.parse(item.observation.expiresAt) <= now)
      )
        this.latest.delete(source);
    }
    // Abstention and weak evidence do not veto stronger independent evidence.
    const abstains =
      present === null ||
      (observation.kind === "SEMANTIC_LOCATION" &&
        (observation.assertion === "UNCERTAIN" || observation.confidence < 0.8)) ||
      (observation.kind === "VIRTUAL_POSITION" && observation.confidence < 0.8) ||
      (observation.kind === "PHYSICAL_POSITION" && observation.accuracyMeters > (profile.requiredAccuracyMeters ?? 50));
    if (!abstains && present !== null) this.latest.set(observation.source, { observation, present });
    const items = [...this.latest.values()];
    if (items.some((item) => item.present) && items.some((item) => !item.present)) return "CONFLICT";
    const contextualRoots = new Set(items.flatMap((item) => item.observation.provenance?.contextEvidenceRefs ?? []));
    const roots = new Set<string>();
    let sources = 0;
    for (const item of items.filter((candidate) => candidate.present)) {
      const provenance = item.observation.provenance;
      if (item.observation.source === "STORY_PROGRESSION") continue;
      const root =
        provenance?.independentEvidenceRef ??
        (item.observation.kind === "SEMANTIC_LOCATION" ? item.observation.evidenceRef : undefined) ??
        item.observation.id;
      if (contextualRoots.has(root) || roots.has(root)) continue;
      roots.add(root);
      sources++;
    }
    return sources >= (profile.fusionPolicy?.minimumIndependentSources ?? 1) ? "SUPPORTED" : "INSUFFICIENT";
  }
}
