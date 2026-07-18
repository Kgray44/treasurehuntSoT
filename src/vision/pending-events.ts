"use client";

type PendingVisionEvent = {
  eventId: string;
  idempotencyKey: string;
  attemptId: string;
  eventType: "vision.result";
  storyStateVersion: number;
  payloadHash: string;
  observedAt: string;
  payload: Record<string, unknown>;
};

const key = "forever-treasure:vision-pending-events:v1";

function read(): PendingVisionEvent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? (parsed as PendingVisionEvent[]).slice(0, 100) : [];
  } catch {
    return [];
  }
}

function write(events: PendingVisionEvent[]) {
  localStorage.setItem(key, JSON.stringify(events.slice(-100)));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, item]) => `${JSON.stringify(name)}:${stableJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

async function payloadHash(payload: Record<string, unknown>) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(payload)));
  return `sha256:${Array.from(new Uint8Array(bytes))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function queueVisionResult(input: {
  attemptId: string;
  storyStateVersion: number;
  payload: Record<string, unknown>;
}) {
  // Hash the same JSON-safe envelope that fetch will transmit. Object properties
  // whose values are undefined are omitted by JSON.stringify and must not create
  // a different pre-transport digest.
  const payload = JSON.parse(JSON.stringify(input.payload)) as Record<string, unknown>;
  const eventId = `offline_${crypto.randomUUID()}`;
  const event: PendingVisionEvent = {
    eventId,
    idempotencyKey: `offline:${input.attemptId}:${eventId}`,
    attemptId: input.attemptId,
    eventType: "vision.result",
    storyStateVersion: input.storyStateVersion,
    payloadHash: await payloadHash(payload),
    observedAt: String(payload.observedAt ?? new Date().toISOString()),
    payload,
  };
  const pending = read().filter((candidate) => candidate.attemptId !== input.attemptId);
  pending.push(event);
  write(pending);
  return event;
}

export function pendingVisionEventCount() {
  return read().length;
}

export async function flushVisionResults(sessionId: string, csrfToken?: string) {
  const pending = read();
  if (!pending.length) return { synced: 0, conflicts: 0, rejected: 0 };
  const response = await fetch("/api/vision-runtime/offline/reconcile", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    },
    body: JSON.stringify({ sessionId, events: pending }),
  });
  const body = (await response.json()) as {
    error?: string;
    results?: Array<{ eventId: string; status: string }>;
  };
  if (!response.ok) throw new Error(body.error ?? "Pending Vision results could not reconnect.");
  const terminalIds = new Set(
    (body.results ?? [])
      .filter((result) => ["SYNCED", "CONFLICT", "REJECTED"].includes(result.status))
      .map((result) => result.eventId),
  );
  write(pending.filter((event) => !terminalIds.has(event.eventId)));
  return {
    synced: (body.results ?? []).filter((result) => result.status === "SYNCED").length,
    conflicts: (body.results ?? []).filter((result) => result.status === "CONFLICT").length,
    rejected: (body.results ?? []).filter((result) => result.status === "REJECTED").length,
  };
}
