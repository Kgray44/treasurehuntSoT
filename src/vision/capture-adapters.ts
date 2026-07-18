"use client";

import {
  captureCapabilitiesSchema,
  captureStatusSchema,
  captureTargetSchema,
  type CaptureCapabilities,
  type CaptureCommand,
  type CaptureStatus,
  type CaptureTarget,
  type CreatorStartInput,
  type PlayerCaptureStartInput,
  type VisionBuildStartInput,
  type VisionRuntimeArmInput,
  type VisionPackageInstallInput,
} from "@/vision/capture-protocol";
import { WebCompanionClient } from "@/vision/web-companion-client";

export type CaptureAdapterKind = "DESKTOP_INTEGRATED" | "BROWSER_PAIRED";
export type CaptureEvent = { eventName: string; payload: unknown };

export interface CapturePlatformAdapter {
  readonly kind: CaptureAdapterKind;
  getCapabilities(): Promise<CaptureCapabilities>;
  getStatus(): Promise<CaptureStatus>;
  listTargets(): Promise<CaptureTarget[]>;
  selectTarget(targetId: string, remember?: boolean): Promise<unknown>;
  beginCreatorRecording(input: CreatorStartInput): Promise<Record<string, unknown>>;
  pauseCreator(sessionId: string): Promise<unknown>;
  resumeCreator(sessionId: string): Promise<unknown>;
  stopCreator(sessionId: string): Promise<Record<string, unknown>>;
  cancelCreator(sessionId: string): Promise<unknown>;
  listCreatorArtifacts(): Promise<Record<string, unknown>[]>;
  deleteCreatorArtifact(artifactId: string): Promise<unknown>;
  previewCreatorArtifact(artifactId: string): Promise<{ previewUrl: string; expiresAt: string }>;
  beginPlayerScan(input: PlayerCaptureStartInput): Promise<{ sessionId: string; state: string }>;
  stopPlayerScan(sessionId: string): Promise<Record<string, unknown>>;
  cancelPlayerScan(sessionId: string): Promise<unknown>;
  pauseVision(reason?: string): Promise<unknown>;
  resumeVision(): Promise<unknown>;
  configureHotkey(binding: string, interaction: "HOLD" | "TOGGLE"): Promise<unknown>;
  disableHotkey(): Promise<unknown>;
  createDiagnosticBundle(consent: boolean): Promise<Record<string, unknown>>;
  exportDiagnosticBundle(bundleId: string): Promise<{ downloadUrl: string; expiresAt: string }>;
  getVisionEngineCapabilities(): Promise<Record<string, unknown>>;
  startVisionBuild(input: VisionBuildStartInput): Promise<Record<string, unknown>>;
  getVisionBuildStatus(buildId: string): Promise<Record<string, unknown>>;
  cancelVisionBuild(buildId: string): Promise<Record<string, unknown>>;
  installVisionPackage(input: VisionPackageInstallInput): Promise<Record<string, unknown>>;
  armVisionRuntime(input: VisionRuntimeArmInput): Promise<Record<string, unknown>>;
  disarmVisionRuntime(attemptId: string): Promise<Record<string, unknown>>;
  subscribe(listener: (event: CaptureEvent) => void): () => void;
}

function objectResult(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The Companion returned invalid data.");
  return value as Record<string, unknown>;
}

export class DesktopCapturePlatformAdapter implements CapturePlatformAdapter {
  readonly kind = "DESKTOP_INTEGRATED" as const;

  private bridge() {
    if (!window.tallTaleDesktop) throw new Error("The restricted desktop Companion bridge is unavailable.");
    return window.tallTaleDesktop;
  }

  private invoke(command: CaptureCommand, payload: Record<string, unknown> = {}) {
    return this.bridge().invoke(command, payload);
  }

  async getCapabilities() {
    return captureCapabilitiesSchema.parse(await this.invoke("capture.getCapabilities"));
  }

  async getStatus() {
    return captureStatusSchema.parse(await this.invoke("capture.getStatus"));
  }

  async listTargets() {
    const result = objectResult(await this.invoke("capture.listTargets"));
    return captureTargetSchema.array().parse(result.targets);
  }

  selectTarget(targetId: string, remember = false) {
    return this.invoke("capture.selectTarget", { targetId, remember });
  }

  async beginCreatorRecording(input: CreatorStartInput) {
    return objectResult(await this.invoke("capture.creator.start", input));
  }

