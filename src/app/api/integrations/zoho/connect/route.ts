import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Purpose: Initiate Zoho Calendar & Tasks OAuth flow with multi-region datacenter resolution
// Why: Master Prompt V3 requires Zoho integration across regional domains (.in, .com, .eu)

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin))
  }

  const clientId = process.env.ZOHO_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "Zoho Client ID not configured" }, { status: 400 })
  }

  const origin = request.nextUrl.origin
  const redirectUri = `${origin}/api/integrations/zoho/callback`

  // Support region selection (default to India region .in, or global .com)
  const region = request.nextUrl.searchParams.get("region") || "in"
  const authDomain = region === "in" ? "accounts.zoho.in" : region === "eu" ? "accounts.zoho.eu" : "accounts.zoho.com"

  const scopes = encodeURIComponent("ZohoCalendar.event.ALL ZohoCalendar.calendar.READ ZohoProjects.tasks.ALL")
  const state = Buffer.from(JSON.stringify({ userId: user.id, region })).toString("base64")

  const authUrl = `https://${authDomain}/oauth/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent&state=${state}`

  return NextResponse.redirect(authUrl)
}

