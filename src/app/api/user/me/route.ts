import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ authenticated: false, user: null })
    }

    const admin = createAdminClient()

    // 1. Ensure Profile exists
    let { data: profile } = await admin
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile) {
      const { data: newProfile } = await admin
        .from("user_profiles")
        .upsert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          status: "approved",
          role: "member",
        })
        .select()
        .single()
      profile = newProfile
    }

    // 2. Ensure Organization exists
    const { data: membership } = await admin
      .from("organization_memberships")
      .select("*, organizations(*)")
      .eq("user_id", user.id)
      .single()

    let organization = membership?.organizations

    if (!organization) {
      // Find or create default organization dynamically
      let { data: org } = await admin
        .from("organizations")
        .select("*")
        .limit(1)
        .maybeSingle()

      if (!org) {
        const defaultName = "Workspace"
        const defaultSlug = `workspace-${Date.now()}`
        const { data: newOrg } = await admin
          .from("organizations")
          .insert({
            name: defaultName,
            slug: defaultSlug,
            timezone: "Asia/Kolkata",
          })
          .select()
          .single()
        org = newOrg
      }

      if (org) {
        await admin.from("organization_memberships").upsert({
          organization_id: org.id,
          user_id: user.id,
          role: "owner",
        })
        organization = org
      }
    }

    // 3. Ensure default booking link exists
    if (organization) {
      const { data: link } = await admin
        .from("booking_links")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("slug", "meeting")
        .single()

      if (!link) {
        await admin.from("booking_links").insert({
          organization_id: organization.id,
          user_id: user.id,
          slug: "meeting",
          title: "30 Minute Meeting",
          duration_minutes: 30,
          status: "published",
        })
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        profile,
        organization,
        role: membership?.role || "owner",
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

