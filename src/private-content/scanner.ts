import type { PrivateScannerProvider, PrivateScanResult } from "./contracts";
import { connect } from "node:net";
import type { PrivateStorageProvider } from "./contracts";

/** Deterministic fixture scanner; it is intentionally not production malware protection. */
export class SyntheticPrivateScanner implements PrivateScannerProvider {
  readonly name = "synthetic-test-scanner";
  constructor(private readonly outcome: PrivateScanResult["state"] = "CLEAN") {}
  async health() {
    return { configured: true, healthy: true };
  }
  async scan(): Promise<PrivateScanResult> {
    return {
      state: this.outcome,
      provider: this.name,
      safeCode: this.outcome === "CLEAN" ? "SYNTHETIC_CLEAN" : "SYNTHETIC_DETECTION",
    };
  }
}

export class UnconfiguredPrivateScanner implements PrivateScannerProvider {
  readonly name = "production-scanner-adapter";
  async health() {
    return { configured: false, healthy: false };
  }
  async scan(): Promise<PrivateScanResult> {
    return { state: "NOT_CONFIGURED", provider: this.name, safeCode: "SCANNER_NOT_CONFIGURED" };
  }
}

type ClamAvInput = {
  storage: PrivateStorageProvider;
  host?: string;
  port?: number;
  timeoutMs?: number;
};

function scannerTimeout(timeoutMs: number, reject: (error: Error) => void) {
  return setTimeout(() => reject(new Error("SCANNER_TIMEOUT")), timeoutMs);
}

/**
 * ClamAV's INSTREAM protocol adapter. It transmits only object bytes over the
 * configured private scanner connection, caps replies, and deliberately maps
 * malformed or unavailable responses to FAILED rather than CLEAN.
 */
export class ClamAvPrivateScanner implements PrivateScannerProvider {
  readonly name = "clamav-instream";
  private readonly host?: string;
  private readonly port: number;
  private readonly timeoutMs: number;
  constructor(private readonly input: ClamAvInput) {
    this.host = input.host ?? process.env.PRIVATE_CONTENT_CLAMAV_HOST;
    this.port = input.port ?? Number(process.env.PRIVATE_CONTENT_CLAMAV_PORT ?? 3310);
    this.timeoutMs = input.timeoutMs ?? 15_000;
  }

  async health() {
    if (!this.host || !Number.isSafeInteger(this.port) || this.port < 1 || this.port > 65535)
      return { configured: false, healthy: false };
    try {
      const response = await this.command("zPING\0");
      return { configured: true, healthy: /PONG/i.test(response) };
    } catch {
      return { configured: true, healthy: false };
    }
  }

  private command(command: string) {
    return new Promise<string>((resolve, reject) => {
      if (!this.host) return reject(new Error("SCANNER_UNCONFIGURED"));
      const socket = connect({ host: this.host, port: this.port });
      let response = Buffer.alloc(0);
      const timer = scannerTimeout(this.timeoutMs, (error) => {
        socket.destroy(error);
        reject(error);
      });
      socket.once("connect", () => socket.write(command));
      socket.on("data", (chunk: Buffer) => {
        response = Buffer.concat([response, chunk]);
        if (response.length > 4096) socket.destroy(new Error("SCANNER_RESPONSE_INVALID"));
      });
      socket.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      socket.once("end", () => {
        clearTimeout(timer);
        resolve(response.toString("utf8"));
      });
    });
  }

  async scan(input: Parameters<PrivateScannerProvider["scan"]>[0]): Promise<PrivateScanResult> {
    if (!this.host) return { state: "NOT_CONFIGURED", provider: this.name, safeCode: "SCANNER_NOT_CONFIGURED" };
    try {
      const stream = await this.input.storage.read(input.object);
      const response = await new Promise<string>((resolve, reject) => {
        const socket = connect({ host: this.host!, port: this.port });
        let reply = Buffer.alloc(0);
        let settled = false;
        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          fn();
        };
        const timer = scannerTimeout(this.timeoutMs, (error) => {
          stream.destroy(error);
          socket.destroy(error);
          settle(() => reject(error));
        });
        const abort = () => {
          const error = new Error("SCANNER_CANCELLED");
          stream.destroy(error);
          socket.destroy(error);
          settle(() => reject(error));
        };
        input.signal?.addEventListener("abort", abort, { once: true });
        socket.once("connect", async () => {
          try {
            socket.write("zINSTREAM\0");
            for await (const chunk of stream) {
              if (input.signal?.aborted) return abort();
              const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
              const size = Buffer.alloc(4);
              size.writeUInt32BE(bytes.length);
              if (!socket.write(size)) await new Promise<void>((done) => socket.once("drain", done));
              if (!socket.write(bytes)) await new Promise<void>((done) => socket.once("drain", done));
            }
            socket.write(Buffer.alloc(4));
          } catch (error) {
            socket.destroy(error as Error);
            settle(() => reject(error as Error));
          }
        });
        socket.on("data", (chunk: Buffer) => {
          reply = Buffer.concat([reply, chunk]);
          if (reply.length > 4096) socket.destroy(new Error("SCANNER_RESPONSE_INVALID"));
        });
        socket.once("error", (error) => settle(() => reject(error)));
        socket.once("end", () => settle(() => resolve(reply.toString("utf8"))));
      });
      if (/\bOK\b/i.test(response)) return { state: "CLEAN", provider: this.name, safeCode: "CLAMAV_CLEAN" };
      if (/\bFOUND\b/i.test(response)) return { state: "MALICIOUS", provider: this.name, safeCode: "CLAMAV_DETECTED" };
      return { state: "FAILED", provider: this.name, safeCode: "CLAMAV_MALFORMED_RESPONSE" };
    } catch (error) {
      return {
        state: "FAILED",
        provider: this.name,
        safeCode:
          error instanceof Error && error.message === "SCANNER_TIMEOUT" ? "CLAMAV_TIMEOUT" : "CLAMAV_UNAVAILABLE",
      };
    }
  }
}
