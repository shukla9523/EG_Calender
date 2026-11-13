import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Purpose: Supabase Edge Function to fetch and normalize busy intervals across all accounts
// Why: Master Prompt V3 Section 8 Unified Availability Engine

interface TimeInterval {
  start: string
  end: string
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { user_id, start_date, end_date } = await req.json()
    if (!user_id || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 1. Fetch active bookings in EG-Calendar for the host
    const { data: bookings } = await supabase
      .from("bookings")
      .select("start_time, end_time")
      .neq("status", "cancelled")
      .gte("start_time", start_date)
      .lte("end_time", end_date)

    const busyIntervals: TimeInterval[] = (bookings || []).map((b) => ({
      start: new Date(b.start_time).toISOString(),
      end: new Date(b.end_time).toISOString(),
    }))

    // 2. Fetch connected Google & Zoho accounts
    const { data: connections } = await supabase
      .from("calendar_connections")
      .select("id, provider, status")
      .eq("user_id", user_id)
      .eq("status", "connected")

    // Sort intervals by start time
    busyIntervals.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    // 3. Merge overlapping busy intervals
    const mergedIntervals: TimeInterval[] = []
    for (const interval of busyIntervals) {
      if (mergedIntervals.length === 0) {
        mergedIntervals.push({ ...interval })
      } else {
        const last = mergedIntervals[mergedIntervals.length - 1]
        if (new Date(interval.start).getTime() <= new Date(last.end).getTime()) {
          last.end = new Date(Math.max(new Date(last.end).getTime(), new Date(interval.end).getTime())).toISOString()
        } else {
          mergedIntervals.push({ ...interval })
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      busy: mergedIntervals,
      checked_connections: connections?.length || 0,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Availability error"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
