"use client";

import { useEffect, useState } from "react";
import type { HubListResult, HubResult } from "@/lib/hub";

export type HubState = { state: "loading" } | HubResult;
export type HubListState = { state: "loading" } | HubListResult;

const cache = new Map<string, HubResult>();

async function getJson<T>(url: string): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return (await res.json()) as T;
  } catch {
    // the route itself is unreachable (offline browser, network drop)
    return { ok: false, live: false, fetchedAt: new Date().toISOString(), reason: "Could not reach the lookup route." } as T;
  }
}

/** Live Hub cards for a set of official repo ids. One request per id per mode; no retries. */
export function useHubModels(ids: string[], offline: boolean): Record<string, HubState> {
  const key = ids.join("|") + (offline ? "#off" : "#on");
  const [state, setState] = useState<Record<string, HubState>>({});

  useEffect(() => {
    let alive = true;
    const mode = offline ? "&simulate=offline" : "";
    const initial: Record<string, HubState> = {};
    for (const id of ids) initial[id] = cache.get(id + mode) ?? { state: "loading" };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(initial);
    for (const id of ids) {
      if (cache.has(id + mode)) continue;
      getJson<HubResult>(`/api/hub?repo=${encodeURIComponent(id)}${mode}`).then((r) => {
        if (r.ok) cache.set(id + mode, r);
        if (alive) setState((s) => ({ ...s, [id]: r }));
      });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export function useHubList(offline: boolean): HubListState {
  const [state, setState] = useState<HubListState>({ state: "loading" });
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ state: "loading" });
    getJson<HubListResult>(`/api/hub?list=1${offline ? "&simulate=offline" : ""}`).then((r) => alive && setState(r));
    return () => {
      alive = false;
    };
  }, [offline]);
  return state;
}
