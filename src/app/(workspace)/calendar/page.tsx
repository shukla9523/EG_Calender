"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, Plus } from "lucide-react"

export default function CalendarPage() {
  const [connectedEmail, setConnectedEmail] = React.useState<string | null>(null)
  const [bookings, setBookings] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [weekDays, setWeekDays] = React.useState<Array<{ label: string; dateStr: string; isToday: boolean }>>([])

  React.useEffect(() => {
    // 1. Fetch live connections from Supabase API
    fetch("/api/integrations")
      .then((res) => res.json())
      .then((data) => {
        if (data.connections && data.connections.length > 0) {
          setConnectedEmail(data.connections[0].provider_email)
        } else {
          const saved = localStorage.getItem("google_calendar_email")
          if (saved) setConnectedEmail(saved)
        }
      })
      .catch(() => {})

    // 2. Fetch live bookings from Supabase API
    fetch("/api/bookings")
      .then((res) => res.json())
      .then((data) => {
        if (data.bookings) {
          setBookings(data.bookings)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))

    // 3. Dynamic current week days
    const today = new Date()
    const currentDay = today.getDay()
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay

    const days = Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() + mondayOffset + i)
      const isToday = d.toDateString() === today.toDateString()
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" })
      const dayNum = d.getDate()
      const monthName = d.toLocaleDateString("en-US", { month: "short" })
      return {
        label: `${dayName} ${dayNum} ${monthName}`,
        dateStr: d.toISOString().split("T")[0],
        isToday,
      }
    })
    setWeekDays(days)
  }, [])

  const timeSlots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">Availability Calendar</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {connectedEmail ? (
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <CheckCircle2 className="h-4 w-4" /> Live Supabase Synced: {connectedEmail}
              </span>
            ) : (
              "View your live Supabase schedule and bookings across connected calendar accounts."
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!connectedEmail ? (
            <Button size="sm" asChild variant="outline" className="border-blue-500 text-blue-600">
              <a href="/integrations">Connect Calendar</a>
            </Button>
          ) : (
            <Button size="sm" asChild variant="outline">
              <a href="/book/meeting" target="_blank" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Book Test Slot
              </a>
            </Button>
          )}
          <Button size="sm" className="gap-2 bg-[var(--color-primary)] text-white">
            <CalendarIcon className="h-4 w-4" />
            Today
          </Button>
        </div>
      </div>

      {bookings.some((b) => b.status === "pending") && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm flex items-center justify-between text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              You have <strong>{bookings.filter((b) => b.status === "pending").length} new pending meeting request(s)</strong> awaiting your approval!
            </span>
          </div>
          <Button size="sm" asChild variant="outline" className="border-amber-600 text-amber-800 dark:text-amber-300">
            <a href="/requests">Review & Approve &rarr;</a>
          </Button>
        </div>
      )}

      {!connectedEmail && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <AlertCircle className="h-4 w-4 text-[var(--color-primary)]" />
            <span>Connect your Google account in Integrations to view real-time busy intervals and events.</span>
          </div>
          <Button size="sm" variant="ghost" asChild>
            <a href="/integrations">Go to Integrations &rarr;</a>
          </Button>
        </div>
      )}

      <div className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm flex flex-col overflow-hidden">
        {/* Dynamic Calendar Header */}
        <div className="flex bg-[var(--color-surface-muted)] border-b border-[var(--color-border)]">
          <div className="w-16 flex-shrink-0 border-r border-[var(--color-border)] p-2">
            <div className="text-xs text-[var(--color-text-muted)] text-center font-medium">Time</div>
          </div>
          <div className="flex-1 grid grid-cols-5 text-center divide-x divide-[var(--color-border)]">
            {weekDays.map((day, idx) => (
              <div
                key={idx}
                className={`p-2 font-medium text-sm ${
                  day.isToday ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold" : "text-[var(--color-text)]"
                }`}
              >
                {day.label}
                {day.isToday && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)] text-white">Today</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Calendar Grid */}
        <div className="flex-1 flex overflow-y-auto">
          {/* Times Column */}
          <div className="w-16 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)]">
            {timeSlots.map((time) => (
              <div
                key={time}
                className="h-20 p-2 text-xs text-[var(--color-text-muted)] text-right border-b border-[var(--color-border)]"
              >
                {time}
              </div>
            ))}
          </div>

          {/* Days Grid Columns */}
          <div className="flex-1 grid grid-cols-5 divide-x divide-[var(--color-border)]">
            {weekDays.map((day, dayIndex) => {
              // Find any booking on this day
              const dayBookings = bookings.filter((b) => b.start_time && b.start_time.startsWith(day.dateStr))

              return (
                <div key={dayIndex} className="relative border-b border-[var(--color-border)] divide-y divide-[var(--color-border)]/50">
                  {timeSlots.map((time, timeIdx) => {
                    const matchingBooking = dayBookings.find((b) => {
                      const bTime = new Date(b.start_time).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit" })
                      return bTime === time.split(":")[0]
                    })

                    return (
                      <div
                        key={timeIdx}
                        className={`h-20 p-1 hover:bg-[var(--color-surface-muted)]/50 transition-colors ${
                          day.isToday ? "bg-[var(--color-primary)]/[0.02]" : ""
                        }`}
                      >
                        {matchingBooking ? (
                          matchingBooking.status === "pending" ? (
                            <a
                              href="/requests"
                              className="h-full bg-amber-500/10 border border-amber-500/30 rounded p-1.5 text-xs text-amber-800 dark:text-amber-300 flex flex-col justify-between overflow-hidden hover:bg-amber-500/20 transition-colors"
                              title="Click to review and approve request"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold truncate">{matchingBooking.invitee_name}</span>
                                <span className="text-[9px] bg-amber-200 dark:bg-amber-900 px-1 rounded font-bold">Needs Approval</span>
                              </div>
                              <span className="text-[10px] text-amber-700 dark:text-amber-400">Review &rarr;</span>
                            </a>
                          ) : (
                            <div className="h-full bg-blue-500/10 border border-blue-500/30 rounded p-1.5 text-xs text-blue-700 dark:text-blue-300 flex flex-col justify-between overflow-hidden">
                              <span className="font-semibold truncate">{matchingBooking.invitee_name}</span>
                              <span className="text-[10px] text-blue-600 dark:text-blue-400">{matchingBooking.invitee_email}</span>
                            </div>
                          )
                        ) : (
                          <div className="h-full border border-dashed border-[var(--color-primary)]/20 rounded p-1 text-[11px] text-[var(--color-primary)] flex items-center justify-center opacity-60 hover:opacity-100 cursor-pointer">
                            <Clock className="h-3 w-3 mr-1" /> Available
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
