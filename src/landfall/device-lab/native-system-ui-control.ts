/** An owned emulator may expose an Android System UI ANR. Only its observed Wait control is eligible. */
export function nativeSystemUiWaitTouch(xml: string): { x: number; y: number } | null {
  if (xml.length > 262144) throw new Error("NATIVE_SYSTEM_UI_HIERARCHY_TOO_LARGE");
  const nodes = [...xml.matchAll(/<node\b([^>]+)>/g)].map((match) => {
    const attr = (key: string) => new RegExp(`(?:^|\\s)${key}="([^"]*)"`).exec(match[1])?.[1] ?? "";
    return { attr, text: attr("text").replaceAll("&apos;", "'").replaceAll("&#39;", "'") };
  });
  const android = (node: (typeof nodes)[number]) => ["android", "com.android.systemui"].includes(node.attr("package"));
  const titles = nodes.filter((node) => android(node) && node.text === "System UI isn't responding");
  if (titles.length !== 1) return null;
  const controls = nodes.filter(
    (node) =>
      android(node) &&
      node.text === "Wait" &&
      node.attr("resource-id") === "android:id/aerr_wait" &&
      node.attr("clickable") === "true" &&
      node.attr("enabled") === "true",
  );
  if (controls.length !== 1) throw new Error("NATIVE_SYSTEM_UI_WAIT_CONTROL_UNOBSERVED");
  const bounds = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(controls[0].attr("bounds"));
  if (!bounds) throw new Error("NATIVE_SYSTEM_UI_WAIT_BOUNDS_INVALID");
  const [left, top, right, bottom] = bounds.slice(1).map(Number);
  if ([left, top, right, bottom].some((value) => value > 4096) || right <= left || bottom <= top)
    throw new Error("NATIVE_SYSTEM_UI_WAIT_BOUNDS_INVALID");
  return { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) };
}
