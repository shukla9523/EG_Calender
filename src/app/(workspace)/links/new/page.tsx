"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Check, Loader2, AlertCircle, Clock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function NewLinkBuilderPage() {
  const router = useRouter()
  const [title, setTitle] = React.useState("Technical Interview")
  const [slug, setSlug] = React.useState("tech-interview-45")
  const [duration, setDuration] = React.useState("45")
  const [buffer, setBuffer] = React.useState("15")
  const [expirationType, setExpirationType] = React.useState("never")
  const [customExpiresAt, setCustomExpiresAt] = React.useState("")
  const [selectedProfileId, setSelectedProfileId] = React.useState<string>("none")
  const [profiles, setProfiles] = React.useState<any[]>([])
  const [host, setHost] = React.useState("")
  const [published, setPublished] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (typeof window !== "undefined") setHost(window.location.host)
    fetch("/api/profiles")
      .then((res) => res.json())
      .then((data) => {
        if (data.profiles) setProfiles(data.profiles)
      })
      .catch(() => {})
  }, [])

  const handlePublish = async () => {
    setLoading(true)
    setError(null)

    try {
      const payload: any = {
        title,
        slug,
        duration_minutes: parseInt(duration, 10),
        buffer_after_minutes: parseInt(buffer, 10),
        expiration_type: expirationType,
        scheduling_profile_id: selectedProfileId !== "none" ? selectedProfileId : null,
      }

      if (expirationType === "custom" && customExpiresAt) {
        payload.custom_expires_at = new Date(customExpiresAt).toISOString()
      }

      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to create booking link in Supabase")
      }

      setPublished(true)
      setTimeout(() => {
        router.push("/links")
      }, 1000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating link")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/links">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">Create Booking Link</h2>
          <p className="text-xs text-[var(--color-text-muted)]">Saved directly into live Supabase database with universal expiration</p>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4 shadow-xs">
          <h3 className="font-semibold text-base border-b border-[var(--color-border)] pb-2 text-[var(--color-text)]">Link Details</h3>
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 45 Minute Interview"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">URL Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-muted)] text-xs bg-[var(--color-surface-muted)] px-3 py-2 rounded-md border border-[var(--color-border)]">
                {host ? `${host}/book/` : "/book/"}
              </span>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="tech-interview-45"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4 shadow-xs">
          <h3 className="font-semibold text-base border-b border-[var(--color-border)] pb-2 text-[var(--color-text)]">Scheduling Profile & Rules</h3>
          
          {profiles.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">Attach Dynamic Scheduling Profile</label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Standard Working Hours Profile</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.profile_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">Duration</label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
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
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">Buffer After</label>
              <Select value={buffer} onValueChange={setBuffer}>
                <SelectTrigger>
                  <SelectValue placeholder="Buffer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No buffer</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2">
            <Clock className="h-4 w-4 text-[var(--color-primary)]" />
            <h3 className="font-semibold text-base text-[var(--color-text)]">Universal Link Expiration</h3>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Prevent stale links from being booked. Expired links immediately return HTTP 410 Gone.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {[
              { id: "never", label: "Never" },
              { id: "1h", label: "1 Hour" },
              { id: "24h", label: "24 Hours" },
              { id: "7d", label: "7 Days" },
              { id: "30d", label: "30 Days" },
              { id: "custom", label: "Custom Date" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setExpirationType(opt.id)}
                className={`py-2 px-3 text-xs font-medium rounded-md border text-center transition-colors ${
                  expirationType === opt.id
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs"
                    : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {expirationType === "custom" && (
            <div className="space-y-2 pt-2">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">Custom Expiration Date & Time</label>
              <Input
                type="datetime-local"
                value={customExpiresAt}
                onChange={(e) => setCustomExpiresAt(e.target.value)}
                className="w-full text-xs"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
          <Button variant="outline" asChild>
            <Link href="/links">Cancel</Link>
          </Button>
          <Button
            onClick={handlePublish}
            disabled={loading}
            className="bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {published ? <Check className="h-4 w-4 mr-2" /> : null}
            {published ? "Saved in Supabase!" : "Publish to Supabase"}
          </Button>
        </div>
      </div>
    </div>
  )
}
