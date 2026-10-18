import { mulberry32 } from "./sim";

export type LonLat = [number, number];

/** Map location for each entry of CONTRACTS, in the same order. */
export const CONTRACT_SITES: LonLat[] = [
  [-90.5, 25.5], // Gulf of Mexico
  [-74.0, 40.7], // NYC
  [-81.5, 27.8], // Florida
  [-112.1, 33.4], // Phoenix
  [-104.99, 39.74], // Denver
  [-95.37, 29.76], // Houston
];

export type EventColor = "orange" | "yellow" | "blue";

export interface EventSite {
  name: string;
  at: LonLat;
  color: EventColor;
}

/** Illustrative event sites, styled after a WorldMonitor feed. */
export const EVENT_SITES: EventSite[] = [
  { name: "NYC", at: [-74.0, 40.7], color: "orange" },
  { name: "Houston", at: [-95.37, 29.76], color: "yellow" },
  { name: "Miami", at: [-80.19, 25.76], color: "orange" },
  { name: "Denver", at: [-104.99, 39.74], color: "blue" },
  { name: "Phoenix", at: [-112.07, 33.45], color: "yellow" },
  { name: "Chicago", at: [-87.63, 41.88], color: "blue" },
  { name: "Seattle", at: [-122.33, 47.61], color: "blue" },
  { name: "Mexico City", at: [-99.13, 19.43], color: "orange" },
  { name: "Sao Paulo", at: [-46.63, -23.55], color: "yellow" },
  { name: "London", at: [-0.12, 51.5], color: "blue" },
  { name: "Frankfurt", at: [8.68, 50.11], color: "orange" },
  { name: "Madrid", at: [-3.7, 40.42], color: "yellow" },
  { name: "Istanbul", at: [28.98, 41.0], color: "orange" },
  { name: "Lagos", at: [3.38, 6.52], color: "yellow" },
  { name: "Nairobi", at: [36.82, -1.29], color: "orange" },
  { name: "Cairo", at: [31.24, 30.04], color: "yellow" },
  { name: "Dubai", at: [55.27, 25.2], color: "orange" },
  { name: "Mumbai", at: [72.88, 19.08], color: "yellow" },
  { name: "Singapore", at: [103.82, 1.35], color: "blue" },
  { name: "Shanghai", at: [121.47, 31.23], color: "orange" },
  { name: "Tokyo", at: [139.69, 35.69], color: "blue" },
  { name: "Seoul", at: [126.98, 37.57], color: "yellow" },
  { name: "Sydney", at: [151.21, -33.87], color: "blue" },
  { name: "Moscow", at: [37.62, 55.76], color: "blue" },
];

/** Arc pairs by index into EVENT_SITES. Kept under 180 degrees of longitude. */
export const ARCS: [number, number][] = [
  [0, 9],
  [0, 5],
  [1, 2],
  [1, 7],
  [3, 6],
  [4, 1],
  [5, 0],
  [0, 8],
  [9, 10],
  [10, 12],
  [11, 13],
  [9, 11],
  [12, 16],
  [16, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [20, 21],
  [14, 16],
  [15, 12],
  [13, 8],
  [22, 18],
  [23, 10],
  [2, 8],
  [10, 15],
  [6, 3],
];

/** Storm and hot zones drawn as large translucent blobs. */
export const ZONES: { at: LonLat; r: number; color: string }[] = [
  { at: [-86, 24], r: 9, color: "255,60,40" },
  { at: [-60, 18], r: 7, color: "255,120,30" },
  { at: [130, 18], r: 8, color: "255,60,40" },
];

const HOTSPOTS: { at: LonLat; spread: [number, number]; n: number }[] = [
  { at: [-95, 39], spread: [14, 7], n: 520 },
  { at: [-78, 38], spread: [6, 5], n: 220 },
  { at: [-118, 36], spread: [5, 5], n: 120 },
  { at: [8, 49], spread: [9, 5], n: 460 },
  { at: [-2, 52], spread: [3, 3], n: 120 },
  { at: [115, 32], spread: [10, 7], n: 170 },
  { at: [78, 22], spread: [6, 6], n: 110 },
  { at: [139, 36], spread: [3, 3], n: 60 },
  { at: [20, 5], spread: [14, 10], n: 110 },
  { at: [32, 30], spread: [6, 4], n: 50 },
  { at: [-50, -15], spread: [10, 10], n: 80 },
  { at: [-99, 19], spread: [4, 3], n: 60 },
  { at: [145, -32], spread: [8, 5], n: 40 },
  { at: [45, 30], spread: [8, 5], n: 60 },
];

/** Seeded event points around the hotspots, for the hex bin heat layer. */
export function heatPoints(seed = 7): LonLat[] {
  const r = mulberry32(seed);
  const gauss = () => {
    const u = Math.max(r(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };
  const out: LonLat[] = [];
  for (const h of HOTSPOTS) {
    for (let i = 0; i < h.n; i++) out.push([h.at[0] + gauss() * h.spread[0], h.at[1] + gauss() * h.spread[1]]);
  }
  return out;
}
