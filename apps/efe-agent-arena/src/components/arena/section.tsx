import type { ReactNode } from "react";

export function Section({
  id,
  number,
  title,
  kicker,
  children,
}: {
  id: string;
  number: string;
  title: string;
  kicker?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-44 pt-12">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-foreground/70 pb-2">
        <span className="font-mono text-sm font-semibold text-ink-b">Part {number}</span>
        <h2 className="font-serif text-3xl font-bold tracking-tight">{title}</h2>
        {kicker && <span className="text-sm text-muted-foreground">{kicker}</span>}
      </div>
      {children}
    </section>
  );
}

export function Score({ solved, tests, className = "" }: { solved: number; tests: number; className?: string }) {
  return (
    <span className={`font-mono tabular ${className}`}>
      {solved}
      <span className="text-muted-foreground">/{tests}</span>
    </span>
  );
}
