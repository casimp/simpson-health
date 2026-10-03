# Setting up Simpson Family Health

The app is a static site (GitHub Pages) that keeps everyone's results in a free Supabase database.
You do this once, and it takes about 15 minutes.

## 1. Create the database

1. Go to [supabase.com](https://supabase.com), sign in with GitHub and create a **New project**
   (any name, choose a region near you such as London, save the database password somewhere).
2. Open **SQL Editor**, paste in the whole of [`supabase/schema.sql`](supabase/schema.sql),
   **replace the four `..._EMAIL_HERE` placeholders with each person's email**, and click **Run**.
   (Leave a placeholder in for anyone who won't use the app yet. You can re-run the file later with their email.)
3. In the SQL Editor again, open a new query, paste in `import-existing-results.sql` (the file Claude gave you,
   which is not in the repo because it holds the medical data) and click **Run** once. It adds the 391 existing results.

## 2. Create everyone's login

**Authentication → Users → Add user → Create new user**, once per person:
use the same email as in step 1.2, choose a password, and leave **Auto Confirm User** ticked.
Send each person their password. No emails are sent by Supabase.

Optional but recommended: **Authentication → Sign In / Providers** → turn off **Allow new users to sign up**.
(Strangers who sign up already see nothing, but this closes the door entirely.)

To reset a forgotten password later, go to the same Users page, open the person's menu (⋯) and choose a new password.

## 3. Connect the app

**Project Settings → API**: copy the **Project URL** and the **anon public** key into [`config.js`](config.js) and commit.
The anon key is designed to be public. The row-level security rules in `schema.sql` are what keep the data private.

## 4. Publish it

GitHub Pages is already switched on for this repo, so once this is merged into `main` (with `config.js` filled in)
it goes live at `https://casimp.github.io/simpson-health/` within a minute or two.

## 5. Put it on everyone's phone

- **iPhone:** open the link in Safari → Share → **Add to Home Screen**.
- **Android:** open the link in Chrome → ⋮ menu → **Install app** (or *Add to Home screen*).

It then opens full screen from its own icon and stays signed in.

## Good to know

- Everyone sees all results, but each person can only add, edit or delete their own. The database enforces this, not just the page.
- Free Supabase projects pause after a week with no use. If someone sees "Couldn't load the results",
  open the Supabase dashboard and click **Restore project**.
- Adding a new kind of test: add an entry to `TESTS` at the top of `app.js` (name, unit, default range).
- Adding a person: add them to `PEOPLE` in `app.js` and give them a colour in `index.html` (`--name` in `:root`), add a row to `members`, and create their login.
