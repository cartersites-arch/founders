-- UNAPPLIED DEVELOPMENT REVIEW DRAFT. NOT A MIGRATION.
-- Target: founders-dev only. Review prerequisites before application.

-- Source: 20260502084805_a2902a3a-50a0-4858-9514-f6a5bac39b82.sql

-- Roles infrastructure (separate table, never on profiles)
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Shared timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- CITIES
CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  state_code TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  description TEXT,
  hero_image_url TEXT,
  seo_title TEXT,
  seo_description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cities_slug ON public.cities(slug);
CREATE INDEX idx_cities_published ON public.cities(is_published);

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  hero_image_url TEXT,
  icon TEXT,
  seo_title TEXT,
  seo_description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_slug ON public.categories(slug);

-- PROVIDERS (pool builders, service companies)
CREATE TABLE public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  business_type TEXT,
  city TEXT,
  state_code TEXT,
  description TEXT,
  website_url TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  hero_image_url TEXT,
  services TEXT[],
  seo_title TEXT,
  seo_description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_providers_slug ON public.providers(slug);
CREATE INDEX idx_providers_location ON public.providers(state_code, city);

-- BLOG
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  cover_image_url TEXT,
  author TEXT,
  seo_title TEXT,
  seo_description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blog_slug ON public.blog_posts(slug);
CREATE INDEX idx_blog_published ON public.blog_posts(is_published, published_at);

-- SEO overrides for any URL (including Sharetribe listings)
CREATE TABLE public.seo_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_path TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  og_image_url TEXT,
  noindex BOOLEAN NOT NULL DEFAULT false,
  canonical_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_seo_overrides_path ON public.seo_overrides(url_path);

-- Enable RLS on all
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_overrides ENABLE ROW LEVEL SECURITY;

-- Public read for published rows (these are SEO pages — meant to be public)
CREATE POLICY "Public can read published cities" ON public.cities
  FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "Public can read published categories" ON public.categories
  FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "Public can read published providers" ON public.providers
  FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "Public can read published blog posts" ON public.blog_posts
  FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "Public can read seo overrides" ON public.seo_overrides
  FOR SELECT TO anon, authenticated USING (true);

-- Admins can manage all content
CREATE POLICY "Admins can manage cities" ON public.cities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage providers" ON public.providers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage blog posts" ON public.blog_posts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage seo overrides" ON public.seo_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated-at triggers
CREATE TRIGGER set_updated_cities BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_categories BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_providers BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_blog BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_seo BEFORE UPDATE ON public.seo_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Source: 20260502084825_989e136c-e1bd-45c5-b741-f233832b6b97.sql

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated, service_role;


-- Source: 20260502091723_fa16036c-03cb-42c9-bf10-0dde104dfd1a.sql
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS topic text;
CREATE INDEX IF NOT EXISTS idx_blog_posts_topic ON public.blog_posts (topic) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON public.blog_posts (published_at DESC) WHERE is_published = true;
UPDATE public.blog_posts SET topic = 'hosting' WHERE topic IS NULL AND slug = 'how-to-host-a-pool-party';

-- Source: 20260502092454_2541afc0-ac25-4fee-a9f5-47e53a0890c1.sql
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  excerpt text,
  description text,
  cover_image_url text,
  category text NOT NULL DEFAULT 'general',
  language text NOT NULL DEFAULT 'en',
  level text,
  embed_url text,
  external_detail_url text,
  duration_minutes integer,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz DEFAULT now(),
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_category ON public.courses (category) WHERE is_published = true;
CREATE INDEX idx_courses_language ON public.courses (language) WHERE is_published = true;
CREATE INDEX idx_courses_published_at ON public.courses (published_at DESC) WHERE is_published = true;

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published courses"
  ON public.courses FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "Admins can manage courses"
  ON public.courses FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260502104723_4a3d05bb-bc29-4fd7-8874-3621a2112091.sql
DROP FUNCTION IF EXISTS public.nearby_cities_by_distance(text, int);

CREATE OR REPLACE FUNCTION public.nearby_cities_by_distance(_slug text, _limit int DEFAULT 12)
RETURNS TABLE (
  out_slug text,
  out_name text,
  out_state text,
  out_state_code text,
  out_distance_km double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH src AS (
    SELECT c.slug AS s_slug, c.state_code AS s_state_code,
           c.latitude AS s_lat, c.longitude AS s_lng
    FROM public.cities c
    WHERE c.slug = _slug
    LIMIT 1
  ),
  candidates AS (
    SELECT
      c.slug AS out_slug,
      c.name AS out_name,
      c.state AS out_state,
      c.state_code AS out_state_code,
      CASE
        WHEN src.s_lat IS NOT NULL
         AND src.s_lng IS NOT NULL
         AND c.latitude IS NOT NULL
         AND c.longitude IS NOT NULL
        THEN
          2 * 6371 * asin(
            sqrt(
              power(sin(radians((c.latitude::double precision - src.s_lat::double precision) / 2)), 2)
              + cos(radians(src.s_lat::double precision))
                * cos(radians(c.latitude::double precision))
                * power(sin(radians((c.longitude::double precision - src.s_lng::double precision) / 2)), 2)
            )
          )
        ELSE NULL
      END AS out_distance_km,
      (c.state_code = src.s_state_code) AS same_state
    FROM public.cities c
    CROSS JOIN src
    WHERE c.is_published = true
      AND c.slug <> src.s_slug
      AND (
        (c.latitude IS NOT NULL AND c.longitude IS NOT NULL
         AND src.s_lat IS NOT NULL AND src.s_lng IS NOT NULL)
        OR c.state_code = src.s_state_code
      )
  )
  SELECT out_slug, out_name, out_state, out_state_code, out_distance_km
  FROM candidates
  ORDER BY
    out_distance_km IS NULL,
    out_distance_km ASC,
    same_state DESC,
    out_name ASC
  LIMIT GREATEST(_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.nearby_cities_by_distance(text, int) TO anon, authenticated;

-- Source: 20260502104750_2c74e658-6d0a-47ed-aaa0-1985875e26a3.sql
CREATE OR REPLACE FUNCTION public.nearby_cities_by_distance(_slug text, _limit int DEFAULT 12)
RETURNS TABLE (
  out_slug text,
  out_name text,
  out_state text,
  out_state_code text,
  out_distance_km double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH src AS (
    SELECT c.slug AS s_slug, c.state_code AS s_state_code,
           c.latitude AS s_lat, c.longitude AS s_lng
    FROM public.cities c
    WHERE c.slug = _slug
    LIMIT 1
  ),
  candidates AS (
    SELECT
      c.slug AS out_slug,
      c.name AS out_name,
      c.state AS out_state,
      c.state_code AS out_state_code,
      CASE
        WHEN src.s_lat IS NOT NULL
         AND src.s_lng IS NOT NULL
         AND c.latitude IS NOT NULL
         AND c.longitude IS NOT NULL
        THEN
          2 * 6371 * asin(
            sqrt(
              power(sin(radians((c.latitude::double precision - src.s_lat::double precision) / 2)), 2)
              + cos(radians(src.s_lat::double precision))
                * cos(radians(c.latitude::double precision))
                * power(sin(radians((c.longitude::double precision - src.s_lng::double precision) / 2)), 2)
            )
          )
        ELSE NULL
      END AS out_distance_km,
      (c.state_code = src.s_state_code) AS same_state
    FROM public.cities c
    CROSS JOIN src
    WHERE c.is_published = true
      AND c.slug <> src.s_slug
      AND (
        (c.latitude IS NOT NULL AND c.longitude IS NOT NULL
         AND src.s_lat IS NOT NULL AND src.s_lng IS NOT NULL)
        OR c.state_code = src.s_state_code
      )
  )
  SELECT out_slug, out_name, out_state, out_state_code, out_distance_km
  FROM candidates
  ORDER BY
    out_distance_km IS NULL,
    out_distance_km ASC,
    same_state DESC,
    out_name ASC
  LIMIT GREATEST(_limit, 1);
$$;

-- Source: 20260502113828_1709500d-9f8a-4121-9700-7332dcd195af.sql
CREATE TABLE public.cities_hero_backfill_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_slug TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL,
  image_url TEXT,
  error TEXT,
  ran_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_cities_hero_backfill_log_city_slug ON public.cities_hero_backfill_log(city_slug);
CREATE INDEX idx_cities_hero_backfill_log_ran_at ON public.cities_hero_backfill_log(ran_at DESC);

ALTER TABLE public.cities_hero_backfill_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage hero backfill log"
ON public.cities_hero_backfill_log
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Source: 20260502120959_bb513e0d-8c20-4bfe-bea0-e608791a6bd5.sql
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS long_form_content jsonb,
  ADD COLUMN IF NOT EXISTS tier text;

CREATE INDEX IF NOT EXISTS idx_courses_tier ON public.courses(tier);
CREATE INDEX IF NOT EXISTS idx_courses_category ON public.courses(category);

-- Source: 20260502123621_d2516ab9-c479-4941-8923-c91ffb4a0b69.sql
UPDATE public.cities SET latitude = 30.2672, longitude = -97.7431 WHERE slug = 'austin-tx';
UPDATE public.cities SET latitude = 25.7617, longitude = -80.1918 WHERE slug = 'miami-fl';
UPDATE public.cities SET latitude = 39.0997, longitude = -94.5786 WHERE slug = 'kansas-city-mo';

-- Source: 20260502124605_7765a242-0096-4bad-8eb9-d43416a905be.sql
CREATE TABLE public.city_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_city_slug text,
  to_city_slug text NOT NULL,
  referrer_path text,
  user_agent text,
  visitor_hash text,
  country text,
  region text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_city_link_clicks_to_slug ON public.city_link_clicks(to_city_slug);
CREATE INDEX idx_city_link_clicks_clicked_at ON public.city_link_clicks(clicked_at DESC);

ALTER TABLE public.city_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert click events"
  ON public.city_link_clicks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read click events"
  ON public.city_link_clicks
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage click events"
  ON public.city_link_clicks
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Source: 20260502125418_b9c62c5f-35ee-4141-8b60-1da7386ecd97.sql
-- PROFILES ----------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ENROLLMENTS -------------------------------------------------------
CREATE TABLE public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_slug text NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_slug)
);

CREATE INDEX idx_enrollments_user ON public.course_enrollments(user_id);
CREATE INDEX idx_enrollments_course ON public.course_enrollments(course_slug);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own enrollments"
  ON public.course_enrollments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own enrollments"
  ON public.course_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own enrollments"
  ON public.course_enrollments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage enrollments"
  ON public.course_enrollments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- COMPLETIONS / CERTIFICATES ---------------------------------------
CREATE OR REPLACE FUNCTION public.generate_certificate_uid()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/1/I/O for legibility
  part1 text := '';
  part2 text := '';
  i int;
BEGIN
  FOR i IN 1..4 LOOP
    part1 := part1 || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    part2 := part2 || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN 'PRNM-' || part1 || '-' || part2;
END;
$$;

CREATE TABLE public.course_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_slug text NOT NULL,
  course_title text NOT NULL,
  learner_name text NOT NULL,
  certificate_uid text NOT NULL UNIQUE DEFAULT public.generate_certificate_uid(),
  completed_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoke_reason text,
  UNIQUE (user_id, course_slug)
);

