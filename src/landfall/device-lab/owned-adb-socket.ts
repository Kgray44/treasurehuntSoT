/** Linux /proc TCP rows identify only listeners on the exclusively reserved lab port. */
export function ownedAdbListeningInodes(tables: readonly string[], port: number): Set<string> {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("LANDFALL_OWNED_ADB_PORT_INVALID");
  const hexPort = port.toString(16).padStart(4, "0").toUpperCase();
  const found = new Set<string>();
  for (const table of tables)
    for (const line of table.split("\n")) {
      const fields = line.trim().split(/\s+/);
      if (fields[3] !== "0A" || fields[1]?.split(":")[1]?.toUpperCase() !== hexPort) continue;
      if (/^[1-9][0-9]*$/.test(fields[9] ?? "")) found.add(fields[9]);
    }
  return found;
}
