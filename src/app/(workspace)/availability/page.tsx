"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Globe, Check, Loader2, AlertCircle, Plus, Sliders } from "lucide-react"

interface SchedulingProfile {
  id?: string
  name: string
  profile_type: string
  duration_minutes: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  minimum_notice_hours: number
  booking_horizon_days: number
  max_bookings_per_day: number
  timezone: string
}

export default function AvailabilitySettingsPage() {
  const [activeTab, setActiveTab] = React.useState<"hours" | "profiles">("hours")
  const [timezone, setTimezone] = React.useState("Asia/Kolkata")
  const [workingHours, setWorkingHours] = React.useState<any[]>([
    { day_of_week: 1, name: "Monday", start_time: "09:00", end_time: "18:00" },
    { day_of_week: 2, name: "Tuesday", start_time: "09:00", end_time: "18:00" },
    { day_of_week: 3, name: "Wednesday", start_time: "09:00", end_time: "18:00" },
    { day_of_week: 4, name: "Thursday", start_time: "09:00", end_time: "18:00" },
    { day_of_week: 5, name: "Friday", start_time: "09:00", end_time: "18:00" },
  ])
  const [profiles, setProfiles] = React.useState<SchedulingProfile[]>([])
  const [newProfileName, setNewProfileName] = React.useState("")
  const [newProfileType, setNewProfileType] = React.useState("technical_interview")
  const [newProfileDuration, setNewProfileDuration] = React.useState("45")
  const [newProfileNotice, setNewProfileNotice] = React.useState("24")
  const [saved, setSaved] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  React.useEffect(() => {
    Promise.all([
      fetch("/api/availability").then((r) => r.json()),
      fetch("/api/profiles").then((r) => r.json()).catch(() => ({ profiles: [] })),
    ])
      .then(([availData, profileData]) => {
        if (availData.timezone) setTimezone(availData.timezone)
        if (availData.working_hours && availData.working_hours.length > 0) {
          const mapped = availData.working_hours.map((h: any) => ({
            day_of_week: h.day_of_week,
            name: dayNames[h.day_of_week],
            start_time: h.start_time.slice(0, 5),
            end_time: h.end_time.slice(0, 5),
          }))
          setWorkingHours(mapped)
        }
        if (profileData.profiles) setProfiles(profileData.profiles)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleTimeChange = (index: number, field: "start_time" | "end_time", value: string) => {
    const updated = [...workingHours]
    updated[index][field] = value
    setWorkingHours(updated)
  }

  const handleSaveWorkingHours = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          working_hours: workingHours.map((h) => ({
            day_of_week: h.day_of_week,
            start_time: `${h.start_time}:00`,
            end_time: `${h.end_time}:00`,
            is_active: true,
          })),
        }),
      })
      if (!res.ok) throw new Error("Failed to save availability to Supabase")
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving schedule")
    } finally {
      setSaving(false)
    }
  }

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProfileName) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProfileName,
          profile_type: newProfileType,
          duration_minutes: parseInt(newProfileDuration, 10),
          minimum_notice_hours: parseInt(newProfileNotice, 10),
          timezone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create scheduling profile")
      setProfiles((prev) => [data.profile, ...prev])
      setNewProfileName("")
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">Availability & Scheduling Profiles</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Configure working hours and dedicated scheduling profiles (working hours vs booking windows) in Supabase.
        </p>
      </div>

      <div className="flex border-b border-[var(--color-border)] gap-4">
        <button
          type="button"
          onClick={() => setActiveTab("hours")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "hours"
              ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          <Clock className="h-4 w-4" /> Working Hours
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("profiles")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "profiles"
              ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          <Sliders className="h-4 w-4" /> Scheduling Profiles ({profiles.length})
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-[var(--color-text-muted)] flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
          Loading Supabase schedule...
        </div>
      ) : activeTab === "hours" ? (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-[var(--color-text)] flex items-center gap-2">
              <Globe className="h-4 w-4" /> Organization Timezone
            </h3>
            <div className="w-80">
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST - India)</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time (US & Canada)</SelectItem>
                  <SelectItem value="Europe/London">London (GMT)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-[var(--color-text)] flex items-center gap-2">
              <Clock className="h-4 w-4" /> Default Working Hours
            </h3>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
              {workingHours.map((wh, idx) => (
                <div key={wh.day_of_week} className="flex items-center gap-4">
                  <div className="w-28 text-sm font-medium text-[var(--color-text)]">{wh.name}</div>
                  <Input
                    type="time"
                    value={wh.start_time}
                    onChange={(e) => handleTimeChange(idx, "start_time", e.target.value)}
                    className="w-32"
                  />
                  <span className="text-sm text-[var(--color-text-muted)]">to</span>
                  <Input
                    type="time"
                    value={wh.end_time}
                    onChange={(e) => handleTimeChange(idx, "end_time", e.target.value)}
                    className="w-32"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 justify-end">
            {saved && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <Check className="h-4 w-4" /> Saved in Supabase!
              </span>
            )}
            <Button
              onClick={handleSaveWorkingHours}
              disabled={saving}
              className="bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {saving ? "Saving..." : "Save Working Hours"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <form onSubmit={handleCreateProfile} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4 shadow-sm">
            <h3 className="font-semibold text-base text-[var(--color-text)] flex items-center gap-2">
              <Plus className="h-4 w-4 text-[var(--color-primary)]" /> Create New Profile (V3 Dynamic Availability)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-muted)]">Profile Name</label>
                <Input
                  placeholder="e.g. Technical Interview 45m"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-muted)]">Profile Type</label>
                <Select value={newProfileType} onValueChange={setNewProfileType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Meeting</SelectItem>
                    <SelectItem value="technical_interview">Technical Interview (12 PM - 4 PM)</SelectItem>
                    <SelectItem value="hr_interview">HR Initial Screening</SelectItem>
                    <SelectItem value="client_meeting">Client Meeting</SelectItem>
                    <SelectItem value="custom">Custom Profile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-muted)]">Duration</label>
                <Select value={newProfileDuration} onValueChange={setNewProfileDuration}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-muted)]">Minimum Notice</label>
                <Select value={newProfileNotice} onValueChange={setNewProfileNotice}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Notice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours (Recommended)</SelectItem>
                    <SelectItem value="48">48 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={saving || !newProfileName}
                className="bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] text-xs h-9"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                Add Profile
              </Button>
            </div>
          </form>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[var(--color-text-muted)]">Existing Profiles ({profiles.length})</h4>
            {profiles.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] rounded-md">
                No custom scheduling profiles configured yet. Create one above to link with booking URLs.
              </div>
            ) : (
              profiles.map((p) => (
                <div key={p.id || p.name} className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between shadow-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--color-text)]">{p.name}</span>
                      <span className="text-[10px] font-mono uppercase bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] px-2 py-0.5 rounded border border-[var(--color-border)]">
                        {p.profile_type}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-3">
                      <span>Duration: {p.duration_minutes}m</span>
                      <span>•</span>
                      <span>Notice: {p.minimum_notice_hours}h</span>
                      <span>•</span>
                      <span>Max/Day: {p.max_bookings_per_day}</span>
                    </div>
                  </div>
                  <div className="text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                    Active
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
