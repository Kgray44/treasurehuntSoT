"use client";

import {
  CAPTURE_PROTOCOL_VERSION,
  captureProtocolEnvelopeSchema,
  createCaptureEnvelope,
} from "@/vision/capture-protocol";

type PairingRequest = {
  pairingId: string;
  allowedOrigin: string;
  createdAt: string;
  expiresAt: string;
  desktopApprovalRequired: true;
};

type PairingSession = {
  pairingId: string;
  allowedOrigin: string;
  protocolVersion: "2.0";
  pairedAt: string;
  expiresAt: string;
  authentication: "ECDSA_P256_CHALLENGE";
};

type PendingResponse = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export class WebCompanionClient extends EventTarget {
  readonly httpBase: string;
  readonly socketUrl: string;
  private keyPair: CryptoKeyPair | null = null;
  private pairingRequest: PairingRequest | null = null;
  private pairing: PairingSession | null = null;
  private socket: WebSocket | null = null;
  private connectionPromise: Promise<void> | null = null;
  private sequence = 0;
  private pending = new Map<string, PendingResponse>();

  constructor(endpoint = process.env.NEXT_PUBLIC_COMPANION_URL || "http://127.0.0.1:32179") {
    super();
    const parsed = new URL(endpoint);
    if (
      !(["http:", "https:"] as const).includes(parsed.protocol as "http:" | "https:") ||
      !["127.0.0.1", "localhost"].includes(parsed.hostname)
    )
      throw new Error("Companion endpoint must use an approved loopback address.");
    this.httpBase = parsed.origin;
    this.socketUrl = `${parsed.protocol === "https:" ? "wss:" : "ws:"}//${parsed.host}/v2/socket`;
  }

  getPairingState() {
    return {
      request: this.pairingRequest,
      pairing: this.pairing,
      connected: this.socket?.readyState === WebSocket.OPEN,
    };
  }

  async requestPairing(accountHint?: string) {
    this.disconnect();
    this.keyPair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const publicKeyJwk = await crypto.subtle.exportKey("jwk", this.keyPair.publicKey);
    const clientInstanceId =
      sessionStorage.getItem("forever-treasure-companion-instance") || `browser_${crypto.randomUUID()}`;
    sessionStorage.setItem("forever-treasure-companion-instance", clientInstanceId);
    const response = await fetch(`${this.httpBase}/v2/pair/request`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocolVersion: CAPTURE_PROTOCOL_VERSION, clientInstanceId, publicKeyJwk, accountHint }),
    });
    const body = (await response.json()) as PairingRequest & { error?: { userMessage?: string } };
    if (!response.ok) throw new Error(body.error?.userMessage ?? "The Companion rejected the pairing request.");
    this.pairingRequest = body;
    return body;
  }

  async completePairing(pairingCode: string) {
    if (!this.pairingRequest || !this.keyPair) throw new Error("Request pairing before entering the code.");
    const response = await fetch(`${this.httpBase}/v2/pair/complete`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingId: this.pairingRequest.pairingId, pairingCode }),
    });
    const body = (await response.json()) as PairingSession & { error?: { userMessage?: string } };
    if (!response.ok) throw new Error(body.error?.userMessage ?? "The Companion rejected the pairing code.");
    this.pairing = body;
    await this.connect();
    return body;
  }

  async connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    if (!this.pairing || !this.keyPair) throw new Error("Pairing is required before connecting to the Companion.");
    if (this.connectionPromise) return this.connectionPromise;
    this.connectionPromise = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.socketUrl);
      this.socket = socket;
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error("The Companion authentication handshake timed out."));
      }, 12_000);
      let authenticated = false;
      socket.addEventListener("message", (event) => {
        void (async () => {
          try {
            const envelope = captureProtocolEnvelopeSchema.parse(JSON.parse(String(event.data)));
            if (
              !authenticated &&
              envelope.messageType === "capture.event" &&
              envelope.payload.eventType === "companion.challenge"
            ) {
              const challenge = String(envelope.payload.challenge);
              const signed = new TextEncoder().encode(
                `${challenge}|${this.pairing?.pairingId}|${location.origin}|${CAPTURE_PROTOCOL_VERSION}`,
              );
              const signature = await crypto.subtle.sign(
                { name: "ECDSA", hash: "SHA-256" },
                this.keyPair!.privateKey,
                signed,
              );
              const authentication = createCaptureEnvelope({
                messageType: "companion.authenticate",
                requestId: `request_${crypto.randomUUID()}`,
                sessionId: this.pairing!.pairingId,
                sequence: 0,
                payload: { pairingId: this.pairing!.pairingId, signature: toBase64Url(signature) },
              });
              socket.send(JSON.stringify(authentication));
              return;
            }
            if (!authenticated && envelope.messageType === "capture.response" && envelope.payload.ok === true) {
              authenticated = true;
              clearTimeout(timeout);
              this.sequence = 0;
              resolve();
              return;
            }
            this.handleEnvelope(envelope);
          } catch (error) {
            clearTimeout(timeout);
            reject(error instanceof Error ? error : new Error("Invalid Companion message."));
          }
        })();
      });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("The local Companion connection failed."));
      });
      socket.addEventListener("close", () => {
        this.socket = null;
        this.connectionPromise = null;
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timeout);
          pending.reject(new Error("The local Companion disconnected."));
        }
        this.pending.clear();
        this.dispatchEvent(new CustomEvent("companion-disconnected"));
      });
    }).finally(() => {
      this.connectionPromise = null;
    });
    return this.connectionPromise;
  }

  async command(command: string, input: Record<string, unknown> = {}) {
    await this.connect();
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.pairing)
      throw new Error("The local Companion is disconnected.");
    const requestId = `request_${crypto.randomUUID()}`;
    const envelope = createCaptureEnvelope({
      messageType: "capture.command",
      requestId,
      sessionId: this.pairing.pairingId,
      sequence: ++this.sequence,
      payload: { command, input },
    });
    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Companion command ${command} timed out.`));
      }, 20_000);
      this.pending.set(requestId, { resolve, reject, timeout });
      this.socket!.send(JSON.stringify(envelope));
    });
  }

  disconnect() {
    this.socket?.close(1000, "Browser disconnected");
    this.socket = null;
  }

  private handleEnvelope(envelope: ReturnType<typeof captureProtocolEnvelopeSchema.parse>) {
    if (envelope.messageType === "capture.event") {
      this.dispatchEvent(new CustomEvent("companion-event", { detail: envelope.payload }));
      return;
    }
    if (envelope.messageType !== "capture.response") return;
    const requestId = typeof envelope.payload.requestId === "string" ? envelope.payload.requestId : envelope.requestId;
    if (!requestId) return;
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);
    clearTimeout(pending.timeout);
    if (envelope.payload.ok === true) pending.resolve(envelope.payload.result);
    else {
      const error = envelope.payload.error as { userMessage?: string; code?: string } | undefined;
      const problem = new Error(error?.userMessage ?? "The Companion command failed.");
      problem.name = error?.code ?? "CompanionCommandError";
      pending.reject(problem);
    }
  }
}

function toBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
