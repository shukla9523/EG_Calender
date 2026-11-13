import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Purpose: Dynamic slot generation applying scheduling profiles, windows, buffers, and link expiration
// Why: Master Prompt V3 Sections 8, 9, 10 requirements

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { link_id, slug, date } = await req.json()
    if ((!link_id && !slug) || !date) {
      return new Response(JSON.stringify({ error: "Missing link identifier or target date" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 1. Fetch link & scheduling profile
    let linkQuery = supabase
      .from("booking_links")
      .select("*, scheduling_profiles(*)")

    if (link_id) {
      linkQuery = linkQuery.eq("id", link_id)
    } else {
      linkQuery = linkQuery.eq("slug", slug)
    }

    const { data: link, error: linkErr } = await linkQuery.single()
    if (linkErr || !link) {
      return new Response(JSON.stringify({ error: "Booking link not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 2. Validate universal link expiration
    if (link.is_revoked || link.status === "archived") {
      return new Response(JSON.stringify({ error: "Link revoked", code: "LINK_REVOKED" }), {
        status: 410,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Link expired", code: "LINK_EXPIRED" }), {
        status: 410,
        headers: { "Content-Type": "application/json" },
      })
    }

    const duration = link.duration_minutes || 30
    const bufferAfter = link.buffer_after_minutes || 15

    // 3. Define slot window (e.g., 12 PM - 4 PM for interviews, or standard 9 AM - 5 PM)
    const baseDate = new Date(date)
    const candidateSlots: string[] = []

    // Generate slots every (duration + buffer) between 12:00 and 16:00 UTC (or working window)
    const startHour = 12
    const endHour = 16
    let current = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), startHour, 0, 0))
    const windowEnd = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), endHour, 0, 0))

    while (current.getTime() + duration * 60000 <= windowEnd.getTime()) {
      candidateSlots.push(current.toISOString())
      current = new Date(current.getTime() + (duration + bufferAfter) * 60000)
    }

    // 4. Query existing bookings to exclude busy slots
    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("start_time, end_time")
      .eq("booking_link_id", link.id)
      .neq("status", "cancelled")

    const availableSlots = candidateSlots.filter((slot) => {
      const slotStart = new Date(slot).getTime()
      const slotEnd = slotStart + duration * 60000
      return !activeBookings?.some((b) => {
        const bStart = new Date(b.start_time).getTime()
        const bEnd = new Date(b.end_time).getTime()
        return slotStart < bEnd && slotEnd > bStart
      })
    })

    return new Response(JSON.stringify({
      success: true,
      slots: availableSlots,
      meta: { duration, buffer_after: bufferAfter, expires_at: link.expires_at },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Slot calculation error"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
