import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// Purpose: Authenticate existing users via Supabase GoTrue JWT with existence verification
// Why: Enforces user existence check, owner-controlled approval gate, and JWT issuance

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()
    const admin = createAdminClient()

    // 1. Verify user exists in Supabase user_profiles
    const { data: profile } = await admin
      .from("user_profiles")
      .select("id, email, status, role, full_name")
      .eq("email", cleanEmail)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: "Account does not exist. Please register first or contact an administrator.",
          code: "USER_NOT_FOUND",
        },
        { status: 404 }
      )
    }

    // 2. Check approval lifecycle status
    if (profile.status === "pending_approval") {
      return NextResponse.json(
        {
          success: false,
          error: "Your registration is currently pending approval by the platform owners.",
          code: "PENDING_APPROVAL",
        },
        { status: 403 }
      )
    }

    if (["suspended", "rejected", "disabled"].includes(profile.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Your account is ${profile.status}. Access is restricted by platform owners.`,
          code: "ACCOUNT_RESTRICTED",
        },
        { status: 403 }
      )
    }

    // 3. Authenticate with Supabase Auth to issue JWT cookies
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Incorrect password. Please verify your credentials and try again.",
          code: "INVALID_CREDENTIALS",
        },
        { status: 401 }
      )
    }

    // 4. Check if user is a protected owner
    const { data: owner } = await admin
      .from("owner_accounts")
      .select("owner_number")
      .eq("id", profile.id)
      .maybeSingle()

    const redirectTo = owner ? "/platform-admin/users" : "/calendar"

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        role: profile.role,
        is_owner: !!owner,
      },
      redirectTo,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

