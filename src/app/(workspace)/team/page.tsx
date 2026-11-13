"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UserPlus, MoreHorizontal, UserCheck, Shield, Loader2 } from "lucide-react"

export default function TeamManagementPage() {
  const [members, setMembers] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch("/api/team")
      .then((res) => res.json())
      .then((data) => {
        if (data.members) {
          setMembers(data.members)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">Team Members</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Live Supabase organization members and permissions.
          </p>
        </div>
        <Button className="gap-2 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]">
          <UserPlus className="h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-[var(--color-text-muted)] flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
          Loading Supabase team members...
        </div>
      ) : (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length > 0 ? (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center font-bold text-xs uppercase">
                          {member.email.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-[var(--color-text)]">{member.email}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{member.organization} • {member.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 capitalize">
                        <Shield className="h-3 w-3" /> {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <UserCheck className="h-3 w-3" /> Active in Supabase
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-[var(--color-text-muted)]">
                    <div>No team members found in Supabase.</div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
