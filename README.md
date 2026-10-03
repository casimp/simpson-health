# Simpson Family Health

Blood test results for the family, each one shown against the reference range from that person's own lab report.
Everyone signs in, sees everyone's results, and adds their own from the **Add result** button.

Plain HTML/JS with no build step: `index.html` (page + styles), `app.js` (dashboard), `config.js` (Supabase project),
`sw.js` + `manifest.webmanifest` (installable as a home-screen app), `vendor/supabase.js` (supabase-js 2.117.2).

First-time setup: see [SETUP.md](SETUP.md).

To run locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
