// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase3.field-context
import { describe, expect, it, vi } from "vitest";
import { BrowserCameraBroker } from "./camera";

function cameraTrack(kind: "video" | "audio" = "video", readyState = "live") {
  const track = Object.assign(new EventTarget(), {
    kind,
    readyState,
    stop: vi.fn(() => {
      track.readyState = "ended";
    }),
  });
  return track;
}
type TestTrack = ReturnType<typeof cameraTrack>;
function cameraStream(tracks: TestTrack[] = [cameraTrack()]) {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
  } as unknown as MediaStream;
}
function media() {
  return { getUserMedia: vi.fn(async () => cameraStream()) };
}

describe("generic externally acquired camera reservation", () => {
  it("requires explicit foreground consent and a supported camera before reserving", () => {
    const devices = media(),
      stopSource = vi.fn(),
      broker = new BrowserCameraBroker(devices);
    expect(() => broker.reserveExternal(false, true, stopSource)).toThrow("FOREGROUND_CONSENT_REQUIRED");
    expect(() => broker.reserveExternal(true, false, stopSource)).toThrow("FOREGROUND_CONSENT_REQUIRED");
    expect(devices.getUserMedia).not.toHaveBeenCalled();
    expect(stopSource).not.toHaveBeenCalled();
    expect(() => new BrowserCameraBroker(null).reserveExternal(true, true)).toThrow("CAMERA_UNSUPPORTED");
    broker.reserveExternal(true, true, stopSource).release();
    expect(stopSource).toHaveBeenCalledOnce();
  });

  it("reserves exclusivity across broker instances before an SDK can acquire, without requesting another stream", async () => {
    const devices = media(),
      broker = new BrowserCameraBroker(devices),
      competing = new BrowserCameraBroker(devices);
    const reservation = broker.reserveExternal(true, true);
    expect(broker.state).toBe("REQUESTING");
    expect(() => broker.reserveExternal(true, true)).toThrow("CAMERA_EXCLUSIVE_LEASE_BUSY");
    expect(() => competing.reserveExternal(true, true)).toThrow("CAMERA_EXCLUSIVE_LEASE_BUSY");
    await expect(broker.acquire(true, true)).rejects.toThrow("CAMERA_EXCLUSIVE_LEASE_BUSY");
    await expect(competing.acquire(true, true)).rejects.toThrow("CAMERA_EXCLUSIVE_LEASE_BUSY");
    expect(devices.getUserMedia).not.toHaveBeenCalled();
    reservation.release();
    const ordinaryLease = await competing.acquire(true, true);
    expect(devices.getUserMedia).toHaveBeenCalledOnce();
    ordinaryLease.release();
  });

  it("cannot reserve while the ordinary broker acquisition is pending", async () => {
    let resolve!: (stream: MediaStream) => void;
    const devices = {
      getUserMedia: vi.fn(
        () =>
          new Promise<MediaStream>((done) => {
            resolve = done;
          }),
      ),
    };
    const broker = new BrowserCameraBroker(devices),
      competing = new BrowserCameraBroker(devices);
    const acquisition = broker.acquire(true, true);
    expect(() => broker.reserveExternal(true, true)).toThrow("CAMERA_EXCLUSIVE_LEASE_BUSY");
    expect(() => competing.reserveExternal(true, true)).toThrow("CAMERA_EXCLUSIVE_LEASE_BUSY");
    resolve(cameraStream());
    const lease = await acquisition;
    expect(() => competing.reserveExternal(true, true)).toThrow("CAMERA_EXCLUSIVE_LEASE_BUSY");
    lease.release();
  });

  it("adopts the SDK's exact stream once and tears down its source and track idempotently", () => {
    const devices = media(),
      broker = new BrowserCameraBroker(devices),
      stopSource = vi.fn();
    const reservation = broker.reserveExternal(true, true, stopSource),
      track = cameraTrack(),
      stream = cameraStream([track]);
    const lease = reservation.adopt(stream);
    expect(lease.stream).toBe(stream);
    expect(reservation.adopt(stream)).toBe(lease);
    expect(broker.snapshot()).toMatchObject({ permission: "GRANTED", availability: "READY", leaseId: lease.id });
    expect(broker.ownedTracks).toBe(1);
    expect(devices.getUserMedia).not.toHaveBeenCalled();
    lease.release();
    lease.release();
    reservation.release();
    broker.release();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(stopSource).toHaveBeenCalledOnce();
    expect(broker.ownedTracks).toBe(0);
  });

  it("cancels pending SDK acquisition on suspension and stops a late stream", () => {
    const broker = new BrowserCameraBroker(media()),
      stopSource = vi.fn();
    const reservation = broker.reserveExternal(true, true, stopSource),
      track = cameraTrack();
    broker.release("SUSPENDED");
    expect(stopSource).toHaveBeenCalledOnce();
    expect(() => reservation.adopt(cameraStream([track]))).toThrow("CAMERA_REQUEST_CANCELLED");
    expect(track.stop).toHaveBeenCalledOnce();
    expect(broker.snapshot()).toMatchObject({ availability: "SUSPENDED", leaseId: null });
    reservation.release();
    expect(stopSource).toHaveBeenCalledOnce();
  });

  it("keeps a newer session intact when old tokens release or deliver late streams", () => {
    const devices = media(),
      broker = new BrowserCameraBroker(devices),
      stopOld = vi.fn(),
      stopNew = vi.fn();
    const old = broker.reserveExternal(true, true, stopOld);
    old.release();
    const current = broker.reserveExternal(true, true, stopNew),
      currentTrack = cameraTrack();
    const currentStream = cameraStream([currentTrack]),
      lease = current.adopt(currentStream);
    const generation = broker.generation,
      stray = cameraTrack();
    old.release();
    expect(() => old.adopt(cameraStream([stray]))).toThrow("CAMERA_REQUEST_CANCELLED");
    expect(stray.stop).toHaveBeenCalledOnce();
    expect(() => old.adopt(currentStream)).toThrow("CAMERA_REQUEST_CANCELLED");
    expect(currentTrack.stop).not.toHaveBeenCalled();
    expect(broker.generation).toBe(generation);
    expect(broker.snapshot().leaseId).toBe(lease.id);
    expect(stopOld).toHaveBeenCalledOnce();
    expect(stopNew).not.toHaveBeenCalled();
    current.release();
    expect(stopNew).toHaveBeenCalledOnce();
  });

  it("keeps another broker's newer adopted stream intact after a late callback", () => {
    const devices = media(),
      oldBroker = new BrowserCameraBroker(devices),
      nextBroker = new BrowserCameraBroker(devices);
    const old = oldBroker.reserveExternal(true, true);
    old.release();
    const next = nextBroker.reserveExternal(true, true),
      track = cameraTrack(),
      stream = cameraStream([track]);
    const lease = next.adopt(stream);
    expect(() => old.adopt(stream)).toThrow("CAMERA_REQUEST_CANCELLED");
    expect(track.stop).not.toHaveBeenCalled();
    expect(nextBroker.snapshot().leaseId).toBe(lease.id);
    next.release();
  });

  it.each([
    { name: "no tracks", tracks: () => [] },
    { name: "audio only", tracks: () => [cameraTrack("audio")] },
    { name: "ended video", tracks: () => [cameraTrack("video", "ended")] },
    { name: "video and audio", tracks: () => [cameraTrack(), cameraTrack("audio")] },
    { name: "two video tracks", tracks: () => [cameraTrack(), cameraTrack()] },
  ])("refuses $name, stops its source and releases the global reservation", ({ tracks: createTracks }) => {
    const devices = media(),
      broker = new BrowserCameraBroker(devices),
      stopSource = vi.fn();
    const reservation = broker.reserveExternal(true, true, stopSource),
      tracks = createTracks();
    expect(() => reservation.adopt(cameraStream(tracks))).toThrow("CAMERA_VIDEO_TRACK_REQUIRED");
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledOnce());
    expect(stopSource).toHaveBeenCalledOnce();
    expect(broker.snapshot()).toMatchObject({ availability: "ERROR", leaseId: null });
    reservation.release();
    expect(stopSource).toHaveBeenCalledOnce();
    new BrowserCameraBroker(devices).reserveExternal(true, true).release();
  });

  it("releases an ended SDK source and ignores its old event/lease after a replacement starts", () => {
    const broker = new BrowserCameraBroker(media()),
      stopSource = vi.fn();
    const reservation = broker.reserveExternal(true, true, stopSource),
      track = cameraTrack();
    const lease = reservation.adopt(cameraStream([track]));
    track.readyState = "ended";
    track.dispatchEvent(new Event("ended"));
    expect(broker.snapshot()).toMatchObject({ availability: "SUSPENDED", permission: "UNKNOWN", leaseId: null });
    expect(stopSource).toHaveBeenCalledOnce();
    const replacement = broker.reserveExternal(true, true),
      replacementLease = replacement.adopt(cameraStream());
    track.dispatchEvent(new Event("ended"));
    lease.release();
    expect(broker.snapshot().leaseId).toBe(replacementLease.id);
    replacement.release();
  });

  it("rejects a track that ends during listener attachment and releases the source", () => {
    const broker = new BrowserCameraBroker(media()),
      stopSource = vi.fn(),
      track = cameraTrack();
    vi.spyOn(track, "addEventListener").mockImplementation((_name, callback) => {
      track.readyState = "ended";
      (callback as EventListener)(new Event("ended"));
    });
    const reservation = broker.reserveExternal(true, true, stopSource);
    expect(() => reservation.adopt(cameraStream([track]))).toThrow("CAMERA_SOURCE_ENDED_DURING_ACQUISITION");
    expect(stopSource).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(broker.snapshot()).toMatchObject({ availability: "SUSPENDED", leaseId: null });
  });

  it("rejects replacement streams under one token and stops both sources", () => {
    const broker = new BrowserCameraBroker(media()),
      stopSource = vi.fn();
    const reservation = broker.reserveExternal(true, true, stopSource),
      first = cameraTrack(),
      second = cameraTrack();
    reservation.adopt(cameraStream([first]));
    expect(() => reservation.adopt(cameraStream([second]))).toThrow("CAMERA_EXTERNAL_STREAM_ALREADY_ADOPTED");
    expect(first.stop).toHaveBeenCalledOnce();
    expect(second.stop).toHaveBeenCalledOnce();
    expect(stopSource).toHaveBeenCalledOnce();
    expect(broker.ownedTracks).toBe(0);
  });

  it("does not retain ownership when the SDK cleanup callback throws", () => {
    const devices = media(),
      broker = new BrowserCameraBroker(devices);
    const stopSource = vi.fn(() => {
      throw new Error("Synthetic source cleanup failure");
    });
    const reservation = broker.reserveExternal(true, true, stopSource);
    reservation.adopt(cameraStream());
    expect(() => reservation.release()).not.toThrow();
    reservation.release();
    expect(stopSource).toHaveBeenCalledOnce();
    new BrowserCameraBroker(devices).reserveExternal(true, true).release();
  });

  it("does not return an active token when foreground ownership is cancelled by the requesting notification", () => {
    const devices = media(),
      stopSource = vi.fn();
    const broker: BrowserCameraBroker = new BrowserCameraBroker(devices, (state) => {
      if (state === "REQUESTING") broker.release("SUSPENDED");
    });
    expect(() => broker.reserveExternal(true, true, stopSource)).toThrow("CAMERA_REQUEST_CANCELLED");
    expect(stopSource).toHaveBeenCalledOnce();
    expect(broker.snapshot()).toMatchObject({ availability: "SUSPENDED", leaseId: null });
    new BrowserCameraBroker(devices).reserveExternal(true, true).release();
  });
});
