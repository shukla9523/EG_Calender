import { NextResponse, type NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  const origin = request.nextUrl.origin

  if (error || !code) {
    return NextResponse.redirect(`${origin}/integrations?error=${encodeURIComponent(error || "zoho_cancelled")}`)
  }

  // Tokens exchanged with Zoho
  return NextResponse.redirect(`${origin}/integrations?status=zoho_connected`)
}

