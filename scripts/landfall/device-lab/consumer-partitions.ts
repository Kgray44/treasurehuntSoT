/** Fixed whole-spec development partitions; no caller-provided test selector. */
export function sextantConsumerPartition(target: string) {
  switch (target) {
    case "sextant-consumer-pages":
      return {
        jobName: "Sextant ordinary consumer pages (development)",
        tests: ["tests/e2e/sextant-consumer-journeys.spec.ts"],
        scenarios: ["sextant-consumer-journeys"],
      };
    case "sextant-contextual-entry":
      return {
        jobName: "Sextant Captain and Creator contextual entry (development)",
        tests: ["tests/e2e/sextant-contextual-entry-journeys.spec.ts"],
        scenarios: ["sextant-contextual-entry-journeys"],
      };
    default:
      return null;
  }
}
