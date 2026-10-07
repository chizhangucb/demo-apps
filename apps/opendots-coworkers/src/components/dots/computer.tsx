"use client";

import { Ban, FileText, Globe, SquareTerminal } from "lucide-react";
import type { Computer } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Simulated Dot computer: browser, files, terminal and the Activity log. No Docker, no real browser or shell. */
export function ComputerPanel({ computer }: { computer: Computer }) {
  const { browser, files, terminal, activity } = computer;
  return (
    <div className="space-y-3 text-xs">
      <section className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-2 py-1.5">
          <Globe className="size-3.5" />
          <div className="flex-1 truncate rounded bg-background px-2 py-0.5 font-mono">
            {browser?.url ?? "about:blank"}
          </div>
        </div>
        <div className="min-h-16 p-3 text-muted-foreground">
          {browser ? (
            <>
              <div className="mb-1 font-medium text-foreground">{browser.title}</div>
              <div className="whitespace-pre-wrap">{browser.snapshot}</div>
            </>
          ) : (
            "Browser idle."
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border p-2">
          <h4 className="mb-1 flex items-center gap-1 font-medium">
            <FileText className="size-3.5" /> Workspace files
          </h4>
          {files.length ? (
            <ul className="space-y-0.5 font-mono">
              {files.map((f, i) => (
                <li key={i} className="flex justify-between">
                  <span>{f.path}</span>
                  <span className="text-muted-foreground">{f.bytes} B</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Empty.</p>
          )}
        </section>
        <section className="rounded-lg border bg-zinc-950 p-2 text-zinc-100">
          <h4 className="mb-1 flex items-center gap-1 font-medium">
            <SquareTerminal className="size-3.5" /> Terminal
          </h4>
          <pre className="font-mono whitespace-pre-wrap text-[11px]">{terminal.join("\n") || "$ _"}</pre>
        </section>
      </div>

      <section className="rounded-lg border">
        <h4 className="border-b px-2 py-1.5 font-medium">Activity</h4>
        {activity.length ? (
          <table className="w-full" data-testid="activity">
            <tbody>
              {activity.map((a) => (
                <tr
                  key={a.id}
                  className={cn(
                    "border-b last:border-0",
                    a.status === "denied" && "bg-destructive/10 font-medium text-destructive",
                  )}
                >
                  <td className="px-2 py-1 font-mono">{a.action}</td>
                  <td className="px-2 py-1">requested by {a.requestedBy}</td>
                  <td className="px-2 py-1 text-right">
                    {a.status === "denied" ? (
                      <span className="inline-flex items-center gap-1">
                        <Ban className="size-3" /> denied: {a.reason}
                      </span>
                    ) : (
                      "allowed"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-2 py-2 text-muted-foreground">No actions yet.</p>
        )}
        <p className="border-t px-2 py-1 text-[10px] text-muted-foreground">
          Logs action, requester and outcome only. No file contents, typed values or full commands.
        </p>
      </section>
    </div>
  );
}
