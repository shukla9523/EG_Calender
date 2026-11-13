"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function PlatformOrganizationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">Platform Organizations</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Manage tenant workspaces and active subscriptions.
        </p>
      </div>

      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>System</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-semibold text-[var(--color-text)]">EG-Calendar</TableCell>
              <TableCell className="text-[var(--color-text-muted)] font-mono text-xs">eg-calendar</TableCell>
              <TableCell>Pro</TableCell>
              <TableCell>
                <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                  Active
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-[var(--color-text-muted)]">Primary Tenant</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
