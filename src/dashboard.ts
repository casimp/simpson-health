import { TESTS, TEST_KEYS, type TestKey } from "./tests";
import type { Reading } from "./types";
import { store, view, member, forTest } from "./state";
import { colourVar } from "./people";
import { extent, gaugePos, niceStep, rangeRuns } from "./logic";
import { MON, fmtDate, fmtShort, fmtTime, esc, LABEL, ICON } from "./format";
import { $, reducedMotion } from "./dom";

/** Called when someone taps Edit on one of their own readings. */
let onEdit: (r: Reading) => void = () => {};
export const setEditHandler = (fn: (r: Reading) => void) => { onEdit = fn; };

function viewRange(rows: Reading[]): [Date, Date] {
  const [a, b] = extent(rows);
  const pad = Math.max((+b - +a) * 0.02, 864e5 * 10);
  return [view.from || new Date(+a - pad), view.to || new Date(+b + pad)];
}

function gaugeHTML(r: Reading, color: string): string {
  const lo = gaugePos(r.low, r.low, r.high), hi = gaugePos(r.high, r.low, r.high), m = gaugePos(r.value, r.low, r.high);
  return `<div class="gauge"><div class="band" style="left:${lo}%;width:${hi - lo}%"></div><div class="mk" style="left:${m}%;color:${color}"></div></div>`;
}

/* ---------- People chips ---------- */
function renderPeople() {
  $("#people").innerHTML = store.members.map(p => {
    const n = store.readings.filter(r => r.memberId === p.id).length;
    return `<button type="button" class="person" style="--c:${colourVar(p)}" data-id="${esc(p.id)}" aria-pressed="${view.people.has(p.id)}">
      <span class="av">${esc(p.shortName[0] ?? "?")}</span>
      <span class="nm">${esc(p.fullName)}<span class="ct">${n ? n + " results" : "No results yet"}</span></span>
    </button>`;
  }).join("");
}

/* ---------- Tiles ---------- */
function renderTiles(rows: Reading[]) {
  const t = TESTS[view.test];
  const el = $("#tiles"), el2 = $("#tiles2");
  if (!rows.length) { el.innerHTML = el2.innerHTML = ""; el.hidden = el2.hidden = true; return; }
  el.hidden = el2.hidden = false;
  const latest = rows.reduce((a, b) => (b.date > a.date ? b : a));
  const c = { in: 0, above: 0, below: 0 }; rows.forEach(r => c[r.status]++);
  const [a, b] = extent(rows);
  const multi = view.people.size > 1;
  const who = multi ? ` · ${esc(member(latest.memberId).shortName)}` : "";
  el.innerHTML = `
  <div class="tile latest">
    <div style="display:flex;flex-direction:column;gap:8px">
      <span class="label">Latest reading${who}</span>
      <div class="big">${latest.value.toFixed(t.dp)}<small>${t.unit}</small></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="pill ${latest.status}">${ICON[latest.status]} ${LABEL[latest.status]}</span><span class="meta">${fmtDate(latest.date)}</span></div>
    </div>
    <div class="lt-gauge">
      ${gaugeHTML(latest, `var(--${latest.status})`)}
      <div class="gauge-labels num"><span></span><span>Reference range ${latest.low.toFixed(t.dp)} – ${latest.high.toFixed(t.dp)}</span><span></span></div>
    </div>
  </div>`;
  const years = new Set(rows.map(r => r.date.getFullYear())).size;
  el2.innerHTML = `
  <div class="tile">
    <span class="label">Readings shown</span>
    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div class="big" data-count="${rows.length}">${rows.length}</div><span class="meta">${fmtShort(a)} to ${fmtShort(b)} · ${years} calendar year${years === 1 ? "" : "s"}</span></div>
    <div class="stack" aria-hidden="true" style="margin-top:6px">
      <span style="flex-grow:${c.below};background:var(--below)"></span>
      <span style="flex-grow:${c.in};background:var(--in)"></span>
      <span style="flex-grow:${c.above};background:var(--above)"></span>
    </div>
    <div class="legend">
      <span><i class="sw" style="background:var(--below)"></i>Below <b>${c.below}</b></span>
      <span><i class="sw" style="background:var(--in)"></i>In range <b>${c.in}</b></span>
      <span><i class="sw" style="background:var(--above)"></i>Above <b>${c.above}</b></span>
    </div>
  </div>
  <div class="tile">
    <span class="label">${multi ? "Reference ranges" : esc(member(latest.memberId).shortName) + "’s reference range"}</span>
    ${rangeList(rows, view.test)}
    <span class="meta">${t.desc} Normal ranges vary with age and sex, so each person is compared with the range on their own lab report.</span>
  </div>`;
  const counter = el2.querySelector<HTMLElement>("[data-count]");
  if (counter && !reducedMotion) countUp(counter, rows.length);
}

