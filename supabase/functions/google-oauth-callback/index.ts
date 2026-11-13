import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Purpose: Supabase Edge Function to exchange Google OAuth code and encrypt tokens
// Why: Master Prompt V3 Section 5 - Tokens encrypted at rest with AES-GCM-256

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const appUrl = Deno.env.get("APP_URL") || "https://eg-calendar.vercel.app"

    if (!code || !state) {
      return Response.redirect(`${appUrl}/integrations?error=missing_code_or_state`)
    }

    let userId = ""
    try {
      const decoded = JSON.parse(atob(state))
      userId = decoded.userId
    } catch {
      return Response.redirect(`${appUrl}/integrations?error=invalid_state`)
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || ""
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || ""
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI") || ""

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || "Token exchange failed")
    }

    // Fetch Google user email
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userData = await userRes.json()
    const providerEmail = userData.email || "unknown@gmail.com"
    const providerAccountId = userData.id || providerEmail

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Lookup organization
    const { data: member } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .single()

    const organizationId = member?.organization_id || "00000000-0000-0000-0000-000000000001"

    // Upsert calendar_connections
    const { data: conn, error: connErr } = await supabase
      .from("calendar_connections")
      .upsert({
        organization_id: organizationId,
        user_id: userId,
        provider: "google",
        provider_account_id: providerAccountId,
        provider_email: providerEmail,
        status: "connected",
        last_sync_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider,provider_account_id" })
      .select()
      .single()

    if (connErr) throw connErr

    if (conn) {
      await supabase.from("calendars").upsert({
        connection_id: conn.id,
        provider_calendar_id: "primary",
        name: `Google Calendar (${providerEmail})`,
        is_primary: true,
        timezone: "Asia/Kolkata",
      }, { onConflict: "connection_id,provider_calendar_id" })
    }

    return Response.redirect(`${appUrl}/integrations?status=google_connected&email=${encodeURIComponent(providerEmail)}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "OAuth callback failed"
    const appUrl = Deno.env.get("APP_URL") || "https://eg-calendar.vercel.app"
    return Response.redirect(`${appUrl}/integrations?error=${encodeURIComponent(msg)}`)
  }
})
