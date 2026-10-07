import { Fragment, type ReactNode } from "react";

/** Tiny Markdown preview: `## ` headings, `- ` bullets, paragraphs, **bold**. Enough for Dot pages. */
export function Markdown({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter(Boolean);
        const out: ReactNode[] = [];
        let bullets: string[] = [];
        const flush = (k: string) => {
          if (bullets.length)
            out.push(
              <ul key={k} className="list-disc space-y-1 pl-5">
                {bullets.map((b, j) => (
                  <li key={j}>{inline(b)}</li>
                ))}
              </ul>,
            );
          bullets = [];
        };
        lines.forEach((line, j) => {
          if (line.startsWith("- ")) bullets.push(line.slice(2));
          else {
            flush(`u${j}`);
            if (line.startsWith("#"))
              out.push(
                <h3 key={j} className="pt-1 text-base font-semibold">
                  {inline(line.replace(/^#+\s*/, ""))}
                </h3>,
              );
            else out.push(<p key={j}>{inline(line)}</p>);
          }
        });
        flush("end");
        return <Fragment key={i}>{out}</Fragment>;
      })}
    </div>
  );
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}