function rangeList(rows: Reading[], test: TestKey): string {
  const t = TESTS[test];
  const pids = [...new Set(rows.map(r => r.memberId))];
  const fmt = (r: { low: number; high: number }) => `${r.low.toFixed(t.dp)}–${r.high.toFixed(t.dp)}`;
  const history = (pid: string) => rangeRuns(rows.filter(r => r.memberId === pid)).reverse();
  if (pids.length === 1) {
    const [cur, ...older] = history(pids[0]);
    return `<div class="big" style="font-size:28px">${fmt(cur)}<small>${t.unit}</small></div>` +
      (older.length ? `<span class="meta">The lab’s range has changed over time. Earlier results used ${older.map(o => `${fmt(o)} (${fmtShort(o.start)}${+o.start === +o.end ? "" : " – " + fmtShort(o.end)})`).join(" and ")}.</span>` : "");
  }
  return `<div class="legend" style="flex-direction:column">${pids.map(pid => {
    const [cur] = history(pid), p = member(pid);
    return `<span><i class="sw" style="background:${colourVar(p)}"></i>${esc(p.shortName)} <b>${fmt(cur)}</b></span>`;
  }).join("")}</div>`;
}

function countUp(node: HTMLElement, n: number) {
  const t0 = performance.now(), dur = 700;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    node.textContent = String(Math.round(n * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  step(t0);
}

/* ---------- Main chart ---------- */
interface Point { r: Reading; px: number; py: number }
let points: Point[] = [];

function renderChart(rows: Reading[], range: [Date, Date], animate: boolean) {
  const svg = $<SVGSVGElement>("#chart"), wrap = $("#chartWrap"), t = TESTS[view.test];
  const W = wrap.clientWidth, H = W < 560 ? 280 : 360;
  const m = { l: 44, r: 14, t: 16, b: 30 };
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", String(H));
  hideTip();
  if (!rows.length) {
    const names = store.members.filter(p => view.people.has(p.id)).map(p => p.shortName);
    svg.innerHTML = "";
    svg.setAttribute("height", "0");
    let msg = view.people.size === 0 ? `<strong>Pick someone above</strong>Tap a name to see their results.`
      : `<strong>Nothing here yet for ${esc(names.join(" & "))}</strong>${view.people.has(store.me) ? "Tap “Add result” to put in your first one." : "Results will appear here once they’re added."}`;
    if (view.people.size && forTest().length) msg = `<strong>No readings in this window</strong>Tap “Show all dates” above the chart.`;
    let e = wrap.querySelector<HTMLElement>(".empty");
    if (!e) { e = document.createElement("div"); e.className = "empty"; wrap.appendChild(e); }
    e.innerHTML = `<div>${msg}</div>`;
    points = []; return;
  }
  wrap.querySelector(".empty")?.remove();

  const vals = rows.map(r => r.value);
  let lo = Math.min(...rows.map(r => r.low), ...vals), hi = Math.max(...rows.map(r => r.high), ...vals);
  const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
  const x = (d: Date) => m.l + ((+d - +range[0]) / (+range[1] - +range[0])) * (W - m.l - m.r);
  const y = (v: number) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);

  let g = "";
  // y grid
  const step = niceStep(hi - lo, H < 300 ? 4 : 6);
  const decimals = step >= 1 ? 0 : Math.abs(step * 10 - Math.round(step * 10)) > 1e-9 ? 2 : 1;
  g += `<g class="grid">`;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(decimals)}</text>`;
  }
  g += `</g>`;
  // Reference band. The range can change over time (new lab method), so draw it as runs along the time axis.
  const pids = [...new Set(rows.map(r => r.memberId))];
  pids.forEach((pid, pi) => {
    const runs = rangeRuns(rows.filter(r => r.memberId === pid));
    runs.forEach((b, i) => {
      const x0 = i === 0 ? m.l : (x(runs[i - 1].end) + x(b.start)) / 2;
      const x1 = i === runs.length - 1 ? W - m.r : (x(b.end) + x(runs[i + 1].start)) / 2;
      const op = pids.length > 1 ? 0.6 : 1;
      g += `<rect class="band-rect" x="${x0}" width="${Math.max(0, x1 - x0)}" y="${y(b.high)}" height="${y(b.low) - y(b.high)}" fill-opacity="${op}"/>`;
      g += `<line class="band-line" x1="${x0}" x2="${x1}" y1="${y(b.high)}" y2="${y(b.high)}"/><line class="band-line" x1="${x0}" x2="${x1}" y1="${y(b.low)}" y2="${y(b.low)}"/>`;
      if (i < runs.length - 1 && x1 - x0 > 90 && W >= 560) g += `<text class="band-label" x="${x0 + 6}" y="${y(b.high) + 14}">${b.low.toFixed(t.dp)}–${b.high.toFixed(t.dp)}</text>`;
      if (i === runs.length - 1 && W >= 560) {
        const who = pids.length > 1 ? esc(member(pid).shortName) + "’s range" : "Reference range";
        g += `<text class="band-label" x="${W - m.r - 6}" y="${y(b.high) + 14 + pi * 14}" text-anchor="end">${who} ${b.low.toFixed(t.dp)}–${b.high.toFixed(t.dp)}</text>`;
      }
    });
  });
  // x ticks
  const spanDays = (+range[1] - +range[0]) / 864e5;
  const ticks: Date[] = [];
  const mStep = spanDays > 1100 ? 12 : spanDays > 500 ? 6 : spanDays > 200 ? 3 : 1;
  let d = mStep === 12 ? new Date(range[0].getFullYear(), 0, 1) : new Date(range[0].getFullYear(), range[0].getMonth(), 1);
  if (mStep !== 12) d.setMonth(Math.floor(d.getMonth() / mStep) * mStep);
  while (d <= range[1]) { if (d >= range[0]) ticks.push(new Date(d)); d = new Date(d.getFullYear(), d.getMonth() + mStep, 1); }
  const minGap = W < 560 ? 56 : 70; let lastX = -1e9;
  ticks.forEach(tk => {
    const tx = x(tk); if (tx - lastX < minGap) return; lastX = tx;
    const yy = String(tk.getFullYear()).slice(2);
    const lab = mStep === 12 ? String(tk.getFullYear()) : tk.getMonth() === 0 || ticks.length < 3 ? `${MON[tk.getMonth()]} ${yy}` : `${MON[tk.getMonth()]} ’${yy}`;
    g += `<line x1="${tx}" x2="${tx}" y1="${m.t}" y2="${H - m.b}" stroke="var(--line)" stroke-opacity=".6"/><text x="${tx}" y="${H - m.b + 18}" text-anchor="middle">${lab}</text>`;
  });

  // a line per person
  points = [];
  const sorted = [...rows].sort((a, b) => +a.date - +b.date);
  const byP = new Map<string, Reading[]>();
  sorted.forEach(r => { const arr = byP.get(r.memberId); if (arr) arr.push(r); else byP.set(r.memberId, [r]); });
  const multi = byP.size > 1;
  g += `<g id="series">`;
  byP.forEach((arr, pid) => {
    const path = arr.map((r, i) => `${i ? "L" : "M"}${x(r.date).toFixed(1)},${y(r.value).toFixed(1)}`).join(" ");
    g += `<path class="series" d="${path}" stroke="${multi ? colourVar(member(pid)) : "var(--accent)"}" stroke-opacity=".85"/>`;
  });
  g += `</g><g id="dots">`;
  const anim = animate && !reducedMotion;
  sorted.forEach((r, i) => {
    const px = x(r.date), py = y(r.value), fill = `var(--${r.status})`;
    const cls = `dot${anim ? " pop" : ""}`;
    const st = anim ? `style="animation-delay:${(300 + i * (900 / sorted.length)).toFixed(0)}ms"` : "";
    const stroke = multi ? `stroke="${colourVar(member(r.memberId))}"` : "";
    if (r.status === "in") g += `<circle class="${cls}" ${st} ${stroke} cx="${px}" cy="${py}" r="4.6" fill="${fill}"/>`;
    else if (r.status === "above") g += `<path class="${cls}" ${st} ${stroke} d="M${px},${py - 6.5} L${px + 6},${py + 4} L${px - 6},${py + 4} Z" fill="${fill}"/>`;
    else g += `<path class="${cls}" ${st} ${stroke} d="M${px},${py + 6.5} L${px + 6},${py - 4} L${px - 6},${py - 4} Z" fill="${fill}"/>`;
    points.push({ r, px, py });
  });
  g += `</g><g id="hover" style="display:none"><line class="guide" id="hGuide" y1="${m.t}" y2="${H - m.b}"/><circle class="ring" id="hRing" r="10"/></g>`;
  g += `<rect id="hit" x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/>`;
  svg.innerHTML = g;

  if (anim) {
    svg.querySelectorAll<SVGPathElement>(".series").forEach(p => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len); p.style.strokeDashoffset = String(len);
      p.getBoundingClientRect();
      p.style.transition = "stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1)";
      p.style.strokeDashoffset = "0";
    });
  }
  wireChart(svg, W, H, m, range);
}

/** Drag to zoom, tap or hover for details. */
function wireChart(svg: SVGSVGElement, W: number, H: number, m: { l: number; r: number; t: number; b: number }, range: [Date, Date]) {
  const hit = $<SVGRectElement>("#hit", svg);
  const inv = (px: number) => new Date(+range[0] + ((Math.max(m.l, Math.min(W - m.r, px)) - m.l) / (W - m.l - m.r)) * (+range[1] - +range[0]));
  const local = (e: PointerEvent) => { const r = svg.getBoundingClientRect(); return (e.clientX - r.left) * (W / r.width); };
  let drag: { x0: number; moved: boolean } | null = null, sel: SVGRectElement | null = null;
  hit.addEventListener("pointerdown", e => {
    drag = { x0: local(e), moved: false };
    try { hit.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    onHover(e);
  });
  hit.addEventListener("pointermove", e => {
    if (drag) {
      const x1 = local(e);
      if (!drag.moved && Math.abs(x1 - drag.x0) > 10) {
        drag.moved = true; hideTip();
        sel = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        sel.setAttribute("class", "zsel"); sel.setAttribute("y", String(m.t)); sel.setAttribute("height", String(H - m.t - m.b));
        svg.insertBefore(sel, hit);
      }
      if (drag.moved && sel) {
        const a = Math.max(m.l, Math.min(drag.x0, x1)), b = Math.min(W - m.r, Math.max(drag.x0, x1));
        sel.setAttribute("x", String(a)); sel.setAttribute("width", String(Math.max(1, b - a)));
        return;
      }
    }
    onHover(e);
  });
  hit.addEventListener("pointerup", e => {
    if (!drag) return;
    if (drag.moved) {
      const x1 = local(e), a = inv(Math.min(drag.x0, x1)), b = inv(Math.max(drag.x0, x1));
      if (+b - +a > 864e5 * 3) { view.from = a; view.to = b; setPreset(null); drag = null; render(true); return; }
      sel?.remove();
    }
    drag = null;
  });
  hit.addEventListener("pointercancel", () => { drag = null; sel?.remove(); });
  hit.addEventListener("dblclick", () => { if (view.from || view.to) { view.from = view.to = null; setPreset("all"); render(true); } });
  hit.addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && !drag) hideTip(); });
}

function onHover(e: PointerEvent) {
  if (!points.length) return;
  const rect = $("#chart").getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  let best: Point | null = null, bd = Infinity;
  points.forEach(p => { const d = Math.abs(p.px - mx) + Math.abs(p.py - my) * 0.15; if (d < bd) { bd = d; best = p; } });
  if (best) showTip(best);
}

function showTip(p: Point) {
  const r = p.r, t = TESTS[r.test];
  $<SVGGElement>("#hover").style.display = "";
  const guide = $("#hGuide"), ring = $("#hRing");
  guide.setAttribute("x1", String(p.px)); guide.setAttribute("x2", String(p.px));
  ring.setAttribute("cx", String(p.px)); ring.setAttribute("cy", String(p.py)); ring.setAttribute("stroke", `var(--${r.status})`);
  let diff = r.status === "above" ? `${(r.value - r.high).toFixed(t.dp)} above the upper limit`
    : r.status === "below" ? `${(r.low - r.value).toFixed(t.dp)} below the lower limit`
    : `Within ${r.low.toFixed(t.dp)}–${r.high.toFixed(t.dp)}`;
  if (r.note) diff += `<br>${esc(r.note)}`;
  const tip = $("#tip");
  tip.innerHTML = `<div class="tl">${esc(member(r.memberId).fullName)} · ${fmtDate(r.date)}, ${fmtTime(r.date)}</div>
    <div class="tv">${r.value.toFixed(t.dp)}<small>${t.unit}</small></div>
    <div class="tl">${diff}</div>
    <span class="pill ${r.status}">${ICON[r.status]} ${LABEL[r.status]}</span>`;
  const W = $("#chartWrap").clientWidth;
  tip.classList.add("show");
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = p.px + 16; if (left + tw > W) left = p.px - tw - 16; if (left < 0) left = Math.max(0, (W - tw) / 2);
  let top = p.py - th - 14; if (top < 0) top = p.py + 18;
  tip.style.left = left + "px"; tip.style.top = top + "px";
  document.querySelectorAll("#tbody tr.hl").forEach(x => x.classList.remove("hl"));
  document.querySelector(`#tbody tr[data-id="${CSS.escape(r.id)}"]`)?.classList.add("hl");
}