  pauseCreator(sessionId: string) {
    return this.invoke("capture.creator.pause", { sessionId });
  }

  resumeCreator(sessionId: string) {
    return this.invoke("capture.creator.resume", { sessionId });
  }

  async stopCreator(sessionId: string) {
    return objectResult(await this.invoke("capture.creator.stop", { sessionId }));
  }

  cancelCreator(sessionId: string) {
    return this.invoke("capture.creator.cancel", { sessionId });
  }

  async listCreatorArtifacts() {
    const result = objectResult(await this.invoke("capture.creator.list"));
    return Array.isArray(result.artifacts) ? (result.artifacts as Record<string, unknown>[]) : [];
  }

  deleteCreatorArtifact(artifactId: string) {
    return this.invoke("capture.creator.delete", { artifactId });
  }

  async previewCreatorArtifact(artifactId: string) {
    const result = objectResult(await this.invoke("capture.creator.preview", { artifactId }));
    return { previewUrl: String(result.previewUrl), expiresAt: String(result.expiresAt) };
  }

  async beginPlayerScan(input: PlayerCaptureStartInput) {
    const result = objectResult(await this.invoke("capture.scan.start", input));
    return { sessionId: String(result.sessionId), state: String(result.state) };
  }

  async stopPlayerScan(sessionId: string) {
    return objectResult(await this.invoke("capture.scan.stop", { sessionId }));
  }

  cancelPlayerScan(sessionId: string) {
    return this.invoke("capture.scan.cancel", { sessionId });
  }

  pauseVision(reason?: string) {
    return this.invoke("capture.privacy.pause", { ...(reason ? { reason } : {}) });
  }

  resumeVision() {
    return this.invoke("capture.privacy.resume");
  }

  configureHotkey(binding: string, interaction: "HOLD" | "TOGGLE") {
    return this.invoke("capture.hotkey.configure", { binding, interaction });
  }

  disableHotkey() {
    return this.invoke("capture.hotkey.disable");
  }

  async createDiagnosticBundle(consent: boolean) {
    return objectResult(await this.invoke("capture.diagnostic.create", { includeFrames: false, consent }));
  }

  async exportDiagnosticBundle(bundleId: string) {
    const result = objectResult(await this.invoke("capture.diagnostic.export", { bundleId }));
    return { downloadUrl: String(result.downloadUrl), expiresAt: String(result.expiresAt) };
  }

  async getVisionEngineCapabilities() {
    return objectResult(await this.invoke("vision.engine.getCapabilities"));
  }

  async startVisionBuild(input: VisionBuildStartInput) {
    return objectResult(await this.invoke("vision.build.start", input));
  }

  async getVisionBuildStatus(buildId: string) {
    return objectResult(await this.invoke("vision.build.status", { buildId }));
  }

  async cancelVisionBuild(buildId: string) {
    return objectResult(await this.invoke("vision.build.cancel", { buildId }));
  }

  async installVisionPackage(input: VisionPackageInstallInput) {
    return objectResult(await this.invoke("vision.package.install", input));
  }

  async armVisionRuntime(input: VisionRuntimeArmInput) {
    return objectResult(await this.invoke("vision.runtime.arm", input));
  }

  async disarmVisionRuntime(attemptId: string) {
    return objectResult(await this.invoke("vision.runtime.disarm", { attemptId }));
  }

  subscribe(listener: (event: CaptureEvent) => void) {
    return this.bridge().subscribe(listener);
  }

  listPendingPairings() {
    return this.bridge().invoke("capture.pairing.pending", {});
  }

  approvePairing(pairingId: string, approved: boolean) {
    return this.bridge().invoke("capture.pairing.approve", { pairingId, approved });
  }

  listPairings() {
    return this.bridge().invoke("capture.pairing.list", {});
  }

  revokePairing(pairingId: string) {
    return this.bridge().invoke("capture.pairing.revoke", { pairingId });
  }
}

export class WebCapturePlatformAdapter implements CapturePlatformAdapter {
  readonly kind = "BROWSER_PAIRED" as const;

  constructor(readonly client = new WebCompanionClient()) {}

  private command(command: CaptureCommand, payload: Record<string, unknown> = {}) {
    return this.client.command(command, payload);
  }

  requestPairing(accountHint?: string) {
    return this.client.requestPairing(accountHint);
  }

  completePairing(pairingCode: string) {
    return this.client.completePairing(pairingCode);
  }

  getPairingState() {
    return this.client.getPairingState();
  }

