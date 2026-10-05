-- Profiles are account data; public forum names remain on the public forum records.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Authors may edit their content, not pinning, counts, identities or timestamps.
REVOKE INSERT, UPDATE ON public.mb_threads, public.mb_replies FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id,user_id,author_name,title,body,category,is_pinned,reply_count,like_count,last_activity_at,created_at,updated_at),
  UPDATE (id,user_id,author_name,title,body,category,is_pinned,reply_count,like_count,last_activity_at,created_at,updated_at)
  ON public.mb_threads FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id,thread_id,user_id,author_name,body,like_count,created_at,updated_at),
  UPDATE (id,thread_id,user_id,author_name,body,like_count,created_at,updated_at)
  ON public.mb_replies FROM PUBLIC, anon, authenticated;
GRANT INSERT(user_id,title,body,category), UPDATE(title,body,category) ON public.mb_threads TO authenticated;
GRANT INSERT(user_id,thread_id,body), UPDATE(body) ON public.mb_replies TO authenticated;

-- Trigger-only privileged maintenance: required to update counts on another author's row.
-- Direct callers cannot execute these functions; no caller-selected tables or SQL are used.
CREATE OR REPLACE FUNCTION public.mb_update_thread_reply_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    UPDATE public.mb_threads SET reply_count=reply_count+1,last_activity_at=now() WHERE id=NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    UPDATE public.mb_threads SET reply_count=greatest(reply_count-1,0) WHERE id=OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION public.mb_update_like_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.thread_id IS NOT NULL THEN
      UPDATE public.mb_threads SET like_count=like_count+1 WHERE id=NEW.thread_id;
    ELSIF NEW.reply_id IS NOT NULL THEN
      UPDATE public.mb_replies SET like_count=like_count+1 WHERE id=NEW.reply_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    IF OLD.thread_id IS NOT NULL THEN
      UPDATE public.mb_threads SET like_count=greatest(like_count-1,0) WHERE id=OLD.thread_id;
    ELSIF OLD.reply_id IS NOT NULL THEN
      UPDATE public.mb_replies SET like_count=greatest(like_count-1,0) WHERE id=OLD.reply_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.mb_update_thread_reply_count(),public.mb_update_like_counts() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.apply_email_unsubscribe(_token text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE entry public.email_unsubscribe_tokens%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token)<16 OR length(_token)>256 THEN RETURN 'invalid'; END IF;
  SELECT * INTO entry FROM public.email_unsubscribe_tokens WHERE token=_token FOR UPDATE;
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  INSERT INTO public.suppressed_emails(email,reason) VALUES(lower(entry.email),'unsubscribe')
    ON CONFLICT(email) DO UPDATE SET reason=excluded.reason;
  -- This also repairs legacy used tokens whose earlier suppression write failed.
  IF entry.used_at IS NOT NULL THEN RETURN 'already'; END IF;
  UPDATE public.email_unsubscribe_tokens SET used_at=now() WHERE token=_token;
  RETURN 'success';
END;
$$;
REVOKE ALL ON FUNCTION public.apply_email_unsubscribe(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_email_unsubscribe(text) TO service_role;
