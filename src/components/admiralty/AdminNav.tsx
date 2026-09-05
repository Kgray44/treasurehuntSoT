"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavItem = Readonly<{ href: string; label: string; shortLabel: string; group: string }>;

export function AdminNav({ items }: { items: readonly AdminNavItem[] }) {
  const pathname = usePathname();
  const groups = items.reduce<AdminNavItem[][]>((result, item) => {
    const existing = result.find((group) => group[0]?.group === item.group);
    if (existing) existing.push(item);
    else result.push([item]);
    return result;
  }, []);
  return (
    <nav className="chartroom-nav" aria-label="Admiralty navigation">
      <details open>
        <summary>Stations</summary>
        <div className="chartroom-nav__groups">
          {groups.map((group) => (
            <section key={group[0]!.group} aria-label={group[0]!.group}>
              <strong>{group[0]!.group}</strong>
              <div>
                {group.map((item) => {
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
              </div>
            </section>
          ))}
        </div>
      </details>
    </nav>
  );
}
