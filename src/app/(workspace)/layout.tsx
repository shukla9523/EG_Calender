"use client"

import * as React from "react"
import { Calendar, Link2, Clock, Settings, User, Users, Inbox, Plug, LogOut, LogIn } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [userEmail, setUserEmail] = React.useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = React.useState(true)

  React.useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setUserEmail(data.user.email)
        setCheckingAuth(false)
        fetch("/api/user/me").catch(() => {})
      } else {
        window.location.href = "/login"
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email)
        setCheckingAuth(false)
        fetch("/api/user/me").catch(() => {})
      } else {
        setUserEmail(null)
        window.location.href = "/login"
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    localStorage.removeItem("google_calendar_email")
    document.cookie = "google_connected_email=; path=/; max-age=0"
    setUserEmail(null)
    window.location.href = "/login"
  }

  const navItems = [
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/links", label: "Booking Links", icon: Link2 },
    { href: "/availability", label: "Availability", icon: Clock },
    { href: "/integrations", label: "Integrations", icon: Plug },
    { href: "/team", label: "Team", icon: Users },
    { href: "/requests", label: "Meeting Requests", icon: Inbox },
    { href: "/settings", label: "Settings", icon: Settings },
  ]

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent"></div>
          <p className="text-sm font-medium text-[var(--color-text-muted)]">Verifying Supabase authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-background)]">
      {/* Sidebar */}
      <aside className="w-[248px] hidden md:flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg text-[var(--color-text)]">EG-Calendar</h1>
            <p className="text-xs text-[var(--color-text-muted)]">Unified Scheduler</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-hover)] font-medium"
                    : "text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between px-6 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-4">
            <div className="md:hidden font-bold text-[var(--color-text)]">EG-Calendar</div>
          </div>
          <div className="flex items-center gap-3">
            {userEmail ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-[var(--color-text)] bg-[var(--color-surface-muted)] px-2.5 py-1 rounded-full border border-[var(--color-border)]">
                  {userEmail}
                </span>
                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="text-xs text-[var(--color-danger)] hover:underline flex items-center gap-1"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-xs px-3 py-1.5 rounded-md bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-medium flex items-center gap-1.5"
              >
                <LogIn className="h-3.5 w-3.5" /> Sign In
              </Link>
            )}
            <div className="h-8 w-8 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center font-bold text-xs">
              {userEmail ? userEmail.slice(0, 1).toUpperCase() : <User className="h-4 w-4" />}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
