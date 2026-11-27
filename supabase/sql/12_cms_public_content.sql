-- ==============================================================================
-- 12_cms_public_content.sql
-- Calyvia Wellness Center Management System (HMIS/EMR)
-- Public website content: careers, vlogs and announcements.
--
-- Safety model:
--   * Staff portal writes go through the authenticated NestJS API using the
--     service role (bypasses RLS).
--   * The anon/authenticated roles have NO direct access to cms_posts.
--   * `published_cms_posts` is the only public object and hard-filters to
--     PUBLISHED rows that are live now. Drafts can never be selected.
--
-- Run this file in Supabase SQL editor (or psql) AFTER 06_triggers_and_functions.sql.
-- ==============================================================================

SET search_path = public, extensions;

-- ------------------------------------------------------------------------------
-- 1. Enums (idempotent)
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE "CmsPostType" AS ENUM ('CAREER', 'VLOG', 'ANNOUNCEMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "CmsPostStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cms_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    type "CmsPostType" NOT NULL,
    status "CmsPostStatus" NOT NULL DEFAULT 'DRAFT',
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    -- Structured blocks only. Raw HTML is never accepted or rendered.
    -- Shape: [{ type: 'heading'|'paragraph'|'quote', text: string }
    --       | { type: 'list', items: string[] }]
    content JSONB NOT NULL DEFAULT '[]'::jsonb,
    cover_image_url TEXT,
    -- YouTube/Vimeo embed URLs only. Validated again by the API and the site.
    embed_url TEXT,
    location TEXT,
    employment_type TEXT,
    application_email TEXT,
    application_url TEXT,
    expires_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.cms_posts;
CREATE POLICY service_role_all ON public.cms_posts
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- No public client may read the base table. Drafts stay private.
REVOKE ALL ON public.cms_posts FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_cms_posts_updated_at ON public.cms_posts;
CREATE TRIGGER trg_cms_posts_updated_at
    BEFORE UPDATE ON public.cms_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_cms_posts_published
    ON public.cms_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_posts_type_status
    ON public.cms_posts (type, status);

-- ------------------------------------------------------------------------------
-- 3. Public read-only view
--    Owned by the migration role, so base-table RLS does not block anon reads,
--    but the WHERE clause is the only path to data. It is deliberately narrow.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.published_cms_posts
WITH (security_barrier = true)
AS
SELECT
    id,
    slug,
    type::text AS type,
    title,
    summary,
    content,
    cover_image_url,
    embed_url,
    location,
    employment_type,
    application_email,
    application_url,
    published_at,
    updated_at
FROM public.cms_posts
WHERE status = 'PUBLISHED'
  AND published_at IS NOT NULL
  AND published_at <= now()
  AND (expires_at IS NULL OR expires_at > now());

REVOKE ALL ON public.published_cms_posts FROM anon, authenticated;
GRANT SELECT ON public.published_cms_posts TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. Verification helper (run manually after migration)
-- ------------------------------------------------------------------------------
-- SELECT count(*) AS published_posts FROM public.published_cms_posts;
-- Should return 0 on a fresh installation.
