import type { ComponentPropsWithRef } from "react";
import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert } from "lucide-react";

function classes(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}

const buttonVariants = {
  primary: "border-primary bg-primary text-primary-foreground enabled:hover:border-primary-hover enabled:hover:bg-primary-hover",
  secondary: "border-control-border bg-surface text-foreground enabled:hover:border-control-border-hover enabled:hover:bg-surface-muted",
  danger: "border-danger bg-surface text-danger enabled:hover:bg-danger-surface",
};

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: keyof typeof buttonVariants;
  pending?: boolean;
};

export function Button({ variant = "secondary", className, pending, disabled, children, "aria-busy": ariaBusy, ...props }: ButtonProps) {
  return <button {...props} disabled={pending || disabled} aria-busy={pending || ariaBusy} className={classes(
    `inline-flex min-h-control max-w-full items-center justify-center gap-2 whitespace-normal rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors duration-150 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 [&>svg]:pointer-events-none ${buttonVariants[variant]}`,
    className,
  )}>{pending && <Spinner />}{children}</button>;
}

export function Spinner() {
  return <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />;
}

const fieldClasses = "min-h-control w-full min-w-0 rounded-lg border border-control-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-150 motion-reduce:transition-none enabled:hover:border-control-border-hover aria-invalid:border-danger aria-invalid:hover:border-danger disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted-foreground disabled:opacity-100";

export function Input({ className, type, ...props }: ComponentPropsWithRef<"input">) {
  const inputClasses = type === "checkbox" || type === "radio"
    ? "size-4 shrink-0 accent-primary disabled:cursor-not-allowed disabled:opacity-60"
    : type === "file"
      ? "block w-full min-w-0 max-w-full text-sm text-muted-foreground file:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      : fieldClasses;
  return <input {...props} type={type} className={classes(inputClasses, className)} />;
}

export function Select({ className, ...props }: ComponentPropsWithRef<"select">) {
  return <select {...props} className={classes(fieldClasses, className)} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithRef<"textarea">) {
  return <textarea {...props} className={classes(`${fieldClasses} block resize-y`, className)} />;
}

export function Card({ className, ...props }: ComponentPropsWithRef<"section">) {
  return <section {...props} className={classes(
    "min-w-0 rounded-xl border border-border bg-surface p-4 text-foreground sm:p-6",
    className,
  )} />;
}

type TableProps = ComponentPropsWithRef<"table"> & { scrollLabel: string };

export function Table({ scrollLabel, className, ...props }: TableProps) {
  return (
    <div role="region" aria-label={scrollLabel} tabIndex={0} className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-surface">
      <table {...props} className={classes(
        "w-full border-collapse text-left text-sm text-foreground [overflow-wrap:anywhere] [&_caption]:border-b [&_caption]:border-border [&_caption]:p-4 [&_caption]:text-left [&_caption]:font-semibold [&_thead]:bg-surface-muted [&_thead_th]:whitespace-nowrap [&_thead_th]:text-xs [&_thead_th]:text-muted-foreground [&_th]:border-b [&_th]:border-border [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_td]:border-b [&_td]:border-border [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_th]:border-b-0 [&_tbody_tr:hover]:bg-surface-hover [&_tbody_tr:focus-within]:bg-surface-hover",
        className,
      )} />
    </div>
  );
}

// Use ref.current.showModal()/close() for native focus trapping, Escape, and focus return.
// The native `open` attribute alone displays a non-modal dialog.
type DialogProps = ComponentPropsWithRef<"dialog"> & { placement?: "center" | "start" } & (
  { "aria-label": string; "aria-labelledby"?: string } |
  { "aria-labelledby": string; "aria-label"?: string }
);

export function Dialog({ className, placement = "center", ...props }: DialogProps) {
  const position = placement === "start"
    ? "fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-[min(20rem,calc(100%-2rem))] max-w-none rounded-r-xl border-y-0 border-l-0"
    : "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg rounded-xl";
  return <dialog {...props} className={classes(
    `${position} overflow-y-auto overscroll-contain border border-border bg-surface p-4 text-foreground shadow-sm backdrop:bg-overlay [overflow-wrap:anywhere] sm:p-6`,
    className,
  )} />;
}

export function Drawer(props: DialogProps & { placement?: never }) {
  return <Dialog {...props} placement="start" />;
}

const messageTones = {
  info: { icon: Info, colors: "border-border bg-surface-muted text-foreground" },
  success: { icon: CheckCircle2, colors: "border-success bg-success-surface text-success" },
  warning: { icon: TriangleAlert, colors: "border-warning bg-warning-surface text-warning" },
  error: { icon: AlertCircle, colors: "border-danger bg-danger-surface text-danger" },
};

export function StatusMessage({ tone = "info", className, children, ...props }: ComponentPropsWithRef<"div"> & { tone?: keyof typeof messageTones }) {
  const { icon: Icon, colors } = messageTones[tone];
  return <div role={tone === "error" ? "alert" : "status"} aria-atomic="true" {...props}
    className={classes(`flex min-w-0 items-start gap-2.5 rounded-lg border p-3 text-sm leading-relaxed [overflow-wrap:anywhere] ${colors}`, className)}>
    <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><div className="min-w-0">{children}</div>
  </div>;
}

export function Skeleton({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div {...props} aria-hidden="true" className={classes("rounded-md bg-surface-muted", className)} />;
}

export function LoadingState({ className, children, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <div role="status" aria-atomic="true" {...props} className={classes("flex min-w-0 items-center gap-3 rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground [overflow-wrap:anywhere]", className)}>
      <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin motion-reduce:animate-none" />
      <span>{children}</span>
    </div>
  );
}

type EmptyStateProps = ComponentPropsWithRef<"p"> & { tone?: "neutral" | "success" };

export function EmptyState({ tone = "neutral", className, ...props }: EmptyStateProps) {
  const colors = tone === "success"
    ? "border-success bg-success-surface text-success"
    : "border-border bg-surface-muted text-muted-foreground";
  return <p role="status" aria-atomic="true" {...props} className={classes(`rounded-xl border p-4 text-sm leading-relaxed [overflow-wrap:anywhere] ${colors}`, className)} />;
}