function hideTip() {
  document.getElementById("tip")?.classList.remove("show");
  const hov = document.getElementById("hover"); if (hov) hov.style.display = "none";
  document.querySelectorAll("#tbody tr.hl").forEach(x => x.classList.remove("hl"));
}

/* ---------- Heat strip ---------- */
function renderHeat(all: Reading[]) {
  const el = $("#heat");
  if (!all.length) { el.innerHTML = `<p class="hint" style="grid-column:1/-1">No readings to show.</p>`; return; }
  const [a, b] = extent(all);
  const counts = new Map<string, number>();
  all.forEach(r => { const k = r.date.getFullYear() + "-" + r.date.getMonth(); counts.set(k, (counts.get(k) ?? 0) + 1); });
  const max = Math.max(...counts.values());
  let h = `<span></span>` + MON.map(mo => `<span class="mh">${mo[0]}</span>`).join("");
  const f = view.from, t = view.to;
  const selYear = f && t && f.getMonth() === 0 && f.getDate() === 1 && t.getMonth() === 11 && t.getDate() === 31 && f.getFullYear() === t.getFullYear() ? f.getFullYear() : null;
  for (let yr = b.getFullYear(); yr >= a.getFullYear(); yr--) {
    h += `<button type="button" class="yr${selYear === yr ? " on" : ""}" data-y="${yr}">${yr}</button>`;
    for (let mo = 0; mo < 12; mo++) {
      const n = counts.get(yr + "-" + mo) ?? 0;
      const k = n ? 0.35 + 0.65 * (n / max) : 0;
      const bg = n ? `background:color-mix(in srgb,var(--accent) ${Math.round(k * 100)}%,var(--surface-2))` : "";
      h += `<div class="m${n ? " has" : ""}" style="${bg}" title="${MON[mo]} ${yr}: ${n} reading${n === 1 ? "" : "s"}">${n > 1 ? `<span class="n">${n}</span>` : ""}</div>`;
    }
  }
  el.innerHTML = h;
}

