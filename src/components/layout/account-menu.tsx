"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { Button } from "../ui/primitives";

/** A disclosure of real controls, with normal Tab order and no ARIA menu impersonation. */
export default function AccountMenu({ children }: { children: ReactNode }) {
  const disclosure = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !disclosure.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !open || document.querySelector("dialog:modal")) return;
      setOpen(false); trigger.current?.focus(); event.preventDefault();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={disclosure} className="relative shrink-0"
    onBlur={event => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
    <Button ref={trigger} type="button" aria-controls={panelId} aria-expanded={open} onClick={() => setOpen(value => !value)} className="px-3">
      <UserRound aria-hidden="true" className="size-4" /><span>Account</span><ChevronDown aria-hidden="true" className={`size-3.5 ${open ? "rotate-180" : ""}`} />
    </Button>
    <div id={panelId} data-account-panel="" role="group" aria-label="Account" hidden={!open} className="absolute right-0 top-full z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-control-border bg-surface p-3 shadow-sm [&_button]:w-full [&_[role=alert]]:max-w-none">
      {children}
    </div>
  </div>;
}
