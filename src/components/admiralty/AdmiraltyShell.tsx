import Link from "next/link";
import type { AdmiraltyCurrentOperator } from "@/admiralty/authorization";
import type { AdmiraltyCapabilityId } from "@/admiralty/capabilities";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { AdminNav, type AdminNavItem } from "./AdminNav";

const navigation: readonly (AdminNavItem & { any: readonly AdmiraltyCapabilityId[] })[] = [
  { href: "/admin", label: "Overview", shortLabel: "Overview", any: ["PLATFORM_OBSERVE"] },
  { href: "/admin/people", label: "People", shortLabel: "People", any: ["ACCOUNT_OBSERVE"] },
  { href: "/admin/support/cases", label: "Support cases", shortLabel: "Cases", any: ["SUPPORT_REQUEST"] },
  { href: "/admin/chronicles", label: "Chronicles", shortLabel: "Chronicles", any: ["CHRONICLE_OBSERVE"] },
  { href: "/admin/voyages", label: "Voyages", shortLabel: "Voyages", any: ["VOYAGE_OBSERVE"] },
  { href: "/admin/community", label: "Community", shortLabel: "Community", any: ["COMMUNITY_OBSERVE"] },
  { href: "/admin/operations", label: "Operations", shortLabel: "Ops", any: ["JOBS_OBSERVE"] },
  { href: "/admin/providers", label: "Providers", shortLabel: "Providers", any: ["CONTENT_OBSERVE"] },
  { href: "/admin/configuration", label: "Configuration", shortLabel: "Config", any: ["CONFIG_OBSERVE"] },
  { href: "/admin/releases", label: "Releases", shortLabel: "Releases", any: ["RELEASE_OBSERVE"] },
  { href: "/admin/audit", label: "Audit", shortLabel: "Audit", any: ["AUDIT_OBSERVE"] },
  { href: "/admin/investigate", label: "Investigate", shortLabel: "Investigate", any: ["PLATFORM_OBSERVE"] },
  { href: "/bridgewatch", label: "Bridgewatch", shortLabel: "Bridgewatch", any: ["PLATFORM_OBSERVE"] },
];

export function AdmiraltyShell({
  operator,
  children,
}: {
  operator: AdmiraltyCurrentOperator;
  children: React.ReactNode;
}) {
  const capabilities = new Set(operator.capabilities);
  const items = navigation.filter((item) => item.any.some((capability) => capabilities.has(capability)));
  return (
    <div className="chartroom">
      <a className="chartroom-skip" href="#chartroom-main">
        Skip to command center content
      </a>
      <header className="chartroom-masthead">
        <Link href="/admin" className="chartroom-brand">
          <span aria-hidden="true">✦</span>
          <span>
            <strong>Admiralty</strong>
            <small>Open the Chartroom</small>
          </span>
        </Link>
        <div className="chartroom-operator">
          <span>{operator.displayName}</span>
          <small>{operator.roles.join(" · ")}</small>
        </div>
        <div className="chartroom-actions">
          <Link href="/account">Return to account</Link>
          <SignOutButton />
        </div>
      </header>
      <AdminNav items={items} />
      <main id="chartroom-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="chartroom-footer">
        <p>Read-only command center · Phase 1 Support Access remains consented and audited.</p>
      </footer>
    </div>
  );
}
