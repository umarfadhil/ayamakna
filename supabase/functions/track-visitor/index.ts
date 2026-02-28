import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { action } = await req.json().catch(() => ({ action: "get" }));

    if (action === "increment") {
      const { data, error } = await supabase.rpc("increment_visitor_count");
      if (error) throw error;
      return new Response(JSON.stringify({ count: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: just read count
    const { data, error } = await supabase
      .from("ayamakna_stats")
      .select("visitor_count")
      .eq("id", "global")
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ count: data.visitor_count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("track-visitor error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
