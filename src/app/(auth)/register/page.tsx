"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { AlertCircle, CheckCircle2, Loader2, Shield } from "lucide-react"

// Purpose: Registration form enforcing approval-pending status for new accounts
// Why: Master Prompt V3 requires approval by Owner 1 or Owner 2 prior to workspace access

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            status: "pending_approval",
          },
        },
      })

      if (signUpError) {
        throw signUpError
      }

      if (data.user) {
        // Automatically route to approval pending screen per Master Prompt V3
        router.push("/approval-pending")
      } else {
        setSuccess("Registration submitted! Please verify your email to notify owners for approval.")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">Create an account</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Register to request an isolated scheduling tenant workspace
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-text-muted)] flex items-center gap-2">
        <Shield className="h-4 w-4 text-[#147D52] flex-shrink-0" />
        <span>Controlled registration: Accounts are activated upon review by a platform owner.</span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleRegister}>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-[var(--color-text)]">Email</label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-[var(--color-text)]">Password</label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </div>
        <Button className="w-full bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]" type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {loading ? "Submitting Registration..." : "Request Workspace Access"}
        </Button>
      </form>
      <div className="text-center text-sm text-[var(--color-text-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--color-primary)] hover:underline font-medium">
          Sign In
        </Link>
      </div>
    </div>
  )
}
