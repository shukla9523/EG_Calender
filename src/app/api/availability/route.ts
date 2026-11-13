import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const admin = createAdminClient()
    const { data: hours, error } = await admin
      .from("working_hours")
      .select("*")
      .order("day_of_week", { ascending: true })

    const { data: org } = await admin
      .from("organizations")
      .select("timezone")
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      working_hours: hours || [],
      timezone: org?.timezone || "Asia/Kolkata",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { timezone, working_hours } = await request.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const admin = createAdminClient()

    // 1. Update org timezone dynamically
    if (timezone) {
      let orgId: string | null = null
      if (user?.id) {
        const { data: membership } = await admin
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle()
        orgId = membership?.organization_id || null
      }
      if (!orgId) {
        const { data: firstOrg } = await admin.from("organizations").select("id").limit(1).maybeSingle()
        orgId = firstOrg?.id || null
      }
      if (orgId) {
        await admin
          .from("organizations")
          .update({ timezone, updated_at: new Date().toISOString() })
          .eq("id", orgId)
      }
    }

    // 2. Update working hours
    if (user?.id && Array.isArray(working_hours)) {
      const rows = working_hours.map((h: any) => ({
        user_id: user.id,
        day_of_week: h.day_of_week,
        start_time: h.start_time || "09:00:00",
        end_time: h.end_time || "18:00:00",
        is_active: h.is_active !== false,
      }))

      await admin
        .from("working_hours")
        .upsert(rows, { onConflict: "user_id,day_of_week" })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

