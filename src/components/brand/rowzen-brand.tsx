import Link from "next/link";

/** Original row/grid mark. Decorative beside the wordmark; named when used alone. */
export function RowzenIcon({ className = "size-5 shrink-0 text-primary", label }: { className?: string; label?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}
    role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
    {label && <title>{label}</title>}
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M3 9h18M3 14h8M9 4v16m4-3 2 2 5-5" />
  </svg>;
}

export default function RowzenBrand({ href = "/", className = "inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md text-sm font-semibold tracking-tight text-foreground sm:text-base" }: {
  href?: string; className?: string;
}) {
  return <Link href={href} className={className}><RowzenIcon /><span>Rowzen</span></Link>;
}
