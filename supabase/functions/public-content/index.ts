import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Origin": "*" };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
    const contentType = typeof payload.contentType === "string" ? payload.contentType : "";
    if (contentType !== "help_article" && contentType !== "changelog") return json({ error: "Unsupported public content type." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Public content is not configured." }, 500);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const response = await adminClient.from("content_items").select("id, content_type, slug, title, excerpt, body, category, version, release_date, tag, changes, related_help_slugs, locale, sort_order, published_at").eq("content_type", contentType).eq("locale", "en").eq("published", true).order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    if (response.error) throw response.error;

    return json({ items: response.data ?? [] });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to load public content." }, 500);
  }
});
