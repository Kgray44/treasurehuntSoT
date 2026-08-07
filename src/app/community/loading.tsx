import { LoadingState } from "@/components/ui/AsyncState";

export default function CommunityLoading() {
  return (
    <main className="community-harbor community-route-loading" aria-busy="true" aria-live="polite">
      <LoadingState
        title="Opening Community Harbor"
        detail="Gathering safe public Community records. Nothing private is used to fill this view."
      />
    </main>
  );
}
