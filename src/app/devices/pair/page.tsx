import { CrossdeckDevices } from "@/components/crossdeck/CrossdeckDevices";
import Link from "next/link";
export const metadata = { title: "Connect your device · Voyagewright", referrer: "no-referrer" };
export default function PairDevicePage() {
  return (
    <main aria-label="Device connections">
      <p>
        <Link href="/devices/reach">Find the Hand interaction laboratory</Link>
      </p>
      <CrossdeckDevices pairing />
    </main>
  );
}
