import type { Reading, Status } from "./types";

export const statusOf = (value: number, low: number, high: number): Status =>
  value < low ? "below" : value > high ? "above" : "in";

/** Accepts "4.5", " 4,5 " and similar; returns null for anything that isn't a number. */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return parseFloat(t);
}

/** Position (0–100%) on a gauge that puts low..high in the middle half. */
export function gaugePos(v: number, low: number, high: number): number {
  const span = high - low, min = low - span * 0.5, max = high + span * 0.5;
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
}

/** A "nice" axis step (1, 2, 2.5, 5 or 10 × a power of ten) giving roughly `target` ticks. */
export function niceStep(range: number, target: number): number {
  const raw = range / target, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 3.5 ? 2.5 : f < 7 ? 5 : 10) * mag;
}

export interface RangeRun { low: number; high: number; start: Date; end: Date }

/** Consecutive stretches (oldest first) where a person's reference range stayed the same. */
export function rangeRuns(rows: readonly Reading[]): RangeRun[] {
  const runs: RangeRun[] = [];
  [...rows].sort((a, b) => +a.date - +b.date).forEach(r => {
    const last = runs[runs.length - 1];
    if (last && last.low === r.low && last.high === r.high) last.end = r.date;
    else runs.push({ low: r.low, high: r.high, start: r.date, end: r.date });
  });
  return runs;
}

export function extent(rows: readonly Reading[]): [Date, Date] {
  if (!rows.length) return [new Date(2020, 0, 1), new Date()];
  let a = rows[0].date, b = rows[0].date;
  rows.forEach(r => { if (r.date < a) a = r.date; if (r.date > b) b = r.date; });
  return [a, b];
}

/** The family code shown as XXXX-XXXX. */
export const formatCode = (c: string): string => c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
