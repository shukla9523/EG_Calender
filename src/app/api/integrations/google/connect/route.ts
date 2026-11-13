import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Purpose: Initiate Google Calendar OAuth flow for connecting calendar accounts
// Why: Master Prompt V3 separates user sign-in from calendar integration permissions

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "Google Client ID not configured" }, { status: 400 })
  }

  const origin = request.nextUrl.origin
  const redirectUri = `${origin}/api/integrations/google/callback`

  const scopes = encodeURIComponent(
    "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks"
  )

  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString("base64")

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent&state=${state}`

  return NextResponse.redirect(authUrl)
}

