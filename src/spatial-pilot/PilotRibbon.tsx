import Link from "next/link";
import { PilotCompass } from "./Compass";
import styles from "./pilot.module.css";
export function PilotRibbon({ voyageId }: { voyageId: string }) {
  return (
    <aside className={styles.ribbon} aria-label="Navigator’s instruments">
      <nav aria-label="Navigator’s instruments">
        <Link href="/dev/spatial-pilot">Return to Owner Sea Trials</Link>
        <Link href={`/account/devices?voyage=${voyageId}`}>Voyage devices</Link>
      </nav>
      <PilotCompass />
    </aside>
  );
}
