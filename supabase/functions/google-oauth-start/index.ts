import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Purpose: Supabase Edge Function to initiate Google Calendar OAuth integration
// Why: Master Prompt V3 Section 5 - All sensitive OAuth operations run through backend services

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

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI")
    if (!clientId || !redirectUri) {
      throw new Error("Missing Google OAuth environment variables")
    }

    // Scopes strictly for Google Calendar & Tasks integration
    const scopes = encodeURIComponent(
      "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks"
    )

    const statePayload = JSON.stringify({ userId: user.id, nonce: crypto.randomUUID() })
    const state = btoa(statePayload)

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent&state=${state}`

    return new Response(JSON.stringify({ success: true, url: googleAuthUrl }), {
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
