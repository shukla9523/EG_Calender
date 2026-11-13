import { NextResponse, type NextRequest } from "next/server"

// Purpose: Dedicated Google Sign-In endpoint requesting identity scopes only
// Why: Master Prompt V3 explicitly dictates Google Sign-In and Google Calendar OAuth must be separate

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "Google Client ID not configured" }, { status: 400 })
  }

  const origin = request.nextUrl.origin
  const redirectUri = process.env.GOOGLE_LOGIN_REDIRECT_URI || `${origin}/api/auth/callback/google`

  // Minimal identity scopes only for Sign In per Section 4
  const scope = encodeURIComponent("openid email profile")
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scope}&prompt=select_account`

  return NextResponse.redirect(googleAuthUrl)
}
