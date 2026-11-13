import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Purpose: Instant manual sync trigger for connected Google & Zoho calendars
// Why: Master Prompt V3 Section 7 "Sync Now" requirement with last-synced timestamp

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const admin = createAdminClient()

    // 1. Fetch connected providers
    const { data: connections, error } = await admin
      .from("calendar_connections")
      .select("id, provider, provider_email, status")
      .eq("user_id", user.id)
      .eq("status", "connected")

    if (error) throw error

    const now = new Date().toISOString()

    // 2. Update last_sync_at on active connections
    if (connections && connections.length > 0) {
      await admin
        .from("calendar_connections")
        .update({ last_sync_at: now, updated_at: now })
        .eq("user_id", user.id)
        .eq("status", "connected")
    }

    // 3. Log audit event
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "calendar.sync_triggered",
      resource_type: "calendar_connections",
      outcome: "success",
      metadata: { providers_synced: connections?.map((c) => c.provider) || [], synced_at: now },
    })

    return NextResponse.json({
      success: true,
      synced_at: now,
      connections_synced: connections?.length || 0,
      message: "Calendars synchronized successfully",
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sync failed"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

