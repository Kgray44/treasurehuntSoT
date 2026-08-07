import Link from "next/link";

export function RoleEntryAdapter({
  title,
  description,
  signInHref,
  children,
}: {
  title: string;
  description: string;
  signInHref: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="platform-auth role-entry-adapter">
      <section className="auth-ledger">
        <p className="eyebrow">One Voyagewright account</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link className="brass-button" href={signInHref}>
          Continue to account sign-in
        </Link>
        {children}
        <p>
          <Link href="/register">Create Account</Link> or <Link href="/forgot-password">Forgot Password</Link>
        </p>
      </section>
    </main>
  );
}
