"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavItem = Readonly<{ href: string; label: string; shortLabel: string }>;

export function AdminNav({ items }: { items: readonly AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="chartroom-nav" aria-label="Admiralty navigation">
      {items.map((item) => {
        const current = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={current ? "current" : undefined}
          >
            <span className="chartroom-nav__full">{item.label}</span>
            <span className="chartroom-nav__short">{item.shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
