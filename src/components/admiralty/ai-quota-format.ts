import { USD_NANO } from "@/parallax/ai-policy";
export function parseUSDNano(value: string) {
  if (!/^\d+(?:\.\d{0,9})?$/.test(value)) return NaN;
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(whole) * BigInt(USD_NANO) + BigInt(fraction.padEnd(9, "0"));
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : NaN;
}
