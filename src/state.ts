import type { Member, Reading, Status } from "./types";
import type { TestKey } from "./tests";

/** Data from the database. */
export const store = {
  members: [] as Member[],
  readings: [] as Reading[],
  /** The signed-in person's member id. */
  me: "" as string,
};

/** What the dashboard is showing. */
export const view = {
  people: new Set<string>(),
  test: "rbc" as TestKey,
  from: null as Date | null,
  to: null as Date | null,
  preset: "all" as "all" | "3y" | "1y" | null,
  status: "all" as Status | "all",
  sort: { k: "date" as "date" | "value", dir: -1 as 1 | -1 },
};

export const member = (id: string): Member =>
  store.members.find(m => m.id === id) ?? { id, fullName: "Unknown", shortName: "?", colour: "slate", claimed: false };

/** Readings for the current test and selected people. */
export const forTest = (): Reading[] => store.readings.filter(r => r.test === view.test && view.people.has(r.memberId));
