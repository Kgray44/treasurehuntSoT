import { OfflineLandfallJournal } from "@/components/player/journal/OfflineLandfallJournal";

/** Public, data-free shell. The client requires a short-lived, previously authorized tab capability. */
export const dynamic = "force-static";
export default function OfflineLandfallPage() {
  return <OfflineLandfallJournal />;
}
