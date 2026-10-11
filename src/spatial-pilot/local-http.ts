/** Explicit task-owned synthetic HTTP preview; never a general cookie override. */
export function pilotLocalHttpEnabled(environment: Record<string, string | undefined> = process.env) {
  const database = (environment.DATABASE_URL ?? "").replaceAll("\\", "/");
  return (
    environment.SPATIAL_PILOT_LOCAL_HTTP === "1" &&
    environment.SPATIAL_PILOT_ENABLED === "1" &&
    environment.SPATIAL_PILOT_OWNER_ID === "spatial-pilot-navigator" &&
    /^file:(?:[A-Za-z]:\/|\/).+\/artifacts\/spatial-pilot\/[^/]+\.db$/.test(database) &&
    !database.split("/").includes("..")
  );
}
