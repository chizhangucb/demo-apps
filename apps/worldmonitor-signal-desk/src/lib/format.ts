export const usd = (v: number) =>
  `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const signedUsd = (v: number) => `${v < 0 ? "-" : "+"}${usd(Math.abs(v))}`;

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

export const clock = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const duration = (s: number) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
