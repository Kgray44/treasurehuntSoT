import { pageSheet, pageState, type PageSurface } from "./page-material";
import { CUT, materialPath, type Actor } from "./program";
import { ArrivalMaterial } from "./arrival-material";
import type { ArrivalSpec } from "./arrival";
import { TitleSnag, type SnagSpec } from "./title-snag";

/** Task-local preparation worker. No application data or captured pixels enter
 * it: only dimensions, material constants and authored support times. */
self.onmessage = (
  event: MessageEvent<{
    surfaces: PageSurface[];
    width: number;
    height: number;
    actors?: Actor[];
    arrivals?: Array<{ key: string; spec: ArrivalSpec; end: number }>;
    snags?: SnagSpec[];
  }>,
) => {
  const { surfaces, width, height } = event.data;
  try {
    if (event.data.snags) {
      const caches = event.data.snags.map((spec) => {
        const snag = new TitleSnag(spec);
        snag.prepare();
        return snag.exportCache();
      });
      self.postMessage({ caches }, { transfer: caches.map((c) => c.sheet.samples.buffer) });
      return;
    }
    if (event.data.arrivals) {
      const caches = event.data.arrivals.map(({ key, spec, end }) => {
        const motion = new ArrivalMaterial(spec);
        motion.prepare(end);
        return { key, ...motion.exportCache() };
      });
      self.postMessage({ caches }, { transfer: caches.map((c) => c.sheet.samples.buffer) });
      return;
    }
    if (event.data.actors) {
      const caches = event.data.actors
        .filter((a) => !a.hero)
        .map((actor) => {
          const path = materialPath(actor);
          path.at(Math.max(0, CUT.room - actor.birth));
          return { id: actor.id, samples: path.exportCache() };
        });
      self.postMessage({ caches }, { transfer: caches.map((c) => c.samples.buffer) });
      return;
    }
    const caches = surfaces.map((surface) => {
      const sheet = pageSheet(surface, width, height);
      let lastVisible = 0;
      for (let t = 0; t < 28; t += 1 / 30) if (pageState(surface, t, width, height).alpha >= 0.002) lastVisible = t;
      sheet.at(Math.min(28, lastVisible + 1 / 30));
      return { id: surface.id, ...sheet.exportCache() };
    });
    self.postMessage({ caches }, { transfer: caches.map((c) => c.samples.buffer) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "material-preparation-failed" });
  }
};
