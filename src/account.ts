import { db, familyCode, newFamilyCode, friendlyError } from "./db";
import { store, member } from "./state";
import { colourVar } from "./people";
import { formatCode } from "./logic";
import { esc } from "./format";
import { $ } from "./dom";

/** The account sheet: who you are, the family code to invite people, and sign out. */
export function initAccount() {
  const dlg = $<HTMLDialogElement>("#account"), codeEl = $("#familyCode"), msg = $("#accountMsg");
  let code = "";
  const showCode = (c: string) => { code = c; codeEl.textContent = formatCode(c); };
  const inviteText = () =>
    `Join Simpson Family Health: ${location.origin}${location.pathname}\nCreate an account, then enter the family code ${formatCode(code)}`;

  $("#meBtn").addEventListener("click", async () => {
    const me = member(store.me);
    const { data } = await db.auth.getUser();
    $("#accountWho").innerHTML = `<b>${esc(me.fullName)}</b><br><span class="hint">${esc(data.user?.email ?? "")}</span>`;
    msg.textContent = ""; codeEl.textContent = "…";
    dlg.showModal();
    try { showCode(await familyCode()); } catch (x) { msg.textContent = friendlyError(x as Error); }
  });
  $("#shareCode").addEventListener("click", async () => {
    if (!code) return;
    try {
      if (navigator.share) await navigator.share({ title: "Simpson Family Health", text: inviteText() });
      else { await navigator.clipboard.writeText(inviteText()); msg.textContent = "Invite copied. Paste it into a message."; }
    } catch { /* share sheet dismissed */ }
  });
  $("#newCode").addEventListener("click", async () => {
    if (!confirm("Make a new family code? The old one will stop working for anyone who hasn’t joined yet.")) return;
    try { showCode(await newFamilyCode()); msg.textContent = "New code made."; } catch (x) { msg.textContent = friendlyError(x as Error); }
  });
  $("#accountClose").addEventListener("click", () => dlg.close());
  document.querySelectorAll(".sign-out").forEach(b => b.addEventListener("click", async () => {
    await db.auth.signOut();
    location.reload();
  }));
}

/** The round button in the header showing the signed-in person's initial. */
export function paintMe() {
  const me = member(store.me);
  const b = $("#meBtn");
  b.style.setProperty("--c", colourVar(me));
  b.textContent = me.shortName[0] ?? "?";
  b.setAttribute("aria-label", `${me.fullName}: account and invite family`);
}
