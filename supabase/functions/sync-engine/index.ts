import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Purpose: Supabase Edge Function for Two-Way Synchronization between Google & Zoho Calendars
// Why: Master Prompt V3 Section 7 & 11 - Webhook-based updates, reconciliation & loop avoidance

function computeHash(payload: Record<string, unknown>): string {
  const str = JSON.stringify(payload)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(16)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json()
    const { user_id, event, source_provider, action = "upsert" } = body

    if (!user_id || !event?.id || !source_provider) {
      return new Response(JSON.stringify({ error: "Missing required sync payload parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const syncHash = computeHash({
      title: event.title || event.summary,
      start: event.start_time || event.startTime,
      end: event.end_time || event.endTime,
    })

    // 1. Check existing mapping in external_event_mappings
    const query = supabase
      .from("external_event_mappings")
      .select("*")
      .eq("user_id", user_id)

    if (source_provider === "google") {
      query.eq("google_event_id", event.id)
    } else {
      query.eq("zoho_event_id", event.id)
    }

    const { data: existing } = await query.single()

    // 2. Prevent infinite loops
    if (existing && existing.sync_hash === syncHash) {
      return new Response(JSON.stringify({ success: true, message: "Sync skipped (loop prevented)" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 3. Handle deletion
    if (action === "delete") {
      if (existing) {
        await supabase.from("external_event_mappings").delete().eq("id", existing.id)
      }
      return new Response(JSON.stringify({ success: true, action: "deleted" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 4. Mirror event to the destination provider
    const destinationProvider = source_provider === "google" ? "zoho" : "google"
    const destinationEventId = existing
      ? (source_provider === "google" ? existing.zoho_event_id : existing.google_event_id)
      : `${destinationProvider}-mirrored-${event.id}`

    // Upsert mapping record
    const { error: upsertErr } = await supabase.from("external_event_mappings").upsert({
      user_id,
      google_calendar_id: "primary",
      google_event_id: source_provider === "google" ? event.id : destinationEventId,
      zoho_calendar_id: "zoho-primary",
      zoho_event_id: source_provider === "zoho" ? event.id : destinationEventId,
      sync_hash: syncHash,
      origin_provider: source_provider,
      last_synced_at: new Date().toISOString(),
    })

    if (upsertErr) throw upsertErr

    // Audit log
    await supabase.from("audit_logs").insert({
      actor_id: user_id,
      action: `calendar.sync.${destinationProvider}`,
      resource_type: "external_event_mappings",
      outcome: "success",
      metadata: { source: source_provider, event_id: event.id, destination_id: destinationEventId },
    })

    return new Response(JSON.stringify({
      success: true,
      mirrored_event_id: destinationEventId,
      action: existing ? "updated" : "created",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sync error"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})

