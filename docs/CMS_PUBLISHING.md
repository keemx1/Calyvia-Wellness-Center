# Website Content Publishing (CMS)

Staff can publish **career opportunities**, **vlogs** and **announcements** from the admin portal. Publishing triggers a Netlify build hook, and the public website (`https://calyviawellness.co.ke`) regenerates its static content from the management API. The existing website pages, branding and navigation remain intact; only new routes are added.

## What was added

| Layer | Files |
| :--- | :--- |
| Database | `supabase/sql/12_cms_public_content.sql` — `cms_posts` table + anon-safe `published_cms_posts` view |
| API | `apps/api/src/modules/cms/` — DTOs, service, controller, Netlify publisher, tests |
| Admin UI | `apps/admin/src/components/CmsManager.tsx`, nav entry in `Sidebar.tsx`, view in `app/page.tsx` |
| Shared | CMS enums, `Permission.CMS_MANAGE`, role module access in `packages/shared/src/index.ts` |
| Website | `scripts/generate-cms-content.mjs`, `src/data/cms*`, `src/components/cms/*`, `/careers`, `/vlogs`, `/news` routes, nav/footer links, sitemap updates |

## Public routes (added, not replacing anything)

- `/careers` and `/careers/:slug`
- `/vlogs` and `/vlogs/:slug`
- `/news` and `/news/:slug`

Vlogs are embedded from `youtube-nocookie.com` or `player.vimeo.com` only. Arbitrary iframe URLs are rejected by the API and re-validated by the website before rendering.

## One-time setup (required before publishing works)

1. **Apply the database migration.** Run `supabase/sql/12_cms_public_content.sql` in the Supabase SQL editor (or `psql`) as an owner/migration role. It is idempotent. Confirm with:
   ```sql
   SELECT count(*) AS published_posts FROM public.published_cms_posts;
   ```
   A fresh database returns `0`.

2. **Create a Netlify build hook** for the `calyvia-website` site (Netlify → Site configuration → Build & deploy → Build hooks). Point it at the branch Netlify deploys. Copy the generated URL.

3. **Set the secret in Coolify only.** Add `NETLIFY_CMS_BUILD_HOOK_URL=<your Netlify build hook URL>` to the API service environment variables and restart the API. Do **not** paste the URL into chat, a repo file, or a committed `.env`. The API accepts only URLs beginning with `https://api.netlify.com/build_hooks/` and never logs the value.

4. **Push the website repo changes** to `keemx1/calyvia-website` so Netlify builds the new routes and prebuild script. Optional: set `VITE_CMS_API_URL` in Netlify's environment UI if the API origin differs from `https://api.calyviawellness.co.ke/api/v1`.

## How publishing works

1. A user with `SUPER_ADMIN`, `FACILITY_ADMIN` or `MANAGEMENT_EXECUTIVE` role opens **Administration → Website Content** in the portal.
2. They create a draft, enter plain text (HTML is stripped), and optionally add an HTTPS cover image, YouTube/Vimeo video, location, employment details or expiry date.
3. They click **Publish**. The API writes the row, sets `published_at`, emits an audit log, and calls the Netlify build hook.
4. During the rebuild, `scripts/generate-cms-content.mjs` calls `GET /api/v1/cms/published` (public, no token), sanitizes the response, and writes `src/data/cms-generated.ts` + `.json`. The sitemap generator then adds the live post routes.
5. Vite builds the static site into `out/`. The new post is live in roughly 1–2 minutes.

Editing a published post, or unpublishing it, triggers the same rebuild. Drafts are never exposed: the public endpoint reads only the `published_cms_posts` view.

## Existing site is untouched

No deployment configuration file was added or changed. The site continues to use its existing Netlify build settings and `public/_redirects` SPA fallback. The only change to the build is the `prebuild` script, which now also generates CMS data before Vite runs. If the CMS API is unreachable, the prebuild logs a warning and produces an empty list so the site still builds.

## Security properties

- `anon` and `authenticated` have **no privileges** on `cms_posts`; only `service_role` can write through RLS.
- The public view has `security_barrier = true` and hard-filters `status = 'PUBLISHED'`, `published_at <= now()` and unexpired posts.
- Content is stored as structured blocks (`heading`, `paragraph`, `list`, `quote`). There is no raw HTML field and no `dangerouslySetInnerHTML` in the website renderer.
- The website build is fail-open: if the CMS API is unavailable, the site still builds with an empty post list and the existing pages remain live.
- Build-hook failures are reported to the staff member in the portal; the post is saved and can be republished after fixing configuration.

## Verification checklist

- [ ] Migration applied; `SELECT count(*) FROM public.published_cms_posts` succeeds.
- [ ] `NETLIFY_CMS_BUILD_HOOK_URL` set in Coolify (never in the repo).
- [ ] `GET https://api.calyviawellness.co.ke/api/v1/cms/published` returns `{"posts":[],"count":0}` initially, with no auth header.
- [ ] Unauthenticated `GET /cms/posts` returns 401; non-editor roles return 403.
- [ ] Create a draft in the portal → it is absent from `/cms/published`.
- [ ] Publish it → Netlify build starts → `/careers/<slug>` (or `/vlogs/<slug>`, `/news/<slug>`) renders live.
- [ ] Unpublish → the route shows "Content not found" after the next rebuild, and the sitemap entry is removed.
- [ ] A Vlog post with a YouTube/Vimeo link renders an iframe with a privacy-friendly host; an invalid link is rejected on save.