CREATE INDEX idx_completions_user ON public.course_completions(user_id);
CREATE INDEX idx_completions_course ON public.course_completions(course_slug);
CREATE INDEX idx_completions_uid ON public.course_completions(certificate_uid);

ALTER TABLE public.course_completions ENABLE ROW LEVEL SECURITY;

-- Public read: ANY visitor can verify a certificate by its UID. We surface
-- only learner_name/course_title/course_slug/certificate_uid/completed_at/revoked_at
-- in the verification UI (no user_id, no email).
CREATE POLICY "Anyone can verify a certificate"
  ON public.course_completions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can create their own completions"
  ON public.course_completions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own completions"
  ON public.course_completions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage completions"
  ON public.course_completions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Source: 20260502125439_23ef0e89-ef9f-47b3-b7cf-a28b55ea55d2.sql
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_certificate_uid() FROM PUBLIC, anon, authenticated;

-- Source: 20260502131002_f514f9cb-686f-41da-9dc6-00fd74058e13.sql
-- ============================================================
-- course_progress: one row per (user, course)
-- ============================================================
CREATE TABLE public.course_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_slug text NOT NULL,
  progress_pct integer NOT NULL DEFAULT 0,
  total_seconds_spent integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_slug),
  CONSTRAINT course_progress_pct_range CHECK (progress_pct BETWEEN 0 AND 100),
  CONSTRAINT course_progress_seconds_nonneg CHECK (total_seconds_spent >= 0)
);

CREATE INDEX idx_course_progress_user ON public.course_progress (user_id);
CREATE INDEX idx_course_progress_slug ON public.course_progress (course_slug);
CREATE INDEX idx_course_progress_last_activity ON public.course_progress (last_activity_at DESC);

ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own progress"
  ON public.course_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
  ON public.course_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON public.course_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage progress"
  ON public.course_progress FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_course_progress_updated_at
  BEFORE UPDATE ON public.course_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- course_progress_events: append-only milestone log
-- ============================================================
CREATE TABLE public.course_progress_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_slug text NOT NULL,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_progress_events_type_check
    CHECK (event_type IN (
      'started',
      'heartbeat',
      'progress_updated',
      'mark_complete_clicked',
      'completed',
      'certificate_downloaded',
      'certificate_verified',
      'resumed'
    ))
);

CREATE INDEX idx_cpe_user ON public.course_progress_events (user_id);
CREATE INDEX idx_cpe_slug ON public.course_progress_events (course_slug);
CREATE INDEX idx_cpe_user_slug_time ON public.course_progress_events (user_id, course_slug, created_at DESC);

ALTER TABLE public.course_progress_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own progress events"
  ON public.course_progress_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress events"
  ON public.course_progress_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage progress events"
  ON public.course_progress_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));


-- Source: 20260502131747_fd5d0633-638f-4f1f-ad1b-c6609182036b.sql
CREATE TABLE public.state_pool_regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code text NOT NULL UNIQUE,
  state_name text NOT NULL,
  legality_status text NOT NULL DEFAULT 'unknown',
  summary text,
  zoning_summary text,
  permit_name text,
  permit_fee_min_usd integer,
  permit_fee_max_usd integer,
  authority_name text,
  authority_url text,
  enforcement_notes text,
  compliance_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_urls text[] NOT NULL DEFAULT '{}',
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT state_pool_regulations_status_check
    CHECK (legality_status IN ('legal','conditional','prohibited','unknown'))
);

CREATE INDEX idx_state_pool_regulations_code ON public.state_pool_regulations (state_code);

ALTER TABLE public.state_pool_regulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read state pool regulations"
  ON public.state_pool_regulations FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage state pool regulations"
  ON public.state_pool_regulations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_state_pool_regulations_updated_at
  BEFORE UPDATE ON public.state_pool_regulations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Source: 20260502133647_ca096039-b38c-414c-94a4-9e0f3d2381c6.sql
-- Host tools registry
CREATE TABLE public.host_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  category text NOT NULL DEFAULT 'Calculator',
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.host_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published host tools" ON public.host_tools
  FOR SELECT TO anon, authenticated USING (is_published = true);

CREATE POLICY "Admins can manage host tools" ON public.host_tools
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_host_tools_updated_at
  BEFORE UPDATE ON public.host_tools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Message board threads
CREATE TABLE public.mb_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  author_name text,
  title text NOT NULL,
  body text NOT NULL,
  category text,
  is_pinned boolean NOT NULL DEFAULT false,
  reply_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mb_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read threads" ON public.mb_threads
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Authenticated can create threads" ON public.mb_threads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors update own threads" ON public.mb_threads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors delete own threads" ON public.mb_threads
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins manage threads" ON public.mb_threads
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_mb_threads_updated_at
  BEFORE UPDATE ON public.mb_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_mb_threads_last_activity ON public.mb_threads (last_activity_at DESC);

-- Replies
CREATE TABLE public.mb_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.mb_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text,
  body text NOT NULL,
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mb_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read replies" ON public.mb_replies
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Authenticated can create replies" ON public.mb_replies
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors update own replies" ON public.mb_replies
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors delete own replies" ON public.mb_replies
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins manage replies" ON public.mb_replies
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_mb_replies_updated_at
  BEFORE UPDATE ON public.mb_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_mb_replies_thread ON public.mb_replies (thread_id, created_at);

-- Likes
CREATE TABLE public.mb_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid REFERENCES public.mb_threads(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES public.mb_replies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((thread_id IS NOT NULL) <> (reply_id IS NOT NULL))
);

CREATE UNIQUE INDEX uniq_mb_likes_thread ON public.mb_likes (user_id, thread_id) WHERE thread_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_mb_likes_reply ON public.mb_likes (user_id, reply_id) WHERE reply_id IS NOT NULL;

ALTER TABLE public.mb_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes" ON public.mb_likes
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users add own likes" ON public.mb_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own likes" ON public.mb_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Triggers to keep counts in sync
CREATE OR REPLACE FUNCTION public.mb_update_thread_reply_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.mb_threads
      SET reply_count = reply_count + 1,
          last_activity_at = now()
      WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.mb_threads
      SET reply_count = GREATEST(reply_count - 1, 0)
      WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER mb_replies_count_trigger
  AFTER INSERT OR DELETE ON public.mb_replies
  FOR EACH ROW EXECUTE FUNCTION public.mb_update_thread_reply_count();

CREATE OR REPLACE FUNCTION public.mb_update_like_counts()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.thread_id IS NOT NULL THEN
      UPDATE public.mb_threads SET like_count = like_count + 1 WHERE id = NEW.thread_id;
    ELSIF NEW.reply_id IS NOT NULL THEN
      UPDATE public.mb_replies SET like_count = like_count + 1 WHERE id = NEW.reply_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.thread_id IS NOT NULL THEN
      UPDATE public.mb_threads SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.thread_id;
    ELSIF OLD.reply_id IS NOT NULL THEN
      UPDATE public.mb_replies SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.reply_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER mb_likes_count_trigger
  AFTER INSERT OR DELETE ON public.mb_likes
  FOR EACH ROW EXECUTE FUNCTION public.mb_update_like_counts();

