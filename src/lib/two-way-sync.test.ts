import { describe, it, expect, vi } from "vitest"
import { syncGoogleToZoho, syncZohoToGoogle, syncZohoTaskToGoogle } from "./calendar/two-way-sync"

// Purpose: Unit test for Two-Way Synchronization and loop avoidance
// Why: Validates Master Prompt V3 Sections 7 & 11

vi.mock("@/lib/supabase/admin", () => {
  const store = new Map<string, unknown>()
  return {
    createAdminClient: () => ({
      from: (table: string) => ({
        select: () => ({
          eq: (_f1: string, v1: string) => ({
            eq: (_f2: string, v2: string) => ({
              single: async () => {
                const key = `${table}:${v1}:${v2}`
                return { data: store.get(key) || null, error: null }
              },
            }),
          }),
        }),
        upsert: async (record: { user_id: string; google_event_id?: string; zoho_event_id?: string; zoho_task_id?: string }) => {
          const key = record.google_event_id
            ? `${table}:${record.user_id}:${record.google_event_id}`
            : `${table}:${record.user_id}:${record.zoho_task_id || record.zoho_event_id}`
          store.set(key, record)
          return { data: record, error: null }
        },
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
        insert: async () => ({ error: null }),
      }),
    }),
  }
})

describe("Two-Way Synchronization Engine", () => {
  const userId = "test-user-123"

  it("mirrors a Google Calendar event to Zoho without duplicate creation", async () => {
    const event = {
      id: "g-event-1",
      title: "Quarterly Review",
      startTime: "2026-11-10T10:00:00Z",
      endTime: "2026-11-10T11:00:00Z",
    }

    const firstSync = await syncGoogleToZoho(userId, event, "create")
    expect(firstSync.success).toBe(true)
    expect(firstSync.action).toBe("created")
    expect(firstSync.zoho_event_id).toBe("zoho-mirrored-g-event-1")

    const loopCheck = await syncGoogleToZoho(userId, event, "update")
    expect(loopCheck.success).toBe(true)
    expect(loopCheck.action).toBe("skipped_identical")
  })

  it("mirrors a Zoho Calendar event to Google without loops", async () => {
    const event = {
      id: "z-event-1",
      title: "Board Meeting",
      startTime: "2026-11-15T14:00:00Z",
      endTime: "2026-11-15T15:00:00Z",
    }

    const firstSync = await syncZohoToGoogle(userId, event, "create")
    expect(firstSync.success).toBe(true)
    expect(firstSync.google_event_id).toBe("google-mirrored-z-event-1")
  })

  it("synchronizes Zoho tasks to Google events cleanly", async () => {
    const task = {
      id: "z-task-1",
      title: "Review Financial Statements",
      dueDate: "2026-11-12",
      dueTime: "14:00",
      durationMinutes: 45,
    }

    const taskSync = await syncZohoTaskToGoogle(userId, task, "create")
    expect(taskSync.success).toBe(true)
    expect(taskSync.google_event_id).toBe("google-task-z-task-1")
  })
})
