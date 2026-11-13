"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clock, Globe, CheckCircle2, Loader2, AlertCircle } from "lucide-react"

function PublicBookingPageContent() {
  const params = useParams()
  const slug = (params?.slug as string) || "meeting"

  const [linkData, setLinkData] = React.useState<any>(null)
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null)
  const [selectedDate, setSelectedDate] = React.useState<number>(1)
  const [inviteeName, setInviteeName] = React.useState("")
  const [inviteeEmail, setInviteeEmail] = React.useState("")
  const [inviteeNotes, setInviteeNotes] = React.useState("")
  const [booked, setBooked] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [bookingInProgress, setBookingInProgress] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [monthName, setMonthName] = React.useState("November")
  const [year, setYear] = React.useState(2026)
  const [daysInMonth, setDaysInMonth] = React.useState(30)
  const [todayDate, setTodayDate] = React.useState(1)

  React.useEffect(() => {
    const today = new Date()
    setMonthName(today.toLocaleDateString("en-US", { month: "long" }))
    setYear(today.getFullYear())
    setDaysInMonth(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate())
    setSelectedDate(today.getDate())
    setTodayDate(today.getDate())

    // Fetch link details from Supabase
    fetch(`/api/book/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.link) {
          setLinkData(data.link)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug])

  const availableSlots = [
    "09:30 AM",
    "10:00 AM",
    "11:30 AM",
    "01:00 PM",
    "02:30 PM",
    "03:30 PM",
    "04:00 PM",
    "04:30 PM",
  ]

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlot || !inviteeName || !inviteeEmail) return

    setBookingInProgress(true)
    setError(null)

    try {
      // Calculate ISO start and end time
      const today = new Date()
      const bookingDate = new Date(year, today.getMonth(), selectedDate)
      const [timePart, modifier] = selectedSlot.split(" ")
      const [initialHours, minutes] = timePart.split(":").map(Number)
      let hours = initialHours
      if (modifier === "PM" && hours < 12) hours += 12
      if (modifier === "AM" && hours === 12) hours = 0

      bookingDate.setHours(hours, minutes, 0, 0)
      const startTime = bookingDate.toISOString()
      const endTime = new Date(bookingDate.getTime() + (linkData?.duration_minutes || 30) * 60000).toISOString()

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          invitee_name: inviteeName,
          invitee_email: inviteeEmail,
          invitee_notes: inviteeNotes,
          start_time: startTime,
          end_time: endTime,
          invitee_timezone: linkData?.organizations?.timezone || "Asia/Kolkata",
          status: "pending",
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to record booking in Supabase")
      }

      setBooked(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBookingInProgress(false)
    }
  }

  if (booked) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Meeting Request Submitted!</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Your meeting request for <strong>{monthName} {selectedDate}, {year} at {selectedSlot}</strong> has been sent to the host for review and approval.
          </p>
          <div className="text-xs bg-[var(--color-surface-muted)] p-3 rounded-md text-[var(--color-text-muted)] text-left space-y-1">
            <div><strong>Invitee:</strong> {inviteeName} ({inviteeEmail})</div>
            <div><strong>Host:</strong> {linkData?.organizations?.name || "Calendar Host"}</div>
            <div><strong>Status:</strong> <span className="text-amber-600 font-semibold">Pending Host Approval</span></div>
          </div>
          <div className="pt-4 flex gap-3 justify-center">
            <Button onClick={() => setBooked(false)} variant="outline">
              Request Another Time
            </Button>
            <Button asChild className="bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]">
              <a href="/calendar">Go to Calendar</a>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        {/* Left Side: Host Info */}
        <div className="md:w-1/3 bg-[var(--color-surface-muted)] p-8 border-r border-[var(--color-border)] flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-[var(--color-primary-soft)] text-[var(--color-primary)] rounded-full flex items-center justify-center text-lg font-bold mb-4">
              EG
            </div>
            <h2 className="text-sm text-[var(--color-text-muted)] font-medium mb-1">
              {linkData?.organizations?.name || "EG-Calendar"}
            </h2>
            <h1 className="text-2xl font-bold text-[var(--color-text)] mb-6">
              {linkData?.title || "30 Minute Meeting"}
            </h1>

            <div className="space-y-4 text-[var(--color-text-muted)]">
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-[var(--color-primary)]" />
                <span>{linkData?.duration_minutes || 30} min</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Globe className="h-4 w-4 text-[var(--color-primary)]" />
                <span>{linkData?.organizations?.timezone || "Asia/Kolkata (IST)"}</span>
              </div>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Select an available time slot. Your booking will be saved live in Supabase.
            </p>
          </div>
        </div>

        {/* Right Side: Slot Selection & Booking Form */}
        <div className="md:w-2/3 p-8">
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-6">Select a Date & Time</h3>

          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-8 h-full">
            {/* Calendar */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-sm text-[var(--color-text)]">
                  {monthName} {year}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-[var(--color-text-muted)] font-medium">
                <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const isPast = day < todayDate
                  const isSelected = day === selectedDate
                  return (
                    <button
                      key={day}
                      onClick={() => !isPast && setSelectedDate(day)}
                      disabled={isPast}
                      className={`h-9 w-9 rounded-full font-medium transition-colors ${
                        isSelected
                          ? "bg-[var(--color-primary)] text-white shadow-sm"
                          : isPast
                          ? "text-gray-300 cursor-not-allowed dark:text-zinc-700"
                          : "text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Slots and Form */}
            <div className="w-full md:w-64 flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
              <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Available on {monthName} {selectedDate}:
              </div>
              {!selectedSlot ? (
                availableSlots.map((slot) => (
                  <Button
                    key={slot}
                    variant="outline"
                    onClick={() => setSelectedSlot(slot)}
                    className="justify-center text-xs h-9 border-[var(--color-primary)]/40 text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                  >
                    {slot}
                  </Button>
                ))
              ) : (
                <form onSubmit={handleBook} className="space-y-3">
                  <div className="text-xs p-2 bg-[var(--color-primary)]/10 rounded text-[var(--color-primary)] font-medium flex items-center justify-between">
                    <span>{selectedSlot}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSlot(null)}
                      className="text-xs underline text-[var(--color-text-muted)]"
                    >
                      Change
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-text)]">Your Name</label>
                    <Input
                      value={inviteeName}
                      onChange={(e) => setInviteeName(e.target.value)}
                      placeholder="John Doe"
                      className="h-8 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-text)]">Your Email</label>
                    <Input
                      type="email"
                      value={inviteeEmail}
                      onChange={(e) => setInviteeEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="h-8 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-text)]">Notes / Topic (Optional)</label>
                    <Input
                      value={inviteeNotes}
                      onChange={(e) => setInviteeNotes(e.target.value)}
                      placeholder="e.g. Discuss solar project or partnership"
                      className="h-8 text-xs"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={bookingInProgress}
                    className="w-full bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] text-xs h-9"
                  >
                    {bookingInProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    {bookingInProgress ? "Sending Request..." : "Request Meeting"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PublicBookingPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-[var(--color-text-muted)]">Loading booking page...</div>}>
      <PublicBookingPageContent />
    </React.Suspense>
  )
}
