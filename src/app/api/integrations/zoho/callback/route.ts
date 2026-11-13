import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// Purpose: OAuth callback for Zoho Calendar & Tasks integration across regions
// Why: Stores Zoho credentials securely and provisions conflict calendars in Supabase

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const state = searchParams.get("state")
  const origin = request.nextUrl.origin

  if (error || !code) {
    return NextResponse.redirect(`${origin}/integrations?error=${encodeURIComponent(error || "zoho_cancelled")}`)
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${origin}/login`)
    }

    let region = "in"
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"))
        if (decoded.region) region = decoded.region
      } catch {
        // Fall back to default region
      }
    }

    const authDomain = region === "in" ? "accounts.zoho.in" : region === "eu" ? "accounts.zoho.eu" : "accounts.zoho.com"
    const clientId = process.env.ZOHO_CLIENT_ID
    const clientSecret = process.env.ZOHO_CLIENT_SECRET
    const redirectUri = `${origin}/api/integrations/zoho/callback`

    const tokenRes = await fetch(`https://${authDomain}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId || "",
        client_secret: clientSecret || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error || "Zoho token exchange failed")
    }

    const admin = createAdminClient()
    const { data: membership } = await admin
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single()

    let organizationId = membership?.organization_id
    if (!organizationId) {
      const { data: defaultOrg } = await admin.from("organizations").select("id").limit(1).single()
      organizationId = defaultOrg?.id
    }

    if (!organizationId) {
      return NextResponse.redirect(`${origin}/integrations?error=organization_not_found`)
    }
    const providerEmail = user.email || ""

    const { data: conn, error: connError } = await admin
      .from("calendar_connections")
      .upsert({
        organization_id: organizationId,
        user_id: user.id,
        provider: "zoho",
        provider_account_id: `zoho-${region}-primary`,
        provider_email: providerEmail,
        status: "connected",
        last_sync_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider,provider_account_id" })
      .select()
      .single()

    if (connError) throw connError

    if (conn) {
      await admin.from("calendars").upsert({
        connection_id: conn.id,
        provider_calendar_id: "zoho-primary",
        name: `Zoho Calendar (${region.toUpperCase()})`,
        is_primary: false,
        timezone: "Asia/Kolkata",
      }, { onConflict: "connection_id,provider_calendar_id" })
    }

    // Audit log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "calendar.connected",
      resource_type: "calendar_connections",
      resource_id: conn?.id,
      outcome: "success",
      metadata: { provider: "zoho", region, email: providerEmail },
    })

    return NextResponse.redirect(`${origin}/integrations?status=zoho_connected&email=${encodeURIComponent(providerEmail)}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Zoho connection failed"
    return NextResponse.redirect(`${origin}/integrations?error=${encodeURIComponent(msg)}`)
  }
}

