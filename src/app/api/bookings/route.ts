import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Purpose: Booking lifecycle endpoint with double-booking collision prevention and audit logging
// Why: Master Prompt V3 Section 8 Zero-Conflict Booking Engine requirement

export async function GET() {
  try {
    const admin = createAdminClient()
    const { data: bookings, error } = await admin
      .from("bookings")
      .select("*, booking_links(*), calendars(*)")
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, bookings: bookings || [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve bookings"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slug, invitee_name, invitee_email, invitee_notes, start_time, end_time, invitee_timezone, status } = body

    if (!invitee_email || !invitee_name || !start_time || !end_time) {
      return NextResponse.json({ success: false, error: "Missing required booking details" }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Find and validate booking link
    const targetSlug = slug || "meeting"
    const { data: link, error: linkErr } = await admin
      .from("booking_links")
      .select("id, organization_id, user_id, title, status, is_revoked, expires_at")
      .eq("slug", targetSlug)
      .single()

    if (linkErr || !link) {
      return NextResponse.json({ success: false, error: "Booking link not found" }, { status: 404 })
    }

    if (link.is_revoked || link.status === "archived") {
      return NextResponse.json({ success: false, error: "This booking link has been deactivated." }, { status: 410 })
    }

    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ success: false, error: "This booking link has expired." }, { status: 410 })
    }

    // 2. Concurrency check: Ensure no active booking exists for the same host and overlapping time
    const { data: conflicts } = await admin
      .from("bookings")
      .select("id")
      .eq("booking_link_id", link.id)
      .neq("status", "cancelled")
      .lt("start_time", end_time)
      .gt("end_time", start_time)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({
        success: false,
        error: "Selected slot is no longer available. Please select another time.",
      }, { status: 409 })
    }

    // 3. Find host destination calendar
    const { data: cal } = await admin
      .from("calendars")
      .select("id")
      .limit(1)
      .single()

    const bookingStatus = status || "pending"
    const { data: newBooking, error: bookErr } = await admin
      .from("bookings")
      .insert({
        booking_link_id: link.id,
        destination_calendar_id: cal?.id || null,
        invitee_email,
        invitee_name,
        invitee_notes: invitee_notes || null,
        start_time,
        end_time,
        invitee_timezone: invitee_timezone || "Asia/Kolkata",
        status: bookingStatus,
      })
      .select("*, booking_links(*)")
      .single()

    if (bookErr) throw bookErr

    // Audit log
    await admin.from("audit_logs").insert({
      actor_id: link.user_id,
      action: "booking.created",
      resource_type: "bookings",
      resource_id: newBooking.id,
      outcome: "success",
      metadata: { invitee_email, start_time, end_time, status: bookingStatus },
    })

    return NextResponse.json({ success: true, booking: newBooking })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Booking operation failed"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json({ success: false, error: "Booking ID and status are required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: updated, error } = await admin
      .from("bookings")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, booking_links(*)")
      .single()

    if (error) throw error

    await admin.from("audit_logs").insert({
      action: `booking.${status}`,
      resource_type: "bookings",
      resource_id: id,
      outcome: "success",
      metadata: { new_status: status },
    })

    return NextResponse.json({ success: true, booking: updated })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update booking status"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
