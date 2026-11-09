import Link from "next/link";

export const metadata = {
  title: "Moved to the Hangar",
  robots: { index: false, follow: true },
};

// Old links (e.g. in sent outreach emails) still point here; real write-ups are the project pages.
// A static export can't send a 308, so redirect with a meta refresh that works without JavaScript.
export default function CaseStudiesPage() {
  return (
    <section className="pt-32 pb-24 px-4 text-center">
      <meta httpEquiv="refresh" content="0;url=/projects/" />
      <h1 className="font-mono text-2xl font-bold tracking-wider mb-4">MOVED</h1>
      <p className="text-text-secondary">
        Project write-ups are in the{" "}
        <Link href="/projects/" className="text-accent-orange underline">
          hangar
        </Link>
        .
      </p>
    </section>
  );
}
