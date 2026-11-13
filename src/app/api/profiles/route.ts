import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Purpose: CRUD for dynamic scheduling profiles (working hours vs booking windows, buffers, notice, daily limits)
// Why: Master Prompt V3 Section 9 requirement

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const admin = createAdminClient()

    let query = admin
      .from("scheduling_profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (user?.id) {
      query = query.eq("user_id", user.id)
    }

    const { data: profiles, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, profiles: profiles || [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve scheduling profiles"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      name,
      profile_type = "general",
      duration_minutes = 30,
      buffer_before_minutes = 0,
      buffer_after_minutes = 15,
      minimum_notice_hours = 24,
      booking_horizon_days = 60,
      max_bookings_per_day = 8,
      working_hours,
      booking_window,
      timezone = "Asia/Kolkata",
    } = body

    if (!name) {
      return NextResponse.json({ success: false, error: "Profile name is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }
    const userId = user.id
    const admin = createAdminClient()

    const profileData = {
      user_id: userId,
      name,
      profile_type,
      duration_minutes,
      buffer_before_minutes,
      buffer_after_minutes,
      minimum_notice_hours,
      booking_horizon_days,
      max_bookings_per_day,
      working_hours: working_hours || [
        { day: "monday", start: "09:00", end: "17:00" },
        { day: "tuesday", start: "09:00", end: "17:00" },
        { day: "wednesday", start: "09:00", end: "17:00" },
        { day: "thursday", start: "09:00", end: "17:00" },
        { day: "friday", start: "09:00", end: "17:00" },
      ],
      booking_window: booking_window || [
        { day: "monday", start: "12:00", end: "16:00" },
        { day: "tuesday", start: "12:00", end: "16:00" },
        { day: "wednesday", start: "12:00", end: "16:00" },
        { day: "thursday", start: "12:00", end: "16:00" },
        { day: "friday", start: "12:00", end: "16:00" },
      ],
      timezone,
      updated_at: new Date().toISOString(),
    }

    let result
    if (id) {
      result = await admin
        .from("scheduling_profiles")
        .update(profileData)
        .eq("id", id)
        .select()
        .single()
    } else {
      result = await admin
        .from("scheduling_profiles")
        .insert(profileData)
        .select()
        .single()
    }

    if (result.error) throw result.error

    return NextResponse.json({ success: true, profile: result.data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save scheduling profile"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

