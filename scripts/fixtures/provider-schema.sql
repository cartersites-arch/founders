-- Isolated provider schema for verifying the complete owner security transaction.
CREATE TABLE public.providers (
 id uuid PRIMARY KEY,slug text,name text,address text,business_type text,
 city text,city_slug text,state_code text,description text,long_description text,
 primary_category text,secondary_categories text[],services text[],email text,phone text,
 website_url text,logo_url text,hero_image_url text,gallery_urls text[],
 latitude double precision,longitude double precision,rating double precision,rating_count integer,
 faq jsonb,is_published boolean,is_featured boolean,plan text,claim_status text,
 seo_title text,seo_description text,created_at timestamptz,updated_at timestamptz,
 submitter_email text,submission_notes text,claimed_by uuid,
 gsc_clicks integer,gsc_impressions integer,gsc_position double precision,gsc_updated_at timestamptz,
 source_type text,source_url text,scraped_at timestamptz,ai_content_generated_at timestamptz,
 ai_enriched_at timestamptz,claimed_at timestamptz,submission_status text,
 listing_paid_until timestamptz,featured_until timestamptz
);
