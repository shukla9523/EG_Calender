"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { AlertCircle, Loader2 } from "lucide-react"

// Purpose: Login page with approval status validation & separate Google sign-in
// Why: Master Prompt V3 requires approval check and clean separation of login vs calendar scopes

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        throw signInError
      }

      if (data?.user) {
        // Check user profile status
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("status")
          .eq("id", data.user.id)
          .single()

        if (profile?.status === "pending_approval") {
          router.push("/approval-pending")
          return
        }

        if (profile?.status === "suspended" || profile?.status === "rejected" || profile?.status === "disabled") {
          await supabase.auth.signOut()
          setError(`Account is ${profile.status}. Access is restricted by platform owners.`)
          return
        }

        // Check if user is an owner, direct to platform-admin or calendar
        const { data: owner } = await supabase
          .from("owner_accounts")
          .select("owner_number")
          .eq("id", data.user.id)
          .single()

        if (owner) {
          router.push("/platform-admin/users")
        } else {
          router.push("/calendar")
        }
        router.refresh()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid login credentials"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">Sign in to your account</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Access your live EG-Calendar scheduling workspace</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Continue with Google */}
      <Button asChild variant="outline" className="w-full h-10 border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] flex items-center justify-center gap-2">
        <a href="/api/auth/google">
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span className="text-sm font-medium text-[var(--color-text)]">Sign In with Google</span>
        </a>
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[var(--color-border)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[var(--color-surface)] px-2 text-[var(--color-text-muted)]">Or continue with email</span>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleLogin}>
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
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-[var(--color-text)]">Password</label>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <Button className="w-full bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]" type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {loading ? "Signing In..." : "Sign In"}
        </Button>
      </form>

      <div className="text-center text-sm text-[var(--color-text-muted)]">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-[var(--color-primary)] hover:underline font-medium">
          Create one
        </Link>
      </div>
    </div>
  )
}
