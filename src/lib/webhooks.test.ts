import { describe, it, expect } from "vitest"
import { generateWebhookSignature, verifyWebhookSignature } from "./webhooks/hmac"

describe("HMAC Webhook Signatures", () => {
  const secret = "whsec_test_secret_12345"
  const payload = JSON.stringify({
    event: "booking.created",
    timestamp: "1730978000000",
    data: { id: "booking_123", guest_email: "test@example.com" },
  })

  it("should generate a valid sha256 prefixed signature", () => {
    const signature = generateWebhookSignature(payload, secret)
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/)
  })

  it("should successfully verify a valid signature", () => {
    const signature = generateWebhookSignature(payload, secret)
    const isValid = verifyWebhookSignature(payload, signature, secret)
    expect(isValid).toBe(true)
  })

  it("should reject verification when secret does not match", () => {
    const signature = generateWebhookSignature(payload, secret)
    const isValid = verifyWebhookSignature(payload, signature, "whsec_wrong_secret")
    expect(isValid).toBe(false)
  })

  it("should reject verification when payload is tampered with", () => {
    const signature = generateWebhookSignature(payload, secret)
    const tamperedPayload = payload.replace("booking_123", "booking_456")
    const isValid = verifyWebhookSignature(tamperedPayload, signature, secret)
    expect(isValid).toBe(false)
  })

  it("should reject malformed or empty signatures", () => {
    expect(verifyWebhookSignature(payload, "", secret)).toBe(false)
    expect(verifyWebhookSignature(payload, "malformed_without_prefix", secret)).toBe(false)
  })
})

