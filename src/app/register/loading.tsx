import { LoadingState } from "@/components/ui/AsyncState";

export default function RegistrationLoading() {
  return (
    <main className="platform-auth account-flow-page" aria-busy="true" aria-live="polite">
      <LoadingState title="Opening Sign Up" detail="Preparing secure account registration." />
    </main>
  );
}
