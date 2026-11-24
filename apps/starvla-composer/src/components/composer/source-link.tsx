import { ArrowUpRight } from "lucide-react";

export function SourceLink({ href, label = "source" }: { href: string; label?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[oklch(0.45_0.12_250)] underline decoration-[oklch(0.45_0.12_250/0.35)] underline-offset-2 hover:decoration-current">
      {label}
      <ArrowUpRight className="size-3" />
    </a>
  );
}
