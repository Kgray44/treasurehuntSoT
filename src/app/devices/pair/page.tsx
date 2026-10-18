import { CrossdeckDevices } from "@/components/crossdeck/CrossdeckDevices";
import Link from "next/link";
export const metadata = { title: "Connect your device · Voyagewright", referrer: "no-referrer" };
export default function PairDevicePage() {
  return (
    <main aria-labelledby="device-connections-heading">
      <h1 id="device-connections-heading">Connect your device</h1>
      <p>
        <Link href="/devices/reach">Find the Hand interaction laboratory</Link>
      </p>
      <CrossdeckDevices />
    </main>
  );
}
