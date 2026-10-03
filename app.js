
(function(){
"use strict";

/* ---------- People and tests ---------- */
// People ids must match public.members in supabase/schema.sql. Adding a test only needs an entry here.
const PEOPLE = [
  {id:"sue",   name:"Sue",   full:"Sue Simpson",   color:"--sue"},
  {id:"phil",  name:"Phil",  full:"Phil Simpson",  color:"--phil"},
  {id:"chris", name:"Chris", full:"Chris Simpson", color:"--chris"},
  {id:"anna",  name:"Anna",  full:"Anna Simpson",  color:"--anna"}
];
const TESTS = {
  rbc:{name:"Red blood cell count", short:"Red cells", unit:"×10¹²/L", low:3.80, high:4.85, dp:2,
       desc:"Red blood cells carry oxygen from the lungs to the rest of the body. This counts how many are in a litre of blood."},
  hb:{name:"Haemoglobin", short:"Haemoglobin", unit:"g/L", low:112, high:148, dp:0,
       desc:"Haemoglobin is the protein inside red blood cells that carries the oxygen. This measures how much is in a litre of blood."},
  alp:{name:"Alkaline phosphatase", short:"ALP", unit:"IU/L", low:30, high:130, dp:0,
       desc:"Alkaline phosphatase (ALP) is an enzyme found mostly in the liver and bones. It is measured in international units per litre."},
  ast:{name:"Aspartate aminotransferase", short:"AST", unit:"IU/L", low:0, high:35, dp:0,
       desc:"Aspartate aminotransferase (AST) is an enzyme found mainly in the liver, heart and muscles. It is measured in international units per litre."},
  alt:{name:"Alanine aminotransferase", short:"ALT", unit:"IU/L", low:0, high:35, dp:0,
       desc:"Alanine aminotransferase (ALT) is an enzyme found mostly in the liver. It is measured in international units per litre."},
  ggt:{name:"Gamma-glutamyl transferase", short:"GGT", unit:"IU/L", low:7, high:32, dp:0,
       desc:"Gamma-glutamyl transferase (GGT) is an enzyme found mainly in the liver. It is measured in international units per litre."}
};

/* ---------- Results (loaded from Supabase) ---------- */
const RESULTS = [];
let db = null, me = null, ready = false;   // me = the signed-in person's member id, or null if they can't add results
function fromRow(row){
  const r = {id:String(row.id), p:row.member_id, t:row.test, date:new Date(row.taken_at), v:+row.value, low:+row.ref_low, high:+row.ref_high, note:row.note||""};
  r.s = r.v < r.low ? "below" : r.v > r.high ? "above" : "in";
  return r;
}
async function loadResults(){
  const rows = [], page = 1000;   // Supabase returns at most 1000 rows per request
  for(let from=0;; from+=page){
    const {data, error} = await db.from("results").select("id,member_id,test,taken_at,value,ref_low,ref_high,note").order("id").range(from, from+page-1);
    if(error) throw error;
    rows.push(...data);
    if(data.length < page) break;
  }
  RESULTS.length = 0;
  rows.filter(r=>TESTS[r.test] && person(r.member_id)).forEach(r=>RESULTS.push(fromRow(r)));
}

/* ---------- State ---------- */
const state = { people:new Set(["sue"]), test:"rbc", from:null, to:null, preset:"all", status:"all", sort:{k:"date",dir:-1}, hl:null };

/* ---------- Helpers ---------- */
const $ = s => document.querySelector(s);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = d => `${String(d.getDate()).padStart(2,"0")} ${MON[d.getMonth()]} ${d.getFullYear()}`;
const fmtShort = d => `${MON[d.getMonth()]} ${d.getFullYear()}`;
const fmtTime = d => `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
const person = id => PEOPLE.find(p=>p.id===id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LABEL = {in:"In range", above:"Above range", below:"Below range"};
const ICON = {in:"●", above:"▲", below:"▼"};
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function forTest(){ return RESULTS.filter(r=>r.t===state.test && state.people.has(r.p)); }
function extent(rows){
  if(!rows.length) return [new Date(2020,0,1), new Date()];
  let a=rows[0].date, b=rows[0].date; rows.forEach(r=>{ if(r.date<a)a=r.date; if(r.date>b)b=r.date; });
  return [a,b];
}
function viewRange(rows){
  const [a,b] = extent(rows);
  const pad = Math.max((b-a)*0.02, 864e5*10);
  return [state.from || new Date(+a-pad), state.to || new Date(+b+pad)];
}
function gaugePos(v, low, high){
  // place low..high in the middle 50% of the bar
  const span = high-low, min = low-span*0.5, max = high+span*0.5;
  return Math.max(0, Math.min(100, (v-min)/(max-min)*100));
}
function gaugeHTML(r, color){
  const lo = gaugePos(r.low,r.low,r.high), hi = gaugePos(r.high,r.low,r.high), m = gaugePos(r.v,r.low,r.high);
  return `<div class="gauge"><div class="band" style="left:${lo}%;width:${hi-lo}%"></div><div class="mk" style="left:${m}%;color:${color}"></div></div>`;
}
function niceStep(range, target){
  const raw = range/target, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw/mag;
  return (f<1.5?1:f<3?2:f<3.5?2.5:f<7?5:10)*mag;
}

/* ---------- People chips ---------- */
function renderPeople(){
  $("#people").innerHTML = PEOPLE.map(p=>{
    const n = RESULTS.filter(r=>r.p===p.id).length;
    const on = state.people.has(p.id);
    return `<button type="button" class="person" style="--c:var(${p.color})" data-id="${p.id}" aria-pressed="${on}">
      <span class="av">${p.name[0]}</span>
      <span class="nm">${esc(p.full)}<span class="ct">${n ? n+" results" : "No results yet"}</span></span>
    </button>`;
  }).join("");
}
$("#people").addEventListener("click", e=>{
  const b = e.target.closest(".person"); if(!b) return;
  const id = b.dataset.id;
  state.people.has(id) ? state.people.delete(id) : state.people.add(id);
  state.from = state.to = null; setPreset("all");
  render(true);
});

/* ---------- Tiles ---------- */
function renderTiles(rows){
  const t = TESTS[state.test];
  const el = $("#tiles"), el2 = $("#tiles2");
  if(!rows.length){ el.innerHTML = el2.innerHTML = ""; el.hidden = el2.hidden = true; return; }
  el.hidden = el2.hidden = false;
  const sorted = rows.slice().sort((a,b)=>b.date-a.date);
  const latest = sorted[0];
  const c = {in:0,above:0,below:0}; rows.forEach(r=>c[r.s]++);
  const [a,b] = extent(rows);
  const multi = state.people.size>1;
  const who = multi ? ` · ${person(latest.p).name}` : "";
  el.innerHTML = `
  <div class="tile latest">
    <div style="display:flex;flex-direction:column;gap:8px">
      <span class="label">Latest reading${who}</span>
      <div class="big">${latest.v.toFixed(t.dp)}<small>${t.unit}</small></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="pill ${latest.s}">${ICON[latest.s]} ${LABEL[latest.s]}</span><span class="meta">${fmtDate(latest.date)}</span></div>
    </div>
    <div class="lt-gauge">
      ${gaugeHTML(latest, `var(--${latest.s})`)}
      <div class="gauge-labels num"><span></span><span>Reference range ${latest.low.toFixed(t.dp)} – ${latest.high.toFixed(t.dp)}</span><span></span></div>
    </div>
  </div>`;
  el2.innerHTML = `
  <div class="tile">
    <span class="label">Readings shown</span>
    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div class="big" data-count="${rows.length}">${rows.length}</div><span class="meta">${fmtShort(a)} to ${fmtShort(b)} · ${countYears(rows)}</span></div>
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
    <span class="label">${multi ? "Reference ranges" : esc(person(latest.p).name)+"’s reference range"}</span>
    ${rangeList(rows, t)}
    <span class="meta">${t.desc} Normal ranges vary with age and sex, so each person is compared with the range on their own lab report.</span>
  </div>`;
  if(!reduced) countUp(el2.querySelector("[data-count]"), rows.length);
}
function rangeList(rows, t){
  const pids = [...new Set(rows.map(r=>r.p))];
  const fmt = r => `${r.low.toFixed(t.dp)}–${r.high.toFixed(t.dp)}`;
  const history = pid => {
    const pr = rows.filter(r=>r.p===pid).sort((a,b)=>b.date-a.date);
    const runs = [];
    pr.forEach(r=>{ const l = runs[runs.length-1]; if(l && l.low===r.low && l.high===r.high) l.start = r.date; else runs.push({low:r.low, high:r.high, start:r.date, end:r.date}); });
    return {cur: runs[0], older: runs.slice(1)};
  };
  if(pids.length===1){
    const {cur, older} = history(pids[0]);
    return `<div class="big" style="font-size:28px">${fmt(cur)}<small>${t.unit}</small></div>` +
      (older.length ? `<span class="meta">The lab’s range has changed over time. Earlier results used ${older.map(o=>`${fmt(o)} (${fmtShort(o.start)}${+o.start===+o.end?"":" – "+fmtShort(o.end)})`).join(" and ")}.</span>` : "");
  }
  return `<div class="legend" style="flex-direction:column">${pids.map(pid=>{ const {cur} = history(pid);
    return `<span><i class="sw" style="background:var(${person(pid).color})"></i>${esc(person(pid).name)} <b>${fmt(cur)}</b></span>`; }).join("")}</div>`;
}
function countYears(rows){
  const ys = new Set(rows.map(r=>r.date.getFullYear()));
  return `${ys.size} calendar year${ys.size===1?"":"s"}`;
}
function countUp(node, n){
  const t0 = performance.now(), dur = 700;
  (function step(t){ const k = Math.min(1,(t-t0)/dur); node.textContent = Math.round(n*(1-Math.pow(1-k,3))); if(k<1) requestAnimationFrame(step); })(t0);
}

/* ---------- Main chart ---------- */
let points = [];
function renderChart(rows, view, animate){
  const svg = $("#chart"), wrap = $("#chartWrap"), t = TESTS[state.test];
  const W = wrap.clientWidth, H = W < 560 ? 280 : 360;
  const m = {l:44, r:14, t:16, b:30};
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", H);
  hideTip();
  if(!rows.length){
    const names = PEOPLE.filter(p=>state.people.has(p.id)).map(p=>p.name);
    svg.innerHTML = "";
    svg.setAttribute("height", 0);
    let msg = state.people.size===0 ? `<strong>Pick someone above</strong>Tap a name to see their results.`
      : `<strong>Nothing here yet for ${esc(names.join(" & "))}</strong>${state.people.has(me) ? "Tap “Add result” to put in your first one." : "Results will appear here once they’re added."}`;
    if(state.people.size && forTest().length) msg = `<strong>No readings in this window</strong>Tap “Show all dates” above the chart.`;
    let e = wrap.querySelector(".empty"); if(!e){ e=document.createElement("div"); e.className="empty"; wrap.appendChild(e); }
    e.innerHTML = `<div>${msg}</div>`;
    points = []; return;
  }
  const e = wrap.querySelector(".empty"); if(e) e.remove();

  const vals = rows.map(r=>r.v);
  const ranges = []; const rk = new Set();
  rows.forEach(r=>{ const k = r.low+"|"+r.high; if(!rk.has(k)){ rk.add(k); ranges.push({low:r.low, high:r.high, p:r.p}); } });
  let lo = Math.min(...ranges.map(r=>r.low), ...vals), hi = Math.max(...ranges.map(r=>r.high), ...vals);
  const pad = (hi-lo)*0.12; lo -= pad; hi += pad;
  const x = d => m.l + (d-view[0])/(view[1]-view[0])*(W-m.l-m.r);
  const y = v => m.t + (1-(v-lo)/(hi-lo))*(H-m.t-m.b);

  let g = "";
  // y grid
  const step = niceStep(hi-lo, H<300?4:6);
  g += `<g class="grid">`;
  for(let v=Math.ceil(lo/step)*step; v<=hi; v+=step){
    g += `<line x1="${m.l}" x2="${W-m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l-8}" y="${y(v)+4}" text-anchor="end">${v.toFixed(step>=1?0:Math.abs(step*10-Math.round(step*10))>1e-9?2:1)}</text>`;
  }
  g += `</g>`;
  // band
  // the range can change over time (new lab method), so draw it as runs along the time axis
  const pids = [...new Set(rows.map(r=>r.p))];
  pids.forEach((pid, pi)=>{
    const pr = rows.filter(r=>r.p===pid).sort((a,b)=>a.date-b.date);
    const runs = [];
    pr.forEach(r=>{ const last = runs[runs.length-1]; if(last && last.low===r.low && last.high===r.high) last.end = r.date; else runs.push({low:r.low, high:r.high, start:r.date, end:r.date}); });
    runs.forEach((b,i)=>{
      const x0 = i===0 ? m.l : (x(runs[i-1].end)+x(b.start))/2;
      const x1 = i===runs.length-1 ? W-m.r : (x(b.end)+x(runs[i+1].start))/2;
      const op = pids.length>1 ? 0.6 : 1;
      g += `<rect class="band-rect" x="${x0}" width="${Math.max(0,x1-x0)}" y="${y(b.high)}" height="${y(b.low)-y(b.high)}" fill-opacity="${op}"/>`;
      g += `<line class="band-line" x1="${x0}" x2="${x1}" y1="${y(b.high)}" y2="${y(b.high)}"/><line class="band-line" x1="${x0}" x2="${x1}" y1="${y(b.low)}" y2="${y(b.low)}"/>`;
      if(i<runs.length-1 && x1-x0>90 && W>=560) g += `<text class="band-label" x="${x0+6}" y="${y(b.high)+14}">${b.low.toFixed(t.dp)}–${b.high.toFixed(t.dp)}</text>`;
      if(i===runs.length-1 && W>=560){
        const who = pids.length>1 ? person(pid).name+"’s range" : "Reference range";
        g += `<text class="band-label" x="${W-m.r-6}" y="${y(b.high)+14+pi*14}" text-anchor="end">${who} ${b.low.toFixed(t.dp)}–${b.high.toFixed(t.dp)}</text>`;
      }
    });
  });
  // x ticks
  const spanDays = (view[1]-view[0])/864e5;
  const ticks = [];
  let d = new Date(view[0].getFullYear(), view[0].getMonth(), 1);
  const mStep = spanDays>1100?12: spanDays>500?6: spanDays>200?3: spanDays>70?1: 1;
  if(mStep===12) d = new Date(view[0].getFullYear(),0,1);
  else d.setMonth(Math.floor(d.getMonth()/mStep)*mStep);
  while(d<=view[1]){ if(d>=view[0]) ticks.push(new Date(d)); d.setMonth(d.getMonth()+mStep); }
  const minGap = W<560 ? 56 : 70; let lastX = -1e9;
  ticks.forEach(tk=>{
    const tx = x(tk); if(tx-lastX < minGap) return; lastX = tx;
    const lab = mStep===12 ? tk.getFullYear() : (tk.getMonth()===0 || ticks.length<3 ? `${MON[tk.getMonth()]} ${String(tk.getFullYear()).slice(2)}` : `${MON[tk.getMonth()]} ’${String(tk.getFullYear()).slice(2)}`);
    g += `<line x1="${tx}" x2="${tx}" y1="${m.t}" y2="${H-m.b}" stroke="var(--line)" stroke-opacity=".6"/><text x="${tx}" y="${H-m.b+18}" text-anchor="middle">${lab}</text>`;
  });

  // series per person
  points = [];
  const byP = {};
  rows.slice().sort((a,b)=>a.date-b.date).forEach(r=>(byP[r.p]=byP[r.p]||[]).push(r));
  const multi = Object.keys(byP).length>1;
  g += `<g id="series">`;
  Object.entries(byP).forEach(([pid, arr])=>{
    const col = `var(${person(pid).color})`;
    const path = arr.map((r,i)=>`${i?"L":"M"}${x(r.date).toFixed(1)},${y(r.v).toFixed(1)}`).join(" ");
    g += `<path class="series" d="${path}" stroke="${multi?col:"var(--accent)"}" stroke-opacity=".85"/>`;
  });
  g += `</g><g id="dots">`;
  const all = rows.slice().sort((a,b)=>a.date-b.date);
  all.forEach((r,i)=>{
    const px = x(r.date), py = y(r.v), fill = `var(--${r.s})`;
    const delay = animate && !reduced ? (300 + i*(900/all.length)).toFixed(0) : 0;
    const cls = `dot${animate && !reduced ? " pop":""}`;
    const st = delay ? `style="animation-delay:${delay}ms"` : "";
    const stroke = multi ? `stroke="var(${person(r.p).color})"` : "";
    if(r.s==="in") g += `<circle class="${cls}" ${st} ${stroke} cx="${px}" cy="${py}" r="4.6" fill="${fill}"/>`;
    else if(r.s==="above") g += `<path class="${cls}" ${st} ${stroke} d="M${px},${py-6.5} L${px+6},${py+4} L${px-6},${py+4} Z" fill="${fill}"/>`;
    else g += `<path class="${cls}" ${st} ${stroke} d="M${px},${py+6.5} L${px+6},${py-4} L${px-6},${py-4} Z" fill="${fill}"/>`;
    points.push({r, px, py});
  });
  g += `</g><g id="hover" style="display:none"><line class="guide" id="hGuide" y1="${m.t}" y2="${H-m.b}"/><circle class="ring" id="hRing" r="10"/></g>`;
  g += `<rect id="hit" x="${m.l}" y="0" width="${W-m.l-m.r}" height="${H}" fill="transparent"/>`;
  svg.innerHTML = g;

  if(animate && !reduced){
    svg.querySelectorAll(".series").forEach(p=>{
      const len = p.getTotalLength();
      p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      p.getBoundingClientRect();
      p.style.transition = "stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1)";
      p.style.strokeDashoffset = 0;
    });
  }
  const hit = svg.querySelector("#hit");
  const inv = px => new Date(+view[0] + (Math.max(m.l,Math.min(W-m.r,px))-m.l)/(W-m.l-m.r)*(view[1]-view[0]));
  const local = e => { const r = svg.getBoundingClientRect(); return (e.clientX - r.left) * (W / r.width); };
  let drag = null, sel = null;
  hit.addEventListener("pointerdown", e=>{
    drag = {x0: local(e), id: e.pointerId, moved:false};
    try{ hit.setPointerCapture(e.pointerId); }catch(_){}
    onHover(e);
  });
  hit.addEventListener("pointermove", e=>{
    if(drag){
      const x1 = local(e);
      if(!drag.moved && Math.abs(x1-drag.x0) > 10){ drag.moved = true; hideTip(); sel = document.createElementNS("http://www.w3.org/2000/svg","rect"); sel.setAttribute("class","zsel"); sel.setAttribute("y", m.t); sel.setAttribute("height", H-m.t-m.b); svg.insertBefore(sel, hit); }
      if(drag.moved){ const a = Math.max(m.l, Math.min(drag.x0,x1)), b = Math.min(W-m.r, Math.max(drag.x0,x1)); sel.setAttribute("x", a); sel.setAttribute("width", Math.max(1,b-a)); return; }
    }
    onHover(e);
  });
  const end = e=>{
    if(!drag) return;
    if(drag.moved){
      const x1 = local(e), a = inv(Math.min(drag.x0,x1)), b = inv(Math.max(drag.x0,x1));
      if(b-a > 864e5*3){ state.from = a; state.to = b; setPreset(null); drag = null; render(true); return; }
      if(sel) sel.remove();
    }
    drag = null;
  };
  hit.addEventListener("pointerup", end);
  hit.addEventListener("pointercancel", ()=>{ drag = null; if(sel) sel.remove(); });
  hit.addEventListener("dblclick", ()=>{ if(state.from||state.to){ state.from = state.to = null; setPreset("all"); render(true); } });
  hit.addEventListener("pointerleave", e=>{ if(e.pointerType==="mouse" && !drag) hideTip(); });
}
function onHover(e){
  if(!points.length) return;
  const svg = $("#chart"), rect = svg.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  let best = null, bd = Infinity;
  points.forEach(p=>{ const d = Math.abs(p.px-mx) + Math.abs(p.py-my)*0.15; if(d<bd){bd=d;best=p;} });
  if(best) showTip(best);
}
function showTip(p){
  const r = p.r, t = TESTS[r.t];
  const hov = $("#hover"); hov.style.display = "";
  $("#hGuide").setAttribute("x1",p.px); $("#hGuide").setAttribute("x2",p.px);
  const ring = $("#hRing"); ring.setAttribute("cx",p.px); ring.setAttribute("cy",p.py); ring.setAttribute("stroke",`var(--${r.s})`);
  let diff = "";
  if(r.s==="above") diff = `${(r.v-r.high).toFixed(t.dp)} above the upper limit`;
  else if(r.s==="below") diff = `${(r.low-r.v).toFixed(t.dp)} below the lower limit`;
  else diff = `Within ${r.low.toFixed(t.dp)}–${r.high.toFixed(t.dp)}`;
  if(r.note) diff += `<br>${esc(r.note)}`;
  const tip = $("#tip");
  tip.innerHTML = `<div class="tl">${esc(person(r.p).full)} · ${fmtDate(r.date)}, ${fmtTime(r.date)}</div>
    <div class="tv">${r.v.toFixed(t.dp)}<small>${t.unit}</small></div>
    <div class="tl">${diff}</div>
    <span class="pill ${r.s}">${ICON[r.s]} ${LABEL[r.s]}</span>`;
  const wrap = $("#chartWrap"), W = wrap.clientWidth;
  tip.classList.add("show");
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = p.px + 16; if(left+tw > W) left = p.px - tw - 16; if(left<0) left = Math.max(0,(W-tw)/2);
  let top = p.py - th - 14; if(top < 0) top = p.py + 18;
  tip.style.left = left+"px"; tip.style.top = top+"px";
  // highlight table row
  document.querySelectorAll("#tbody tr.hl").forEach(x=>x.classList.remove("hl"));
  const row = document.querySelector(`#tbody tr[data-id="${r.id}"]`); if(row) row.classList.add("hl");
}
function hideTip(){
  const tip = $("#tip"); if(tip) tip.classList.remove("show");
  const hov = document.getElementById("hover"); if(hov) hov.style.display = "none";
  document.querySelectorAll("#tbody tr.hl").forEach(x=>x.classList.remove("hl"));
}

/* ---------- Overview brush ---------- */
let ov = null;
function renderOverview(all, view){
  const svg = $("#overview"), W = $("#ovWrap").clientWidth, H = 54, m = {l:44,r:14,t:6,b:16};
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`); svg.setAttribute("height",H);
  if(!all.length){ svg.innerHTML = ""; ov = null; return; }
  const [a0,b0] = extent(all); const pad = Math.max((b0-a0)*0.02, 864e5*10);
  const full = [new Date(+a0-pad), new Date(+b0+pad)];
  const x = d => m.l + (d-full[0])/(full[1]-full[0])*(W-m.l-m.r);
  const vals = all.map(r=>r.v); const lo = Math.min(...vals), hi = Math.max(...vals);
  const y = v => m.t + (1-(v-lo)/((hi-lo)||1))*(H-m.t-m.b);
  let g = "";
  for(let yr=full[0].getFullYear()+1; yr<=full[1].getFullYear(); yr++){
    const tx = x(new Date(yr,0,1));
    g += `<line x1="${tx}" x2="${tx}" y1="${m.t}" y2="${H-m.b}" stroke="var(--line)"/><text x="${tx+3}" y="${H-3}">${yr}</text>`;
  }
  const sorted = all.slice().sort((a,b)=>a.date-b.date);
  g += `<path d="${sorted.map((r,i)=>`${i?"L":"M"}${x(r.date).toFixed(1)},${y(r.v).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--muted)" stroke-width="1.2" stroke-opacity=".7"/>`;
  sorted.forEach(r=>{ g += `<circle cx="${x(r.date)}" cy="${y(r.v)}" r="1.8" fill="var(--${r.s})"/>`; });
  const sx0 = Math.max(m.l, x(view[0])), sx1 = Math.min(W-m.r, x(view[1]));
  const isAll = !state.from && !state.to;
  if(!isAll){
    g += `<rect class="sel" x="${sx0}" y="1" width="${Math.max(2,sx1-sx0)}" height="${H-m.b}" rx="4"/>`;
    g += `<rect class="handle" x="${sx0-2}" y="${(H-m.b)/2-8}" width="4" height="16" rx="2"/><rect class="handle" x="${sx1-2}" y="${(H-m.b)/2-8}" width="4" height="16" rx="2"/>`;
  }
  svg.innerHTML = g;
  ov = {x, full, W, m, sx0, sx1, isAll, inv: px => new Date(+full[0] + (Math.max(m.l,Math.min(W-m.r,px))-m.l)/(W-m.l-m.r)*(full[1]-full[0]))};
}

/* ---------- Heat strip ---------- */
function renderHeat(all){
  const el = $("#heat");
  if(!all.length){ el.innerHTML = `<p class="hint" style="grid-column:1/-1">No readings to show.</p>`; return; }
  const [a,b] = extent(all);
  const counts = {}, worst = {};
  all.forEach(r=>{ const k = r.date.getFullYear()+"-"+r.date.getMonth(); counts[k]=(counts[k]||0)+1; });
  const max = Math.max(...Object.values(counts));
  let h = `<span></span>` + MON.map(m=>`<span class="mh">${m[0]}</span>`).join("");
  const selYear = state.from && state.to && state.from.getMonth()===0 && state.from.getDate()===1 && state.to.getMonth()===11 && state.to.getDate()===31 && state.from.getFullYear()===state.to.getFullYear() ? state.from.getFullYear() : null;
  for(let yr=b.getFullYear(); yr>=a.getFullYear(); yr--){
    h += `<button type="button" class="yr${selYear===yr?" on":""}" data-y="${yr}">${yr}</button>`;
    for(let mo=0; mo<12; mo++){
      const n = counts[yr+"-"+mo]||0;
      const k = n? 0.35 + 0.65*(n/max) : 0;
      const bg = n ? `background:color-mix(in srgb,var(--accent) ${Math.round(k*100)}%,var(--surface-2))` : "";
      h += `<div class="m${n?" has":""}" style="${bg}" title="${MON[mo]} ${yr}: ${n} reading${n===1?"":"s"}">${n>1?`<span class="n">${n}</span>`:""}</div>`;
    }
  }
  el.innerHTML = h;
}
$("#heat").addEventListener("click", e=>{
  const b = e.target.closest(".yr"); if(!b) return;
  const y = +b.dataset.y;
  state.from = new Date(y,0,1); state.to = new Date(y,11,31,23,59); setPreset(null);
  render(true);
});

/* ---------- Table ---------- */
function renderTable(rows){
  const t = TESTS[state.test];
  const f = rows.filter(r=>state.status==="all" || r.s===state.status);
  const {k,dir} = state.sort;
  f.sort((a,b)=> (k==="date" ? a.date-b.date : a.v-b.v || a.date-b.date) * dir);
  $("#tableCard").classList.toggle("multi", state.people.size>1);
  $("#rowCount").textContent = `(${f.length})`;
  $("#tbody").innerHTML = f.length ? f.map(r=>{
    const p = person(r.p);
    return `<tr data-id="${r.id}">
      <td><span class="num">${fmtDate(r.date)}</span> <span class="hint num">${fmtTime(r.date)}</span></td>
      <td class="col-who"><span class="who"><i style="background:var(${p.color})"></i>${esc(p.name)}</span></td>
      <td class="num" style="font-weight:600">${r.v.toFixed(t.dp)}</td>
      <td class="col-pos">${gaugeHTML(r, `var(--${r.s})`)}</td>
      <td><span class="pill ${r.s}">${ICON[r.s]} ${LABEL[r.s]}</span>${r.p===me ? `<button type="button" class="edit-btn" data-edit="${r.id}" aria-label="Edit ${fmtDate(r.date)} reading">Edit</button>` : ""}</td>
    </tr>`;}).join("") : `<tr><td colspan="5" class="hint" style="text-align:center;padding:24px">No readings match.</td></tr>`;
  ["Date","Val"].forEach(n=>{
    const th = $("#th"+n), key = n==="Date"?"date":"value", arr = th.querySelector(".arr");
    if(k===key){ th.setAttribute("aria-sort", dir<0?"descending":"ascending"); arr.textContent = dir<0?"↓":"↑"; }
    else { th.removeAttribute("aria-sort"); arr.textContent = "↕"; }
  });
}
document.querySelector("thead").addEventListener("click", e=>{
  const b = e.target.closest("button[data-k]"); if(!b) return;
  const k = b.dataset.k;
  state.sort = state.sort.k===k ? {k, dir:-state.sort.dir} : {k, dir:-1};
  renderTable(currentRows);
});
$("#statusSeg").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  state.status = b.dataset.s;
  $("#statusSeg").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", x===b));
  renderTable(currentRows);
});
$("#tbody").addEventListener("mouseover", e=>{
  const tr = e.target.closest("tr[data-id]"); if(!tr) return;
  const p = points.find(p=>p.r.id===tr.dataset.id); if(p) showTip(p);
});
$("#tbody").addEventListener("mouseleave", hideTip);

/* ---------- Presets ---------- */
function setPreset(p){
  state.preset = p;
  $("#presets").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.p===p));
}
$("#presets").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  const p = b.dataset.p, all = forTest(), [, end] = extent(all);
  if(p==="all"){ state.from = state.to = null; }
  else { const yrs = p==="1y"?1:3; state.to = new Date(+end + 864e5*14); state.from = new Date(end.getFullYear()-yrs, end.getMonth(), end.getDate()); }
  setPreset(p); render(true);
});

$("#testSeg").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b || b.dataset.t===state.test) return;
  state.test = b.dataset.t; render(true);
});

$("#resetZoom").addEventListener("click", ()=>{ state.from = state.to = null; setPreset("all"); render(true); });

/* ---------- Render ---------- */
let currentRows = [];
function render(animate){
  if(!ready) return;
  const t = TESTS[state.test];
  $("#testName").textContent = t.name; $("#testUnit").textContent = t.unit;
  $("#testSeg").innerHTML = Object.entries(TESTS).map(([k,tt])=>{
    const n = RESULTS.filter(r=>r.t===k && state.people.has(r.p)).length;
    return `<button type="button" data-t="${k}" aria-pressed="${k===state.test}">${tt.short}${n?` <span class="tcount">${n}</span>`:""}</button>`;
  }).join("");
  renderPeople();
  const all = forTest();
  const view = viewRange(all);
  currentRows = all.filter(r=>r.date>=view[0] && r.date<=view[1]);
  $("#resetZoom").hidden = !(state.from || state.to);
  $("#viewLabel").textContent = all.length ? `${fmtShort(view[0])} – ${fmtShort(view[1])} · ${currentRows.length} reading${currentRows.length===1?"":"s"}` : "";
  const names = PEOPLE.filter(p=>state.people.has(p.id)).map(p=>p.name);
  $("#chartTitle").textContent = names.length ? `${names.join(", ")} over time` : "Over time";
  renderTiles(currentRows);
  renderChart(currentRows, view, animate);
  renderHeat(all);
  renderTable(currentRows);
}

/* ---------- Theme toggle ---------- */
const THEMES = ["auto","light","dark"]; let theme = "auto";
try{ theme = localStorage.getItem("sfh-theme") || "auto"; }catch(e){}
function applyTheme(){
  if(theme==="auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  $("#themeLabel").textContent = theme==="auto"?"Auto":theme==="light"?"Light":"Dark";
  $("#themeIcon").textContent = theme==="auto"?"◐":theme==="light"?"☀":"☾";
}
$("#themeBtn").addEventListener("click", ()=>{
  theme = THEMES[(THEMES.indexOf(theme)+1)%3];
  try{ localStorage.setItem("sfh-theme", theme); }catch(e){}
  applyTheme(); render(false);
});
applyTheme();

/* ---------- Floating red cells in the header ---------- */
(function cells(){
  const cv = $("#cells"), ctx = cv.getContext("2d"); if(!ctx) return;
  let W=0,H=0,dpr=1, parts=[];
  function size(){
    const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio||1);
    W = r.width; H = r.height; cv.width = W*dpr; cv.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    const n = Math.round(Math.max(6, Math.min(14, W/80)));
    parts = Array.from({length:n},(_,i)=>({x:W*(0.45+Math.random()*0.6), y:Math.random()*H, r:10+Math.random()*16, a:Math.random()*6.28, va:(Math.random()-.5)*0.004, vx:-(0.08+Math.random()*0.18), vy:(Math.random()-.5)*0.08, tilt:0.55+Math.random()*0.4}));
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    const col = css("--sue") || "#C2457A";
    parts.forEach(p=>{
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a); ctx.scale(1,p.tilt);
      const g = ctx.createRadialGradient(0,0,p.r*0.15,0,0,p.r);
      g.addColorStop(0, col+"10"); g.addColorStop(0.55, col+"22"); g.addColorStop(1, col+"38");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill();
      ctx.restore();
    });
  }
  function tick(){
    parts.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.a+=p.va; if(p.x<-40){p.x=W+40; p.y=Math.random()*H;} if(p.y<-30)p.y=H+30; if(p.y>H+30)p.y=-30; });
    draw(); if(!document.hidden) raf = requestAnimationFrame(tick);
  }
  let raf; size(); draw();
  if(!reduced){ raf = requestAnimationFrame(tick); document.addEventListener("visibilitychange",()=>{ if(!document.hidden){cancelAnimationFrame(raf); raf=requestAnimationFrame(tick);} }); }
  new ResizeObserver(()=>{ size(); draw(); }).observe(cv.parentElement);
})();

/* ---------- Resize ---------- */
let rt; new ResizeObserver(()=>{ clearTimeout(rt); rt = setTimeout(()=>render(false), 120); }).observe($("#chartWrap"));
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", ()=>render(false));


/* ---------- Add / edit a result ---------- */
const dlg = $("#entry"), ef = $("#entryForm");
let editing = null;
const pad2 = n => String(n).padStart(2,"0");
const num = s => { const v = parseFloat(String(s).trim().replace(",", ".")); return Number.isFinite(v) ? v : null; };
function lastRange(test){
  const mine = RESULTS.filter(r=>r.p===me && r.t===test).sort((a,b)=>b.date-a.date)[0];
  return mine ? [mine.low, mine.high] : [TESTS[test].low, TESTS[test].high];
}
function syncEntry(){
  const t = TESTS[ef.test.value];
  $("#entryUnit").textContent = t.unit;
  const v = num(ef.value.value), lo = num(ef.low.value), hi = num(ef.high.value);
  const prev = $("#entryStatus");
  if(v===null || lo===null || hi===null){ prev.innerHTML = ""; return; }
  const st = v < lo ? "below" : v > hi ? "above" : "in";
  prev.innerHTML = `<span class="pill ${st}">${ICON[st]} ${LABEL[st]}</span>`;
}
function openEntry(r){
  editing = r || null;
  $("#entryTitle").textContent = r ? "Edit result" : "Add a result";
  $("#entryWho").textContent = person(me).full;
  $("#entryDelete").hidden = !r;
  $("#entryErr").textContent = "";
  ef.test.innerHTML = Object.entries(TESTS).map(([k,t])=>`<option value="${k}">${esc(t.name)} (${esc(t.short)})</option>`).join("");
  const d = r ? r.date : new Date();
  ef.test.value = r ? r.t : state.test;
  ef.value.value = r ? r.v : "";
  ef.date.value = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  ef.time.value = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const [lo, hi] = r ? [r.low, r.high] : lastRange(ef.test.value);
  ef.low.value = lo; ef.high.value = hi;
  ef.note.value = r ? r.note : "";
  syncEntry();
  dlg.showModal();
  if(!r) ef.value.focus();
}
ef.test.addEventListener("change", ()=>{ const [lo,hi] = lastRange(ef.test.value); ef.low.value = lo; ef.high.value = hi; syncEntry(); });
ef.addEventListener("input", syncEntry);
$("#entryCancel").addEventListener("click", ()=>dlg.close());
async function afterChange(test){
  await loadResults();
  state.test = test; state.people.add(me);
  dlg.close(); render(true);
}
ef.addEventListener("submit", async e=>{
  e.preventDefault();
  const err = $("#entryErr"), btn = $("#entrySave");
  const v = num(ef.value.value), lo = num(ef.low.value), hi = num(ef.high.value);
  const when = new Date(`${ef.date.value}T${ef.time.value || "12:00"}`);
  if(v===null) return err.textContent = "Enter the result as a number.";
  if(lo===null || hi===null || lo >= hi) return err.textContent = "Check the reference range: the low number should be smaller than the high one.";
  if(isNaN(when)) return err.textContent = "Pick the date of the test.";
  if(when > new Date(Date.now() + 864e5)) return err.textContent = "That date is in the future.";
  const row = {member_id:me, test:ef.test.value, taken_at:when.toISOString(), value:v, ref_low:lo, ref_high:hi, note:ef.note.value.trim() || null};
  btn.disabled = true; err.textContent = "";
  const {error} = editing ? await db.from("results").update(row).eq("id", editing.id) : await db.from("results").insert(row);
  btn.disabled = false;
  if(error) return err.textContent = "Couldn’t save: " + error.message;
  await afterChange(row.test);
});
$("#entryDelete").addEventListener("click", async ()=>{
  if(!editing || !confirm(`Delete the ${TESTS[editing.t].short} result from ${fmtDate(editing.date)}?`)) return;
  const {error} = await db.from("results").delete().eq("id", editing.id);
  if(error) return $("#entryErr").textContent = "Couldn’t delete: " + error.message;
  await afterChange(editing.t);
});
$("#addBtn").addEventListener("click", ()=>openEntry(null));
$("#tbody").addEventListener("click", e=>{
  const b = e.target.closest("[data-edit]"); if(!b) return;
  const r = RESULTS.find(x=>x.id===b.dataset.edit); if(r && r.p===me) openEntry(r);
});

/* ---------- Sign in ---------- */
const gate = $("#gate");
function showGate(view, msg){
  gate.hidden = false;
  gate.querySelectorAll("[data-view]").forEach(el=>el.hidden = el.dataset.view!==view);
  if(msg!==undefined) gate.querySelector(`[data-view="${view}"] .gate-msg`).textContent = msg;
}
$("#signinForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const btn = e.target.querySelector("button"), err = $("#signinErr");
  btn.disabled = true; btn.textContent = "Signing in…"; err.textContent = "";
  const {data, error} = await db.auth.signInWithPassword({email:$("#email").value.trim().toLowerCase(), password:$("#password").value});
  btn.disabled = false; btn.textContent = "Sign in";
  if(error) return err.textContent = /invalid/i.test(error.message) ? "That email and password don’t match. Check them and try again." : error.message;
  enter(data.session);
});
document.querySelectorAll(".sign-out").forEach(b=>b.addEventListener("click", async ()=>{ await db.auth.signOut(); location.reload(); }));

let loadedAt = 0;
async function enter(session){
  try{
    const {data:id, error} = await db.rpc("my_member_id");
    if(error) throw error;
    if(!id || !person(id)) return showGate("stranger", `${session.user.email} isn’t on the family list. Ask whoever set this up to add it.`);
    me = id;
    await loadResults(); loadedAt = Date.now();
  }catch(x){
    return showGate("stranger", "Couldn’t load the results: " + (x.message || x));
  }
  const withData = PEOPLE.filter(p=>RESULTS.some(r=>r.p===p.id)).map(p=>p.id);
  state.people = new Set(RESULTS.some(r=>r.p===me) ? [me] : withData.slice(0,1).concat(withData.length ? [] : [me]));
  const firstTest = Object.keys(TESTS).find(k=>RESULTS.some(r=>r.t===k && state.people.has(r.p)));
  if(firstTest) state.test = firstTest;
  $("#meName").textContent = person(me).name;
  gate.hidden = true;
  document.querySelector(".wrap").hidden = false;
  ready = true;
  render(true);
}
// Pick up results other people added while the app sat in the background.
document.addEventListener("visibilitychange", async ()=>{
  if(document.hidden || !ready || Date.now()-loadedAt < 60000) return;
  loadedAt = Date.now();
  try{ await loadResults(); render(false); }catch(_){}
});

(async function boot(){
  const cfg = window.SFH_CONFIG || {};
  if(!cfg.url || !cfg.anonKey || /YOUR_/.test(cfg.url + cfg.anonKey)) return showGate("stranger", "This copy isn’t connected to a database yet. Fill in config.js (see SETUP.md).");
  db = supabase.createClient(cfg.url, cfg.anonKey, {auth:{persistSession:true, autoRefreshToken:true}});
  const {data:{session}} = await db.auth.getSession();
  if(session) enter(session); else showGate("signin");
})();

if("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
