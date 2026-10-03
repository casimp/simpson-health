# Setting up Simpson Family Health

You do this once. It takes about 10 minutes and nothing needs editing.

## 1. Supabase (the database)

You've already created the project. In the Supabase dashboard:

1. **SQL Editor → New query**: paste in the whole of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
2. **SQL Editor → New query**: paste in `import-existing-results.sql` (the file Claude gave you; it isn't in the repo
   because it holds the medical data) and click **Run** once. It adds the 391 existing results.
3. **Authentication → Sign In / Providers → Email**: turn **off** “Confirm email” and save.
   (Supabase's free email service only sends to your own Supabase team, so confirmation emails would never arrive.
   Leave “Allow new users to sign up” **on**: strangers can make an account but see nothing without the family code.)
4. **Project Settings → API**: copy the **Project URL** and the **publishable** key (or the **anon public** key on older
   projects) and send them to Claude, or put them in [`.env`](.env) yourself.
   Never share the `service_role` / secret key.

## 2. GitHub (publishing it)

Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Every push to `main` then checks, builds and publishes the site to https://casimp.github.io/simpson-health/.

## 3. Everyone joins

1. **You go first.** Open the site, tap **Create account**, then pick who you are. The first person needs no code.
2. **Invite the others.** Tap your initial (top right) → **Send invite**. That sends the link and the family code.
3. **They** open the link, tap **Create account**, enter the code and pick who they are.
   Someone not on the list (a new partner, say) picks **Someone else** and types their name.

To put it on a phone's home screen:
- **iPhone:** open the link in Safari → Share → **Add to Home Screen**.
- **Android:** open the link in Chrome → ⋮ menu → **Install app** (or *Add to Home screen*).

## Looking after it

- **Forgotten password:** Supabase → Authentication → Users → the person's ⋯ menu → set a new password.
- **Remove someone's access:** delete their login on that Users page. Their results stay, and their person becomes
  free to be picked again by whoever signs up as them next.
- **Code leaked?** Tap your initial → **New code**. The old code stops working; people already in are unaffected.
- **“Couldn’t load the results”:** free Supabase projects pause after a week with no use.
  Open the Supabase dashboard and click **Restore project**.
