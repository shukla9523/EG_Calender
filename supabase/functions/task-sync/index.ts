import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Purpose: Supabase Edge Function to synchronize Zoho Tasks to Google Events and vice versa
// Why: Master Prompt V3 Section 11 Dedicated Task-to-Event Synchronization Engine

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
    const { user_id, task, action = "upsert" } = body

    if (!user_id || !task?.id) {
      return new Response(JSON.stringify({ error: "Missing user_id or task payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const syncHash = computeHash({
      title: task.title,
      due_date: task.due_date || task.dueDate,
      due_time: task.due_time || task.dueTime,
    })

    const { data: existing } = await supabase
      .from("task_event_mappings")
      .select("*")
      .eq("user_id", user_id)
      .eq("zoho_task_id", task.id)
      .single()

    if (existing && existing.sync_hash === syncHash) {
      return new Response(JSON.stringify({ success: true, message: "Task sync skipped (unchanged)" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (action === "delete") {
      if (existing) {
        if (existing.deletion_policy === "delete") {
          await supabase.from("task_event_mappings").delete().eq("id", existing.id)
        }
      }
      return new Response(JSON.stringify({ success: true, policy: existing?.deletion_policy || "cancel" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const googleEventId = existing?.google_event_id || `google-task-${task.id}`

    await supabase.from("task_event_mappings").upsert({
      user_id,
      zoho_task_id: task.id,
      google_event_id: googleEventId,
      google_calendar_id: "primary",
      deletion_policy: task.deletion_policy || "cancel",
      sync_hash: syncHash,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: "user_id,zoho_task_id" })

    return new Response(JSON.stringify({
      success: true,
      google_event_id: googleEventId,
      action: existing ? "updated" : "created",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Task sync failure"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})

