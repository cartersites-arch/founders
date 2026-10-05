-- Public directory reads expose business listing fields, never intake or staff metadata.
REVOKE SELECT ON public.providers FROM PUBLIC,anon,authenticated;
DO $$ DECLARE column_list text; BEGIN
  SELECT string_agg(quote_ident(column_name),',') INTO column_list
    FROM information_schema.columns WHERE table_schema='public' AND table_name='providers';
  EXECUTE 'REVOKE SELECT (' || column_list || ') ON public.providers FROM PUBLIC,anon,authenticated';
END $$;
GRANT SELECT (id,slug,name,address,business_type,city,city_slug,state_code,description,long_description,primary_category,secondary_categories,services,email,phone,website_url,logo_url,hero_image_url,gallery_urls,latitude,longitude,rating,rating_count,faq,is_published,is_featured,plan,claim_status,seo_title,seo_description,created_at,updated_at) ON public.providers TO anon,authenticated;
GRANT SELECT ON public.providers TO service_role;

-- Listing submissions must use the server's validation and shared abuse guard.
-- Revoke column grants too: they survive a table-level REVOKE.
REVOKE INSERT ON public.providers FROM PUBLIC,anon,authenticated;
DO $$ DECLARE column_list text; BEGIN
  SELECT string_agg(quote_ident(column_name),',') INTO column_list
    FROM information_schema.columns WHERE table_schema='public' AND table_name='providers';
  EXECUTE 'REVOKE INSERT (' || column_list || ') ON public.providers FROM PUBLIC,anon,authenticated';
END $$;
GRANT INSERT ON public.providers TO service_role;
