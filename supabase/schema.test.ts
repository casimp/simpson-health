// Checks the access rules in schema.sql against a real Postgres (PGlite), with Supabase's auth bits stubbed.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const CHRIS = "00000000-0000-0000-0000-00000000000a";
const SUE = "00000000-0000-0000-0000-00000000000b";
const STRANGER = "00000000-0000-0000-0000-00000000000c";
const NEWBIE = "00000000-0000-0000-0000-00000000000d";

let db: PGlite;
let code = "";

/** Run queries as a signed-in user, the way PostgREST does. */
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await db.exec("reset role;"); }
}
const rows = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => (await rows<T>(sql, params))[0];
const count = async (sql: string) => (await one<{ c: number }>(`select count(*)::int c from (${sql}) x`)).c;

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema extensions;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public, extensions to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${CHRIS}'), ('${SUE}'), ('${STRANGER}'), ('${NEWBIE}');
  `);
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  await db.exec(schema);
  await db.exec(schema);   // must be safe to run twice
  await db.exec(`insert into results (member_id, test, taken_at, value, ref_low, ref_high) values
    ('sue', 'rbc', '2020-01-01 09:00 Europe/London', 4.2, 3.8, 4.85),
    ('sue', 'hb',  '2020-01-01 09:00 Europe/London', 130, 112, 148)`);
  code = (await one<{ join_code: string }>("select join_code from family")).join_code;
}, 30_000);

describe("schema.sql", () => {
  it("sets up four people and an 8-character code without look-alike characters", async () => {
    expect(await count("select * from members")).toBe(4);
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  });

  it("lets the first person join without a code, and only then shows them anything", () => as(CHRIS, async () => {
    expect(await count("select * from results")).toBe(0);
    expect(await count("select * from join_options('')")).toBe(4);
    expect((await one("select join_family('', 'chris') j")).j).toBe("chris");
    expect(await count("select * from results")).toBe(2);
    expect((await one("select join_code from family")).join_code).toBe(code);
    expect((await one("select join_family('', 'anna') j")).j).toBe("chris");   // already joined: no second person
  }));

  it("only lets people change their own results", () => as(CHRIS, async () => {
    await expect(db.query(`insert into results (member_id, test, taken_at, value, ref_low, ref_high) values ('sue','rbc',now(),4,3,5)`))
      .rejects.toThrow(/row-level security/);
    expect(await rows(`insert into results (member_id, test, taken_at, value, ref_low, ref_high) values ('chris','rbc',now(),4,3,5) returning id`)).toHaveLength(1);
    expect(await rows(`update results set value = 1 where member_id = 'sue' returning id`)).toHaveLength(0);
    expect(await rows(`delete from results where member_id = 'sue' returning id`)).toHaveLength(0);
    await expect(db.query(`update results set member_id = 'sue' where member_id = 'chris'`)).rejects.toThrow(/row-level security/);
    await expect(db.query(`update members set user_id = auth.uid() where id = 'anna'`)).rejects.toThrow();
    await expect(db.query(`update family set join_code = 'X'`)).rejects.toThrow();
  }));

  it("shows strangers nothing and refuses them without the code", () => as(STRANGER, async () => {
    await expect(db.query("select * from join_options('')")).rejects.toThrow(/wrong_code/);
    await expect(db.query("select join_family('WRONGCOD', 'sue')")).rejects.toThrow(/wrong_code/);
    expect(await count("select * from members")).toBe(0);
    expect(await count("select * from family")).toBe(0);
    expect(await count("select * from results")).toBe(0);
    await expect(db.query("select new_join_code()")).rejects.toThrow(/not_family/);
    await expect(db.query("select code_ok('x')")).rejects.toThrow(/permission denied/);
  }));

  it("lets family join with the code, but not as someone already taken", () => as(SUE, async () => {
    const opts = await rows<{ id: string; taken: boolean }>("select id, taken from join_options($1)", [`${code.slice(0, 4)}-${code.slice(4).toLowerCase()}`]);
    expect(opts.find(o => o.id === "chris")?.taken).toBe(true);
    await expect(db.query("select join_family($1, 'chris')", [code])).rejects.toThrow(/taken/);
    expect((await one("select join_family($1, 'sue') j", [code])).j).toBe("sue");
    expect(await rows(`update results set note = 'checked' where member_id = 'sue' returning id`)).toHaveLength(2);
  }));

  it("stops the old code working once a new one is made, and lets someone new join", async () => {
    const fresh = await as(SUE, async () => (await one<{ c: string }>("select new_join_code() c")).c);
    expect(fresh).not.toBe(code);
    await as(NEWBIE, async () => {
      await expect(db.query("select join_family($1, null, 'Gran Simpson', 'Gran')", [code])).rejects.toThrow(/wrong_code/);
      expect(await count("select * from family")).toBe(0);
      const id = (await one<{ j: string }>("select join_family($1, null, 'Gran Simpson', 'Gran') j", [fresh])).j;
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(await count("select * from members")).toBe(5);
    });
  });

  it("gives signed-out visitors nothing", async () => {
    await db.exec("set role anon; select set_config('request.jwt.claim.sub', '', false);");
    try {
      await expect(db.query("select * from results")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from join_options('')")).rejects.toThrow(/permission denied/);
    } finally { await db.exec("reset role;"); }
  });
});
