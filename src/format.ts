export const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");

export const fmtDate = (d: Date) => `${pad2(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}`;
export const fmtShort = (d: Date) => `${MON[d.getMonth()]} ${d.getFullYear()}`;
export const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
/** Values for <input type="date"> and <input type="time"> in local time. */
export const dateInput = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const timeInput = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const LABEL = { in: "In range", above: "Above range", below: "Below range" } as const;
export const ICON = { in: "●", above: "▲", below: "▼" } as const;
