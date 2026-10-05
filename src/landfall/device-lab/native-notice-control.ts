/** A normal OS touch derived only from the observed generic Landfall notice.
 * No PendingIntent execution, handle extraction or synthetic notification. */
export function nativeLandfallNoticeTouch(xml: string) {
  if (xml.length > 262144) throw new Error("NATIVE_NOTICE_HIERARCHY_TOO_LARGE");
  const rows = [...xml.matchAll(/<node\b([^>]+)>/g)].flatMap((match) => {
    const attr = (key: string) => new RegExp(`(?:^|\\s)${key}="([^"]*)"`).exec(match[1])?.[1] ?? "";
    if (
      attr("package") !== "com.android.systemui" ||
      attr("enabled") !== "true" ||
      attr("text") !== "Your journey may be nearby"
    )
      return [];
    const bounds = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(attr("bounds"));
    if (!bounds) throw new Error("NATIVE_NOTICE_BOUNDS_UNOBSERVED");
    const [left, top, right, bottom] = bounds.slice(1).map(Number);
    if ([left, top, right, bottom].some((value) => value < 0 || value > 4096) || right <= left || bottom <= top)
      throw new Error("NATIVE_NOTICE_BOUNDS_INVALID");
    return [{ x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) }];
  });
  if (rows.length === 0) throw new Error("NATIVE_NOTICE_UNOBSERVED");
  if (rows.length !== 1) throw new Error("NATIVE_NOTICE_AMBIGUOUS");
  return rows[0];
}
