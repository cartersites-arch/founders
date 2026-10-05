CREATE TYPE public.app_plan AS ENUM ('starter','growth','scale','enterprise');
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid','paused');
CREATE TABLE public.customer_subscriptions (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id), stripe_customer_id text NOT NULL,
  stripe_subscription_id text UNIQUE, stripe_price_id text, plan public.app_plan NOT NULL,
  status public.subscription_status NOT NULL, cancel_at_period_end boolean NOT NULL DEFAULT false,
  current_period_start timestamptz,current_period_end timestamptz,trial_ends_at timestamptz,canceled_at timestamptz,
  last_event_id text,last_event_at timestamptz,raw jsonb
);
GRANT ALL ON public.customer_subscriptions TO service_role;