-- Seed all 56 tools
INSERT INTO public.host_tools (slug, title, summary, category, icon, sort_order) VALUES
('pool-rental-earnings-calculator','Pool Rental Earnings Calculator','Advanced income estimator with amenities, location & charts','Calculator','dollar',1),
('pool-earnings','Pool Earnings Calculator','Quick estimate of pool rental income','Calculator','dollar',2),
('pool-party-pricing','Pool Party Pricing Calculator','Figure out the right price for pool parties','Calculator','party',3),
('pool-insurance','Pool Insurance Estimator','Estimate pool rental insurance costs','Calculator','shield',4),
('pool-capacity','Pool Capacity Calculator','How many guests fit in your pool','Calculator','users',5),
('pool-break-even','Pool Break-Even Calculator','When does your pool pay for itself?','Calculator','target',6),
('pool-roi-calculator','Pool ROI Calculator','Return on investment for pool ownership','Calculator','trending',7),
('pool-cost-calculator','How Much Does a Pool Cost?','Total pool cost calculator with installation, maintenance & ROI','Calculator','dollar',8),
('private-pool-pricing-calculator','Private Pool Pricing','Pricing for private & adult-only bookings','Calculator','lock',9),
('pool-heating-cost','Pool Heating Cost Calculator','Cost to heat your pool by heater type','Calculator','flame',10),
('pool-maintenance-cost','Pool Maintenance Cost Calculator','Monthly maintenance cost estimates','Calculator','wrench',11),
('pool-chemical-cost','Pool Chemical Cost Calculator','Monthly chemical cost breakdown','Calculator','flask',12),
('pool-water-usage','Pool Water Usage Calculator','Water volume and cost estimates','Calculator','droplet',13),
('pool-pump-cost-calculator','Pool Pump Energy Cost','Electricity cost to run your pool pump','Calculator','zap',14),
('pool-fill-cost-calculator','Pool Fill Cost Calculator','Cost and time to fill your pool','Calculator','droplet',15),
('pool-heating-time-calculator','Pool Heating Time Calculator','How long to heat your pool','Calculator','flame',16),
('pool-evaporation-calculator','Pool Evaporation Calculator','Water lost to evaporation and refill costs','Calculator','droplet',17),
('pool-volume-calculator','Pool Volume Calculator','Calculate gallons of water in your pool','Calculator','droplet',18),
('pool-deck-size-calculator','Pool Deck Size Calculator','Recommended deck area for your pool','Calculator','ruler',19),
('pool-party-capacity','Pool Party Capacity','Safe party size for your pool and deck','Guide','users',20),
('pool-shade-calculator','Pool Shade Calculator','How much shade coverage you need','Calculator','umbrella',21),
('pool-chemical-dose-calculator','Pool Chemical Dose Calculator','Right amount of chlorine, shock, or algaecide','Calculator','flask',22),
('pool-water-chemistry','Pool Water Chemistry Advisor','Enter test readings, get exact chemical doses & step-by-step instructions','Guide','flask',23),
('pool-liability-waiver','Pool Liability Waiver Generator','Generate a printable liability waiver','Generator','file',24),
('pool-rules','Pool Rules Generator','Create printable pool rules signs','Generator','file',25),
('pool-guest-agreement','Pool Guest Agreement Builder','Comprehensive guest agreements','Generator','file',26),
('pool-safety-checklist','Pool Safety Checklist','Safety compliance checklist','Checklist','check',27),
('pool-host-checklist','Pool Host Checklist','Pre-booking preparation guide','Checklist','check',28),
('pool-wifi-qr','Pool WiFi QR Generator','QR code for guest WiFi access','Generator','qr',29),
('pool-welcome-sign','Pool Welcome Sign Generator','Printable welcome signs','Generator','file',30),
('pool-cleaning-schedule','Pool Cleaning Schedule','Maintenance schedule generator','Planner','calendar',31),
('message-board','Pool Host Message Board','Public board for hosts to share tips & connect','Community','message',32),
('host-marketing-engine','Host Marketing Engine','Generate flyers, social posts, DM scripts & campaigns instantly','AI','sparkles',33),
('pool-listing-ai-writer','Pool Listing AI Writer','Generate optimized listing titles, descriptions & photo tips','AI','sparkles',34),
('social-media-calendar','Social Media Content Calendar','30-day posting schedule with ready-to-use captions & hashtags','Planner','calendar',35),
('review-response-generator','Review Response Generator','Professional replies to guest reviews — positive or negative','AI','sparkles',36),
('email-sms-campaigns','Email & SMS Campaign Builder','Drip campaigns for repeat guests, seasonal promos & referrals','AI','sparkles',37),
('pool-listing-score','Pool Listing Score','Grade your pool listing quality','Guide','star',38),
('pool-host-pricing-ai','Pool Host Pricing AI','AI-driven pricing recommendations','AI','sparkles',39),
('pool-rental-price-index','Pool Rental Price Index','Local market pricing data','Guide','chart',40),
('seasonality','Seasonality Calculator','Best months to rent by region','Calculator','calendar',41),
('backyard-income-calculator','Backyard Income Calculator','Total backyard earning potential from pools, events & more','Calculator','dollar',42),
('backyard-monetization','Backyard Monetization Calculator','Full backyard earning potential','Calculator','dollar',43),
('event-profit','Event Profit Calculator','Party and event profitability','Calculator','party',44),
('swim-lesson-pricing','Swim Lesson Pricing Tool','Private lesson rate calculator','Calculator','dollar',45),
('birthday-party-planner','Birthday Party Planner','Budget and plan pool parties','Planner','party',46),
('backyard-event-pricing','Backyard Event Pricing','Price your backyard for events','Calculator','dollar',47),
('pool-rental-profit','Pool Rental Profit Calculator','Net profit from pool rentals','Calculator','dollar',48),
('noise-distance','Noise Distance Calculator','Check party noise compliance','Calculator','volume',49),
('hoa-risk-checker','HOA Risk Checker','Assess HOA compatibility','Checklist','shield',50),
('hoa-pool-rental-defense-kit','HOA Pool Rental Defense Kit','Legal templates & strategies to protect your right to rent your pool','Guide','shield',51),
('amenity-revenue-guide','Amenity & Upgrade Revenue Guide','Interactive ROI calculator for 249 pool amenities & upgrades','Guide','star',52),
('pool-host-academy','Pool Host Academy','Free courses and guides to become a top-rated pool host','Guide','book',53),
('pool-host-community','Pool Host Community','Connect with other pool hosts, share tips & grow together','Community','users',54),
('new-host-courses','New Host Courses','Latest training courses for pool hosts','Guide','book',55),
('cursos-en-espanol','Cursos en Español','Aprende a rentar tu piscina — Spanish hosting guides','Guide','book',56);

-- Source: 20260502135328_0fb7a70f-8e09-4969-b90f-a1bf3185946b.sql

CREATE TABLE public.help_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  hero_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.help_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_slug TEXT NOT NULL REFERENCES public.help_categories(slug) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_help_articles_category ON public.help_articles(category_slug);
CREATE INDEX idx_help_articles_published ON public.help_articles(is_published);

ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published help categories"
  ON public.help_categories FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins manage help categories"
  ON public.help_categories FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can read published help articles"
  ON public.help_articles FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins manage help articles"
  ON public.help_articles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER help_categories_updated_at
  BEFORE UPDATE ON public.help_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER help_articles_updated_at
  BEFORE UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Source: 20260502152903_3fbe1546-9e3a-4dc6-9269-12e784707b8f.sql
-- Extend providers with Google Maps fields
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS rating numeric,
  ADD COLUMN IF NOT EXISTS rating_count integer,
  ADD COLUMN IF NOT EXISTS google_cid text,
  ADD COLUMN IF NOT EXISTS google_category text,
  ADD COLUMN IF NOT EXISTS city_slug text,
  ADD COLUMN IF NOT EXISTS claimed_by uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ai_enriched_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_providers_state_city ON public.providers (state_code, city_slug);
CREATE INDEX IF NOT EXISTS idx_providers_claimed_by ON public.providers (claimed_by);
CREATE INDEX IF NOT EXISTS idx_providers_rating ON public.providers (rating DESC NULLS LAST);
CREATE UNIQUE INDEX IF NOT EXISTS uq_providers_slug ON public.providers (slug);
CREATE UNIQUE INDEX IF NOT EXISTS uq_providers_google_cid ON public.providers (google_cid) WHERE google_cid IS NOT NULL;

-- Provider leads: people interested in joining the network
CREATE TABLE IF NOT EXISTS public.provider_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  website text,
  city text,
  state_code text,
  message text,
  source_provider_slug text,
  source_path text,
  user_id uuid,
  status text NOT NULL DEFAULT 'new',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.provider_leads;
CREATE POLICY "Anyone can submit a lead"
  ON public.provider_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins manage leads" ON public.provider_leads;
CREATE POLICY "Admins manage leads"
  ON public.provider_leads
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_provider_leads_updated_at ON public.provider_leads;
CREATE TRIGGER trg_provider_leads_updated_at
  BEFORE UPDATE ON public.provider_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_provider_leads_email ON public.provider_leads (email);
CREATE INDEX IF NOT EXISTS idx_provider_leads_status ON public.provider_leads (status);

-- Source: 20260502233000_a1b2c3d4-e5f6-7890-abcd-ef1234567890.sql
-- =============================================================================
-- Migration: PRNM URL parity rebuild
-- =============================================================================
-- Adds the unified content_pages table that powers /p/$slug, public pools tree
-- (/public-pools/{state}/{city}/{pool}), host_profiles cache for /u/{uuid},
-- and renames categories -> amenities to match Sharetribe's /amenity/$slug URLs.
-- See migration-plan/02-supabase-schema.md for the full design rationale.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. content_pages: master table for all /p/$slug pages
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.content_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  template_type   text NOT NULL,
  title           text NOT NULL,
  description     text,
  content         text,
  seo_title       text,
  seo_description text,
  cover_image_url text,
  city_id         uuid REFERENCES public.cities(id),
  state_code      text,
  amenity_id      uuid,
  language        text NOT NULL DEFAULT 'en',
  hreflang_alt    uuid REFERENCES public.content_pages(id),
  author          text,
  published_at    timestamp with time zone,
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  is_published    boolean NOT NULL DEFAULT false,
  legacy_slugs    text[] NOT NULL DEFAULT '{}',
  CONSTRAINT content_pages_template_type_check CHECK (template_type IN (
    'city_main',
    'host_acquisition_city',
    'event_city_guide',
    'spanish_host_acquisition',
    'spanish_resource',
    'host_advocacy',
    'state_advocacy_guide',
    'academy_article',
    'money_page',
    'resource_article'
  )),
  CONSTRAINT content_pages_language_check CHECK (language IN ('en', 'es'))
);

CREATE INDEX IF NOT EXISTS idx_content_pages_slug_published
  ON public.content_pages (slug) WHERE is_published;

CREATE INDEX IF NOT EXISTS idx_content_pages_template_type
  ON public.content_pages (template_type) WHERE is_published;

CREATE INDEX IF NOT EXISTS idx_content_pages_legacy_slugs
  ON public.content_pages USING gin (legacy_slugs);

CREATE INDEX IF NOT EXISTS idx_content_pages_city
  ON public.content_pages (city_id) WHERE city_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_pages_updated_at
  ON public.content_pages (updated_at DESC) WHERE is_published;

ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published content_pages" ON public.content_pages;
CREATE POLICY "Public can read published content_pages"
  ON public.content_pages
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins manage content_pages" ON public.content_pages;
CREATE POLICY "Admins manage content_pages"
  ON public.content_pages
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_content_pages_updated_at ON public.content_pages;
CREATE TRIGGER trg_content_pages_updated_at
  BEFORE UPDATE ON public.content_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. amenities: renamed from categories to match Sharetribe /amenity/$slug
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'amenities') THEN
    ALTER TABLE public.categories RENAME TO amenities;
  END IF;
END $$;

-- If the rename didn't happen (no source table), create amenities from scratch
CREATE TABLE IF NOT EXISTS public.amenities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  description     text,
  icon            text,
  cover_image_url text,
  is_published    boolean NOT NULL DEFAULT true,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  updated_at      timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published amenities" ON public.amenities;
