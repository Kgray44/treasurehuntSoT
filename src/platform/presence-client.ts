"use client";

const deviceKey = "platform-membership-presence-device-v1";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/** A browser-local, opaque instance token. It is neither a person identifier nor
 * a cross-site tracker, and it is only sent to the authenticated Voyage endpoint. */
export function membershipPresenceDeviceId() {
  const current = window.localStorage.getItem(deviceKey);
  if (current && uuidPattern.test(current)) return current;
  const next = crypto.randomUUID();
  window.localStorage.setItem(deviceKey, next);
  return next;
}
