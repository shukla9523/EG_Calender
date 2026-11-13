import { createAdminClient } from "@/lib/supabase/admin"
import { generateWebhookSignature } from "./hmac"

// Purpose: Database-backed webhook dispatcher with signed HMAC payloads and delivery history
// Why: Master Prompt V3 Section 13 Webhook System requirement

export async function dispatchWebhook(
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  try {
    const admin = createAdminClient()

    // 1. Fetch active subscriptions for this organization and event
    const { data: endpoints, error } = await admin
      .from("webhook_endpoints")
      .select("id, url, signing_secret_hash, events")
      .eq("organization_id", organizationId)
      .eq("status", "active")

    if (error || !endpoints || endpoints.length === 0) {
      return { dispatched: 0 }
    }

    const matching = endpoints.filter((ep) => ep.events.includes(eventType) || ep.events.includes("*"))

    for (const ep of matching) {
      const timestamp = Date.now().toString()
      const bodyString = JSON.stringify({
        event: eventType,
        timestamp,
        data: payload,
      })

      // Generate cryptographically secure HMAC signature
      const signingSecret = ep.signing_secret_hash || "whsec_default_eg_calendar_secret"
      const signature = generateWebhookSignature(bodyString, signingSecret)

      const start = Date.now()
      let status = 0
      let responseBody = ""

      try {
        const res = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-EG-Signature": signature,
            "X-EG-Timestamp": timestamp,
          },
          body: bodyString,
          signal: AbortSignal.timeout(10000), // 10s timeout
        })
        status = res.status
        responseBody = await res.text().catch(() => "")
      } catch (err: unknown) {
        status = 504
        responseBody = err instanceof Error ? err.message : "Delivery timeout"
      }

      // Record delivery log in webhook_deliveries
      await admin.from("webhook_deliveries").insert({
        endpoint_id: ep.id,
        event_type: eventType,
        payload: { event: eventType, data: payload },
        request_headers: { "X-EG-Signature": signature, "X-EG-Timestamp": timestamp },
        response_status: status,
        response_body: responseBody.slice(0, 500),
        duration_ms: Date.now() - start,
      })
    }

    return { dispatched: matching.length }
  } catch {
    return { dispatched: 0 }
  }
}

