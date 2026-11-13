"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  Clock,
  Mail,
  CheckCircle2,
  XCircle,
  Inbox,
  Loader2,
  ExternalLink,
  User,
  AlertCircle
} from "lucide-react"

export default function MeetingRequestsPage() {
  const [bookings, setBookings] = React.useState<any[]>([])
  const [filter, setFilter] = React.useState<"pending" | "confirmed" | "all">("pending")
  const [loading, setLoading] = React.useState(true)
  const [processingId, setProcessingId] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)

  const fetchBookings = () => {
    fetch("/api/bookings")
      .then((res) => res.json())
      .then((data) => {
        if (data.bookings) {
          setBookings(data.bookings)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  React.useEffect(() => {
    fetchBookings()
  }, [])

  const handleUpdateStatus = async (id: string, status: "confirmed" | "cancelled", openGmail = false, bookingData?: any) => {
    setProcessingId(id)
    setMessage(null)

    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })

      if (!res.ok) throw new Error("Failed to update booking status")

      // Update state locally
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b))
      )

      setMessage(`Meeting successfully ${status === "confirmed" ? "approved" : "declined"}!`)
      setTimeout(() => setMessage(null), 4000)

      if (openGmail && bookingData) {
        // Open Gmail compose with pre-filled details
        const invitee = bookingData.invitee_email
        const name = bookingData.invitee_name
        const dateStr = new Date(bookingData.start_time).toLocaleString("en-US", {
          dateStyle: "full",
          timeStyle: "short",
        })
        const subject = encodeURIComponent(`Meeting Confirmed: ${bookingData.booking_links?.title || "30 Minute Meeting"}`)
        const body = encodeURIComponent(
          `Hi ${name},\n\nYour meeting request has been approved!\n\nDetails:\nDate & Time: ${dateStr}\nTopic: ${bookingData.booking_links?.title || "Meeting"}\n\nLooking forward to speaking with you.\n\nBest regards,\nCalendar Host`
        )
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(invitee)}&su=${subject}&body=${body}`
        window.open(gmailUrl, "_blank")
      }
    } catch (err: any) {
      alert(err.message || "Error updating booking")
    } finally {
      setProcessingId(null)
    }
  }

  const pendingBookings = bookings.filter((b) => b.status === "pending")
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed")
  const filteredList =
    filter === "pending"
      ? pendingBookings
      : filter === "confirmed"
      ? confirmedBookings
      : bookings

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Meeting Requests & Approvals
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Review incoming meeting requests and approve them directly or via Gmail compose.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/book/meeting" target="_blank" className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" /> Open Booking Page
          </a>
        </Button>
      </div>

      {message && (
        <div className="p-3 text-sm text-emerald-800 bg-emerald-500/10 border border-emerald-500/20 rounded-md flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-[var(--color-border)] gap-2">
        <button
          onClick={() => setFilter("pending")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            filter === "pending"
              ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          Pending Review
          {pendingBookings.length > 0 && (
            <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-xs px-2 py-0.5 rounded-full font-bold">
              {pendingBookings.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter("confirmed")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            filter === "confirmed"
              ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          Approved Meetings
          <span className="text-xs text-[var(--color-text-muted)]">({confirmedBookings.length})</span>
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
            filter === "all"
              ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          All Requests ({bookings.length})
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-[var(--color-text-muted)] flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
          Loading meeting requests from Supabase...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[var(--color-surface-muted)] flex items-center justify-center mb-4 text-[var(--color-text-muted)]">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-lg text-[var(--color-text)] mb-1">
            {filter === "pending" ? "No Pending Meeting Requests" : "No Requests Found"}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] max-w-sm mb-4">
            {filter === "pending"
              ? "When visitors or clients select a slot on your booking link, their meeting request will appear here for you to approve."
              : "No requests match the selected filter."}
          </p>
          <Button asChild size="sm" className="bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]">
            <a href="/book/meeting" target="_blank">
              Send Test Meeting Request &rarr;
            </a>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredList.map((booking) => {
            const isPending = booking.status === "pending"
            const isConfirmed = booking.status === "confirmed"
            const isCancelled = booking.status === "cancelled"
            const startDate = new Date(booking.start_time)

            return (
              <div
                key={booking.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm hover:shadow transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base text-[var(--color-text)]">
                      {booking.invitee_name}
                    </span>
                    {isPending && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 gap-1 text-xs">
                        <AlertCircle className="h-3 w-3" /> Needs Approval
                      </Badge>
                    )}
                    {isConfirmed && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" /> Approved
                      </Badge>
                    )}
                    {isCancelled && (
                      <Badge variant="outline" className="bg-red-50 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 text-xs">
                        Declined
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      <a href={`mailto:${booking.invitee_email}`} className="hover:underline text-[var(--color-primary)]">
                        {booking.invitee_email}
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium text-[var(--color-text)]">
                      <Calendar className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                      {startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} ({booking.invitee_timezone})
                    </div>
                  </div>

                  {booking.invitee_notes && (
                    <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-muted)] p-2 rounded">
                      <strong>Note:</strong> {booking.invitee_notes}
                    </p>
                  )}
                </div>

                {/* Action Buttons for Owner */}
                <div className="flex items-center gap-2 shrink-0">
                  {isPending ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(booking.id, "confirmed", false)}
                        disabled={processingId === booking.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs h-9"
                      >
                        {processingId === booking.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(booking.id, "confirmed", true, booking)}
                        disabled={processingId === booking.id}
                        className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 gap-1 text-xs h-9"
                        title="Approve and open Gmail to email the invitee"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Approve & Gmail
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdateStatus(booking.id, "cancelled", false)}
                        disabled={processingId === booking.id}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950 text-xs h-9"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Decline
                      </Button>
                    </>
                  ) : isConfirmed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const subject = encodeURIComponent(`Meeting: ${booking.booking_links?.title || "Meeting"}`)
                        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(booking.invitee_email)}&su=${subject}`
                        window.open(gmailUrl, "_blank")
                      }}
                      className="gap-1.5 text-xs h-8"
                    >
                      <Mail className="h-3 w-3" /> Email Client
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