CREATE POLICY "Public can read published amenities"
  ON public.amenities
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins manage amenities" ON public.amenities;
CREATE POLICY "Admins manage amenities"
  ON public.amenities
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add the FK now that amenities exists (deferred from content_pages CREATE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'content_pages_amenity_id_fkey'
  ) THEN
    ALTER TABLE public.content_pages
      ADD CONSTRAINT content_pages_amenity_id_fkey
      FOREIGN KEY (amenity_id) REFERENCES public.amenities(id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. public_pool_states / public_pool_cities / public_pools
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_pool_states (
  state_code     text PRIMARY KEY,
  state_slug     text NOT NULL UNIQUE,
  state_name     text NOT NULL,
  hero_image_url text,
  intro          text,
  is_published   boolean NOT NULL DEFAULT true,
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  updated_at     timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.public_pool_cities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_slug     text NOT NULL REFERENCES public.public_pool_states(state_slug),
  city_slug      text NOT NULL,
  city_name      text NOT NULL,
  hero_image_url text,
  intro          text,
  is_published   boolean NOT NULL DEFAULT true,
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  updated_at     timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (state_slug, city_slug)
);

CREATE TABLE IF NOT EXISTS public.public_pools (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_slug     text NOT NULL,
  city_slug      text NOT NULL,
  pool_slug      text NOT NULL,
  pool_name      text NOT NULL,
  description    text,
  address        text,
  latitude       numeric,
  longitude      numeric,
  amenities      text[],
  hours          jsonb,
  contact        jsonb,
  hero_image_url text,
  is_published   boolean NOT NULL DEFAULT true,
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  updated_at     timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (state_slug, city_slug, pool_slug),
  FOREIGN KEY (state_slug, city_slug) REFERENCES public.public_pool_cities(state_slug, city_slug)
);

CREATE INDEX IF NOT EXISTS idx_public_pools_loc
  ON public.public_pools (state_slug, city_slug) WHERE is_published;

CREATE INDEX IF NOT EXISTS idx_public_pools_updated_at
  ON public.public_pools (updated_at DESC) WHERE is_published;

ALTER TABLE public.public_pool_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_pool_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_pools         ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['public_pool_states', 'public_pool_cities', 'public_pools'] LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS "Public can read published %1$s" ON public.%1$I;
      CREATE POLICY "Public can read published %1$s"
        ON public.%1$I
        FOR SELECT
        TO anon, authenticated
        USING (is_published = true);

      DROP POLICY IF EXISTS "Admins manage %1$s" ON public.%1$I;
      CREATE POLICY "Admins manage %1$s"
        ON public.%1$I
        FOR ALL
        TO authenticated
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    $f$, t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_public_pool_states_updated_at ON public.public_pool_states;
CREATE TRIGGER trg_public_pool_states_updated_at
  BEFORE UPDATE ON public.public_pool_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_public_pool_cities_updated_at ON public.public_pool_cities;
CREATE TRIGGER trg_public_pool_cities_updated_at
  BEFORE UPDATE ON public.public_pool_cities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_public_pools_updated_at ON public.public_pools;
CREATE TRIGGER trg_public_pools_updated_at
  BEFORE UPDATE ON public.public_pools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. host_profiles: cache table for /u/{uuid} pages
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.host_profiles (
  uuid           uuid PRIMARY KEY,
  display_name   text NOT NULL,
  bio            text,
  city_id        uuid REFERENCES public.cities(id),
  avatar_url     text,
  joined_at      timestamp with time zone,
  listing_count  integer NOT NULL DEFAULT 0,
  is_published   boolean NOT NULL DEFAULT true,
  cached_at      timestamp with time zone NOT NULL DEFAULT now(),
  updated_at     timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_host_profiles_city
  ON public.host_profiles (city_id) WHERE is_published;

CREATE INDEX IF NOT EXISTS idx_host_profiles_updated_at
  ON public.host_profiles (updated_at DESC) WHERE is_published;

ALTER TABLE public.host_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published host_profiles" ON public.host_profiles;
CREATE POLICY "Public can read published host_profiles"
  ON public.host_profiles
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins manage host_profiles" ON public.host_profiles;
CREATE POLICY "Admins manage host_profiles"
  ON public.host_profiles
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_host_profiles_updated_at ON public.host_profiles;
CREATE TRIGGER trg_host_profiles_updated_at
  BEFORE UPDATE ON public.host_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Source: 20260503044749_a591f5e0-21c4-408e-b1e9-f70705847813.sql
-- Replace the public "Anyone can verify a certificate" select policy with a function that looks up by certificate UID without exposing all rows.
DROP POLICY IF EXISTS "Anyone can verify a certificate" ON public.course_completions;

CREATE POLICY "Users can view their own completions"
ON public.course_completions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Public verification via SECURITY DEFINER function (returns only the matching record)
CREATE OR REPLACE FUNCTION public.verify_certificate(_uid text)
RETURNS TABLE (
  certificate_uid text,
  course_slug text,
  course_title text,
  learner_name text,
  completed_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT certificate_uid, course_slug, course_title, learner_name,
         completed_at, revoked_at, revoke_reason
  FROM public.course_completions
  WHERE certificate_uid = _uid
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

-- Source: 20260503044822_b26b0405-fe9c-411a-8058-2dfded3d406f.sql
REVOKE EXECUTE ON FUNCTION public.verify_certificate(text) FROM anon, authenticated;

-- Source: 20260503050446_65fe37f1-705b-4485-bfb3-b2f7f1ab94e7.sql
-- Migration tracking + content store for the /p/ URL inventory.
--
-- An earlier migration (20260502233000) created `content_pages` with a
-- different (CMS-style) schema. This migration redefines it as the
-- URL-inventory schema that all subsequent migrations expect (they ALTER
-- TABLE on the columns defined below). The DROP+CASCADE wipes the earlier
-- placeholder + its policies/indexes/triggers cleanly.
DROP TABLE IF EXISTS public.content_pages CASCADE;

CREATE TABLE public.content_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identity
  source_url text NOT NULL UNIQUE,           -- Full original URL from Sharetribe
  url_path text NOT NULL,                    -- Path portion, e.g. /p/become-a-pool-host-austin-tx
  slug text,                                 -- Last path segment

  -- Classification (from CSV)
  category text NOT NULL,                    -- e.g. "Host Acquisition (City pSEO)"
  template_type text,                        -- normalized template key: host_acq_city, event_guide, resource, elearning, host_advocacy_hub, host_advocacy_state, spanish_host_acq, spanish_resource, public_pool_city, public_pool_state, amenity, hub, homepage, listing, other
  locale text NOT NULL DEFAULT 'en',         -- 'en' | 'es'
  hreflang_group text,                       -- shared key linking en/es siblings

  -- Sitemap source tracking
  in_sitemap boolean NOT NULL DEFAULT false,
  sitemap_source text,

  -- Migration workflow
  status text NOT NULL DEFAULT 'pending',    -- pending | scraped | drafted | published | skipped | redirect
  priority integer NOT NULL DEFAULT 0,       -- higher = migrate first (top SEO pages)
  redirect_to text,                          -- if status = redirect

  -- Content
  title text,
  seo_title text,
  seo_description text,
  hero_image_url text,
  body_markdown text,                        -- migrated content
  raw_html text,                             -- scraped HTML (before transform)

  -- Timestamps
  scraped_at timestamptz,
  migrated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_pages_category ON public.content_pages(category);
CREATE INDEX idx_content_pages_template_type ON public.content_pages(template_type);
CREATE INDEX idx_content_pages_status ON public.content_pages(status);
CREATE INDEX idx_content_pages_locale ON public.content_pages(locale);
CREATE INDEX idx_content_pages_slug ON public.content_pages(slug);
CREATE INDEX idx_content_pages_url_path ON public.content_pages(url_path);
CREATE INDEX idx_content_pages_hreflang_group ON public.content_pages(hreflang_group);

ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;

-- Admin-only — this is internal migration tooling, not public content
CREATE POLICY "Admins manage content pages"
  ON public.content_pages
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_content_pages_updated_at
  BEFORE UPDATE ON public.content_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260503050726_42e9a48f-7e08-48d3-8613-fc6665fffa65.sql
-- Explicit admin-only SELECT on internal backfill log
CREATE POLICY "Admins can read hero backfill log"
  ON public.cities_hero_backfill_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Source: 20260503054106_378faba2-b5db-4400-a5d0-1f5c467a4df1.sql
CREATE TABLE IF NOT EXISTS public.content_404_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url_path text NOT NULL,
  slug text,
  referrer text,
  user_agent text,
  hit_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_notes text
);

CREATE UNIQUE INDEX IF NOT EXISTS content_404_log_url_path_key ON public.content_404_log(url_path);
CREATE INDEX IF NOT EXISTS content_404_log_last_seen_idx ON public.content_404_log(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS content_404_log_unresolved_idx ON public.content_404_log(resolved_at) WHERE resolved_at IS NULL;

ALTER TABLE public.content_404_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage 404 log"
  ON public.content_404_log FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Source: 20260503071720_3868ec7a-8c8f-4846-9085-bbeb7b43106d.sql
-- Restrict EXECUTE on internal SECURITY DEFINER helpers to prevent direct calls by signed-in users.
-- has_role: only used internally by RLS policies (definer context bypasses grants).
-- handle_new_user: trigger function on auth.users; never called directly.
-- verify_certificate: intentionally public (used by /verify page) — keep EXECUTE for anon/authenticated.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- Source: 20260503073220_821da08f-a620-4a51-9d90-9d897c9e03c4.sql
REVOKE ALL ON TABLE public.content_pages FROM anon, authenticated;

COMMENT ON TABLE public.content_pages IS
  'Server-only access. Reads MUST go through supabaseAdmin (service role) in server functions. No public SELECT RLS policy exists; anon/authenticated table grants are revoked as defense-in-depth. See src/server/content-pages.functions.ts.';

-- Source: 20260503073420_05514898-2dbc-4017-b9fd-facdaced355b.sql
-- Remove user-facing INSERT path; completions are now created exclusively
-- by the markCourseComplete server function via the service role.
DROP POLICY IF EXISTS "Users can create their own completions" ON public.course_completions;

-- Source: 20260503181858_e661b638-f01c-4509-a1ff-bbcf7ef31d70.sql
-- Cached Sharetribe listings for fast rendering
CREATE TABLE public.synced_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sharetribe_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price_amount INTEGER,
  price_currency TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  address TEXT,
  city TEXT,
  state_code TEXT,
  city_slug TEXT,
  category TEXT,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  capacity INTEGER,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  primary_image_url TEXT,
  author_id TEXT,
  state TEXT NOT NULL DEFAULT 'published',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  public_data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  st_created_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_synced_listings_city_slug ON public.synced_listings(city_slug) WHERE state = 'published' AND is_deleted = false;
CREATE INDEX idx_synced_listings_state_code ON public.synced_listings(state_code) WHERE state = 'published' AND is_deleted = false;
CREATE INDEX idx_synced_listings_category ON public.synced_listings(category) WHERE state = 'published' AND is_deleted = false;
CREATE INDEX idx_synced_listings_geo ON public.synced_listings(latitude, longitude) WHERE state = 'published' AND is_deleted = false;
CREATE INDEX idx_synced_listings_state ON public.synced_listings(state);
CREATE INDEX idx_synced_listings_slug ON public.synced_listings(slug);

ALTER TABLE public.synced_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published synced listings"
  ON public.synced_listings FOR SELECT
  TO anon, authenticated
  USING (state = 'published' AND is_deleted = false);

CREATE POLICY "Admins manage synced listings"
  ON public.synced_listings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_synced_listings_updated_at
  BEFORE UPDATE ON public.synced_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync run log
CREATE TABLE public.listing_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  total_processed INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_sync_log_started_at ON public.listing_sync_log(started_at DESC);

ALTER TABLE public.listing_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage listing sync log"
  ON public.listing_sync_log FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Source: 20260503183204_98645831-24e9-4344-8f06-c1336ea4df0f.sql

UPDATE public.content_pages
SET 
  title = 'How Pool Rental Near Me Works',
  seo_title = 'How It Works — Rent or List a Pool by the Hour | Pool Rental Near Me',
  seo_description = 'Discover how Pool Rental Near Me connects guests with private pool hosts. Browse pools, book by the hour, and enjoy a safe, insured swim — or list your pool to earn extra income.',
  status = 'published',
  body_markdown = $$Pool Rental Near Me is the easiest way to book a private pool by the hour — or to turn your own backyard pool into a source of income. Whether you''re planning a birthday party, a family swim, a photoshoot, or just a quiet afternoon away from the crowds, here''s how it works.

## For Guests — Book a Pool in 3 Simple Steps

### 1. Search Pools Near You
Enter your city, ZIP code, or address to see available pools in your area. Filter by date, group size, amenities (hot tubs, slides, shaded areas, restrooms, Wi-Fi), and pet-friendly options. Each listing includes photos, host reviews, house rules, and clear hourly pricing.

### 2. Book by the Hour
Pick the date and time window that works for you. Booking is fully online — no awkward calls, no negotiating. You''ll see the total upfront, including any cleaning or extra-guest fees. Payment is processed securely; the host only gets paid after your swim is complete.

### 3. Show Up & Swim
Once your booking is confirmed, you''ll receive the address and check-in instructions. Arrive at your scheduled time, enjoy the pool with your group, and leave it the way you found it. After your visit, leave a review to help future guests.

**Every booking includes:**
- Secure online payment
- Host-verified listings
- 24/7 support team
- Liability protection through our partner insurance program

## For Hosts — Earn With Your Pool

### 1. List Your Pool for Free
Create your listing in under 15 minutes. Add photos, set your hourly rate, choose your availability calendar, and write your house rules. Our team reviews every listing before it goes live.

### 2. Welcome Guests on Your Schedule
You stay in full control. Approve or decline booking requests, block off dates you''re unavailable, and adjust pricing for weekends, holidays, or peak summer months. Most hosts earn between $1,500 and $5,000 per month during pool season.

### 3. Get Paid Automatically
Payouts are deposited directly to your bank account within 24 hours of each completed booking. We handle all payment processing, taxes documentation, and guest communication tools.

**Hosts get:**
- Free listing & onboarding
- Liability coverage during bookings
- Smart pricing recommendations
- Full calendar control
- Dedicated host success team

## Safety & Trust

Every guest and host is verified with email and phone confirmation. All bookings are protected by our community guidelines, and our support team is available around the clock to resolve any issues. Hosts can require waivers, set maximum guest counts, and review every booking request before approving.

## Frequently Asked Questions

**How much does it cost to book a pool?**
Hourly rates typically range from $40 to $200 per hour depending on the pool, location, and amenities. Most bookings are 2–4 hours.

**Do I need to bring anything?**
Towels and personal items, yes. Many hosts also provide pool floats, lounge chairs, and grills — check the listing details.

**What if it rains?**
Most hosts offer flexible rescheduling for weather-related cancellations. Check each host''s cancellation policy before booking.

**How do I become a host?**
Click "List your pool" at the top of any page, and we''ll walk you through it step by step. You''ll need photos of your pool, basic property info, and a bank account for payouts.

---

Ready to dive in? [Find a pool near you](/) or [list your pool](/p/list-your-pool) today.$$,
  updated_at = now()
WHERE slug = 'how-it-works';


-- Source: 20260503185550_04c3cfaf-e4d0-41ee-aa78-755f6bfaaa12.sql
-- Waitlist table for visitors with no pool within 500 miles
create table if not exists public.pool_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  city text,
  region text,
  latitude double precision,
  longitude double precision,
  nearest_miles double precision,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists pool_waitlist_email_idx on public.pool_waitlist (email);
create index if not exists pool_waitlist_created_at_idx on public.pool_waitlist (created_at desc);

alter table public.pool_waitlist enable row level security;

-- Public visitors (anon) may insert their own email; nobody can read.
-- Admins can read/manage via has_role().
drop policy if exists "Anyone can join waitlist" on public.pool_waitlist;
create policy "Anyone can join waitlist"
on public.pool_waitlist
for insert
to anon, authenticated
with check (true);

drop policy if exists "Admins manage waitlist" on public.pool_waitlist;
create policy "Admins manage waitlist"
on public.pool_waitlist
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));


-- Source: 20260503185619_3d979523-4561-4feb-b171-89f21a7ec09e.sql
drop policy if exists "Anyone can join waitlist" on public.pool_waitlist;

-- Source: 20260503214344_c8aeead6-945c-489c-b533-1ad052dbd466.sql
-- Defense-in-depth: synced_listings contains private host home addresses
-- and precise lat/long. The app does not read this table from the browser
-- (listings come directly from Sharetribe at request time); the only reads
-- happen server-side via supabaseAdmin during sync. Drop the public SELECT
-- policy so RLS denies anon/authenticated reads, and revoke table grants.
DROP POLICY IF EXISTS "Public can read published synced listings" ON public.synced_listings;

REVOKE SELECT ON public.synced_listings FROM anon, authenticated;

-- Source: 20260503222953_e80d383a-7464-4074-a0f5-56c925fcfff8.sql
-- Add missing columns
ALTER TABLE public.content_pages
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS legacy_slugs TEXT[] DEFAULT '{}'::text[];

-- Relax NOT NULLs and add a category default
ALTER TABLE public.content_pages
  ALTER COLUMN url_path DROP NOT NULL,
  ALTER COLUMN source_url DROP NOT NULL,
  ALTER COLUMN category SET DEFAULT 'general';

-- Deduplicate: keep most recently updated row per slug
DELETE FROM public.content_pages a
USING public.content_pages b
WHERE a.slug IS NOT NULL
  AND a.slug = b.slug
  AND (a.updated_at, a.id) < (b.updated_at, b.id);

-- Now safe to enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS content_pages_slug_key
  ON public.content_pages (slug)
  WHERE slug IS NOT NULL;

-- Source: 20260503224607_fa65e0c9-061f-4b89-8bab-1b888ba1132a.sql
CREATE UNIQUE INDEX IF NOT EXISTS content_pages_url_path_key ON public.content_pages (url_path);

-- Source: 20260503230322_18c00d76-d895-4b50-9cd2-f8930c2785fe.sql
-- Grant admin role to Derek's user from the pool-rental project, if that
-- user happens to exist in this DB (it won't on a fresh founders-click
-- project — admin will be granted manually post-signup via the UI / SQL).
INSERT INTO public.user_roles (user_id, role)
SELECT '1c83b29a-9757-49cf-944a-c2e5db131e06'::uuid, 'admin'
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = '1c83b29a-9757-49cf-944a-c2e5db131e06'::uuid)
ON CONFLICT (user_id, role) DO NOTHING;


