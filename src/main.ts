import "./styles.css";
import { configured, db, loadMembers, loadReadings, myMemberId, friendlyError, type Session } from "./db";
import { store, view } from "./state";
import { TEST_KEYS, type TestKey } from "./tests";
import { initDashboard, startDashboard, render, setEditHandler } from "./dashboard";
import { initEntry } from "./entry";
import { initGate, showGate, hideGate } from "./gate";
import { initAccount, paintMe } from "./account";
import { initTheme } from "./theme";
import { startCells } from "./cells";
import { $ } from "./dom";

let loadedAt = 0;
async function reload() {
  [store.members, store.readings] = await Promise.all([loadMembers(), loadReadings()]);
  loadedAt = Date.now();
}

/** Signed in: either show the dashboard, or ask them to join the family first. */
async function enter(session: Session | null) {
  if (!session) return showGate("signin");
  try {
    const id = await myMemberId();
    if (!id) return gate.startJoin();
    store.me = id;
    await reload();
  } catch (x) {
    return showGate("message", "Couldn’t load the results: " + friendlyError(x as Error) +
      ". If this keeps happening, the database may be paused: open the Supabase dashboard and restore it.");
  }
  // Start on your own results if you have any, otherwise on whoever does.
  const hasData = (id: string) => store.readings.some(r => r.memberId === id);
  const first = hasData(store.me) ? store.me : store.members.find(m => hasData(m.id))?.id ?? store.me;
  view.people = new Set([first]);
  view.test = TEST_KEYS.find(k => store.readings.some(r => r.test === k && r.memberId === first)) ?? "rbc";
  paintMe();
  hideGate();
  $(".wrap").hidden = false;
  startDashboard();
}

const gate = initGate(s => void enter(s), () => void db.auth.getSession().then(({ data }) => enter(data.session)));
initDashboard();
initTheme(() => render(false));
initAccount();
startCells();
const entry = initEntry(async (test: TestKey) => {
  await reload();
  view.test = test; view.people.add(store.me);
  render(true);
});
setEditHandler(r => entry.open(r));

// Pick up results other people added while the app sat in the background.
document.addEventListener("visibilitychange", async () => {
  if (document.hidden || !store.me || Date.now() - loadedAt < 60_000) return;
  try { await reload(); render(false); } catch { /* offline; try again next time */ }
});

if (!configured) {
  showGate("message", "This copy isn’t connected to a database yet. See SETUP.md.");
} else {
  void db.auth.getSession().then(({ data }) => enter(data.session));
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
