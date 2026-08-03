"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { visibleCommunityDistricts } from "@/community/districts";

export function CommunityDistrictNavigator() {
  const pathname = usePathname();
  return (
    <nav className="community-district-nav" aria-label="Community Harbor districts">
      <div className="community-district-nav__track">
        {visibleCommunityDistricts.map((district) => {
          const current =
            district.route === "/community"
              ? pathname === district.route
              : pathname === district.route || pathname.startsWith(`${district.route}/`);
          return (
            <Link
              key={district.id}
              href={district.route}
              aria-current={current ? "page" : undefined}
              data-district-id={district.id}
            >
              {district.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
