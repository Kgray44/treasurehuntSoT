/** Setup entry opens an empty trial; observation eligibility still gates every sample. */
export function canOpenReachTrial({
  source,
  sessionStatus,
  workerAvailable,
}: {
  source: "OFF" | "LIVE" | "DEMO";
  sessionStatus: string;
  workerAvailable: boolean;
}): boolean {
  if (source === "DEMO") return true;
  return source === "LIVE" && workerAvailable && ["READY", "STALE_OR_INVALID_OBSERVATION"].includes(sessionStatus);
}
