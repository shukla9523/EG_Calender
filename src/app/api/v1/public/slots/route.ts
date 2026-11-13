import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Purpose: Public API endpoint for querying conflict-free available booking slots
// Why: Master Prompt V3 Section 12 Public API & Section 16 TTL Caching

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get("slug")
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0]

  if (!slug) {
    return NextResponse.json({ success: false, error: { code: "MISSING_SLUG", message: "slug parameter is required" } }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // Check link existence & universal expiration
    const { data: link, error: linkErr } = await admin
      .from("booking_links")
      .select("id, duration_minutes, expires_at, is_revoked, status, user_id")
      .eq("slug", slug)
      .single()

    if (linkErr || !link) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Booking link not found" } }, { status: 404 })
    }

    if (link.is_revoked || link.status === "archived") {
      return NextResponse.json({ success: false, error: { code: "LINK_REVOKED", message: "Scheduling link deactivated" } }, { status: 410 })
    }

    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ success: false, error: { code: "LINK_EXPIRED", message: "Scheduling link expired" } }, { status: 410 })
    }

    // Check TTL Cache Table (Section 16 TTL caching without Redis)
    const cacheKey = `slots:${slug}:${dateStr}`
    const { data: cacheRow } = await admin
      .from("cache_entries")
      .select("cache_data, expires_at")
      .eq("cache_key", cacheKey)
      .single()

    if (cacheRow && new Date(cacheRow.expires_at).getTime() > Date.now()) {
      return NextResponse.json({
        success: true,
        data: cacheRow.cache_data,
        meta: { cached: true, ttl_seconds: 30 },
      })
    }

    // Standard business hours slots computation
    const candidateSlots = [
      `${dateStr}T09:00:00Z`,
      `${dateStr}T10:00:00Z`,
      `${dateStr}T11:00:00Z`,
      `${dateStr}T13:00:00Z`,
      `${dateStr}T14:00:00Z`,
      `${dateStr}T15:00:00Z`,
      `${dateStr}T16:00:00Z`,
    ]

    // Filter against existing bookings
    const { data: booked } = await admin
      .from("bookings")
      .select("start_time")
      .eq("booking_link_id", link.id)
      .neq("status", "cancelled")

    const bookedSet = new Set((booked || []).map((b) => b.start_time))
    const availableSlots = candidateSlots.filter((s) => !bookedSet.has(s))

    // Store in PostgreSQL TTL Cache (30 seconds TTL per Section 16)
    await admin.from("cache_entries").upsert({
      cache_key: cacheKey,
      cache_data: availableSlots,
      expires_at: new Date(Date.now() + 30 * 1000).toISOString(),
    }, { onConflict: "cache_key" })

    return NextResponse.json({
      success: true,
      data: availableSlots,
      meta: { cached: false, duration_minutes: link.duration_minutes },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error calculating slots"
    return NextResponse.json({ success: false, error: { code: "SERVER_ERROR", message: msg } }, { status: 500 })
  }
}

