/** Only the public synthetic Journal entry control can become an OS touch target. */
export function nativeJournalOpeningTouch(xml: string) {
  if (xml.length > 262144) throw new Error("NATIVE_OPENING_HIERARCHY_TOO_LARGE");
  const candidates = [...xml.matchAll(/<node\b([^>]+)>/g)].filter((match) => {
    const attr = (key: string) => new RegExp(`(?:^|\\s)${key}="([^"]*)"`).exec(match[1])?.[1] ?? "";
    return (
      attr("package") === "com.voyagewright.landfall" &&
      attr("class") === "android.widget.Button" &&
      attr("clickable") === "true" &&
      attr("enabled") === "true" &&
      [attr("text"), attr("content-desc")].some((copy) => copy.length <= 160 && copy.includes("Open the journal"))
    );
  });
  if (candidates.length !== 1) throw new Error("NATIVE_OPENING_CONTROL_UNOBSERVED_OR_AMBIGUOUS");
  const bounds = /(?:^|\s)bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(candidates[0][1]);
  if (!bounds) throw new Error("NATIVE_OPENING_BOUNDS_UNOBSERVED");
  const [left, top, right, bottom] = bounds.slice(1).map(Number);
  if (right <= left || bottom <= top || right > 4096 || bottom > 4096) throw new Error("NATIVE_OPENING_BOUNDS_INVALID");
  return { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) };
}
