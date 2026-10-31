import Link from "next/link";
import { ArrowRight } from "lucide-react";
import RowzenBrand from "../brand/rowzen-brand";

export function Brand() {
  return <RowzenBrand />;
}

export function GetStartedLink({ className = "" }: { className?: string }) {
  return <Link href="/dashboard" className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-150 motion-reduce:transition-none hover:border-primary-hover hover:bg-primary-hover ${className}`}>
    Get Started<ArrowRight aria-hidden="true" className="size-4 shrink-0" />
  </Link>;
}