/* ---------- Table ---------- */
let currentRows: Reading[] = [];
function renderTable(rows: Reading[]) {
  const t = TESTS[view.test];
  const f = rows.filter(r => view.status === "all" || r.status === view.status);
  const { k, dir } = view.sort;
  f.sort((a, b) => (k === "date" ? +a.date - +b.date : a.value - b.value || +a.date - +b.date) * dir);
  $("#tableCard").classList.toggle("multi", view.people.size > 1);
  $("#rowCount").textContent = `(${f.length})`;
  $("#tbody").innerHTML = f.length ? f.map(r => {
    const p = member(r.memberId);
    return `<tr data-id="${esc(r.id)}">
      <td><span class="num">${fmtDate(r.date)}</span> <span class="hint num">${fmtTime(r.date)}</span></td>
      <td class="col-who"><span class="who"><i style="background:${colourVar(p)}"></i>${esc(p.shortName)}</span></td>
      <td class="num" style="font-weight:600">${r.value.toFixed(t.dp)}</td>
      <td class="col-pos">${gaugeHTML(r, `var(--${r.status})`)}</td>
      <td><span class="pill ${r.status}">${ICON[r.status]} ${LABEL[r.status]}</span>${r.memberId === store.me ? `<button type="button" class="edit-btn" data-edit="${esc(r.id)}" aria-label="Edit ${fmtDate(r.date)} reading">Edit</button>` : ""}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="5" class="hint" style="text-align:center;padding:24px">No readings match.</td></tr>`;
  (["Date", "Val"] as const).forEach(n => {
    const th = $("#th" + n), key = n === "Date" ? "date" : "value", arr = $(".arr", th);
    if (k === key) { th.setAttribute("aria-sort", dir < 0 ? "descending" : "ascending"); arr.textContent = dir < 0 ? "↓" : "↑"; }
    else { th.removeAttribute("aria-sort"); arr.textContent = "↕"; }
  });
}

/* ---------- Presets ---------- */
function setPreset(p: typeof view.preset) {
  view.preset = p;
  $("#presets").querySelectorAll<HTMLButtonElement>("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.p === p)));
}

/* ---------- Render ---------- */
let ready = false;
export function render(animate: boolean) {
  if (!ready) return;
  const t = TESTS[view.test];
  $("#testName").textContent = t.name; $("#testUnit").textContent = t.unit;
  $("#testSeg").innerHTML = TEST_KEYS.map(k => {
    const n = store.readings.filter(r => r.test === k && view.people.has(r.memberId)).length;
    return `<button type="button" data-t="${k}" aria-pressed="${k === view.test}">${TESTS[k].short}${n ? ` <span class="tcount">${n}</span>` : ""}</button>`;
  }).join("");
  renderPeople();
  const all = forTest();
  const range = viewRange(all);
  currentRows = all.filter(r => r.date >= range[0] && r.date <= range[1]);
  $("#resetZoom").hidden = !(view.from || view.to);
  $("#viewLabel").textContent = all.length ? `${fmtShort(range[0])} – ${fmtShort(range[1])} · ${currentRows.length} reading${currentRows.length === 1 ? "" : "s"}` : "";
  const names = store.members.filter(p => view.people.has(p.id)).map(p => p.shortName);
  $("#chartTitle").textContent = names.length ? `${names.join(", ")} over time` : "Over time";
  renderTiles(currentRows);
  renderChart(currentRows, range, animate);
  renderHeat(all);
  renderTable(currentRows);
}

/** Wire up the dashboard's controls. Call once. */
export function initDashboard() {
  $("#people").addEventListener("click", e => {
    const b = (e.target as Element).closest<HTMLElement>(".person"); if (!b?.dataset.id) return;
    const id = b.dataset.id;
    if (view.people.has(id)) view.people.delete(id); else view.people.add(id);
    view.from = view.to = null; setPreset("all");
    render(true);
  });
  $("#heat").addEventListener("click", e => {
    const b = (e.target as Element).closest<HTMLElement>(".yr"); if (!b) return;
    const y = Number(b.dataset.y);
    view.from = new Date(y, 0, 1); view.to = new Date(y, 11, 31, 23, 59); setPreset(null);
    render(true);
  });
  $("thead").addEventListener("click", e => {
    const b = (e.target as Element).closest<HTMLElement>("button[data-k]"); if (!b) return;
    const k = b.dataset.k as "date" | "value";
    view.sort = view.sort.k === k ? { k, dir: view.sort.dir === 1 ? -1 : 1 } : { k, dir: -1 };
    renderTable(currentRows);
  });
  $("#statusSeg").addEventListener("click", e => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button"); if (!b) return;
    view.status = b.dataset.s as typeof view.status;
    $("#statusSeg").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    renderTable(currentRows);
  });
  $("#tbody").addEventListener("mouseover", e => {
    const tr = (e.target as Element).closest<HTMLElement>("tr[data-id]"); if (!tr) return;
    const p = points.find(p => p.r.id === tr.dataset.id); if (p) showTip(p);
  });
  $("#tbody").addEventListener("mouseleave", hideTip);
  $("#tbody").addEventListener("click", e => {
    const b = (e.target as Element).closest<HTMLElement>("[data-edit]"); if (!b) return;
    const r = store.readings.find(x => x.id === b.dataset.edit);
    if (r && r.memberId === store.me) onEdit(r);
  });
  $("#presets").addEventListener("click", e => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button"); if (!b) return;
    const p = b.dataset.p as "all" | "3y" | "1y", [, end] = extent(forTest());
    if (p === "all") view.from = view.to = null;
    else {
      const yrs = p === "1y" ? 1 : 3;
      view.to = new Date(+end + 864e5 * 14);
      view.from = new Date(end.getFullYear() - yrs, end.getMonth(), end.getDate());
    }
    setPreset(p); render(true);
  });
  $("#testSeg").addEventListener("click", e => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button"); if (!b || b.dataset.t === view.test) return;
    view.test = b.dataset.t as TestKey; render(true);
  });
  $("#resetZoom").addEventListener("click", () => { view.from = view.to = null; setPreset("all"); render(true); });

  let rt: ReturnType<typeof setTimeout>;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => render(false), 120); }).observe($("#chartWrap"));
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => render(false));
}

/** Show the dashboard for the first time once the data is loaded. */
export function startDashboard() {
  ready = true;
  render(true);
}
