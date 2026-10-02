"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Any client exception in the playground lands here instead of blanking the tab. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => console.error(error), [error]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>The playground hit an error</AlertTitle>
        <AlertDescription>{error.message || "Unexpected client error."}</AlertDescription>
      </Alert>
      <Button className="mt-4" size="sm" onClick={() => retry()}>
        <RotateCcw /> Reload playground
      </Button>
    </main>
  );
}
