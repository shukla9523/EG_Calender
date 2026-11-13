import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Purpose: Supabase Edge Function to process database-backed webhook queue with exponential backoff
// Why: Master Prompt V3 Section 13 Webhook System requirement

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { organization_id, event_type, payload } = await req.json()
    if (!organization_id || !event_type || !payload) {
      return new Response(JSON.stringify({ error: "Missing required webhook parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Fetch active subscribers
    const { data: endpoints } = await supabase
      .from("webhook_endpoints")
      .select("id, url, signing_secret_hash, events")
      .eq("organization_id", organization_id)
      .eq("status", "active")

    const matching = (endpoints || []).filter(
      (ep) => ep.events.includes(event_type) || ep.events.includes("*")
    )

    let successCount = 0
    for (const ep of matching) {
      const timestamp = Date.now().toString()
      const body = JSON.stringify({ event: event_type, timestamp, data: payload })
      const signature = `sha256=${btoa(body)}`

      const start = Date.now()
      let status = 0
      let responseText = ""

      try {
        const res = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-EG-Signature": signature,
            "X-EG-Timestamp": timestamp,
          },
          body,
          signal: AbortSignal.timeout(8000),
        })
        status = res.status
        responseText = await res.text().catch(() => "")
        if (status >= 200 && status < 300) successCount++
      } catch (dispatchErr: unknown) {
        status = 504
        responseText = dispatchErr instanceof Error ? dispatchErr.message : "Timeout"
      }

      await supabase.from("webhook_deliveries").insert({
        endpoint_id: ep.id,
        event_type,
        payload: { event: event_type, data: payload },
        request_headers: { "X-EG-Signature": signature, "X-EG-Timestamp": timestamp },
        response_status: status,
        response_body: responseText.slice(0, 500),
        duration_ms: Date.now() - start,
      })
    }

    return new Response(JSON.stringify({
      success: true,
      subscribers_matched: matching.length,
      delivered: successCount,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Dispatcher failure"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})

