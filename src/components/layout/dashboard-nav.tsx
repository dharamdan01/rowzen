"use client";

import { Suspense, useEffect, useRef, useState, type MouseEventHandler, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Database, FileCheck2, FolderOpen, LayoutDashboard, Menu, X } from "lucide-react";
import ThemeSelector from "../theme/theme-selector";
import SignOutButton from "../auth/sign-out-button";
import RowzenBrand from "../brand/rowzen-brand";
import { Button, Drawer } from "../ui/primitives";
import AccountMenu from "./account-menu";
import { trapDialogFocus } from "../ui/dialog-focus";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderOpen },
  { label: "CSV Workspace", href: "/upload", icon: Database },
  { label: "Results", href: "/results", icon: FileCheck2 },
];

function NavigationLinks({ pathname, onNavigate }: {
  pathname: string;
  onNavigate?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return navItems.map(({ label, href, icon: Icon }) => {
    const isActive = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        className={`relative flex min-h-control items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 motion-reduce:transition-none ${
          isActive
            ? "bg-info-surface font-semibold text-primary before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
            : "font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        }`}
      >
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        {label}
      </Link>
    );
  });
}

export function MobileNavigation({ pathname }: { pathname: string }) {
  const drawer = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const dismiss = () => {
      if (!media.matches || !drawer.current?.open) return;
      drawer.current.close();
      document.querySelector<HTMLElement>('nav[aria-label="Dashboard navigation"] [aria-current="page"]')?.focus();
    };
    media.addEventListener("change", dismiss);
    return () => media.removeEventListener("change", dismiss);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <div className="lg:hidden">
    <Button type="button" aria-label="Navigation" aria-controls="mobile-dashboard-navigation" aria-haspopup="dialog" aria-expanded={open}
      className="min-w-11 px-2.5" onClick={() => { drawer.current?.showModal(); setOpen(true); }}>
      <Menu aria-hidden="true" className="size-5" />
    </Button>
    <Drawer ref={drawer} id="mobile-dashboard-navigation" aria-labelledby="mobile-navigation-title" tabIndex={-1} onClose={() => setOpen(false)} onKeyDown={trapDialogFocus}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
      }}>
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <h2 id="mobile-navigation-title" className="text-base font-semibold">Workspace navigation</h2>
        <Button autoFocus type="button" aria-label="Close navigation" className="min-w-11 px-2.5" onClick={() => drawer.current?.close()}><X aria-hidden="true" className="size-5" /></Button>
      </div>
      <nav aria-label="Mobile dashboard navigation" className="mt-5 space-y-1">
        <NavigationLinks pathname={pathname} onNavigate={() => drawer.current?.close()} />
      </nav>
    </Drawer>
  </div>;
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const currentPage = navItems.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
  const isSummary = pathname.startsWith("/results/");
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-h-11 flex-wrap items-center gap-x-2 text-sm">
        {currentPage?.href !== "/dashboard" && (
          <li className="flex items-center gap-2">
            <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-md text-muted-foreground underline-offset-4 hover:text-primary hover:underline">Dashboard</Link>
            <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
          </li>
        )}
        {isSummary && (
          <li className="flex items-center gap-2">
            <Link href="/results" className="inline-flex min-h-11 items-center rounded-md text-muted-foreground underline-offset-4 hover:text-primary hover:underline">Results</Link>
            <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
          </li>
        )}
        <li aria-current="page" className="font-medium text-foreground [overflow-wrap:anywhere]">
          {isSummary ? "Saved summary" : currentPage?.label ?? "Workspace"}
        </li>
      </ol>
    </nav>
  );
}

// Keep the presentation usable in isolation; the wrapper below owns route context.
export function DashboardShellNavigation({ pathname, accountAction }: {
  pathname: string;
  accountAction: ReactNode;
}) {
  return (
    <>
      <a href="#dashboard-content" className="sr-only z-50 rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <aside aria-label="Workspace sidebar" className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto border-r border-border bg-sidebar lg:flex">
        <RowzenBrand href="/dashboard" className="flex min-h-16 shrink-0 items-center gap-3 border-b border-border px-6 text-base font-semibold tracking-tight text-foreground" />
        <div className="px-3 py-5">
          <p className="mb-3 px-3 text-xs font-medium text-muted-foreground">Workspace</p>
          <nav aria-label="Dashboard navigation" className="space-y-1">
            <NavigationLinks pathname={pathname} />
          </nav>
        </div>
        <p className="mt-auto border-t border-border px-6 py-5 text-sm leading-relaxed text-muted-foreground">
          Rehearse your CSV imports before making database changes.
        </p>
      </aside>
      <header className="relative border-b border-border bg-surface lg:ml-64">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <MobileNavigation key={pathname} pathname={pathname} />
            <RowzenBrand href="/dashboard" className="inline-flex min-h-11 min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-base" />
          </div>
          <div className="hidden min-w-0 lg:block"><Breadcrumbs pathname={pathname} /></div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3"><div className="hidden lg:block"><ThemeSelector /></div><AccountMenu>{accountAction}</AccountMenu></div>
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 pb-3 sm:px-6 lg:hidden"><Breadcrumbs pathname={pathname} /><ThemeSelector /></div>
      </header>
    </>
  );
}

function RouteDashboardNav() {
  const pathname = usePathname();
  return <DashboardShellNavigation pathname={pathname} accountAction={<SignOutButton />} />;
}

export default function DashboardNav() {
  // Unknown report IDs suspend usePathname during partial prerendering.
  return <Suspense fallback={<DashboardShellNavigation pathname="" accountAction={<SignOutButton />} />}>
    <RouteDashboardNav />
  </Suspense>;
}
