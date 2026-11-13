import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Purpose: Supabase Edge Function to initiate Zoho Calendar OAuth with multi-region datacenter resolution
// Why: Master Prompt V3 Section 6 - Supports accounts.zoho.in, accounts.zoho.com, and accounts.zoho.eu

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      })
    }

    const url = new URL(req.url)
    const region = url.searchParams.get("region") || "in"
    const authDomain = region === "in" ? "accounts.zoho.in" : region === "eu" ? "accounts.zoho.eu" : "accounts.zoho.com"

    const clientId = Deno.env.get("ZOHO_CLIENT_ID")
    const redirectUri = Deno.env.get("ZOHO_REDIRECT_URI")
    if (!clientId || !redirectUri) {
      throw new Error("Missing Zoho OAuth configuration")
    }

    const scopes = encodeURIComponent("ZohoCalendar.event.ALL ZohoCalendar.calendar.READ ZohoProjects.tasks.ALL")
    const state = btoa(JSON.stringify({ userId: user.id, region, nonce: crypto.randomUUID() }))

    const zohoAuthUrl = `https://${authDomain}/oauth/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent&state=${state}`

    return new Response(JSON.stringify({ success: true, url: zohoAuthUrl }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 200,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error"
    return new Response(JSON.stringify({ error: msg }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 400,
    })
  }
})
