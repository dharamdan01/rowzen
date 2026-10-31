import type { Metadata } from "next";
import Link from "next/link";
import "../components/landing/landing.css";
import { ArrowDown, ArrowUpRight, Columns3, FileCheck2, Undo2 } from "lucide-react";
import LandingHeader from "../components/landing/landing-header";
import { Brand, GetStartedLink } from "../components/landing/landing-links";
import ProductPreview from "../components/landing/product-preview";
import ProductScreenshot from "../components/landing/product-screenshot";
import AiShowcase from "../components/landing/ai-showcase";

const description = "Map CSV columns, run preflight validation, review and correct issues, and export locally. Rowzen does not execute database imports.";
export const metadata: Metadata = {
  title: { absolute: "CSV validation | Rowzen" }, description,
  openGraph: { title: "Rowzen — Catch data issues before import.", description, type: "website" },
  twitter: { card: "summary", title: "Rowzen — CSV preflight workspace", description },
};
const container = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
const sectionTitle = "max-w-2xl scroll-mt-24 text-2xl font-semibold tracking-tight sm:text-3xl";
const textLink = "inline-flex min-h-11 items-center rounded-md text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";
const steps = [
  ["Upload", "Select your CSV files. Records stay in browser memory."],
  ["Configure", "Apply column mappings, types, keys and rules."],
  ["Validate", "Run deterministic checks against those rules."],
  ["Review", "Inspect issues, dependencies and your schema diagram."],
  ["Correct", "Preview supported changes, approve edits and revalidate."],
  ["Export", "Download reports, corrected CSVs or supported database artifacts."],
] as const;
const features = [
  { icon: Columns3, title: "Validate what matters", description: "Define what each column means before checking it.", details: "Apply types, required fields, primary and unique keys. Keep complete foreign-key relationships visible in the schema diagram." },
  { icon: FileCheck2, title: "Understand the findings", description: "Review findings in the context of your actual CSV files.", details: "Locate invalid values, duplicate keys and missing references. Trace issues to the affected records and relationships." },
  { icon: Undo2, title: "Correct with confidence", description: "Compare a correction before committing to it.", details: "Use deterministic What-if results, explicit approval, Undo/Redo and activity history. AI advice never replaces validation or business judgment." },
] as const;

