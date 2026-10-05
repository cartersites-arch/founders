-- Service-only usage accounting. Lock the workspace before claiming quota so
-- concurrent Workers cannot spend the same final allowance. Submitted attempts
-- remain counted even if the provider or later page save fails: cost may already
-- have been incurred, and deleting a page must not restore generation allowance.
CREATE TABLE IF NOT EXISTS public.customer_generation_usage (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  attempts integer NOT NULL CHECK(attempts>=0),
  minute_start timestamptz NOT NULL,
  minute_attempts integer NOT NULL CHECK(minute_attempts>=0),
  PRIMARY KEY(workspace_id,month_start)
);
ALTER TABLE public.customer_generation_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_generation_usage FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.customer_generation_usage TO service_role;

CREATE OR REPLACE FUNCTION public.claim_customer_generation(_workspace_id uuid,_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE
  workspace public.workspaces%ROWTYPE;
  usage public.customer_generation_usage%ROWTYPE;
  request_time timestamptz;
  this_month date;
  this_minute timestamptz;
  quota integer;
  initial_count integer;
  is_admin boolean;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Generation authorization required'; END IF;
  SELECT * INTO workspace FROM public.workspaces WHERE id=_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Generation workspace unavailable'; END IF;
  request_time := clock_timestamp();
  this_month := date_trunc('month',request_time AT TIME ZONE 'UTC')::date;
  this_minute := date_trunc('minute',request_time);
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role::text='admin') INTO is_admin;
  IF NOT is_admin AND NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=_workspace_id AND user_id=_user_id) THEN
    RAISE EXCEPTION 'Generation authorization required';
  END IF;
  IF NOT is_admin AND NOT coalesce(workspace.is_internal,false) AND coalesce(workspace.subscription_status::text,'') NOT IN('active','trialing') THEN
    RAISE EXCEPTION 'Generation subscription inactive';
  END IF;
  quota := CASE workspace.plan::text WHEN 'starter' THEN 50 WHEN 'growth' THEN 500 WHEN 'scale' THEN 5000 WHEN 'enterprise' THEN NULL ELSE 0 END;
  IF is_admin OR coalesce(workspace.is_internal,false) THEN quota := NULL; END IF;
  SELECT * INTO usage FROM public.customer_generation_usage WHERE workspace_id=_workspace_id AND month_start=this_month;
  IF NOT FOUND THEN
    -- Preserve the prior completed-page baseline at the time accounting begins.
    SELECT count(*)::integer INTO initial_count FROM public.content_pages
      WHERE workspace_id=_workspace_id AND created_at>=this_month::timestamp AT TIME ZONE 'UTC';
    INSERT INTO public.customer_generation_usage(workspace_id,month_start,attempts,minute_start,minute_attempts)
      VALUES(_workspace_id,this_month,initial_count,this_minute,0) RETURNING * INTO usage;
  END IF;
  IF quota IS NOT NULL AND usage.attempts>=quota THEN RETURN false; END IF;
  IF usage.minute_start=this_minute AND usage.minute_attempts>=10 THEN RETURN false; END IF;
  UPDATE public.customer_generation_usage SET attempts=attempts+1,
    minute_attempts=CASE WHEN minute_start=this_minute THEN minute_attempts+1 ELSE 1 END,
    minute_start=this_minute WHERE workspace_id=_workspace_id AND month_start=this_month;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_customer_generation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_customer_generation(uuid,uuid) TO service_role;
