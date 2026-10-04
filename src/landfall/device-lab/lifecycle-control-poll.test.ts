import { describe, expect, it, vi } from "vitest";
import { DeviceLabLifecycleControlPoll } from "./lifecycle-control-poll";
describe("native lifecycle lab control polling", () => {
  it("recovers a read-only control request only after observed background and foreground", async () => {
    const poll = new DeviceLabLifecycleControlPoll(
      () => 0,
      async () => {},
    );
    poll.lifecycle("BACKGROUND");
    poll.lifecycle("FOREGROUND");
    const request = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network suspended"))
      .mockResolvedValue({ status: 204 });
    expect(await poll.next(request)).toEqual({ status: 204 });
    expect(request).toHaveBeenCalledTimes(2);
    await expect(
      poll.next(async () => {
        throw new TypeError("unrelated later failure");
      }),
    ).rejects.toThrow("unrelated later failure");
  });
  it("does not retry an unobserved transition, product exception or permanent outage", async () => {
    const request = vi.fn().mockRejectedValue(new TypeError("network unavailable"));
    const poll = new DeviceLabLifecycleControlPoll(
      () => 0,
      async () => {},
    );
    await expect(poll.next(request)).rejects.toThrow("network unavailable");
    expect(request).toHaveBeenCalledTimes(1);
    poll.lifecycle("BACKGROUND");
    poll.lifecycle("FOREGROUND");
    await expect(
      poll.next(async () => {
        throw new Error("product failure");
      }),
    ).rejects.toThrow("product failure");
    request.mockClear();
    await expect(poll.next(request)).rejects.toThrow("NATIVE_CONTROL_RESUME_RETRY_EXHAUSTED");
    expect(request).toHaveBeenCalledTimes(4);
  });
  it("requires actual foreground observation inside the recovery deadline", async () => {
    let now = 0;
    const poll = new DeviceLabLifecycleControlPoll(
      () => now,
      async (ms) => {
        now += ms;
      },
    );
    poll.lifecycle("BACKGROUND");
    const request = vi.fn().mockRejectedValue(new TypeError("network suspended"));
    await expect(poll.next(request)).rejects.toThrow("NATIVE_CONTROL_FOREGROUND_UNOBSERVED");
    expect(request).toHaveBeenCalledTimes(1);
    expect(now).toBe(15000);
  });
});
