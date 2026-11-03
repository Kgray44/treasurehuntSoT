import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ChronicleLensDeviceLab } from "@/components/player/parallax/ChronicleLens";
import { NativeDeviceLabSpatialAdapter } from "@/parallax/native-device-lab";

// Bundled only by the owned Device Lab loopback host. This is never a route or
// a runtime switch in the released Player. Production rejects synthetic receipts.
async function main() {
  const config = await (await fetch("/lab/scene", { cache: "no-store" })).json();
  function Journey() {
    const [open, setOpen] = useState(false);
    return (
      <main>
        <h1>Synthetic Device Lab Voyage</h1>
        <p>Camera-free native input verification. No physical tracking or owner acceptance.</p>
        <button id="parallax.lab.open" onClick={() => setOpen(true)}>
          Open camera-free Lens
        </button>
        {open && (
          <ChronicleLensDeviceLab
            moment={config.moment}
            binding={config.binding}
            replayOnly={false}
            createAdapter={(selected) => new NativeDeviceLabSpatialAdapter(selected)}
            loadBinding={async () => (await fetch("/lab/scene", { cache: "no-store" })).json()}
            record={async (receipt) => {
              const response = await fetch("/lab/inspect", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-csrf-token": config.csrf },
                body: JSON.stringify(receipt),
              });
              if (!response.ok)
                throw new Error(
                  "Camera-free simulation cannot record a real native observation. Your Voyage progress has not changed.",
                );
            }}
            onClose={() => setOpen(false)}
          />
        )}
      </main>
    );
  }
  createRoot(document.getElementById("root")!).render(<Journey />);
  await fetch("/lab/client-ready", { method: "POST" });
}
void main().catch(() => fetch("/lab/client-failed", { method: "POST" }));
