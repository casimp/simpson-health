import { $ } from "./dom";

const THEMES = ["auto", "light", "dark"] as const;
type Theme = (typeof THEMES)[number];

export function initTheme(onChange: () => void) {
  let theme: Theme = "auto";
  try { const t = localStorage.getItem("sfh-theme"); if (t && (THEMES as readonly string[]).includes(t)) theme = t as Theme; } catch { /* storage blocked */ }
  const apply = () => {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    $("#themeLabel").textContent = theme === "auto" ? "Auto" : theme === "light" ? "Light" : "Dark";
    $("#themeIcon").textContent = theme === "auto" ? "◐" : theme === "light" ? "☀" : "☾";
  };
  $("#themeBtn").addEventListener("click", () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    try { localStorage.setItem("sfh-theme", theme); } catch { /* storage blocked */ }
    apply(); onChange();
  });
  apply();
}
