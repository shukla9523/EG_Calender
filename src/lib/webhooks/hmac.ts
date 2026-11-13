import { createHmac, timingSafeEqual } from "crypto"

// Purpose: HMAC-SHA256 signature generator and timing-safe validator for webhooks
// Why: Master Prompt V3 Section 13 requirement for signed webhook payloads

export function generateWebhookSignature(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret)
  hmac.update(payload, "utf8")
  return `sha256=${hmac.digest("hex")}`
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret || !signature.startsWith("sha256=")) {
    return false
  }

  const expectedSig = generateWebhookSignature(payload, secret)
  const expectedBuffer = Buffer.from(expectedSig, "utf8")
  const actualBuffer = Buffer.from(signature, "utf8")

  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, actualBuffer)
}

