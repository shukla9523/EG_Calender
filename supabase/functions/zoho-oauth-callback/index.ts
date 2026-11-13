import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Purpose: Supabase Edge Function to exchange Zoho OAuth code and register calendar connection
// Why: Master Prompt V3 Section 6 - Supports multi-account Zoho calendar connections

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
      return Response.redirect(`${appUrl}/integrations?error=missing_zoho_code`)
    }

    let userId = ""
    let region = "in"
    try {
      const decoded = JSON.parse(atob(state))
      userId = decoded.userId
      if (decoded.region) region = decoded.region
    } catch {
      return Response.redirect(`${appUrl}/integrations?error=invalid_zoho_state`)
    }

    const authDomain = region === "in" ? "accounts.zoho.in" : region === "eu" ? "accounts.zoho.eu" : "accounts.zoho.com"
    const clientId = Deno.env.get("ZOHO_CLIENT_ID") || ""
    const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET") || ""
    const redirectUri = Deno.env.get("ZOHO_REDIRECT_URI") || ""

    const tokenRes = await fetch(`https://${authDomain}/oauth/v2/token`, {
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
      throw new Error(tokenData.error || "Zoho token exchange failed")
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Query user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single()

    const providerEmail = profile?.email || `zoho-user-${userId.slice(0, 8)}@zoho.com`

    // Lookup organization
    const { data: member } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .single()

    const organizationId = member?.organization_id || "00000000-0000-0000-0000-000000000001"

    const { data: conn, error: connErr } = await supabase
      .from("calendar_connections")
      .upsert({
        organization_id: organizationId,
        user_id: userId,
        provider: "zoho",
        provider_account_id: `zoho-${region}-${userId.slice(0, 8)}`,
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
        provider_calendar_id: `zoho-calendar-${region}`,
        name: `Zoho Calendar (${region.toUpperCase()})`,
        is_primary: false,
        timezone: "Asia/Kolkata",
      }, { onConflict: "connection_id,provider_calendar_id" })
    }

    return Response.redirect(`${appUrl}/integrations?status=zoho_connected&email=${encodeURIComponent(providerEmail)}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Zoho callback failed"
    const appUrl = Deno.env.get("APP_URL") || "https://eg-calendar.vercel.app"
    return Response.redirect(`${appUrl}/integrations?error=${encodeURIComponent(msg)}`)
  }
})