-- Source: 20260503231041_b090a46f-643b-4207-b796-7c64f61a63b5.sql

CREATE TABLE public.content_plan (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL DEFAULT 'city',
  priority_tier TEXT,
  priority_score BIGINT,
  city TEXT,
  state TEXT,
  state_code TEXT,
  population_2024 BIGINT,
  warm_climate BOOLEAN,
  slug TEXT NOT NULL UNIQUE,
  h1 TEXT,
  meta_title TEXT,
  meta_description TEXT,
  primary_keyword TEXT,
  supporting_keywords TEXT,
  uniqueness_angle TEXT,
  internal_links TEXT,
  schema_suggestions TEXT,
  notes TEXT,
  search_intent TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  generated_page_slug TEXT,
  generated_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_plan_status ON public.content_plan (status);
CREATE INDEX idx_content_plan_tier ON public.content_plan (priority_tier);
CREATE INDEX idx_content_plan_state ON public.content_plan (state_code);
CREATE INDEX idx_content_plan_priority ON public.content_plan (priority_score DESC NULLS LAST);

ALTER TABLE public.content_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage content plan"
  ON public.content_plan
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_content_plan_updated_at
  BEFORE UPDATE ON public.content_plan
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- Source: 20260504041912_12b092b4-5de2-4e59-9809-f4a00ab75988.sql
UPDATE content_plan SET status='pending', last_error=NULL WHERE status='generating';

-- Source: 20260504224549_e332e013-176c-4d29-80ed-9dc56fe4ea40.sql
CREATE TABLE public.feature_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  name text,
  request_text text NOT NULL,
  city text,
  region text,
  latitude double precision,
  longitude double precision,
  user_agent text,
  referrer_path text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage feature requests"
ON public.feature_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can submit a feature request"
ON public.feature_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE TRIGGER update_feature_requests_updated_at
BEFORE UPDATE ON public.feature_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_feature_requests_created_at ON public.feature_requests (created_at DESC);

-- Source: 20260505004403_email_infra.sql
-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);



