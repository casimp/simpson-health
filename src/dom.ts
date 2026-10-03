export function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el;
}
export const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
