import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const admin = createAdminClient()

    // If user is authenticated, query for their user_id, otherwise query by organisation
    let query = admin.from("calendar_connections").select("*, calendars(*)")
    if (user?.id) {
      query = query.eq("user_id", user.id)
    }

    const { data: connections, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ connections: connections || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const admin = createAdminClient()

    if (user?.id && provider) {
      await admin
        .from("calendar_connections")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", provider)
    } else if (provider) {
      await admin
        .from("calendar_connections")
        .delete()
        .eq("provider", provider)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

