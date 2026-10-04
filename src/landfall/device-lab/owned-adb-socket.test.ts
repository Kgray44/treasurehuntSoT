import { describe, expect, it } from "vitest";
import { ownedAdbListeningInodes } from "./owned-adb-socket";
describe("exclusive ADB listening socket identity", () => {
  it("accepts TCP and TCP6 listeners only on the acquired private port", () => {
    const rows = [
      "sl local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode",
      "0: 0100007F:13AE 00000000:0000 0A 00000000:00000000 00:00000000 00000000 1001 0 12345 1",
      "1: 00000000000000000000000001000000:13AE 00000000000000000000000000000000:0000 0A 0:0 00:0 0 1001 0 67890 1",
      "2: 0100007F:13AD 00000000:0000 0A 0:0 00:0 0 1001 0 11111 1",
      "3: 0100007F:13AE 00000000:0000 01 0:0 00:0 0 1001 0 22222 1",
      "4: 0100007F:13AE 00000000:0000 0A 0:0 00:0 0 1001 0 0 1",
    ].join("\n");
    expect([...ownedAdbListeningInodes([rows], 5038)]).toEqual(["12345", "67890"]);
    expect(() => ownedAdbListeningInodes([rows], 0)).toThrow("LANDFALL_OWNED_ADB_PORT_INVALID");
  });
});
