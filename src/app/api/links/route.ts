import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateExpirationDate } from "@/lib/expiration"

// Purpose: Link management API supporting scheduling profiles and universal link expiration
// Why: Master Prompt V3 Sections 9 & 10 requirement

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const admin = createAdminClient()

    let query = admin
      .from("booking_links")
      .select("*, scheduling_profiles(name, profile_type), organizations(name, slug)")
      .order("created_at", { ascending: false })

    if (user?.id) {
      query = query.eq("user_id", user.id)
    }

    const { data: links, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, links: links || [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve booking links"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      slug,
      title,
      duration_minutes = 30,
      buffer_before_minutes = 0,
      buffer_after_minutes = 15,
      expiration_type = "never",
      custom_expires_at,
      scheduling_profile_id,
    } = body

    if (!slug || !title) {
      return NextResponse.json({ success: false, error: "Title and slug are required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: membership } = await admin
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single()

    let orgId = membership?.organization_id
    if (!orgId) {
      const { data: defaultOrg } = await admin.from("organizations").select("id").limit(1).single()
      orgId = defaultOrg?.id
    }

    if (!orgId) {
      return NextResponse.json({ success: false, error: "Organization not found" }, { status: 400 })
    }

    // Calculate expiration timestamp
    const expiresAt = calculateExpirationDate(expiration_type, custom_expires_at)

    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-")

    const { data: newLink, error } = await admin
      .from("booking_links")
      .upsert({
        organization_id: orgId,
        user_id: user.id,
        slug: cleanSlug,
        title,
        duration_minutes,
        buffer_before_minutes,
        buffer_after_minutes,
        expiration_type,
        expires_at: expiresAt,
        scheduling_profile_id: scheduling_profile_id || null,
        status: "published",
        is_revoked: false,
      }, { onConflict: "slug" })
      .select()
      .single()

    if (error) throw error

    // Log link creation
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "link.created",
      resource_type: "booking_links",
      resource_id: newLink.id,
      outcome: "success",
      metadata: { slug: cleanSlug, expiration_type, expires_at: expiresAt },
    })

    return NextResponse.json({ success: true, data: newLink })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create booking link"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
