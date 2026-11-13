import Link from "next/link"
import { Clock, ShieldCheck, ArrowLeft } from "lucide-react"

// Purpose: Landing screen for new registrations awaiting platform Owner approval
// Why: Master Prompt V3 requires controlled SaaS onboarding where Owners approve accounts

export default function ApprovalPendingPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <Clock className="h-7 w-7" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
          Registration Pending Approval
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
          Your account has been registered successfully. To protect workspace privacy, access is subject to approval by an authorized Platform Owner.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left text-xs text-[var(--color-text-muted)] space-y-2">
        <div className="flex items-center gap-2 font-medium text-[var(--color-text)]">
          <ShieldCheck className="h-4 w-4 text-[#147D52]" />
          Platform Governance Rules
        </div>
        <p>• Both Owner 1 and Owner 2 have been notified of your registration request.</p>
        <p>• Once approved, you will receive full access to your isolated tenant calendar workspace.</p>
        <p>• If you believe this is in error, contact your enterprise organization administrator.</p>
      </div>

      <div className="pt-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#147D52] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Sign In
        </Link>
      </div>
    </div>
  )
}

