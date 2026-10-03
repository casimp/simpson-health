import { createClient, type Session } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { Member, Reading } from "./types";
import { isTestKey, type TestKey } from "./tests";
import { statusOf } from "./logic";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

export const configured = Boolean(url && key);
export const db = createClient<Database>(url || "https://not-configured.invalid", key || "missing", {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type { Session };

/** Turns a Postgres error raised by the join functions into something to show a person. */
export function friendlyError(e: { message?: string } | null | undefined): string {
  const m = e?.message || String(e);
  if (/wrong_code/.test(m)) return "That family code didn’t work. Check it with someone who’s already in.";
  if (/taken/.test(m)) return "Someone has already signed up as that person.";
  if (/invalid login credentials/i.test(m)) return "That email and password don’t match. Check them and try again.";
  if (/already registered|already exists/i.test(m)) return "There’s already an account with that email. Sign in instead.";
  if (/password.*(at least|short)/i.test(m)) return "Choose a longer password (at least 6 characters).";
  return m;
}

export async function myMemberId(): Promise<string | null> {
  const { data, error } = await db.rpc("my_member_id");
  if (error) throw error;
  return data || null;
}

export async function loadMembers(): Promise<Member[]> {
  const { data, error } = await db.from("members").select("id,full_name,short_name,colour,user_id").order("created_at").order("full_name");
  if (error) throw error;
  return data.map(m => ({ id: m.id, fullName: m.full_name, shortName: m.short_name, colour: m.colour, claimed: m.user_id !== null }));
}

export async function loadReadings(): Promise<Reading[]> {
  const rows: Database["public"]["Tables"]["results"]["Row"][] = [];
  const page = 1000;   // Supabase returns at most 1000 rows per request
  for (let from = 0; ; from += page) {
    const { data, error } = await db.from("results").select("*").order("id").range(from, from + page - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < page) break;
  }
  return rows.flatMap(row => {
    if (!isTestKey(row.test)) return [];
    const value = Number(row.value), low = Number(row.ref_low), high = Number(row.ref_high);
    return [{
      id: String(row.id), memberId: row.member_id, test: row.test, date: new Date(row.taken_at),
      value, low, high, note: row.note ?? "", status: statusOf(value, low, high),
    }];
  });
}

export interface ReadingInput {
  memberId: string; test: TestKey; date: Date; value: number; low: number; high: number; note: string;
}
const toRow = (r: ReadingInput) => ({
  member_id: r.memberId, test: r.test, taken_at: r.date.toISOString(),
  value: r.value, ref_low: r.low, ref_high: r.high, note: r.note.trim() || null,
});

export async function saveReading(r: ReadingInput, id?: string): Promise<void> {
  const { error } = id
    ? await db.from("results").update(toRow(r)).eq("id", Number(id))
    : await db.from("results").insert(toRow(r));
  if (error) throw error;
}

export async function deleteReading(id: string): Promise<void> {
  const { error } = await db.from("results").delete().eq("id", Number(id));
  if (error) throw error;
}

export async function joinOptions(code: string) {
  const { data, error } = await db.rpc("join_options", { p_code: code });
  if (error) throw error;
  return data;
}

export async function joinFamily(code: string, pick: { memberId: string } | { fullName: string; shortName: string }) {
  const { data, error } = await db.rpc("join_family", "memberId" in pick
    ? { p_code: code, p_member_id: pick.memberId }
    : { p_code: code, p_full_name: pick.fullName, p_short_name: pick.shortName });
  if (error) throw error;
  return data;
}

export async function familyCode(): Promise<string> {
  const { data, error } = await db.from("family").select("join_code").single();
  if (error) throw error;
  return data.join_code;
}

export async function newFamilyCode(): Promise<string> {
  const { data, error } = await db.rpc("new_join_code");
  if (error) throw error;
  return data;
}