-- Source: 20260505092224_859458a4-60c1-40e8-ba94-57fc81031a01.sql
-- Quality view: per-page word count, quality bucket, issue flags
CREATE OR REPLACE VIEW public.page_quality AS
SELECT
  p.id,
  p.slug,
  p.url_path,
  p.template_type,
  p.status,
  p.title,
  p.seo_title,
  p.seo_description,
  p.body_markdown,
  p.created_at,
  p.updated_at,
  COALESCE(
    array_length(
      regexp_split_to_array(trim(COALESCE(p.body_markdown, '')), '\s+'),
      1
    ),
    0
  ) AS word_count,
  CASE
    WHEN p.body_markdown IS NULL OR length(trim(p.body_markdown)) = 0 THEN 'empty'
    WHEN COALESCE(array_length(regexp_split_to_array(trim(p.body_markdown), '\s+'), 1), 0) < 500 THEN 'thin'
    WHEN COALESCE(array_length(regexp_split_to_array(trim(p.body_markdown), '\s+'), 1), 0) < 1000 THEN 'medium'
    ELSE 'healthy'
  END AS quality,
  (p.seo_description IS NULL OR length(trim(p.seo_description)) = 0) AS missing_meta,
  -- "schema" proxy: does body contain a JSON-LD script block?
  (p.body_markdown IS NULL OR p.body_markdown !~* 'application/ld\+json') AS missing_schema,
  (p.title IS NULL OR p.title = p.slug OR length(trim(COALESCE(p.title,''))) = 0) AS title_is_slug,
  -- no internal markdown links and no relative href to /
  (
    p.body_markdown IS NOT NULL
    AND p.body_markdown !~ '\]\(/'
    AND p.body_markdown !~ 'href="/'
  ) AS no_internal_links
FROM public.content_pages p
WHERE p.url_path LIKE '/p/%';

-- Per-template rollup
CREATE OR REPLACE VIEW public.template_quality_breakdown AS
SELECT
  template_type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'published') AS published,
  COUNT(*) FILTER (WHERE status = 'published' AND quality = 'empty')   AS published_empty,
  COUNT(*) FILTER (WHERE status = 'published' AND quality = 'thin')    AS published_thin,
  COUNT(*) FILTER (WHERE status = 'published' AND quality = 'medium')  AS published_medium,
  COUNT(*) FILTER (WHERE status = 'published' AND quality = 'healthy') AS published_healthy,
  COUNT(*) FILTER (WHERE status <> 'published') AS pending,
  AVG(word_count) FILTER (WHERE status = 'published')::int AS avg_words_published,
  MIN(updated_at) FILTER (WHERE status <> 'published') AS oldest_pending,
  COUNT(*) FILTER (WHERE status = 'published' AND updated_at >= now() - interval '7 days') AS published_last_7d
FROM public.page_quality
GROUP BY template_type;

-- Site-wide issue counters
CREATE OR REPLACE VIEW public.site_issues AS
SELECT
  COUNT(*) FILTER (WHERE status = 'published' AND missing_meta)        AS missing_meta_published,
  COUNT(*) FILTER (WHERE status = 'published' AND missing_schema)      AS missing_schema_published,
  COUNT(*) FILTER (WHERE status = 'published' AND no_internal_links)   AS no_links_published,
  COUNT(*) FILTER (WHERE status = 'published' AND title_is_slug)       AS title_is_slug_published,
  COUNT(*) FILTER (WHERE status = 'published' AND quality = 'thin')    AS thin_published_total,
  COUNT(*) FILTER (WHERE status = 'published' AND quality = 'empty')   AS empty_published_total
FROM public.page_quality;

-- Source: 20260505092249_67cf97aa-ff34-41e3-85a7-a904979f922d.sql
REVOKE ALL ON public.page_quality FROM anon, authenticated;
REVOKE ALL ON public.template_quality_breakdown FROM anon, authenticated;
REVOKE ALL ON public.site_issues FROM anon, authenticated;
ALTER VIEW public.page_quality SET (security_invoker = true);
ALTER VIEW public.template_quality_breakdown SET (security_invoker = true);
ALTER VIEW public.site_issues SET (security_invoker = true);

-- Source: 20260505092817_434dcb24-7b7e-46e7-8ed1-a780bd0f29a4.sql
-- Service categories
CREATE TABLE IF NOT EXISTS public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  plural_name text NOT NULL,
  icon text,
  hero_image_url text,
  intro_markdown text,
  seo_title text,
  seo_description text,
  sort_order int NOT NULL DEFAULT 100,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published service categories"
  ON public.service_categories FOR SELECT TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "Admins manage service categories"
  ON public.service_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_service_categories_updated_at
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.service_categories (slug, name, plural_name, icon, sort_order, seo_title, seo_description, intro_markdown) VALUES
  ('pool-builders', 'Pool Builder', 'Pool Builders', 'Hammer', 10,
   'Pool Builders Directory — Find Local Pool Construction Pros',
   'Browse vetted pool builders near you. Compare designs, materials, and quotes for inground, fiberglass, and concrete pools.',
   'Find a trusted local **pool builder** for your inground, fiberglass, or gunite project. All listings include service area, specialties, and direct contact.'),
  ('pool-cleaners', 'Pool Cleaner', 'Pool Cleaners', 'Sparkles', 20,
   'Pool Cleaning Services — Weekly & One-Time Pool Maintenance',
   'Find local pool cleaners for weekly maintenance, chemical balancing, and seasonal service. Compare local pros now.',
   'Browse local **pool cleaning services** offering weekly maintenance, chemical balancing, vacuuming, and tile scrubbing.'),
  ('pool-repair', 'Pool Repair Pro', 'Pool Repair Pros', 'Wrench', 30,
   'Pool Repair Services — Pump, Liner, Heater & Equipment Repair',
   'Local pool repair specialists for pumps, heaters, liners, filters, and plumbing leaks. Get matched with a pro fast.',
   'Find **pool repair specialists** for pumps, heaters, filters, liner replacement, and equipment troubleshooting.'),
  ('pool-manufacturers', 'Pool Manufacturer', 'Pool Manufacturers', 'Factory', 40,
   'Pool Manufacturers — Fiberglass Shells, Liners & Equipment',
   'Browse leading pool manufacturers and suppliers of fiberglass shells, vinyl liners, and pool equipment.',
   'Browse **pool manufacturers** producing fiberglass shells, vinyl liners, pumps, heaters, and full pool equipment lines.'),
  ('pool-openers-closers', 'Opening & Closing Service', 'Pool Opening & Closing Services', 'CalendarClock', 50,
   'Pool Opening & Closing Services — Seasonal Pool Pros',
   'Schedule local pool opening and winter closing services. Find seasonal pool pros for spring start-ups and winterizing.',
   'Find local pros for **seasonal pool openings and winterizations** — pump priming, chemical balancing, cover install, and antifreeze line blowouts.'),
  ('pool-leak-detection', 'Leak Detection Specialist', 'Pool Leak Detection Specialists', 'SearchCheck', 60,
   'Pool Leak Detection Services — Find & Fix Pool Leaks',
   'Find pool leak detection specialists using pressure testing, dye, and sonic equipment to locate and repair pool leaks.',
   'Locate hidden pool leaks fast with **certified leak-detection specialists** using pressure, dye, and sonic testing.'),
  ('pool-resurfacing', 'Resurfacing Pro', 'Pool Resurfacing Pros', 'PaintBucket', 70,
   'Pool Resurfacing — Plaster, Pebble & Tile Refinishing',
   'Find pool resurfacing pros for plaster, pebble, quartz, and tile refinishing. Restore your aging pool surface.',
   'Refinish an aging pool with **plaster, pebble, quartz, or tile resurfacing** by vetted local pros.')
ON CONFLICT (slug) DO NOTHING;

-- Extend providers
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS primary_category text REFERENCES public.service_categories(slug) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS secondary_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz,
  ADD COLUMN IF NOT EXISTS listing_paid_until timestamptz,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS claim_status text NOT NULL DEFAULT 'unclaimed',
  ADD COLUMN IF NOT EXISTS submission_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitter_email text,
  ADD COLUMN IF NOT EXISTS submission_notes text;

CREATE INDEX IF NOT EXISTS providers_primary_category_idx ON public.providers (primary_category) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS providers_state_idx ON public.providers (state_code) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS providers_featured_idx ON public.providers (is_featured) WHERE is_published = true AND is_featured = true;
CREATE INDEX IF NOT EXISTS providers_submission_status_idx ON public.providers (submission_status) WHERE submission_status = 'pending';

-- Allow anyone to submit a new pending provider (admin must approve before publish)
DROP POLICY IF EXISTS "Anyone can submit a provider" ON public.providers;
CREATE POLICY "Anyone can submit a provider"
  ON public.providers FOR INSERT TO anon, authenticated
  WITH CHECK (
    is_published = false
    AND submission_status = 'pending'
    AND claim_status IN ('unclaimed', 'pending')
  );

