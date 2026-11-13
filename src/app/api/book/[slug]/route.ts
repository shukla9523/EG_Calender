import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isLinkExpired } from "@/lib/expiration"

// Purpose: Public booking link resolution with strict server-side universal expiration check
// Why: Master Prompt V3 Section 10 requires server-side validation rejecting expired or revoked links

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const admin = createAdminClient()

    const { data: link, error } = await admin
      .from("booking_links")
      .select("*, organizations(name, slug, timezone), scheduling_profiles(*)")
      .eq("slug", slug)
      .single()

    if (error || !link) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Booking link not found" } }, { status: 404 })
    }

    if (link.status === "archived" || link.is_revoked) {
      return NextResponse.json({
        success: false,
        error: { code: "LINK_REVOKED", message: "This scheduling link has been deactivated or revoked." },
      }, { status: 410 })
    }

    // Server-side universal expiration check per Section 10
    if (isLinkExpired(link)) {
      return NextResponse.json({
        success: false,
        error: { code: "LINK_EXPIRED", message: "This scheduling link has expired." },
      }, { status: 410 })
    }

    return NextResponse.json({ success: true, data: link })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ success: false, error: { code: "SERVER_ERROR", message: msg } }, { status: 500 })
  }
}
