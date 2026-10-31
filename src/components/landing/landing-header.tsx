"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import ThemeSelector from "../theme/theme-selector";
import { Brand, GetStartedLink } from "./landing-links";

const sections = [["Features", "#features"], ["How It Works", "#how-it-works"], ["Privacy", "#privacy"], ["Try Demo", "/rehearsal"]] as const;
const linkStyle = "inline-flex min-h-11 items-center rounded-md text-sm font-medium text-muted-foreground hover:text-foreground";

export default function LandingHeader() {
  return <header className="sticky top-0 z-40 border-b border-border bg-surface">
    <div className="relative mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
      <Brand />
      <nav aria-label="Homepage sections" className="hidden items-center gap-7 lg:flex">
        {sections.map(([label,href]) => <a key={href} href={href} className={linkStyle}>{label}</a>)}
      </nav>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <ThemeSelector />
        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/login" className={linkStyle}>Sign in</Link>
          <GetStartedLink />
        </div>
        <details className="group lg:hidden" onKeyDown={event => {
          if(event.key === "Escape" && event.currentTarget.open) {
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
            event.preventDefault();
          }
        }}>
          <summary aria-controls="landing-mobile-navigation" className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-control-border bg-surface text-foreground hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
            <span className="sr-only">Open navigation</span><Menu aria-hidden="true" className="size-4 group-open:hidden" /><X aria-hidden="true" className="hidden size-4 group-open:block" />
          </summary>
          <nav id="landing-mobile-navigation" aria-label="Mobile homepage navigation" className="absolute inset-x-4 top-full mt-2 grid gap-1 rounded-xl border border-border bg-surface p-3 shadow-sm" onClick={event => {
            if((event.target as HTMLElement).closest("a")) event.currentTarget.closest("details")!.open = false;
          }}>
            {sections.map(([label,href]) => <a key={href} href={href} className={`${linkStyle} px-3`}>{label}</a>)}
            <Link href="/login" className={`${linkStyle} border-t border-border px-3`}>Sign in</Link>
            <GetStartedLink />
          </nav>
        </details>
      </div>
    </div>
  </header>;
}
