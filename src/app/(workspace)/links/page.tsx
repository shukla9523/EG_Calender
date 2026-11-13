"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Plus, Link as LinkIcon, CalendarDays, Check, Clock, Loader2 } from "lucide-react"
import Link from "next/link"

export default function LinksPage() {
  const [links, setLinks] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [origin, setOrigin] = React.useState("")

  React.useEffect(() => {
    setOrigin(window.location.origin)
    fetch("/api/links")
      .then((res) => res.json())
      .then((data) => {
        if (data.links) {
          setLinks(data.links)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleCopy = (slug: string, id: string) => {
    const fullUrl = `${origin}/book/${slug}`
    navigator.clipboard.writeText(fullUrl)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">Booking Links</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Live Supabase booking links to share your availability with clients and invitees.
          </p>
        </div>
        <Button asChild className="gap-2 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]">
          <Link href="/links/new">
            <Plus className="h-4 w-4" />
            New Link
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-[var(--color-text-muted)] flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
          Loading Supabase booking links...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <div
              key={link.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col h-full">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg text-[var(--color-text)] mb-1">{link.title}</h3>
                  <p className="text-sm text-[var(--color-primary)] font-mono">/book/{link.slug}</p>
                </div>
                <div className="space-y-2 mb-6 text-sm text-[var(--color-text-muted)]">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" /> {link.duration_minutes || 30} minutes
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> Supabase Managed
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-[var(--color-border)] pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(link.slug, link.id)}
                    className="gap-2 text-[var(--color-primary)]"
                  >
                    {copiedId === link.id ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <LinkIcon className="h-4 w-4" />
                    )}
                    {copiedId === link.id ? "Copied!" : "Copy Link"}
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/book/${link.slug}`} target="_blank">
                      Preview
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
