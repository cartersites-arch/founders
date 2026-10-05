CREATE TABLE public.profiles(id uuid DEFAULT gen_random_uuid(),user_id uuid,display_name text,full_name text);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT TO anon,authenticated USING(true);
CREATE TABLE public.mb_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,author_name text,title text,body text,category text,
 is_pinned boolean DEFAULT false,reply_count integer DEFAULT 0,like_count integer DEFAULT 0,
 last_activity_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.mb_replies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),thread_id uuid REFERENCES public.mb_threads(id),user_id uuid,author_name text,body text,
 like_count integer DEFAULT 0,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.mb_likes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,thread_id uuid REFERENCES public.mb_threads(id),reply_id uuid REFERENCES public.mb_replies(id));
ALTER TABLE public.mb_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mb_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mb_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_threads ON public.mb_threads FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY write_threads ON public.mb_threads FOR INSERT TO authenticated WITH CHECK(auth.uid()=user_id);
CREATE POLICY edit_threads ON public.mb_threads FOR UPDATE TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
CREATE POLICY delete_threads ON public.mb_threads FOR DELETE TO authenticated USING(auth.uid()=user_id);
CREATE POLICY read_replies ON public.mb_replies FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY write_replies ON public.mb_replies FOR INSERT TO authenticated WITH CHECK(auth.uid()=user_id);
CREATE POLICY edit_replies ON public.mb_replies FOR UPDATE TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
CREATE POLICY delete_replies ON public.mb_replies FOR DELETE TO authenticated USING(auth.uid()=user_id);
CREATE POLICY read_likes ON public.mb_likes FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY write_likes ON public.mb_likes FOR INSERT TO authenticated WITH CHECK(auth.uid()=user_id);
CREATE POLICY delete_likes ON public.mb_likes FOR DELETE TO authenticated USING(auth.uid()=user_id);
CREATE TABLE public.email_unsubscribe_tokens(token text PRIMARY KEY,email text,used_at timestamptz);
CREATE TABLE public.suppressed_emails(email text PRIMARY KEY,reason text);
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.profiles,public.mb_threads,public.mb_replies,public.mb_likes TO authenticated,service_role;
GRANT SELECT ON public.profiles,public.mb_threads,public.mb_replies,public.mb_likes TO anon;
GRANT ALL ON public.email_unsubscribe_tokens,public.suppressed_emails TO service_role;
