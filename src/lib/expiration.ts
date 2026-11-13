// Purpose: Centralized expiration and revocation calculation for booking links
// Why: Master Prompt V3 Section 10 Universal Link Expiration requirement

export function calculateExpirationDate(
  type: string,
  customDate?: string | Date,
  baseTime: number = Date.now()
): string | null {
  if (type === "never" || !type) return null

  switch (type) {
    case "1h":
      return new Date(baseTime + 60 * 60 * 1000).toISOString()
    case "24h":
      return new Date(baseTime + 24 * 60 * 60 * 1000).toISOString()
    case "7d":
      return new Date(baseTime + 7 * 24 * 60 * 60 * 1000).toISOString()
    case "30d":
      return new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString()
    case "custom":
      return customDate ? new Date(customDate).toISOString() : null
    default:
      return null
  }
}

export function isLinkExpired(
  link: {
    expiration_type?: string
    expires_at?: string | null
    is_revoked?: boolean
  },
  checkTime: number = Date.now()
): boolean {
  if (link.is_revoked) return true
  if (link.expiration_type === "never" || !link.expires_at) return false

  const expireEpoch = new Date(link.expires_at).getTime()
  return checkTime > expireEpoch
}