export default function HomePage() {
  return <div data-landing-page className="min-w-0 bg-background text-foreground">
    <a href="#landing-main" className="sr-only z-50 rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
    <LandingHeader />
    <main id="landing-main" tabIndex={-1}>
      <section aria-labelledby="landing-title" className={container + " grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_1.12fr] lg:gap-16 lg:py-24"}>
        <div className="rz-hero-copy">
          <p className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><span aria-hidden="true" className="h-4 w-0.5 rounded-full bg-primary" />The CSV preflight workspace</p>
          <h1 id="landing-title" className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl xl:text-6xl">Catch data issues before import.</h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">Map your columns. Check your rules. Review and correct issues before your CSV data reaches a database.</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <GetStartedLink />
            <Link href="/rehearsal" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-control-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-surface-muted motion-reduce:transition-none">Try live demo<ArrowUpRight aria-hidden="true" className="size-4" /></Link>
          </div>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">Preflight checks and local exports. No database import is run.</p>
          <a href="#how-it-works" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:underline">See How It Works<ArrowDown aria-hidden="true" className="size-4" /></a>
        </div>
        <figure className="rz-hero-preview min-w-0 rounded-2xl border border-border bg-surface-muted p-3 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Inside a validation run</span><span>Demo capture · sample CSV data</span></div>
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <a href="#product-preview" className="block" aria-label="Explore the actual Rowzen interface screenshots">
              <ProductScreenshot name="overview" eager alt="Actual sample report excerpt showing blocked migration readiness and validation counts." />
            </a>
          </div>
          <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Real checks on sample students and departments.</span>
            <a href="#product-preview" className="inline-flex min-h-11 items-center gap-1 rounded-md font-medium text-primary hover:underline">Explore the interface<ArrowUpRight aria-hidden="true" className="size-3.5" /></a>
          </figcaption>
        </figure>
      </section>

      <AiShowcase />

      <section aria-labelledby="features" className="border-y border-border bg-surface py-12 sm:py-16">
        <div className={container}>
          <p className="mb-3 text-sm font-medium text-muted-foreground">A clearer path through messy data</p>
          <h2 id="features" tabIndex={-1} className={sectionTitle}>From uncertain rows to informed decisions.</h2>
          <div className="mt-9 grid gap-8 md:grid-cols-3 md:gap-10">
            {features.map(({ icon: Icon, title, description, details }) => <div key={title} className="border-t border-border pt-6">
              <Icon aria-hidden="true" className="mb-5 size-5 text-primary" />
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed">{description}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{details}</p>
            </div>)}
          </div>
        </div>
      </section>

      <section aria-labelledby="product-preview" className={container + " py-12 sm:py-16"}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-3 text-sm font-medium text-muted-foreground">See the work behind the result</p><h2 id="product-preview" tabIndex={-1} className={sectionTitle}>Inspect. Compare. Decide.</h2></div>
          <Link href="/rehearsal" className={textLink + " gap-2 text-primary"}>Try the CSV demo<ArrowUpRight aria-hidden="true" className="size-4" /></Link>
        </div>
        <ProductPreview />
      </section>

      <section aria-labelledby="how-it-works" className="border-y border-border bg-surface py-12 sm:py-16">
        <div className={container + " grid gap-8 lg:grid-cols-[0.65fr_1.35fr] lg:gap-16"}>
          <div><p className="mb-3 text-sm font-medium text-muted-foreground">One guided workspace</p><h2 id="how-it-works" tabIndex={-1} className={sectionTitle}>Six steps.<br />You stay in control.</h2><p className="mt-5 text-sm leading-relaxed text-muted-foreground">Work through your files at your pace. Review and approve each change.</p></div>
          <ol role="list" className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {steps.map(([title, detail], index) => <li key={title} className="flex gap-4 border-t border-border pt-5">
              <span aria-hidden="true" className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
              <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p></div>
            </li>)}
          </ol>
        </div>
      </section>

      <section aria-labelledby="privacy" className={container + " grid gap-8 py-12 sm:py-16 lg:grid-cols-[0.65fr_1.35fr] lg:gap-16"}>
        <div><p className="mb-3 text-sm font-medium text-muted-foreground">Clear boundaries, by design</p><h2 id="privacy" tabIndex={-1} className={sectionTitle}>Your files.<br />Your next move.</h2><p className="mt-5 text-sm leading-relaxed text-muted-foreground">Know what stays local, what gets saved and what still needs verification.</p></div>
        <dl className="divide-y divide-border text-sm">
          <div className="pb-5"><dt className="font-medium">CSV processing stays in browser memory</dt><dd className="mt-2 leading-relaxed text-muted-foreground">Records are parsed, validated and corrected locally. AI requests include only the metadata you approve; raw CSV records and correction history stay in your browser.</dd></div>
          <div className="py-5"><dt className="font-medium">Saved summaries are not CSV backups</dt><dd className="mt-2 leading-relaxed text-muted-foreground">Saving a project summary stores counts and status, not raw records. Mapping templates store configuration. Leaving or refreshing discards browser-memory CSV data.</dd></div>
          <div className="py-5"><dt className="font-medium">Exports are files you control</dt><dd className="mt-2 leading-relaxed text-muted-foreground">Download corrected CSVs, reports, schema SVGs and supported PostgreSQL, MySQL or MongoDB artifacts. Database record exports require your explicit consent.</dd></div>
          <div className="pt-5"><dt className="font-medium">Preflight validation, not a database import</dt><dd className="mt-2 leading-relaxed text-muted-foreground">Rowzen does not connect to your target database or execute imports. Passing configured checks does not guarantee database compatibility or business correctness.</dd></div>
        </dl>
      </section>

      <section aria-labelledby="get-started-title" className="border-t border-border bg-surface py-12 sm:py-16">
        <div className={container + " flex flex-wrap items-center justify-between gap-6"}>
          <div><h2 id="get-started-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">Clean data. Confident imports.</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Start with a CSV. Leave with a clearer plan.</p></div>
          <GetStartedLink />
        </div>
      </section>
    </main>
    <footer className="border-t border-border py-6">
      <div className={container + " flex flex-wrap items-center justify-between gap-5"}>
        <div><Brand /><p className="mt-2 text-xs text-muted-foreground">The CSV preflight workspace.</p></div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-1">
          <a href="#features" className={textLink}>Features</a><a href="#how-it-works" className={textLink}>How It Works</a><a href="#privacy" className={textLink}>Privacy</a><Link href="/rehearsal" className={textLink}>CSV demo</Link><Link href="/login" className={textLink}>Log in</Link>
        </nav>
      </div>
    </footer>
  </div>;
}
