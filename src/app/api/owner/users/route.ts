import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Purpose: Owner user management endpoint for registration approvals and status transitions
// Why: Master Prompt V3 requires both Owners to manage user lifecycles while protecting owner accounts

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 })
    }

    // Verify requester is an authorized Owner
    const { data: owner } = await supabase
      .from("owner_accounts")
      .select("owner_number")
      .eq("id", user.id)
      .single()

    if (!owner) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Only platform owners can manage users" } }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100)
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: profiles, error: listError, count } = await supabase
      .from("user_profiles")
      .select("id, email, full_name, status, role, created_at, updated_at", { count: "exact" })
      .range(from, to)
      .order("created_at", { ascending: false })

    if (listError) throw listError

    // Query protected owners to flag them
    const { data: ownerRows } = await supabase.from("owner_accounts").select("id, owner_number")
    const ownerMap = new Map((ownerRows || []).map((o) => [o.id, o.owner_number]))

    const enriched = (profiles || []).map((p) => ({
      ...p,
      is_protected_owner: ownerMap.has(p.id),
      owner_number: ownerMap.get(p.id) || null,
    }))

    return NextResponse.json({
      success: true,
      data: enriched,
      meta: { page, limit, total: count || enriched.length },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ success: false, error: { code: "SERVER_ERROR", message: msg } }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 })
    }

    // Verify requester is Owner
    const { data: owner } = await supabase
      .from("owner_accounts")
      .select("owner_number")
      .eq("id", user.id)
      .single()

    if (!owner) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Owner privileges required" } }, { status: 403 })
    }

    const body = await req.json()
    const { userId, status } = body

    if (!userId || !["approved", "rejected", "suspended", "active"].includes(status)) {
      return NextResponse.json({ success: false, error: { code: "INVALID_INPUT", message: "Invalid user ID or status" } }, { status: 400 })
    }

    // Guard: Protected owners cannot be suspended or rejected
    const { data: targetOwner } = await supabase
      .from("owner_accounts")
      .select("id")
      .eq("id", userId)
      .single()

    if (targetOwner) {
      return NextResponse.json({
        success: false,
        error: { code: "PROTECTED_ACCOUNT", message: "Protected owner accounts cannot be modified or suspended" },
      }, { status: 400 })
    }

    const nextStatus = status === "active" ? "approved" : status
    const { data: updated, error: updateError } = await supabase
      .from("user_profiles")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single()

    if (updateError) throw updateError

    // Log to audit_logs
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: `user.${status}`,
      resource_type: "user_profiles",
      resource_id: userId,
      outcome: "success",
      metadata: { previous_status: updated.status, new_status: nextStatus },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ success: false, error: { code: "SERVER_ERROR", message: msg } }, { status: 500 })
  }
}

