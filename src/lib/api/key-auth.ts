import { createAdminClient } from "@/lib/supabase/admin"

// Purpose: API key authentication and scope verification helper for external platform integrations
// Why: Master Prompt V3 Section 12 Public API security requirement

export interface ApiAuthResult {
  isValid: boolean
  organizationId?: string
  scopes?: string[]
  error?: string
}

export async function verifyApiKey(apiKeyHeader: string | null, requiredScope = "read"): Promise<ApiAuthResult> {
  if (!apiKeyHeader) {
    return { isValid: false, error: "Missing x-api-key header" }
  }

  try {
    const admin = createAdminClient()
    const { data: keyRow, error } = await admin
      .from("api_keys")
      .select("organization_id, scopes")
      .eq("key_hint", apiKeyHeader.slice(0, 8))
      .single()

    if (error || !keyRow) {
      return { isValid: false, error: "Invalid or revoked API key" }
    }

    if (!keyRow.scopes.includes(requiredScope) && !keyRow.scopes.includes("all")) {
      return { isValid: false, error: `Missing required scope: ${requiredScope}` }
    }

    // Update last_used_at
    await admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hint", apiKeyHeader.slice(0, 8))

    return {
      isValid: true,
      organizationId: keyRow.organization_id,
      scopes: keyRow.scopes,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "API key verification failure"
    return { isValid: false, error: msg }
  }
}

