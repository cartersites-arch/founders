/** Private request history is keyed only by the verified Auth email. */
export async function readProviderStatus(client: any, slug: string, verifiedEmail: string) {
  const { data: provider, error } = await client.from("providers")
    .select("id,slug,name,city,state_code,primary_category,is_published,is_featured,plan,claim_status,submission_status,listing_paid_until,featured_until,claimed_at")
    .eq("slug", slug).maybeSingle();
  if (error) throw new Error("Provider status unavailable");
  if (!provider) return { provider: null, claims: [], plan_requests: [] };
  // ILIKE preserves legacy email casing; escape wildcard characters so an
  // address containing '_' or '%' cannot select somebody else's request.
  const email = verifiedEmail.replace(/[\\%_]/g, "\\$&");
  const [claims, plans] = await Promise.all([
    client.from("provider_claims").select("id,status,created_at,reviewed_at")
      .eq("provider_id", provider.id).ilike("claimer_email", email)
      .order("created_at", { ascending: false }).limit(20),
    client.from("provider_plan_requests").select("id,status,requested_plan,amount_usd,created_at,reviewed_at")
      .eq("provider_id", provider.id).ilike("requester_email", email)
      .order("created_at", { ascending: false }).limit(20),
  ]);
  if (claims.error || plans.error) throw new Error("Provider status unavailable");
  if (!provider.is_published && !claims.data?.length && !plans.data?.length)
    return { provider: null, claims: [], plan_requests: [] };
  return { provider, claims: claims.data ?? [], plan_requests: plans.data ?? [] };
}
