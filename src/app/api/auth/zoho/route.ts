import { NextResponse, type NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const clientId = process.env.ZOHO_CLIENT_ID
  const region = process.env.ZOHO_REGION || "com"

  if (!clientId) {
    return NextResponse.redirect(new URL("/integrations?error=zoho_not_configured", request.url))
  }

  const origin = request.nextUrl.origin
  const redirectUri = process.env.ZOHO_REDIRECT_URI || `${origin}/api/auth/callback/zoho`

  const zohoAuthUrl = `https://accounts.zoho.${region}/oauth/v2/auth?client_id=${clientId}&response_type=code&scope=ZohoCalendar.calendar.ALL&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&access_type=offline&prompt=consent`

  return NextResponse.redirect(zohoAuthUrl)
}

