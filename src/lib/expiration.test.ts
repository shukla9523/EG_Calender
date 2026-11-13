import { describe, it, expect } from "vitest"
import { calculateExpirationDate, isLinkExpired } from "./expiration"

describe("Universal Link Expiration Logic", () => {
  const baseTime = 1730978000000 // Fixed epoch for testing

  it("should return null for 'never' expiration type", () => {
    expect(calculateExpirationDate("never", undefined, baseTime)).toBeNull()
  })

  it("should accurately calculate 1h, 24h, 7d, and 30d offsets", () => {
    const oneHour = calculateExpirationDate("1h", undefined, baseTime)
    expect(new Date(oneHour!).getTime()).toBe(baseTime + 3600000)

    const oneDay = calculateExpirationDate("24h", undefined, baseTime)
    expect(new Date(oneDay!).getTime()).toBe(baseTime + 86400000)

    const sevenDays = calculateExpirationDate("7d", undefined, baseTime)
    expect(new Date(sevenDays!).getTime()).toBe(baseTime + 7 * 86400000)

    const thirtyDays = calculateExpirationDate("30d", undefined, baseTime)
    expect(new Date(thirtyDays!).getTime()).toBe(baseTime + 30 * 86400000)
  })

  it("should parse custom expiration dates correctly", () => {
    const target = "2026-12-31T23:59:59.000Z"
    const result = calculateExpirationDate("custom", target, baseTime)
    expect(result).toBe(target)
  })

  it("should detect revoked links as expired immediately", () => {
    expect(isLinkExpired({ is_revoked: true, expiration_type: "never" })).toBe(true)
  })

  it("should accurately determine expiration based on check timestamp", () => {
    const expiresAt = new Date(baseTime + 3600000).toISOString()
    const link = { expiration_type: "1h", expires_at: expiresAt, is_revoked: false }

    // Before expiration
    expect(isLinkExpired(link, baseTime + 1800000)).toBe(false)
    // After expiration
    expect(isLinkExpired(link, baseTime + 3600001)).toBe(true)
  })
})

