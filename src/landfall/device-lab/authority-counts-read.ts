/** A deadline does not permit a cached count or a repeated write. The sole
 * recovery is one new read from the still-owned live authority child. */
export async function readOwnedLandfallAuthorityCounts<T>(options: {
  ownedChildAlive: () => boolean;
  request: (operation: "counts") => Promise<T>;
  delay: (ms: number) => Promise<void>;
}): Promise<T> {
  if (!options.ownedChildAlive()) throw new Error("LANDFALL_LAB_AUTHORITY_EXITED");
  try {
    return await options.request("counts");
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "LANDFALL_LAB_AUTHORITY_TIMEOUT" || !options.ownedChildAlive())
      throw error;
    await options.delay(250);
    if (!options.ownedChildAlive()) throw new Error("LANDFALL_LAB_AUTHORITY_EXITED");
    return options.request("counts");
  }
}
