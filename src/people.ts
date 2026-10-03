import type { Member } from "./types";

/** Each name maps to a CSS custom property (--c-<name>) with light and dark variants in styles.css. */
export const COLOURS = ["rose", "amber", "teal", "violet", "green", "blue", "slate"] as const;

export const colourVar = (m: Pick<Member, "colour">): string =>
  `var(--c-${(COLOURS as readonly string[]).includes(m.colour) ? m.colour : "teal"})`;
