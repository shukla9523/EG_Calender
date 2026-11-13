"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react"

// Purpose: Centralized Owner Administration user list & approval interface
// Why: Enables Owner 1 and Owner 2 to approve registrations while protecting owner accounts

interface UserRecord {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  status: "pending_approval" | "approved" | "rejected" | "suspended" | "disabled"
  is_protected_owner: boolean
  owner_number: number | null
  created_at: string
}

export default function PlatformUsersPage() {
  const [users, setUsers] = React.useState<UserRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionId, setActionId] = React.useState<string | null>(null)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const fetchUsers = React.useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch("/api/owner/users")
      const result = await res.json()
      if (result.success && Array.isArray(result.data)) {
        setUsers(result.data)
      } else {
        setUsers([])
        if (result.error?.message) {
          setErrorMsg(result.error.message)
        }
      }
    } catch {
      setErrorMsg("Failed to load user list. Please verify owner credentials.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleStatusChange = async (userId: string, newStatus: string) => {
    setActionId(userId)
    try {
      const res = await fetch("/api/owner/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: newStatus }),
      })
      const result = await res.json()
      if (result.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: newStatus as UserRecord["status"] } : u))
        )
      } else {
        alert(result.error?.message || "Operation failed")
      }
    } catch {
      alert("Network error updating user status")
    } finally {
      setActionId(null)
    }
  }

  const getStatusBadge = (user: UserRecord) => {
    if (user.is_protected_owner) {
      return (
        <Badge className="bg-[#147D52] text-white gap-1">
          <ShieldCheck className="h-3 w-3" /> Owner {user.owner_number} (Protected)
        </Badge>
      )
    }
    switch (user.status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Approved</Badge>
      case "pending_approval":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300">Pending Approval</Badge>
      case "suspended":
        return <Badge className="bg-red-100 text-red-800 border-red-300">Suspended</Badge>
      case "rejected":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Rejected</Badge>
      default:
        return <Badge variant="outline">{user.status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Owner User Administration
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Review registration requests, approve tenant accounts, and enforce platform governance.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="gap-2 self-start">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User / Email</TableHead>
              <TableHead>Governance Status</TableHead>
              <TableHead>Registration Date</TableHead>
              <TableHead className="text-right">Administrative Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-[var(--color-text-muted)]">
                  Loading user records...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-[var(--color-text-muted)]">
                  No registered accounts found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="hover:bg-[var(--color-surface-muted)] transition-colors">
                  <TableCell>
                    <div className="font-medium text-[var(--color-text)]">{user.email}</div>
                    {(user.first_name || user.last_name) && (
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {[user.first_name, user.last_name].filter(Boolean).join(" ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(user)}</TableCell>
                  <TableCell className="text-sm text-[var(--color-text-muted)]">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.is_protected_owner ? (
                      <span className="text-xs text-[var(--color-text-muted)] italic">
                        Account protected by DB rules
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        {user.status === "pending_approval" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-[#147D52] hover:bg-[#106744] text-white h-8 gap-1"
                              disabled={actionId === user.id}
                              onClick={() => handleStatusChange(user.id, "approved")}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50 h-8 gap-1"
                              disabled={actionId === user.id}
                              onClick={() => handleStatusChange(user.id, "rejected")}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </>
                        )}
                        {user.status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-700 hover:bg-amber-50 h-8 text-xs"
                            disabled={actionId === user.id}
                            onClick={() => handleStatusChange(user.id, "suspended")}
                          >
                            Suspend
                          </Button>
                        )}
                        {user.status === "suspended" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-700 hover:bg-emerald-50 h-8 text-xs"
                            disabled={actionId === user.id}
                            onClick={() => handleStatusChange(user.id, "approved")}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
