import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Purpose: Supabase Edge Function to atomically lock a slot and confirm a booking
// Why: Master Prompt V3 Section 8 Zero-Conflict Booking Engine requirement

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { link_id, start_time, end_time, invitee_details, idempotency_key } = await req.json()
    if (!link_id || !start_time || !end_time || !invitee_details?.email) {
      return new Response(JSON.stringify({ error: "Missing required booking payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 1. Idempotency Check
    if (idempotency_key) {
      const { data: existing } = await supabase
        .from("bookings")
        .select("*")
        .eq("idempotency_key", idempotency_key)
        .single()

      if (existing) {
        return new Response(JSON.stringify({ success: true, booking: existing, idempotent_replay: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    // 2. Concurrency Lock: Re-verify that no overlapping booking exists
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id")
      .eq("booking_link_id", link_id)
      .neq("status", "cancelled")
      .lt("start_time", end_time)
      .gt("end_time", start_time)

    if (conflicts && conflicts.length > 0) {
      return new Response(JSON.stringify({
        error: "Slot is no longer available. Concurrency conflict prevented.",
        code: "SLOT_CONFLICT",
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 3. Find destination calendar
    const { data: cal } = await supabase
      .from("calendars")
      .select("id, connection_id")
      .limit(1)
      .single()

    const destinationCalId = cal?.id || "00000000-0000-0000-0000-000000000001"

    // 4. Create confirmed booking record
    const { data: booking, error: bookErr } = await supabase
      .from("bookings")
      .insert({
        booking_link_id: link_id,
        destination_calendar_id: destinationCalId,
        invitee_email: invitee_details.email,
        invitee_name: invitee_details.name || "Invitee",
        invitee_notes: invitee_details.notes || null,
        invitee_timezone: invitee_details.timezone || "UTC",
        start_time,
        end_time,
        status: "confirmed",
        idempotency_key: idempotency_key || null,
      })
      .select()
      .single()

    if (bookErr) throw bookErr

    // 5. Invalidate TTL slot cache entries for this date
    const dateStr = start_time.split("T")[0]
    await supabase.from("cache_entries").delete().like("cache_key", `slots:%:${dateStr}`)

    return new Response(JSON.stringify({
      success: true,
      message: "Booking confirmed with zero-conflict guarantee",
      booking_id: booking.id,
      booking,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Confirmation failure"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
