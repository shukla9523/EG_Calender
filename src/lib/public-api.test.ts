import { describe, it, expect, vi } from "vitest"
import { verifyApiKey } from "./api/key-auth"

// Purpose: Unit test for Public API Key authentication & scope enforcement
// Why: Validates Master Prompt V3 Section 12 Public API security

vi.mock("@/lib/supabase/admin", () => {
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === "api_keys") {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                single: async () => {
                  if (val === "valid_12") {
                    return {
                      data: {
                        organization_id: "org-1",
                        scopes: ["read", "write"],
                      },
                      error: null,
                    }
                  }
                  return { data: null, error: { message: "Not found" } }
                },
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          }
        }
        return {}
      },
    }),
  }
})

describe("Public API Security Layer", () => {
  it("rejects missing API keys", async () => {
    const res = await verifyApiKey(null, "read")
    expect(res.isValid).toBe(false)
    expect(res.error).toBe("Missing x-api-key header")
  })

  it("validates authorized API keys and matches scope", async () => {
    const res = await verifyApiKey("valid_1234567890", "read")
    expect(res.isValid).toBe(true)
    expect(res.organizationId).toBe("org-1")
  })

  it("denies access if requested scope is absent", async () => {
    const res = await verifyApiKey("valid_1234567890", "admin_delete")
    expect(res.isValid).toBe(false)
    expect(res.error).toContain("Missing required scope")
  })
})

