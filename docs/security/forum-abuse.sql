-- Database enforcement covers both Worker service writes and direct authenticated writes.
-- Counters survive post deletion and are shared across threads, replies and edits.
CREATE OR REPLACE FUNCTION public.guard_forum_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  request_time timestamptz := clock_timestamp();
  item record;
  accepted integer;
BEGIN
  IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'Forum author required' USING ERRCODE='23514'; END IF;
  IF NEW.body IS NULL OR char_length(NEW.body) > 10000
    OR char_length(NEW.body) < (CASE WHEN TG_TABLE_NAME='mb_threads' THEN 5 ELSE 2 END)
    OR char_length(coalesce(NEW.author_name,'')) > 120 THEN
    RAISE EXCEPTION 'Invalid forum content size' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='mb_threads' THEN
    IF NEW.title IS NULL OR char_length(NEW.title) NOT BETWEEN 3 AND 200
      OR char_length(coalesce(NEW.category,'')) > 120 THEN
      RAISE EXCEPTION 'Invalid forum title or category' USING ERRCODE='23514';
    END IF;
  END IF;
  -- Stable lock order; conflict updates serialize concurrent requests per author.
  FOR item IN SELECT * FROM (VALUES
    ('forum:hour:' || NEW.user_id::text, 20, 3600),
    ('forum:minute:' || NEW.user_id::text, 5, 60)
  ) AS limits(key,maximum,seconds) ORDER BY key LOOP
    INSERT INTO public.submission_rate_limits AS counters(key,attempts,expires_at)
    VALUES(item.key,1,request_time+make_interval(secs=>item.seconds))
    ON CONFLICT(key) DO UPDATE SET
      attempts=CASE WHEN counters.expires_at<=request_time THEN 1 ELSE counters.attempts+1 END,
      expires_at=CASE WHEN counters.expires_at<=request_time
        THEN request_time+make_interval(secs=>item.seconds) ELSE counters.expires_at END
    WHERE counters.expires_at<=request_time OR counters.attempts<item.maximum
    RETURNING attempts INTO accepted;
    IF NOT FOUND THEN RAISE EXCEPTION 'Forum posting limit reached. Try again later.' USING ERRCODE='P0001'; END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_forum_content() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS guard_forum_content ON public.mb_threads;
CREATE TRIGGER guard_forum_content BEFORE INSERT OR UPDATE OF title,body,category,author_name
  ON public.mb_threads FOR EACH ROW EXECUTE FUNCTION public.guard_forum_content();
DROP TRIGGER IF EXISTS guard_forum_content ON public.mb_replies;
CREATE TRIGGER guard_forum_content BEFORE INSERT OR UPDATE OF body,author_name
  ON public.mb_replies FOR EACH ROW EXECUTE FUNCTION public.guard_forum_content();
