import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const admin = createAdminClient()

    const { data: members, error: memErr } = await admin
      .from("organization_memberships")
      .select("*, organizations(name, slug)")

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 })
    }

    const userIds = (members || []).map((m) => m.user_id)
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("*")
      .in("id", userIds)

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))

    // Format for client
    const formatted = (members || []).map((m) => {
      const p = profileMap.get(m.user_id)
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        joined_at: m.created_at,
        email: p?.email || "",
        name: p?.full_name || p?.email || "User",
        organization: m.organizations?.name || "Workspace",
      }
    })

    return NextResponse.json({ members: formatted })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