  async getCapabilities() {
    return captureCapabilitiesSchema.parse(await this.command("capture.getCapabilities"));
  }

  async getStatus() {
    return captureStatusSchema.parse(await this.command("capture.getStatus"));
  }

  async listTargets() {
    const result = objectResult(await this.command("capture.listTargets"));
    return captureTargetSchema.array().parse(result.targets);
  }

  selectTarget(targetId: string, remember = false) {
    return this.command("capture.selectTarget", { targetId, remember });
  }

  async beginCreatorRecording(input: CreatorStartInput) {
    return objectResult(await this.command("capture.creator.start", input));
  }

  pauseCreator(sessionId: string) {
    return this.command("capture.creator.pause", { sessionId });
  }

  resumeCreator(sessionId: string) {
    return this.command("capture.creator.resume", { sessionId });
  }

  async stopCreator(sessionId: string) {
    return objectResult(await this.command("capture.creator.stop", { sessionId }));
  }

  cancelCreator(sessionId: string) {
    return this.command("capture.creator.cancel", { sessionId });
  }

  async listCreatorArtifacts() {
    const result = objectResult(await this.command("capture.creator.list"));
    return Array.isArray(result.artifacts) ? (result.artifacts as Record<string, unknown>[]) : [];
  }

  deleteCreatorArtifact(artifactId: string) {
    return this.command("capture.creator.delete", { artifactId });
  }

  async previewCreatorArtifact(artifactId: string) {
    const result = objectResult(await this.command("capture.creator.preview", { artifactId }));
    return { previewUrl: String(result.previewUrl), expiresAt: String(result.expiresAt) };
  }

  async beginPlayerScan(input: PlayerCaptureStartInput) {
    const result = objectResult(await this.command("capture.scan.start", input));
    return { sessionId: String(result.sessionId), state: String(result.state) };
  }

  async stopPlayerScan(sessionId: string) {
    return objectResult(await this.command("capture.scan.stop", { sessionId }));
  }

  cancelPlayerScan(sessionId: string) {
    return this.command("capture.scan.cancel", { sessionId });
  }

  pauseVision(reason?: string) {
    return this.command("capture.privacy.pause", { ...(reason ? { reason } : {}) });
  }

  resumeVision() {
    return this.command("capture.privacy.resume");
  }

  configureHotkey() {
    return Promise.reject(new Error("Global hotkey settings are available in the desktop Companion."));
  }

  disableHotkey() {
    return Promise.reject(new Error("Global hotkey settings are available in the desktop Companion."));
  }

  async createDiagnosticBundle(consent: boolean) {
    return objectResult(await this.command("capture.diagnostic.create", { includeFrames: false, consent }));
  }

  async exportDiagnosticBundle(bundleId: string) {
    const result = objectResult(await this.command("capture.diagnostic.export", { bundleId }));
    return { downloadUrl: String(result.downloadUrl), expiresAt: String(result.expiresAt) };
  }

  async getVisionEngineCapabilities() {
    return objectResult(await this.command("vision.engine.getCapabilities"));
  }

  async startVisionBuild(input: VisionBuildStartInput) {
    return objectResult(await this.command("vision.build.start", input));
  }

  async getVisionBuildStatus(buildId: string) {
    return objectResult(await this.command("vision.build.status", { buildId }));
  }

  async cancelVisionBuild(buildId: string) {
    return objectResult(await this.command("vision.build.cancel", { buildId }));
  }

  async installVisionPackage(input: VisionPackageInstallInput) {
    return objectResult(await this.command("vision.package.install", input));
  }

  async armVisionRuntime(input: VisionRuntimeArmInput) {
    return objectResult(await this.command("vision.runtime.arm", input));
  }

  async disarmVisionRuntime(attemptId: string) {
    return objectResult(await this.command("vision.runtime.disarm", { attemptId }));
  }

  subscribe(listener: (event: CaptureEvent) => void) {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ eventType?: string; data?: unknown }>).detail;
      listener({ eventName: detail.eventType ?? "unknown", payload: detail.data });
    };
    this.client.addEventListener("companion-event", handler);
    return () => this.client.removeEventListener("companion-event", handler);
  }
}

export function selectCapturePlatformAdapter(): CapturePlatformAdapter {
  if (typeof window !== "undefined" && window.tallTaleDesktop) return new DesktopCapturePlatformAdapter();
  return new WebCapturePlatformAdapter();
}
