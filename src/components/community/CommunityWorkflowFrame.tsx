import Link from "next/link";
import { CommunityPageFrame } from "./CommunityPageFrame";

/**
 * Private Community work needs the Harbor's visual and navigational lineage
 * without claiming that a draft is part of the public district projection.
 */
export function CommunityWorkflowFrame({
  title,
  description,
  children,
  backHref = "/community/voyage-logs",
  backLabel = "Voyage Logs",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <CommunityPageFrame
      districtId="VOYAGE_LOGS"
      eyebrow="Private Community workspace"
      title={title}
      description={description}
    >
      <nav className="community-workflow__breadcrumbs" aria-label="Private Community workspace location">
        <Link href="/community">Harbor Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/community/voyage-logs">Voyage Logs</Link>
        <span aria-hidden="true">/</span>
        <Link href={backHref}>{backLabel}</Link>
      </nav>
      <section className="community-workflow" data-community-workflow="private-voyage-log">
        <header className="community-workflow__intro">
          <p className="community-eyebrow">Private until publication checks pass</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </header>
        {children}
      </section>
    </CommunityPageFrame>
  );
}
