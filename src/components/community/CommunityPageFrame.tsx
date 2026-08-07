import Link from "next/link";
import { communityDistrict, type CommunityDistrictId } from "@/community/districts";
import { CommunityDistrictNavigator } from "./CommunityDistrictNavigator";

export function CommunityPageFrame({
  districtId,
  title,
  description,
  children,
  eyebrow = "Community Harbor",
}: {
  districtId: CommunityDistrictId;
  title: string;
  description: string;
  children: React.ReactNode;
  eyebrow?: string;
}) {
  const district = communityDistrict(districtId);
  return (
    <main className="community-harbor" data-community-district={district.id}>
      <header className="community-hero">
        <div className="community-hero__copy">
          <p className="community-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {districtId !== "HARBOR_HOME" ? (
          <Link className="community-return" href="/community">
            <span aria-hidden="true">←</span> Harbor Home
          </Link>
        ) : (
          <p className="community-hero__privacy">Only safe, published Community records appear here.</p>
        )}
      </header>
      <CommunityDistrictNavigator />
      <div className="community-content">{children}</div>
    </main>
  );
}
