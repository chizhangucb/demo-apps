export const nf = new Intl.NumberFormat("en-US");
export function fmtVal(v: number): string {
  if (!Number.isFinite(v)) return "n/a";
  if (v === 0) return "0";
  const a = Math.abs(v);
  return a >= 0.001 && a < 1000 ? v.toPrecision(5) : v.toExponential(4);
}
