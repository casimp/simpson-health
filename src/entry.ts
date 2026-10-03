import { TESTS, TEST_KEYS, isTestKey, type TestKey } from "./tests";
import type { Reading } from "./types";
import { store, view, member } from "./state";
import { parseNumber, statusOf } from "./logic";
import { dateInput, timeInput, fmtDate, esc, LABEL, ICON } from "./format";
import { saveReading, deleteReading, friendlyError } from "./db";
import { $ } from "./dom";

type EntryForm = HTMLFormElement & {
  test: HTMLSelectElement; value: HTMLInputElement; date: HTMLInputElement; time: HTMLInputElement;
  low: HTMLInputElement; high: HTMLInputElement; note: HTMLInputElement;
};

/** The add / edit result sheet. `onSaved` reloads the data and redraws. */
export function initEntry(onSaved: (test: TestKey) => Promise<void>) {
  const dlg = $<HTMLDialogElement>("#entry"), f = $<EntryForm>("#entryForm"), err = $("#entryErr");
  let editing: Reading | null = null;

  f.test.innerHTML = TEST_KEYS.map(k => `<option value="${k}">${esc(TESTS[k].name)} (${esc(TESTS[k].short)})</option>`).join("");

  const lastRange = (test: TestKey): [number, number] => {
    const mine = store.readings.filter(r => r.memberId === store.me && r.test === test).sort((a, b) => +b.date - +a.date)[0];
    return mine ? [mine.low, mine.high] : [TESTS[test].low, TESTS[test].high];
  };
  const currentTest = (): TestKey => (isTestKey(f.test.value) ? f.test.value : "rbc");
  const sync = () => {
    $("#entryUnit").textContent = TESTS[currentTest()].unit;
    const v = parseNumber(f.value.value), lo = parseNumber(f.low.value), hi = parseNumber(f.high.value);
    const st = v === null || lo === null || hi === null ? null : statusOf(v, lo, hi);
    $("#entryStatus").innerHTML = st ? `<span class="pill ${st}">${ICON[st]} ${LABEL[st]}</span>` : "";
  };

  function open(r: Reading | null) {
    editing = r;
    $("#entryTitle").textContent = r ? "Edit result" : "Add a result";
    $("#entryWho").textContent = member(store.me).fullName;
    $("#entryDelete").hidden = !r;
    err.textContent = "";
    const d = r ? r.date : new Date();
    f.test.value = r ? r.test : view.test;
    f.value.value = r ? String(r.value) : "";
    f.date.value = dateInput(d);
    f.time.value = timeInput(d);
    const [lo, hi] = r ? [r.low, r.high] : lastRange(currentTest());
    f.low.value = String(lo); f.high.value = String(hi);
    f.note.value = r ? r.note : "";
    sync();
    dlg.showModal();
    if (!r) f.value.focus();
  }

  f.test.addEventListener("change", () => { const [lo, hi] = lastRange(currentTest()); f.low.value = String(lo); f.high.value = String(hi); sync(); });
  f.addEventListener("input", sync);
  $("#entryCancel").addEventListener("click", () => dlg.close());

  f.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $<HTMLButtonElement>("#entrySave");
    const value = parseNumber(f.value.value), low = parseNumber(f.low.value), high = parseNumber(f.high.value);
    const date = new Date(`${f.date.value}T${f.time.value || "12:00"}`);
    if (value === null) { err.textContent = "Enter the result as a number."; return; }
    if (low === null || high === null || low >= high) { err.textContent = "Check the reference range: the low number should be smaller than the high one."; return; }
    if (isNaN(+date)) { err.textContent = "Pick the date of the test."; return; }
    if (+date > Date.now() + 864e5) { err.textContent = "That date is in the future."; return; }
    btn.disabled = true; err.textContent = "";
    try {
      const test = currentTest();
      await saveReading({ memberId: store.me, test, date, value, low, high, note: f.note.value }, editing?.id);
      await onSaved(test);
      dlg.close();
    } catch (x) {
      err.textContent = "Couldn’t save: " + friendlyError(x as Error);
    } finally {
      btn.disabled = false;
    }
  });

  $("#entryDelete").addEventListener("click", async () => {
    if (!editing || !confirm(`Delete the ${TESTS[editing.test].short} result from ${fmtDate(editing.date)}?`)) return;
    try {
      await deleteReading(editing.id);
      await onSaved(editing.test);
      dlg.close();
    } catch (x) {
      err.textContent = "Couldn’t delete: " + friendlyError(x as Error);
    }
  });

  $("#addBtn").addEventListener("click", () => open(null));
  return { open };
}
