-- Service-only role removal. The caller is checked again after acquiring the lock.
CREATE OR REPLACE FUNCTION public.revoke_admin_role(_caller_id uuid, _target_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  SET LOCAL lock_timeout = '5s';
  -- Also serialize with direct role inserts/deletes so the last-admin decision
  -- cannot be invalidated by a concurrent request while this transaction runs.
  LOCK TABLE public.user_roles IN SHARE ROW EXCLUSIVE MODE;
  IF _caller_id IS NULL OR _target_id IS NULL OR _caller_id = _target_id THEN
    RAISE EXCEPTION 'Invalid admin removal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_caller_id AND role='admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_target_id AND role='admin') THEN
    RETURN true; -- An already removed role is an idempotent success.
  END IF;
  IF (SELECT count(*) FROM public.user_roles WHERE role='admin') <= 1 THEN
    RAISE EXCEPTION 'Refusing to remove last admin';
  END IF;
  DELETE FROM public.user_roles WHERE user_id=_target_id AND role='admin';
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_admin_role(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin_role(uuid,uuid) TO service_role;