-- Source: 20260505093601_59000bf7-d0bb-4789-8b58-0dd0b2e8e007.sql
CREATE OR REPLACE FUNCTION public.count_providers_by_category()
RETURNS TABLE(primary_category text, n bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT primary_category, count(*)::bigint AS n
  FROM public.providers
  WHERE is_published = true AND primary_category IS NOT NULL
  GROUP BY primary_category;
$$;

REVOKE ALL ON FUNCTION public.count_providers_by_category() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_providers_by_category() TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS providers_primary_category_pub_idx
  ON public.providers (primary_category)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS providers_secondary_categories_gin
  ON public.providers USING GIN (secondary_categories);


-- Source: 20260505094449_1509f5d4-4c63-4402-a7bc-c58be5469a16.sql
CREATE TABLE public.provider_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  provider_slug TEXT NOT NULL,
  claimer_name TEXT NOT NULL,
  claimer_email TEXT NOT NULL,
  claimer_phone TEXT,
  claimer_role TEXT,
  business_email TEXT,
  business_phone TEXT,
  business_website TEXT,
  verification_notes TEXT,
  proposed_updates JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  user_agent TEXT,
  source_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX provider_claims_provider_idx ON public.provider_claims (provider_id);
CREATE INDEX provider_claims_status_idx ON public.provider_claims (status, created_at DESC);

ALTER TABLE public.provider_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a claim"
  ON public.provider_claims FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "Admins manage claims"
  ON public.provider_claims FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_provider_claims_updated_at
  BEFORE UPDATE ON public.provider_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260505103452_c51129e0-13a3-446c-962b-61c473417a78.sql
CREATE TABLE public.provider_plan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  provider_slug text NOT NULL,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text,
  requested_plan text NOT NULL CHECK (requested_plan IN ('paid','featured')),
  payment_reference text,
  payment_method text,
  amount_usd numeric,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  source_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ppr_provider ON public.provider_plan_requests(provider_id);
CREATE INDEX idx_ppr_status ON public.provider_plan_requests(status);

ALTER TABLE public.provider_plan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a plan request"
  ON public.provider_plan_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "Admins manage plan requests"
  ON public.provider_plan_requests FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ppr_updated_at
  BEFORE UPDATE ON public.provider_plan_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260505113147_0b742260-d78d-400a-958e-e9e7e63828ad.sql

-- Add fields to support richer SEO provider pages, scraping, AI content, and GSC metrics
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS long_description text,
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gallery_urls text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS scraped_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_content_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS gsc_impressions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gsc_clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gsc_position numeric,
  ADD COLUMN IF NOT EXISTS gsc_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS providers_gsc_impressions_idx
  ON public.providers (gsc_impressions DESC) WHERE is_published = true;

-- Track scrape jobs from competitor directories (Yelp, Google Maps, etc.)
CREATE TABLE IF NOT EXISTS public.provider_scrape_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  source_type text,
  status text NOT NULL DEFAULT 'pending', -- pending | running | success | failed
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  error text,
  raw jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_scrape_jobs_created_idx ON public.provider_scrape_jobs (created_at DESC);

ALTER TABLE public.provider_scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage scrape jobs"
  ON public.provider_scrape_jobs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_provider_scrape_jobs_updated
  BEFORE UPDATE ON public.provider_scrape_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Source: 20260505130815_89b965c6-b832-4c61-bba1-60c5788991c9.sql
CREATE TABLE public.seo_fix_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('full','meta_only','title_only')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','done','failed','cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  result JSONB,
  error TEXT,
  batch_id UUID,
  enqueued_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_fix_jobs_status ON public.seo_fix_jobs(status, created_at);
CREATE INDEX idx_seo_fix_jobs_batch ON public.seo_fix_jobs(batch_id);
CREATE INDEX idx_seo_fix_jobs_page ON public.seo_fix_jobs(page_id);

ALTER TABLE public.seo_fix_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view jobs" ON public.seo_fix_jobs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert jobs" ON public.seo_fix_jobs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update jobs" ON public.seo_fix_jobs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_seo_fix_jobs_updated_at
  BEFORE UPDATE ON public.seo_fix_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260505151829_e6bdeb86-6b07-434c-a0b8-889c30876963.sql

CREATE TABLE IF NOT EXISTS public.email_branding (
  id INTEGER PRIMARY KEY DEFAULT 1,
  site_name TEXT NOT NULL DEFAULT 'fresh-web',
  sender_name TEXT NOT NULL DEFAULT 'fresh-web',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#000000',
  primary_text_color TEXT NOT NULL DEFAULT '#ffffff',
  footer_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_branding_singleton CHECK (id = 1)
);

ALTER TABLE public.email_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email branding"
  ON public.email_branding FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert email branding"
  ON public.email_branding FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email branding"
  ON public.email_branding FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_branding_updated_at
  BEFORE UPDATE ON public.email_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_branding (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- Source: 20260505162001_1e83bbde-998b-419e-8bae-c4a680fb891f.sql

CREATE TABLE public.site_footer_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  contact_phone TEXT,
  contact_phone_label TEXT,
  contact_phone_hours TEXT,
  contact_email TEXT,
  bottom_text TEXT,
  explore_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  host_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  company_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  popular_markets JSONB NOT NULL DEFAULT '[]'::jsonb,
  socials JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_footer_settings_singleton CHECK (id = 1)
);

ALTER TABLE public.site_footer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view footer settings"
ON public.site_footer_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert footer settings"
ON public.site_footer_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update footer settings"
ON public.site_footer_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_site_footer_settings_updated_at
BEFORE UPDATE ON public.site_footer_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.site_footer_settings (id) VALUES (1) ON CONFLICT DO NOTHING;


-- Source: 20260506025705_5201c602-7ac6-4a6c-88dd-646d49587f2a.sql

-- Keyword opportunities (GSC query-level data)
CREATE TABLE public.gsc_query_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url_path text NOT NULL,
  query text NOT NULL,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr numeric,
  position numeric,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (url_path, query)
);
CREATE INDEX idx_gsc_query_data_position ON public.gsc_query_data (position);
CREATE INDEX idx_gsc_query_data_url ON public.gsc_query_data (url_path);
CREATE INDEX idx_gsc_query_data_impr ON public.gsc_query_data (impressions DESC);

ALTER TABLE public.gsc_query_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage gsc query data" ON public.gsc_query_data
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.gsc_query_data FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsc_query_data TO authenticated;

-- Competitor pages
CREATE TABLE public.competitor_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  domain text,
  title text,
  meta_description text,
  h1 text,
  word_count integer DEFAULT 0,
  headings jsonb,
  markdown text,
  notes text,
  last_scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_competitor_pages_domain ON public.competitor_pages (domain);

ALTER TABLE public.competitor_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage competitor pages" ON public.competitor_pages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.competitor_pages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_pages TO authenticated;

CREATE TRIGGER update_competitor_pages_updated_at
  BEFORE UPDATE ON public.competitor_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Internal link suggestions
CREATE TABLE public.internal_link_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_url text NOT NULL,
  to_url text NOT NULL,
  anchor_text text,
  score numeric NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'pending',  -- pending | applied | dismissed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_url, to_url)
);
CREATE INDEX idx_link_suggestions_status ON public.internal_link_suggestions (status);
CREATE INDEX idx_link_suggestions_score ON public.internal_link_suggestions (score DESC);

ALTER TABLE public.internal_link_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage link suggestions" ON public.internal_link_suggestions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.internal_link_suggestions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_link_suggestions TO authenticated;

CREATE TRIGGER update_internal_link_suggestions_updated_at
  BEFORE UPDATE ON public.internal_link_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Source: 20260506033545_902bd597-198e-4c7b-924d-8617abb12d4a.sql

-- Competitor Radar
CREATE TABLE public.competitor_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  sitemap_url TEXT NOT NULL,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  last_url_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.competitor_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.competitor_sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scraped_at TIMESTAMPTZ,
  title TEXT,
  word_count INTEGER,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (site_id, url)
);

CREATE INDEX idx_competitor_urls_first_seen ON public.competitor_urls (first_seen_at DESC);
CREATE INDEX idx_competitor_urls_ack ON public.competitor_urls (acknowledged, first_seen_at DESC);

ALTER TABLE public.competitor_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage competitor_sites" ON public.competitor_sites
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage competitor_urls" ON public.competitor_urls
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SERP Rank Tracker
CREATE TABLE public.tracked_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  target_url_path TEXT,
  market TEXT NOT NULL DEFAULT 'us',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_position INTEGER,
  previous_position INTEGER,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (keyword, market)
);

CREATE TABLE public.serp_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID NOT NULL REFERENCES public.tracked_keywords(id) ON DELETE CASCADE,
  position INTEGER,
  url_found TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_serp_rankings_kw_time ON public.serp_rankings (keyword_id, checked_at DESC);

ALTER TABLE public.tracked_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serp_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tracked_keywords" ON public.tracked_keywords
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage serp_rankings" ON public.serp_rankings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- AI Page Auditor
CREATE TABLE public.page_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_path TEXT NOT NULL,
  score INTEGER,
  summary TEXT,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_audits_url_time ON public.page_audits (url_path, audited_at DESC);

ALTER TABLE public.page_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage page_audits" ON public.page_audits
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- Source: 20260506061241_b4d0fddc-6e9a-476f-aff4-ac8c3ce30c24.sql

CREATE TABLE public.competitor_host_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_url_id uuid NOT NULL REFERENCES public.competitor_urls(id) ON DELETE CASCADE,
  competitor_url text NOT NULL,
  domain text,
  host_first_name text,
  host_city text,
  host_state text,
  -- candidate match fields
  candidate_name text,
  candidate_business_name text,
  candidate_email text,
  candidate_phone text,
  candidate_website text,
  candidate_social_url text,
  candidate_source text, -- 'google_business', 'yelp', 'facebook_page', 'listing_description', 'website_contact'
  candidate_evidence text, -- short LLM justification
  match_confidence integer NOT NULL DEFAULT 0, -- 0-100
  -- triage
  status text NOT NULL DEFAULT 'new', -- 'new', 'contacted', 'converted', 'dismissed'
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chm_url_id ON public.competitor_host_matches(competitor_url_id);
CREATE INDEX idx_chm_status_conf ON public.competitor_host_matches(status, match_confidence DESC);
CREATE INDEX idx_chm_created ON public.competitor_host_matches(created_at DESC);

ALTER TABLE public.competitor_host_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage host matches"
  ON public.competitor_host_matches
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_chm_updated_at
  BEFORE UPDATE ON public.competitor_host_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Source: 20260506062346_0b2fdef9-235b-4d56-a2c4-f2871d719afb.sql

-- Cache of enriched contacts (90-day dedupe)
CREATE TABLE public.enriched_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE, -- normalized: lower(name)|lower(city)|state OR email OR phone
  source_tier text NOT NULL, -- 'osint' | 'batchdata' | 'pdl'
  full_name text,
  emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  social_profiles jsonb NOT NULL DEFAULT '[]'::jsonb,
  property_address text,
  property_city text,
  property_state text,
  property_zip text,
  raw_response jsonb,
  cost_usd numeric NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);
CREATE INDEX idx_enriched_contacts_expires ON public.enriched_contacts(expires_at);
ALTER TABLE public.enriched_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage enriched contacts" ON public.enriched_contacts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Daily spend tracking
CREATE TABLE public.enrichment_spend_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spend_date date NOT NULL DEFAULT current_date,
  provider text NOT NULL, -- 'batchdata' | 'pdl'
  match_id uuid,
  cost_usd numeric NOT NULL DEFAULT 0,
  outcome text NOT NULL, -- 'hit' | 'miss' | 'error'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_enrichment_spend_date ON public.enrichment_spend_log(spend_date);
