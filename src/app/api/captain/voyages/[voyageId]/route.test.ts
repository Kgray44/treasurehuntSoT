import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorization: vi.fn(), projection: vi.fn(), events: vi.fn() }));
vi.mock("@/chronicle/captain-authorization", () => ({ requireCaptainSession: mocks.authorization }));
vi.mock("@/helm/operations", () => ({
  getCaptainVoyageProjection: mocks.projection,
  getCaptainOperationalEvents: mocks.events,
}));

import { GET as getVoyage } from "./route";
import { GET as getCrew } from "./crew/route";
import { GET as getEvents } from "./events/route";

const context = { params: Promise.resolve({ voyageId: "voyage-1" }) };
const authorization = {
  session: { accountId: "account-1" },
  actor: { accountId: "account-1", legacyGameMasterId: null },
  playthrough: { id: "voyage-1" },
};
const projection = {
  voyage: { computedAt: "2026-08-10T20:00:00.000Z" },
  crew: [{ id: "membership-1", displayName: "Safe Crew" }],
  events: [],
};

describe("Helm Phase 2 Captain operational routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue(authorization);
    mocks.projection.mockResolvedValue(projection);
    mocks.events.mockResolvedValue({ events: [], nextCursor: null });
  });

  it("denies direct Voyage and crew reads before executing a projection", async () => {
    mocks.authorization.mockResolvedValue(null);
    expect((await getVoyage(new Request("https://example.test/api/captain/voyages/voyage-1"), context)).status).toBe(
      403,
    );
    expect((await getCrew(new Request("https://example.test/api/captain/voyages/voyage-1/crew"), context)).status).toBe(
      403,
    );
    expect(mocks.projection).not.toHaveBeenCalled();
  });

  it("binds every projection to the Voyage-scoped Captain actor", async () => {
    const response = await getVoyage(new Request("https://example.test/api/captain/voyages/voyage-1"), context);
    expect(response.status).toBe(200);
    expect(mocks.projection).toHaveBeenCalledWith("voyage-1", authorization.actor);
    expect(await response.json()).toEqual(projection);
  });

  it("returns only the dedicated crew projection", async () => {
    const response = await getCrew(new Request("https://example.test/api/captain/voyages/voyage-1/crew"), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      voyageId: "voyage-1",
      crew: projection.crew,
      computedAt: projection.voyage.computedAt,
    });
  });

  it("guards event reads and accepts only safe event categories", async () => {
    const invalid = await getEvents(
      new Request("https://example.test/api/captain/voyages/voyage-1/events?category=PRIVATE"),
      context,
    );
    expect(invalid.status).toBe(400);
    expect(mocks.events).not.toHaveBeenCalled();

    const valid = await getEvents(
      new Request("https://example.test/api/captain/voyages/voyage-1/events?category=PROGRESSION&cursor=event-7"),
      context,
    );
    expect(valid.status).toBe(200);
    expect(mocks.events).toHaveBeenCalledWith("voyage-1", "event-7", "PROGRESSION");
  });
});
