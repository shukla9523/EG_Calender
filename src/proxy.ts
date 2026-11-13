import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

// Purpose: Enforce Supabase JWT authentication across all workspace routes
// Why: Unauthenticated requests are strictly redirected to /login before rendering

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Root path routing
  if (pathname === "/") {
    const rootTarget = user ? "/calendar" : "/login"
    const rootUrl = request.nextUrl.clone()
    rootUrl.pathname = rootTarget
    return NextResponse.redirect(rootUrl)
  }

  // Protected workspace routes
  const protectedPaths = [
    "/calendar",
    "/links",
    "/availability",
    "/integrations",
    "/team",
    "/requests",
    "/settings",
    "/platform-admin",
  ]

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If already authenticated and visiting /login or /register, send to /calendar
  if ((pathname === "/login" || pathname === "/register") && user) {
    const calendarUrl = request.nextUrl.clone()
    calendarUrl.pathname = "/calendar"
    return NextResponse.redirect(calendarUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