ALTER TABLE public.enrichment_spend_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage enrichment spend" ON public.enrichment_spend_log
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Extend matches table
ALTER TABLE public.competitor_host_matches
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enriched_tier text, -- 'osint' | 'batchdata' | 'pdl'
  ADD COLUMN IF NOT EXISTS enriched_emails jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS enriched_phones jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS enriched_socials jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS revenue_signal_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_signal_notes text,
  ADD COLUMN IF NOT EXISTS enrichment_cost_usd numeric DEFAULT 0;


-- Source: 20260506065153_1aca3d00-0dfa-4b65-8fec-dc80c4c4c49c.sql
ALTER TABLE public.content_pages
  ADD COLUMN IF NOT EXISTS gsc_impressions integer,
  ADD COLUMN IF NOT EXISTS gsc_clicks integer,
  ADD COLUMN IF NOT EXISTS gsc_position numeric,
  ADD COLUMN IF NOT EXISTS gsc_updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_content_pages_gsc_impressions ON public.content_pages (gsc_impressions DESC NULLS LAST);

-- Source: 20260506073729_0f1b8a60-0bc8-400a-865d-81ef4772f384.sql
CREATE TABLE IF NOT EXISTS public.host_match_false_positives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid,
  competitor_url text,
  domain text,
  candidate_name text,
  candidate_business_name text,
  candidate_email text,
  candidate_phone text,
  candidate_website text,
  candidate_source text,
  host_first_name text,
  host_city text,
  host_state text,
  match_confidence integer,
  reason text,
  reported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.host_match_false_positives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage false positives"
  ON public.host_match_false_positives
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_host_match_fp_created_at
  ON public.host_match_false_positives (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_host_match_fp_domain
  ON public.host_match_false_positives (domain);

-- Source: 20260510120000_saas_workspaces_and_billing.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- SaaS phase 1: workspaces + per-customer subscriptions
--
-- Background: founders.click is being packaged for sale to Sharetribe
-- marketplace operators. Each customer = one Sharetribe marketplace, served
-- via reverse-proxy: their-domain.com/p/* -> founders.click/p/*. founders.click
-- looks at the incoming Host header, resolves it to a workspace, and serves
-- THAT workspace's content_pages.
--
-- Today there's exactly one tenant: "Pool Rental Near Me" (PRNM). All
-- existing content_pages / cities / categories / providers / blog_posts rows
-- belong to it. This migration:
--   1. creates workspaces / workspace_members / customer_subscriptions
--   2. seeds the PRNM workspace + makes every existing user_roles.admin a
--      member of it (so the founders.click team keeps its current access)
--   3. backfills workspace_id on content_pages
--
-- Other content tables (cities/categories/providers/blog_posts) are NOT
-- backfilled in this migration — they're rendered on founders.click itself
-- (the marketing+directory site), not via the /p/ proxy. Multi-tenancy for
-- those tables is a later phase.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE public.app_plan AS ENUM ('starter', 'growth', 'scale', 'enterprise');

CREATE TYPE public.subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused'
);

CREATE TYPE public.workspace_role AS ENUM ('owner', 'editor');

-- ─── workspaces ─────────────────────────────────────────────────────────────
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  -- Customer's Sharetribe marketplace domain (apex). Used to resolve incoming
  -- /p/* reverse-proxy traffic back to the right workspace.
  marketplace_domain text UNIQUE,
  domain_verified_at timestamptz,
  -- Owner is the user who created the workspace; convenience pointer in
  -- addition to workspace_members.
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  plan public.app_plan NOT NULL DEFAULT 'starter',
  -- Mirror of customer_subscriptions.status for cheap reads on the hot path.
  subscription_status public.subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  -- "Internal" workspaces are seeded ones (e.g. PRNM, founders.click itself).
  -- Used to bypass plan gating for the founders.click team.
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspaces_owner ON public.workspaces(owner_user_id);
CREATE INDEX idx_workspaces_domain ON public.workspaces(marketplace_domain);
CREATE INDEX idx_workspaces_stripe_customer ON public.workspaces(stripe_customer_id);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- ─── workspace_members ──────────────────────────────────────────────────────
CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'editor',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_wm_user ON public.workspace_members(user_id);
CREATE INDEX idx_wm_workspace ON public.workspace_members(workspace_id);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- ─── customer_subscriptions ─────────────────────────────────────────────────
-- Source-of-truth for billing state, written by the Stripe webhook. The
-- workspace row mirrors plan/status/trial_ends_at for fast reads.
CREATE TABLE public.customer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  plan public.app_plan NOT NULL,
  status public.subscription_status NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  -- Last Stripe event we processed; lets the webhook be idempotent.
  last_event_id text,
  last_event_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_stripe_customer ON public.customer_subscriptions(stripe_customer_id);
CREATE INDEX idx_cs_status ON public.customer_subscriptions(status);

ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;

-- ─── helper functions ───────────────────────────────────────────────────────

-- Is this user a member of this workspace (any role)?
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
$$;

-- Owner check.
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id AND role = 'owner'
  );
$$;

-- Resolve a request hostname to a workspace_id. Strips port + leading "www.".
-- Returns NULL if no match.
CREATE OR REPLACE FUNCTION public.workspace_for_host(_host text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT lower(regexp_replace(regexp_replace(_host, ':\d+$', ''), '^www\.', '')) AS h
  )
  SELECT id FROM public.workspaces, normalized
  WHERE marketplace_domain = normalized.h
  LIMIT 1;
$$;

-- ─── RLS policies ───────────────────────────────────────────────────────────

-- workspaces: members read; owners update; super-admins full access.
CREATE POLICY "Members can read their workspaces"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can update their workspace"
  ON public.workspaces FOR UPDATE
  TO authenticated
  USING (public.is_workspace_owner(id, auth.uid()))
  WITH CHECK (public.is_workspace_owner(id, auth.uid()));

CREATE POLICY "Admins manage workspaces"
  ON public.workspaces FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- workspace_members: a user can read their own membership rows; owners
-- and super-admins can manage.
CREATE POLICY "Users can read their memberships"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners manage members"
  ON public.workspace_members FOR ALL
  TO authenticated
  USING (public.is_workspace_owner(workspace_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_workspace_owner(workspace_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- customer_subscriptions: members read; only service role / super-admin write
-- (the Stripe webhook bypasses RLS via service role).
CREATE POLICY "Members can read their subscription"
  ON public.customer_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage subscriptions"
  ON public.customer_subscriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_customer_subscriptions_updated_at
  BEFORE UPDATE ON public.customer_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── seed: PRNM workspace + founders.click team membership ──────────────────

INSERT INTO public.workspaces (slug, name, marketplace_domain, plan, subscription_status, is_internal)
VALUES (
  'pool-rental-near-me',
  'Pool Rental Near Me',
  'poolrentalnearme.online',
  'enterprise',
  'active',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Every current super-admin (user_roles.role = 'admin') becomes an OWNER of
-- the PRNM workspace. This keeps the founders.click team's existing access to
-- the live admin tooling while phase 1 lands.
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, ur.user_id, 'owner'
FROM public.workspaces w
CROSS JOIN public.user_roles ur
WHERE w.slug = 'pool-rental-near-me'
  AND ur.role = 'admin'
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- ─── content_pages: add workspace_id, default to PRNM, then NOT NULL ────────

ALTER TABLE public.content_pages
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.content_pages cp
   SET workspace_id = w.id
  FROM public.workspaces w
 WHERE w.slug = 'pool-rental-near-me'
   AND cp.workspace_id IS NULL;

ALTER TABLE public.content_pages
  ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_pages_workspace ON public.content_pages(workspace_id);
-- url_path is unique within a workspace, not globally — different customers
-- will have their own /p/hosting page.
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_pages_workspace_url
  ON public.content_pages(workspace_id, url_path);

-- Public can read PUBLISHED rows of any workspace — they're served via the
-- reverse-proxy. The /p/$slug route additionally filters by workspace_id
-- resolved from the incoming host header.
DROP POLICY IF EXISTS "Public can read published content pages" ON public.content_pages;
CREATE POLICY "Public can read published content pages"
  ON public.content_pages FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Workspace members can read all rows in their workspace (drafts included).
CREATE POLICY "Members can read their workspace content pages"
  ON public.content_pages FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- (The original "Admins manage content pages" policy from
-- 20260503050446 stays in place — super-admins keep full access.)


-- Reviewed hardening draft; still unapplied
-- Unapplied review draft, not a migration. Test against an isolated database first.
-- No hosted database is changed by preparing this file.
BEGIN;

-- RLS restricts rows, not writable columns. Billing and domain ownership are
-- server-managed. Even administrators use authenticated server operations.
REVOKE INSERT, UPDATE, DELETE ON public.workspaces FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, slug, marketplace_domain, domain_verified_at, owner_user_id,
  plan, subscription_status, trial_ends_at, current_period_end,
  stripe_customer_id, stripe_subscription_id, is_internal, created_at, updated_at)
  ON public.workspaces FROM PUBLIC, anon, authenticated;
GRANT UPDATE (name) ON public.workspaces TO authenticated;

-- Restore the RLS helper permission revoked by an earlier migration, but
-- prevent callers from probing another user's role or membership.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
$$;
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id AND role = 'owner'
  );
$$;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid), public.is_workspace_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid), public.is_workspace_owner(uuid, uuid) TO authenticated, service_role;

-- Public form inserts must pass the server's abuse guard. A publishable key
-- alone must not bypass it by writing directly to PostgREST.
REVOKE INSERT ON public.pool_waitlist, public.feature_requests,
  public.provider_leads, public.provider_claims, public.provider_plan_requests,
  public.city_link_clicks FROM PUBLIC, anon, authenticated;

COMMIT;

-- Restrict direct RPC access; trusted server uses service_role.
-- Self-scoped has_role and membership helpers remain available for RLS.
REVOKE ALL ON FUNCTION public.workspace_for_host(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_for_host(text) TO service_role;
REVOKE ALL ON FUNCTION public.count_providers_by_category() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_providers_by_category() TO service_role;
