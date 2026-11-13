import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchWebhook } from "@/lib/webhooks/dispatcher"

// Purpose: Public API booking creation endpoint with idempotency and webhook dispatching
// Why: Master Prompt V3 Sections 12 & 13 requirements

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slug, slot, invitee_name, invitee_email, invitee_notes, invitee_timezone, idempotency_key } = body

    if (!slug || !slot || !invitee_name || !invitee_email) {
      return NextResponse.json({
        success: false,
        error: { code: "INVALID_INPUT", message: "slug, slot, invitee_name, and invitee_email are required" },
      }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Idempotency check if idempotency_key is provided
    if (idempotency_key) {
      const { data: existing } = await admin
        .from("bookings")
        .select("*")
        .eq("idempotency_key", idempotency_key)
        .single()

      if (existing) {
        return NextResponse.json({ success: true, data: existing, meta: { idempotent_replay: true } })
      }
    }

    // 2. Validate link & expiration
    const { data: link, error: linkErr } = await admin
      .from("booking_links")
      .select("id, duration_minutes, is_revoked, expires_at, status, organization_id, user_id")
      .eq("slug", slug)
      .single()

    if (linkErr || !link) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Booking link not found" } }, { status: 404 })
    }

    if (link.is_revoked || link.status === "archived") {
      return NextResponse.json({ success: false, error: { code: "LINK_REVOKED", message: "Link is no longer active" } }, { status: 410 })
    }

    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ success: false, error: { code: "LINK_EXPIRED", message: "Link has expired" } }, { status: 410 })
    }

    // 3. Compute end_time
    const startTime = new Date(slot)
    const duration = link.duration_minutes || 30
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

    // 4. Concurrency lock / check
    const { data: conflict } = await admin
      .from("bookings")
      .select("id")
      .eq("booking_link_id", link.id)
      .neq("status", "cancelled")
      .lt("start_time", endTime.toISOString())
      .gt("end_time", startTime.toISOString())

    if (conflict && conflict.length > 0) {
      return NextResponse.json({
        success: false,
        error: { code: "SLOT_CONFLICT", message: "Selected time slot is already booked" },
      }, { status: 409 })
    }

    // 5. Insert booking
    const { data: newBooking, error: bookErr } = await admin
      .from("bookings")
      .insert({
        booking_link_id: link.id,
        invitee_email,
        invitee_name,
        invitee_notes: invitee_notes || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        invitee_timezone: invitee_timezone || "UTC",
        idempotency_key: idempotency_key || null,
        destination_calendar_id: null,
        status: "pending",
      })
      .select()
      .single()

    if (bookErr) throw bookErr

    // 6. Invalidate TTL slot cache
    const dateStr = slot.split("T")[0]
    await admin.from("cache_entries").delete().eq("cache_key", `slots:${slug}:${dateStr}`)

    // 7. Dispatch Webhook event (Section 13)
    await dispatchWebhook(link.organization_id, "booking.created", {
      booking_id: newBooking.id,
      invitee_email,
      invitee_name,
      start_time: newBooking.start_time,
      end_time: newBooking.end_time,
    }).catch(() => { })

    return NextResponse.json({ success: true, data: newBooking }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Booking creation failed"
    return NextResponse.json({ success: false, error: { code: "SERVER_ERROR", message: msg } }, { status: 500 })
  }
}

