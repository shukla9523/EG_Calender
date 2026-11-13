import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  const origin = request.nextUrl.origin

  if (error || !code) {
    return NextResponse.redirect(`${origin}/integrations?error=${encodeURIComponent(error || "cancelled")}`)
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/callback/google`

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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

    let userEmail = ""
    if (tokenData.access_token) {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      if (userRes.ok) {
        const userData = await userRes.json()
        userEmail = userData.email || ""
      }
    }

    if (userEmail) {
      // Connect to Supabase
      try {
        const admin = createAdminClient()
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        // Resolve user dynamically
        let userId = user?.id
        if (!userId) {
          const { data: profile } = await admin
            .from("user_profiles")
            .select("id")
            .eq("email", userEmail)
            .maybeSingle()
          userId = profile?.id
        }

        if (!userId) {
          return NextResponse.redirect(`${origin}/integrations?error=user_not_authenticated`)
        }

        // Resolve organization dynamically
        const { data: firstOrg } = await admin.from("organizations").select("id").limit(1).maybeSingle()
        const orgId = firstOrg?.id
        if (!orgId) {
          return NextResponse.redirect(`${origin}/integrations?error=organization_not_found`)
        }

        const { data: conn } = await admin
          .from("calendar_connections")
          .upsert({
            organization_id: orgId,
            user_id: userId,
            provider: "google",
            provider_account_id: "primary",
            provider_email: userEmail,
            status: "connected",
            last_sync_at: new Date().toISOString(),
          }, { onConflict: "user_id,provider,provider_account_id" })
          .select()
          .single()

        if (conn) {
          await admin
            .from("calendars")
            .upsert({
              connection_id: conn.id,
              provider_calendar_id: "primary",
              name: "Google Calendar",
              is_primary: true,
              timezone: "Asia/Kolkata",
            }, { onConflict: "connection_id,provider_calendar_id" })
        }
      } catch (dbErr) {
        console.error("Failed to persist Google connection in Supabase:", dbErr)
      }
    }

    const redirectUrl = new URL("/integrations", origin)
    redirectUrl.searchParams.set("status", "success")
    if (userEmail) {
      redirectUrl.searchParams.set("google_email", userEmail)
    }

    const response = NextResponse.redirect(redirectUrl)
    if (userEmail) {
      response.cookies.set("google_connected_email", userEmail, { path: "/", maxAge: 60 * 60 * 24 * 30 })
    }
    return response
  } catch (err: any) {
    return NextResponse.redirect(`${origin}/integrations?error=${encodeURIComponent(err.message || "exchange_failed")}`)
  }
}
