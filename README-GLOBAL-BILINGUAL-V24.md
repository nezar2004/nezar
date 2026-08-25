# Wazen Global Bilingual V24.1

This build upgrades the existing Wazen V23 bilingual system without changing Firebase project IDs, Firestore structure, or checkout URLs.

## What changed
- Centralized Arabic/English product vocabulary in `public/i18n.js`.
- UI switches between RTL Arabic and LTR English.
- Language toggle remains available only on the landing page.
- Dynamic dashboard views are re-translated after every render.
- Added the missing dashboard vocabulary used by Home, Calendar, Habits, Progress, Notes, Settings, and profile values.
- Added safe translation rules for generated time ranges and study-hour values.
- Added English weekday labels and translations for user profile goal/role/activity/unit values.
- Calendar month names and numeric formatting follow the selected locale.
- Workout names now have separate Arabic/English display values instead of mixed strings.
- AI plan generation already receives `language` and now remains enforced by the Worker.
- AI plan translation endpoint keeps JSON structure/keys while translating user-facing values.
- Billing/AI Worker errors can follow the selected language through `X-Wazen-Language`.

## Deploy
1. Replace your local project files with this build.
2. Deploy `public/` to Firebase Hosting as usual.
3. Deploy `cloudflare/worker.js` to the SAME Cloudflare Worker that serves `hayati-ai.nezarcaht.workers.dev`.
4. Keep your existing Cloudflare secrets/bindings (`GEMINI_API_KEY`, `OWNER_UID`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `SUBSCRIPTIONS`).
5. Do not paste Firebase API keys or Cloudflare secrets into the Worker beyond the existing public Firebase Web API key.

## Important
The Worker file in this package is the deployable Worker source. Editing only the local copy does not change the live Cloudflare Worker until you deploy it.
