import Link from "next/link";
export default function Page() {
  return (
    <main>
      <h1>Your Wayfarer roles</h1>
      <p>One account carries every role you have been granted.</p>
      <nav aria-label="Role destinations">
        <Link href="/player">Player voyages</Link>
        <Link href="/captain">Captain voyages</Link>
        <Link href="/studio">Creator Studio</Link>
      </nav>
    </main>
  );
}
