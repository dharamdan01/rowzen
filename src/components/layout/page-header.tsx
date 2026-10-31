import type { ReactNode } from "react";

export default function PageHeader({ id, title, description }: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <header className="space-y-2 border-b border-border pb-6">
      <h1 id={id} className="max-w-4xl text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl">{title}</h1>
      {description && <p className="max-w-2xl text-base leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{description}</p>}
    </header>
  );
}
