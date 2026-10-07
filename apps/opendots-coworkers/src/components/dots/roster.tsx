"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { DOTS } from "@/lib/catalog";
import { PERMISSION_LABELS, PERMISSIONS, type DotId, type Permission, type Permissions } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Roster({
  perms,
  onToggle,
  active,
  disabled,
}: {
  perms: Permissions;
  onToggle: (dot: DotId, p: Permission, on: boolean) => void;
  active: DotId | null;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      {DOTS.map((dot) => (
        <Card key={dot.id} size="sm" className={cn(active === dot.id && "ring-2 ring-primary/60")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-block size-2.5 rounded-full",
                  dot.id === "researcher" ? "bg-sky-500" : "bg-violet-500",
                  active === dot.id && "animate-pulse",
                )}
              />
              {dot.name}
              <Badge variant="outline" className="ml-auto font-normal">
                Space: {dot.space}
              </Badge>
            </CardTitle>
            <CardDescription>{dot.role}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{dot.instructions}</p>
            <div className="grid grid-cols-1 gap-1.5">
              {PERMISSIONS.map((p) => (
                <label
                  key={p}
                  className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs"
                  data-testid={`perm-${dot.id}-${p}`}
                >
                  <span>{PERMISSION_LABELS[p]}</span>
                  <Switch
                    size="sm"
                    checked={perms[dot.id][p]}
                    disabled={disabled}
                    onCheckedChange={(on) => onToggle(dot.id, p, on)}
                    aria-label={`${dot.name} ${PERMISSION_LABELS[p]}`}
                  />
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <p className="px-1 text-[11px] text-muted-foreground">
        Toggles are sent with every run and checked on the server per tool call. Anything missing counts as off.
      </p>
    </div>
  );
}
