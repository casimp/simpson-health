# Simpson Family Health

Blood test results for the family, each shown against the reference range from that person's own lab report.
Everyone signs in, sees everyone's results, and adds their own with the **Add result** button.
It installs to a phone's home screen like an app.

**Live:** https://casimp.github.io/simpson-health/ · **First-time setup:** [SETUP.md](SETUP.md)

## How it's built

- **Front end:** TypeScript + Vite, no framework. Built by GitHub Actions and published to GitHub Pages on every push to `main`.
- **Data and logins:** Supabase (Postgres + Auth). The rules for who can see and change what live in the database
  ([`supabase/schema.sql`](supabase/schema.sql)) as row-level security, not in the page.

```
src/
  main.ts          start-up: sign-in → join → dashboard
  gate.ts          sign in, create account, join the family
  account.ts       the "You" sheet: family code, invite, sign out
  dashboard.ts     people, tiles, chart, heat strip, table
  entry.ts         add / edit / delete a result
  db.ts            all Supabase calls
  tests.ts         the blood tests and their default ranges  ← add new tests here
  logic.ts         pure helpers (with logic.test.ts)
  database.types.ts  database types (regenerate with `npm run types`)
supabase/
  schema.sql       tables, access rules, join functions (run in the Supabase SQL editor)
  schema.test.ts   checks those rules against a real Postgres (PGlite)
public/            icons, web app manifest, service worker
```

## Working on it

```sh
npm install
cp .env .env.local    # put the Supabase URL and key in .env.local to run against the real database
npm run dev           # http://localhost:5173
npm test              # unit tests + database access-rule tests
npm run build         # typecheck + production build into dist/
```

After changing `supabase/schema.sql`: run it in the Supabase SQL editor (it's safe to re-run), then
`SUPABASE_PROJECT_ID=<ref> npm run types` to refresh `src/database.types.ts` (needs `npx supabase login` once).
