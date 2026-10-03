import { describe, expect, it } from "vitest";
import { extent, formatCode, gaugePos, niceStep, parseNumber, rangeRuns, statusOf } from "./logic";
import type { Reading } from "./types";

const reading = (date: string, value: number, low: number, high: number): Reading => ({
  id: date, memberId: "sue", test: "rbc", date: new Date(date), value, low, high, note: "", status: statusOf(value, low, high),
});

describe("statusOf", () => {
  it("treats the limits themselves as in range", () => {
    expect(statusOf(3.8, 3.8, 4.85)).toBe("in");
    expect(statusOf(4.85, 3.8, 4.85)).toBe("in");
  });
  it("flags values outside the range", () => {
    expect(statusOf(3.79, 3.8, 4.85)).toBe("below");
    expect(statusOf(5.2, 3.8, 4.85)).toBe("above");
  });
});

describe("parseNumber", () => {
  it("accepts dots, commas and spaces", () => {
    expect(parseNumber("4.5")).toBe(4.5);
    expect(parseNumber(" 4,5 ")).toBe(4.5);
    expect(parseNumber("137")).toBe(137);
    expect(parseNumber(".5")).toBe(0.5);
  });
  it("rejects anything that isn't a plain number", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("4.5.1")).toBeNull();
    expect(parseNumber("12abc")).toBeNull();
    expect(parseNumber("1e3")).toBeNull();
  });
});

describe("gaugePos", () => {
  it("puts the range in the middle half and clamps the ends", () => {
    expect(gaugePos(10, 10, 20)).toBe(25);
    expect(gaugePos(20, 10, 20)).toBe(75);
    expect(gaugePos(-100, 10, 20)).toBe(0);
    expect(gaugePos(100, 10, 20)).toBe(100);
  });
});

describe("niceStep", () => {
  it("rounds to 1, 2, 2.5, 5 or 10 times a power of ten", () => {
    expect(niceStep(1.6, 6)).toBeCloseTo(0.2);
    expect(niceStep(1.9, 6)).toBeCloseTo(0.25);
    expect(niceStep(100, 4)).toBe(20);
    expect(niceStep(60, 6)).toBe(10);
  });
});

describe("rangeRuns", () => {
  it("groups consecutive readings with the same range, oldest first, whatever the input order", () => {
    const runs = rangeRuns([
      reading("2025-01-01", 50, 30, 130),
      reading("2020-01-01", 50, 40, 125),
      reading("2021-01-01", 50, 40, 125),
      reading("2024-05-01", 50, 30, 130),
    ]);
    expect(runs.map(r => [r.low, r.high, r.start.getFullYear(), r.end.getFullYear()])).toEqual([
      [40, 125, 2020, 2021],
      [30, 130, 2024, 2025],
    ]);
  });
});

describe("extent", () => {
  it("finds the first and last dates", () => {
    const [a, b] = extent([reading("2023-05-01", 1, 0, 2), reading("2021-01-01", 1, 0, 2), reading("2026-01-01", 1, 0, 2)]);
    expect(a.getFullYear()).toBe(2021);
    expect(b.getFullYear()).toBe(2026);
  });
});

describe("formatCode", () => {
  it("splits an 8-character code in two", () => {
    expect(formatCode("ABCD2345")).toBe("ABCD-2345");
    expect(formatCode("SHORT")).toBe("SHORT");
  });
});
