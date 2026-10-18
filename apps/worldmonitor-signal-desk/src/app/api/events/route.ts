// Optional live overlay: real USGS earthquakes from the last 24h (public, no
// key). Short timeout, cached, and an empty scripted fallback on any error.

const USGS = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const TTL_MS = 5 * 60 * 1000;

type Quake = { at: [number, number]; mag: number };
let cache: { at: number; quakes: Quake[] } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) return Response.json({ source: "usgs", quakes: cache.quakes });
  try {
    const res = await fetch(USGS, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!res.ok) throw new Error(`usgs ${res.status}`);
    const data = (await res.json()) as {
      features: { geometry: { coordinates: number[] }; properties: { mag: number | null } }[];
    };
    const quakes = data.features.slice(0, 300).map((f) => ({
      at: [f.geometry.coordinates[0], f.geometry.coordinates[1]] as [number, number],
      mag: f.properties.mag ?? 2.5,
    }));
    cache = { at: Date.now(), quakes };
    return Response.json({ source: "usgs", quakes });
  } catch {
    return Response.json({ source: "scripted", quakes: [] });
  }
}
