-- Revocation must remain authoritative. Learners must not delete a revoked
-- completion and then use the normal completion endpoint to issue a new UID.
REVOKE INSERT,UPDATE,DELETE ON public.course_completions FROM PUBLIC,anon,authenticated;
REVOKE INSERT(id,user_id,course_slug,course_title,learner_name,certificate_uid,completed_at,revoked_at,revoke_reason),
  UPDATE(id,user_id,course_slug,course_title,learner_name,certificate_uid,completed_at,revoked_at,revoke_reason)
  ON public.course_completions FROM PUBLIC,anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.course_completions TO service_role;
