import { vi } from "vitest";
import type { MusterProjection, MusterMember } from "@/muster/contracts";
export class FakeEventSource {
  static current: FakeEventSource;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, () => void>();
  close = vi.fn();
  constructor(public url: string) {
    FakeEventSource.current = this;
  }
  addEventListener(name: string, fn: () => void) {
    this.listeners.set(name, fn);
  }
  emit(name: string) {
    this.listeners.get(name)?.();
  }
}
export function member(overrides: Partial<MusterMember> = {}): MusterMember {
  return {
    id: "member-1",
    displayName: "Sera",
    avatarUrl: null,
    isCaptain: false,
    isCurrentPlayer: true,
    participates: true,
    status: "READY",
    ready: true,
    presence: "CONNECTED",
    canReceiveCaptaincy: false,
    invitation: null,
    ...overrides,
  };
}
export function room(overrides: Partial<MusterProjection> = {}): MusterProjection {
  return {
    csrfToken: "csrf-token",
    voyage: {
      id: "voyage-1",
      title: "The Moonlit Key",
      subtitle: "A new horizon",
      description: "A safe Chronicle.",
      voyageName: "Lanternwake",
      edition: "1",
      status: "READY",
      authorityState: "ASSIGNED",
      captainName: "Kato",
      duration: 90,
      coverUrl: "/cover.png",
      concurrencyVersion: 5,
      currentSequence: 12,
      plannedStartAt: null,
    },
    viewer: {
      isCaptain: false,
      participates: true,
      membershipId: "member-1",
      ready: true,
      canLaunch: false,
      canRelinquish: false,
      canInvite: false,
      canLeave: true,
      canTakeCaptaincy: false,
      canContinueSolo: true,
      runtimeHref: null,
    },
    readiness: { ready: 1, total: 1, allReady: true },
    crew: [member()],
    ...overrides,
  };
}
export function response(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}
export function mockNetwork(getRoom: () => MusterProjection) {
  vi.stubGlobal("EventSource", FakeEventSource);
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === "POST") return response(200, {});
    if (url.endsWith("/chat")) return response(200, { messages: [] });
    return response(200, getRoom());
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
