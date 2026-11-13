"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Check, Unplug, Calendar, ShieldCheck, AlertCircle, Loader2, RefreshCw } from "lucide-react"

interface ConnectionRecord {
  id: string
  provider: "google" | "zoho"
  provider_email: string
  status: string
  last_sync_at: string | null
}

function IntegrationsContent() {
  const searchParams = useSearchParams()
  const [googleConn, setGoogleConn] = React.useState<ConnectionRecord | null>(null)
  const [zohoConn, setZohoConn] = React.useState<ConnectionRecord | null>(null)
  const [zohoRegion, setZohoRegion] = React.useState<string>("in")
  const [loading, setLoading] = React.useState(true)
  const [syncing, setSyncing] = React.useState(false)
  const [syncSuccess, setSyncSuccess] = React.useState<string | null>(null)

  const fetchConnections = React.useCallback(async () => {
    try {
      const res = await fetch("/api/integrations")
      const data = await res.json()
      if (Array.isArray(data.connections)) {
        const g = data.connections.find((c: ConnectionRecord) => c.provider === "google")
        const z = data.connections.find((c: ConnectionRecord) => c.provider === "zoho")
        setGoogleConn(g || null)
        setZohoConn(z || null)
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchConnections()
  }, [fetchConnections, searchParams])

  const handleDisconnect = async (provider: "google" | "zoho") => {
    setLoading(true)
    try {
      await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      })
      if (provider === "google") setGoogleConn(null)
      if (provider === "zoho") setZohoConn(null)
    } catch {
      // Fallback
    } finally {
      setLoading(false)
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    setSyncSuccess(null)
    try {
      const res = await fetch("/api/integrations/sync", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setSyncSuccess(`Synchronized ${data.connections_synced} provider(s) at ${new Date().toLocaleTimeString()}`)
        fetchConnections()
        setTimeout(() => setSyncSuccess(null), 4000)
      }
    } catch {
      // Fallback
    } finally {
      setSyncing(false)
    }
  }

  const lastSyncDisplay = googleConn?.last_sync_at || zohoConn?.last_sync_at

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">Calendar Integrations</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Connect independent Google and Zoho accounts for conflict-free availability and two-way sync.
          </p>
        </div>

        {(googleConn || zohoConn) && (
          <div className="flex items-center gap-3">
            {lastSyncDisplay && (
              <span className="text-xs text-[var(--color-text-muted)]">
                Last synced: {new Date(lastSyncDisplay).toLocaleTimeString()}
              </span>
            )}
            <Button
              onClick={handleSyncNow}
              disabled={syncing}
              size="sm"
              variant="outline"
              className="text-xs border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin text-[var(--color-primary)]" : ""}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          </div>
        )}
      </div>

      {syncSuccess && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{syncSuccess}</span>
        </div>
      )}

      {searchParams.get("status") && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>Calendar account successfully linked with Supabase!</span>
        </div>
      )}

      {searchParams.get("error") && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <span>OAuth notification: {searchParams.get("error")}. Please try connecting again.</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Google Calendar Provider Card */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                  G
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[var(--color-text)]">Google Calendar</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {googleConn ? googleConn.provider_email : "Sync Google events and availability"}
                  </p>
                </div>
              </div>
              {googleConn ? (
                <Badge variant="success" className="gap-1 bg-emerald-100 text-emerald-800 border-emerald-200">
                  <Check className="h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-[var(--color-text-muted)]">Not connected</Badge>
              )}
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              {googleConn
                ? `Account connected and verified. Busy blocks merged for conflict detection.`
                : `Connect Google Calendar to evaluate busy intervals and schedule confirmed meetings.`}
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
            {googleConn ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDisconnect("google")}
                  disabled={loading}
                  className="text-red-600 hover:bg-red-50 text-xs"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unplug className="h-4 w-4 mr-2" />}
                  Disconnect
                </Button>
                <Button size="sm" asChild variant="outline" className="text-xs">
                  <a href="/calendar"><Calendar className="h-3.5 w-3.5 mr-1.5" /> View Calendar</a>
                </Button>
              </>
            ) : (
              <Button size="sm" asChild className="w-full bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] text-xs">
                <a href="/api/integrations/google/connect"><Plus className="h-4 w-4 mr-1.5" /> Connect Google Calendar</a>
              </Button>
            )}
          </div>
        </div>

        {/* Zoho Calendar Provider Card */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg">
                  Z
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[var(--color-text)]">Zoho Calendar & Tasks</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {zohoConn ? zohoConn.provider_email : "Connect Zoho Mail, Calendar & Tasks"}
                  </p>
                </div>
              </div>
              {zohoConn ? (
                <Badge variant="success" className="gap-1 bg-emerald-100 text-emerald-800 border-emerald-200">
                  <Check className="h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-[var(--color-text-muted)]">Not connected</Badge>
              )}
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              {zohoConn
                ? `Zoho account active. Two-way synchronization and task mappings running.`
                : `Connect Zoho to mirror events, sync Zoho Tasks to Google, and block busy intervals.`}
            </p>

            {!zohoConn && (
              <div className="mb-4 space-y-1">
                <label className="text-xs font-medium text-[var(--color-text-muted)]">Select Zoho Datacenter Region</label>
                <Select value={zohoRegion} onValueChange={setZohoRegion}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">India (accounts.zoho.in)</SelectItem>
                    <SelectItem value="com">US / Global (accounts.zoho.com)</SelectItem>
                    <SelectItem value="eu">Europe (accounts.zoho.eu)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
            {zohoConn ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDisconnect("zoho")}
                  disabled={loading}
                  className="text-red-600 hover:bg-red-50 text-xs"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unplug className="h-4 w-4 mr-2" />}
                  Disconnect
                </Button>
                <Button size="sm" asChild variant="outline" className="text-xs">
                  <a href="/calendar"><Calendar className="h-3.5 w-3.5 mr-1.5" /> View Calendar</a>
                </Button>
              </>
            ) : (
              <Button size="sm" asChild variant="outline" className="w-full text-xs">
                <a href={`/api/integrations/zoho/connect?region=${zohoRegion}`}>
                  <Plus className="h-4 w-4 mr-1.5" /> Connect Zoho Calendar
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm text-[var(--color-text-muted)]">Loading integrations...</div>}>
      <IntegrationsContent />
    </React.Suspense>
  )
}
