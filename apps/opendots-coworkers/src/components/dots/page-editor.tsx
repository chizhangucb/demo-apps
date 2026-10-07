"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Draft, SavedPage } from "@/lib/types";
import { Markdown } from "./markdown";

export type SpacePage = SavedPage & { original: string; editedAt?: number };

/** Human-in-the-loop review card shown while the run is paused on its interrupt. */
export function ReviewCard({
  draft,
  space,
  busy,
  onAnswer,
}: {
  draft: Draft;
  space: string;
  busy: boolean;
  onAnswer: (status: "approved" | "declined") => void;
}) {
  return (
    <Card className="ring-2 ring-amber-500/60" data-testid="review-card">
      <CardHeader>
        <CardTitle>Review before saving</CardTitle>
        <CardDescription>
          The Writer wants to save <strong>{draft.title}</strong> to the {space} Space.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-48 overflow-auto rounded-md border mx-4 bg-muted/30 p-3">
        <Markdown source={draft.body} />
      </CardContent>
      <CardFooter className="gap-2">
        <Button onClick={() => onAnswer("approved")} disabled={busy}>
          Approve &amp; save
        </Button>
        <Button variant="outline" onClick={() => onAnswer("declined")} disabled={busy}>
          Decline
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Editable page with a Markdown preview. Every change autosaves to the localStorage Space. */
export function PageEditor({ page, onChange }: { page: SpacePage; onChange: (p: SpacePage) => void }) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const edited = page.body !== page.original;

  useEffect(() => {
    const t = setTimeout(() => setSavedAt(Date.now()), 500);
    return () => clearTimeout(t);
  }, [page.title, page.body]);

  return (
    <div className="space-y-2" data-testid="page-editor">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">Space: {page.space}</Badge>
        {edited ? <Badge variant="secondary">edited</Badge> : <Badge variant="outline">as saved by Writer</Badge>}
        <span className="text-muted-foreground">
          {savedAt ? `Autosaved ${new Date(savedAt).toLocaleTimeString()}` : "Autosave on"}
        </span>
        <div className="ml-auto flex gap-1">
          <Button size="xs" variant={mode === "edit" ? "secondary" : "ghost"} onClick={() => setMode("edit")}>
            Edit
          </Button>
          <Button size="xs" variant={mode === "preview" ? "secondary" : "ghost"} onClick={() => setMode("preview")}>
            Preview
          </Button>
        </div>
      </div>
      <Input
        value={page.title}
        onChange={(e) => onChange({ ...page, title: e.target.value, editedAt: Date.now() })}
        className="font-semibold"
        aria-label="Page title"
      />
      {mode === "edit" ? (
        <Textarea
          value={page.body}
          onChange={(e) => onChange({ ...page, body: e.target.value, editedAt: Date.now() })}
          className="min-h-64 font-mono text-xs"
          aria-label="Page body (Markdown)"
        />
      ) : (
        <div className="min-h-64 rounded-md border p-3">
          <Markdown source={page.body} />
        </div>
      )}
      {page.sources.length > 0 && (
        <div className="text-xs">
          <div className="mb-1 font-medium">Sources</div>
          <ul className="space-y-0.5">
            {page.sources.map((s) => (
              <li key={s}>
                <a href={s} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
