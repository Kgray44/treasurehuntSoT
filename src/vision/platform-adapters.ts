import { z } from "zod";
import {
  mockVisionScenarioSchema,
  type MockVisionScenario,
  type VerificationAttemptState,
  type VerificationResult,
} from "@/vision/domain";

export type PlatformKind = "WEB" | "PWA" | "DESKTOP";
export type CompanionConnectionStatus = {
  available: boolean;
  state: "CONNECTED" | "UNAVAILABLE" | "RECONNECTING" | "INCOMPATIBLE";
  reason?: string;
};
export type VisionCapabilities = {
  protocolVersion: "1.0";
  packageSchemaVersions: number[];
  capture: false;
  deterministicMock: boolean;
  platform: PlatformKind;
};
export type PlayerScanRequest = {
  sessionId: string;
  blockId: string;
  waypointVersionId: string;
  scenario: MockVisionScenario;
  csrfToken?: string;
  onProgress?: (state: VerificationAttemptState) => void;
};
export type VerificationAttemptResult = {
  id: string;
  attemptState: VerificationAttemptState;
  result: VerificationResult | null;
  guidanceCode: string | null;
  eventDeliveryStatus: string;
  duplicateResultRejected: boolean;
};
export type DiagnosticBundleMetadata = {
  generatedAt: string;
  implementation: "B1_DETERMINISTIC_MOCK";
  attempt: VerificationAttemptResult;
};

export interface VisionPlatformAdapter {
  getPlatformKind(): PlatformKind;
  getCapabilities(): Promise<VisionCapabilities>;
  connect(): Promise<CompanionConnectionStatus>;
  disconnect(): Promise<void>;
  selectCaptureTarget(): Promise<{ available: false; reason: string }>;
  beginCreatorRecording(): Promise<never>;
  beginPlayerScan(request: PlayerScanRequest): Promise<VerificationAttemptResult>;
  cancelAttempt(attemptId: string, csrfToken?: string): Promise<void>;
  pauseVision(): Promise<void>;
  resumeVision(): Promise<void>;
  getDiagnosticBundle(attemptId: string): Promise<DiagnosticBundleMetadata>;
}

const attemptSchema = z
  .object({
    id: z.string(),
    attemptState: z.string(),
    result: z.string().nullable(),
    guidanceCode: z.string().nullable(),
    eventDeliveryStatus: z.string(),
    duplicateResultRejected: z.boolean(),
  })
  .passthrough();

async function jsonResponse(response: Response) {
  const body = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Vision request failed (${response.status}).`);
  return body;
}

export class MockVisionPlatformAdapter implements VisionPlatformAdapter {
  constructor(
    private readonly platform: PlatformKind = "WEB",
    private readonly adapterType = "MOCK",
  ) {}
  getPlatformKind() {
    return this.platform;
  }
  async getCapabilities(): Promise<VisionCapabilities> {
    return {
      protocolVersion: "1.0",
      packageSchemaVersions: [1],
      capture: false,
      deterministicMock: true,
      platform: this.platform,
    };
  }
  async connect(): Promise<CompanionConnectionStatus> {
    return { available: true, state: "CONNECTED" };
  }
  async disconnect() {}
  async selectCaptureTarget() {
    return { available: false as const, reason: "CREATOR_CAPTURE_OUT_OF_SCOPE_B1" };
  }
  async beginCreatorRecording(): Promise<never> {
    throw new Error("Real creator capture is not available in Phase B-1.");
  }
  async beginPlayerScan(request: PlayerScanRequest): Promise<VerificationAttemptResult> {
    const scenario = mockVisionScenarioSchema.parse(request.scenario);
    request.onProgress?.("ARMED");
    const created = attemptSchema.parse(
      await jsonResponse(
        await fetch("/api/verification-attempts", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            ...(request.csrfToken ? { "x-csrf-token": request.csrfToken } : {}),
          },
          body: JSON.stringify({
            sessionId: request.sessionId,
            blockId: request.blockId,
            waypointVersionId: request.waypointVersionId,
            scenario,
            platform: this.platform,
            adapterType: this.adapterType,
          }),
        }),
      ),
    );
    request.onProgress?.("CAPTURING");
    const result = attemptSchema.parse(
      await jsonResponse(
        await fetch(`/api/verification-attempts/${created.id}/mock-result`, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            ...(request.csrfToken ? { "x-csrf-token": request.csrfToken } : {}),
          },
          body: JSON.stringify({ scenario }),
        }),
      ),
    );
    request.onProgress?.(result.attemptState as VerificationAttemptState);
    return result as VerificationAttemptResult;
  }
  async cancelAttempt(attemptId: string, csrfToken?: string) {
    await jsonResponse(
      await fetch(`/api/verification-attempts/${attemptId}/cancel`, {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
      }),
    );
  }
  async pauseVision() {}
  async resumeVision() {}
  async getDiagnosticBundle(attemptId: string): Promise<DiagnosticBundleMetadata> {
    const body = (await jsonResponse(
      await fetch(`/api/verification-attempts/${attemptId}`, { cache: "no-store" }),
    )) as { attempt: unknown };
    return {
      generatedAt: new Date().toISOString(),
      implementation: "B1_DETERMINISTIC_MOCK",
      attempt: attemptSchema.parse(body.attempt) as VerificationAttemptResult,
    };
  }
}

export class WebCompanionPlatformAdapter extends MockVisionPlatformAdapter {
  constructor() {
    super("WEB", "WEB_COMPANION");
  }
  override async connect(): Promise<CompanionConnectionStatus> {
    return { available: false, state: "UNAVAILABLE", reason: "COMPANION_UNAVAILABLE" };
  }
  override async beginPlayerScan(): Promise<VerificationAttemptResult> {
    throw new Error("The future local Web Companion is unavailable. Use the authorized development mock.");
  }
}

export class DesktopPlatformAdapter extends MockVisionPlatformAdapter {
  constructor() {
    super("DESKTOP", "DESKTOP");
  }
  override async connect(): Promise<CompanionConnectionStatus> {
    if (!window.tallTaleDesktop) return { available: false, state: "UNAVAILABLE", reason: "DESKTOP_BRIDGE_MISSING" };
    return window.tallTaleDesktop.invoke("vision.getCapabilities", {}) as Promise<CompanionConnectionStatus>;
  }
  override async beginPlayerScan(request: PlayerScanRequest): Promise<VerificationAttemptResult> {
    if (!window.tallTaleDesktop) throw new Error("The restricted desktop bridge is unavailable.");
    await window.tallTaleDesktop.invoke("vision.prepareMockScan", {
      sessionId: request.sessionId,
      blockId: request.blockId,
      waypointVersionId: request.waypointVersionId,
      scenario: request.scenario,
    });
    return super.beginPlayerScan(request);
  }
}

export function selectVisionPlatformAdapter(options: { forceMock?: boolean } = {}): VisionPlatformAdapter {
  if (typeof window !== "undefined" && window.tallTaleDesktop && !options.forceMock)
    return new DesktopPlatformAdapter();
  return new MockVisionPlatformAdapter(
    typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches ? "PWA" : "WEB",
  );
}

declare global {
  interface Window {
    tallTaleDesktop?: {
      platform: "windows";
      shellVersion: string;
      invoke(command: string, payload: Record<string, unknown>): Promise<unknown>;
      subscribe(callback: (event: { eventName: string; payload: unknown }) => void): () => void;
    };
  }
}
