import type { TestKey } from "./tests";

export type Status = "in" | "above" | "below";

export interface Member {
  id: string;
  fullName: string;
  shortName: string;
  /** Palette name; see COLOURS in people.ts. */
  colour: string;
  /** Whether someone has signed up as this person. */
  claimed: boolean;
}

export interface Reading {
  id: string;
  memberId: string;
  test: TestKey;
  date: Date;
  value: number;
  low: number;
  high: number;
  note: string;
  status: Status;
}
