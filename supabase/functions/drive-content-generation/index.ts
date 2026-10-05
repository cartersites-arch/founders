// Disabled on this development branch. No production driver credential is retained.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(() => new Response("Content driver disabled in isolated local testing", { status: 503 }));
