import type { PrivateScannerProvider, PrivateScanResult } from "./contracts";

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
