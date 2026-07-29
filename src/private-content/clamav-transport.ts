import { connect } from "node:net";

export type ClamAvByteResult =
  | "CLEAN"
  | "MALICIOUS"
  | "TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "FAILED"
  | "SCAN_NOT_CONFIGURED";

/** Shared low-level ClamAV INSTREAM transport. It accepts bytes, has bounded
 * responses and cancellation, and returns safe classifications only. */
export async function scanClamAvBytes(input: {
  bytes: Uint8Array;
  host?: string;
  port?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<{ result: ClamAvByteResult; safeCode: string }> {
  const host = input.host;
  const port = input.port ?? 3310;
  const timeoutMs = input.timeoutMs ?? 15_000;
  if (!host || !Number.isSafeInteger(port) || port < 1 || port > 65_535)
    return { result: "SCAN_NOT_CONFIGURED", safeCode: "CLAMAV_NOT_CONFIGURED" };
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    let reply = Buffer.alloc(0);
    let settled = false;
    const settle = (result: ClamAvByteResult, safeCode: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ result, safeCode });
    };
    const timer = setTimeout(() => settle("TIMEOUT", "CLAMAV_TIMEOUT"), timeoutMs);
    const abort = () => settle("FAILED", "CLAMAV_CANCELLED");
    input.signal?.addEventListener("abort", abort, { once: true });
    socket.once("connect", () => {
      try {
        const bytes = Buffer.from(input.bytes);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(bytes.length);
        socket.write("zINSTREAM\0");
        socket.write(size);
        socket.write(bytes);
        socket.write(Buffer.alloc(4));
      } catch {
        settle("FAILED", "CLAMAV_SEND_FAILED");
      }
    });
    socket.on("data", (chunk: Buffer) => {
      reply = Buffer.concat([reply, chunk]);
      if (reply.length > 4096) settle("FAILED", "CLAMAV_RESPONSE_TOO_LARGE");
    });
    socket.once("error", () => settle("PROVIDER_UNAVAILABLE", "CLAMAV_UNAVAILABLE"));
    socket.once("end", () => {
      const response = reply.toString("utf8");
      if (/\bOK\b/iu.test(response)) settle("CLEAN", "CLAMAV_CLEAN");
      else if (/\bFOUND\b/iu.test(response)) settle("MALICIOUS", "CLAMAV_DETECTED");
      else settle("FAILED", "CLAMAV_MALFORMED_RESPONSE");
    });
  });
}
