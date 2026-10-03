import { db, friendlyError, joinOptions, joinFamily, type Session } from "./db";
import { esc } from "./format";
import { $ } from "./dom";

type View = "signin" | "signup" | "join" | "message";

const gate = () => $("#gate");
export function showGate(v: View, message?: string) {
  gate().hidden = false;
  gate().querySelectorAll<HTMLElement>("[data-view]").forEach(el => { el.hidden = el.dataset.view !== v; });
  if (message !== undefined) $("#gateMsg").textContent = message;
}
export const hideGate = () => { gate().hidden = true; };

async function busy<T>(btn: HTMLButtonElement, label: string, fn: () => Promise<T>): Promise<T> {
  const old = btn.textContent; btn.disabled = true; btn.textContent = label;
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = old; }
}

/**
 * Sign in, create an account, or join the family.
 * `onSession` is called with a session once someone is signed in; `onJoined` once they're linked to a person.
 */
export function initGate(onSession: (s: Session) => void, onJoined: () => void) {
  $("#toSignup").addEventListener("click", () => showGate("signup"));
  $("#toSignin").addEventListener("click", () => showGate("signin"));

  $<HTMLFormElement>("#signinForm").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#signinErr"); err.textContent = "";
    const { data, error } = await busy($("#signinForm button[type=submit]"), "Signing in…", () =>
      db.auth.signInWithPassword({ email: $<HTMLInputElement>("#email").value.trim().toLowerCase(), password: $<HTMLInputElement>("#password").value }));
    if (error) { err.textContent = friendlyError(error); return; }
    onSession(data.session);
  });

  $<HTMLFormElement>("#signupForm").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#signupErr"); err.textContent = "";
    const { data, error } = await busy($("#signupForm button[type=submit]"), "Creating…", () =>
      db.auth.signUp({ email: $<HTMLInputElement>("#newEmail").value.trim().toLowerCase(), password: $<HTMLInputElement>("#newPassword").value }));
    if (error) { err.textContent = friendlyError(error); return; }
    if (!data.session) {
      err.textContent = "Your account was made, but Supabase wants to email a confirmation first. Ask whoever set this up to turn off “Confirm email” (see SETUP.md), then sign in.";
      return;
    }
    onSession(data.session);
  });

  // Joining: enter the family code (unless you're the first), then pick who you are.
  let code = "";
  const codeStep = $("#codeStep"), pickStep = $("#pickStep"), joinErr = $("#joinErr");
  async function showPeople(c: string): Promise<boolean> {
    try {
      const people = await joinOptions(c);
      code = c;
      $("#pickList").innerHTML = people.map(p => `
        <label class="pick${p.taken ? " taken" : ""}"><input type="radio" name="who" value="${esc(p.id)}"${p.taken ? " disabled" : ""}>
          <span>${esc(p.full_name)}${p.taken ? ` <small>already signed up</small>` : ""}</span></label>`).join("") + `
        <label class="pick"><input type="radio" name="who" value=""><span>Someone else</span></label>`;
      if (c) $("#joinIntro").textContent = "That code works. Now pick who you are.";
      codeStep.hidden = true; pickStep.hidden = false; $("#newPerson").hidden = true;
      return true;
    } catch (x) {
      if (c) joinErr.textContent = friendlyError(x as Error);
      return false;
    }
  }
  $("#pickList").addEventListener("change", () => {
    const v = $<HTMLInputElement>("#pickList input:checked").value;
    $("#newPerson").hidden = v !== "";
  });
  $<HTMLFormElement>("#codeStep").addEventListener("submit", async e => {
    e.preventDefault(); joinErr.textContent = "";
    await busy($("#codeStep button[type=submit]"), "Checking…", () => showPeople($<HTMLInputElement>("#joinCode").value));
  });
  $<HTMLFormElement>("#pickStep").addEventListener("submit", async e => {
    e.preventDefault(); joinErr.textContent = "";
    const picked = document.querySelector<HTMLInputElement>("#pickList input:checked");
    if (!picked) { joinErr.textContent = "Pick who you are."; return; }
    const fullName = $<HTMLInputElement>("#newFull").value.trim(), shortName = $<HTMLInputElement>("#newShort").value.trim();
    if (!picked.value && (!fullName || !shortName)) { joinErr.textContent = "Fill in your full name and what people call you."; return; }
    try {
      await busy($("#pickStep button[type=submit]"), "Joining…", () =>
        joinFamily(code, picked.value ? { memberId: picked.value } : { fullName, shortName }));
      onJoined();
    } catch (x) {
      joinErr.textContent = friendlyError(x as Error);
      if (/taken/.test((x as Error).message)) await showPeople(code);
    }
  });

  return {
    /** Show the join screen; the first person in skips the code. */
    async startJoin() {
      showGate("join");
      joinErr.textContent = "";
      $("#joinIntro").textContent = "Enter the family code. Anyone already using the app can find it by tapping their initial at the top.";
      codeStep.hidden = false; pickStep.hidden = true;
      if (!(await showPeople(""))) $<HTMLInputElement>("#joinCode").focus();
      else $("#joinIntro").textContent = "You’re the first one here, so no family code is needed. Who are you?";
    },
  };
}
