import { $, css, reducedMotion } from "./dom";

/** Red blood cells drifting across the header. */
export function startCells() {
  const cv = $<HTMLCanvasElement>("#cells"), ctx = cv.getContext("2d");
  if (!ctx) return;
  let W = 0, H = 0;
  interface Cell { x: number; y: number; r: number; a: number; va: number; vx: number; vy: number; tilt: number }
  let parts: Cell[] = [];
  function size() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.max(6, Math.min(14, W / 80)));
    parts = Array.from({ length: n }, () => ({
      x: W * (0.45 + Math.random() * 0.6), y: Math.random() * H, r: 10 + Math.random() * 16, a: Math.random() * 6.28,
      va: (Math.random() - 0.5) * 0.004, vx: -(0.08 + Math.random() * 0.18), vy: (Math.random() - 0.5) * 0.08, tilt: 0.55 + Math.random() * 0.4,
    }));
  }
  function draw() {
    ctx!.clearRect(0, 0, W, H);
    const col = css("--c-rose") || "#C2457A";
    parts.forEach(p => {
      ctx!.save(); ctx!.translate(p.x, p.y); ctx!.rotate(p.a); ctx!.scale(1, p.tilt);
      const g = ctx!.createRadialGradient(0, 0, p.r * 0.15, 0, 0, p.r);
      g.addColorStop(0, col + "10"); g.addColorStop(0.55, col + "22"); g.addColorStop(1, col + "38");
      ctx!.fillStyle = g; ctx!.beginPath(); ctx!.arc(0, 0, p.r, 0, Math.PI * 2); ctx!.fill();
      ctx!.restore();
    });
  }
  let raf = 0;
  function tick() {
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.a += p.va;
      if (p.x < -40) { p.x = W + 40; p.y = Math.random() * H; }
      if (p.y < -30) p.y = H + 30;
      if (p.y > H + 30) p.y = -30;
    });
    draw();
    if (!document.hidden) raf = requestAnimationFrame(tick);
  }
  size(); draw();
  if (!reducedMotion) {
    raf = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); } });
  }
  new ResizeObserver(() => { size(); draw(); }).observe(cv.parentElement!);
}
