import { NextResponse } from "next/server"

// Purpose: OpenAPI 3.0 Specification endpoint for external developer integrations
// Why: Master Prompt V3 Section 12 Public API documentation requirement

export async function GET() {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "EG-Calendar Public Scheduling API",
      version: "3.0.0",
      description: "Enterprise multi-tenant scheduling, availability queries, and webhook subscriptions.",
    },
    servers: [
      { url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/v1`, description: "Active Server" },
      { url: "http://localhost:3000/api/v1", description: "Local Development Server" },
    ],
    paths: {
      "/public/slots": {
        get: {
          summary: "Query Available Booking Slots",
          parameters: [
            { name: "slug", in: "query", required: true, schema: { type: "string" } },
            { name: "date", in: "query", required: false, schema: { type: "string", format: "date" } },
          ],
          responses: {
            200: { description: "List of available ISO 8601 timestamps" },
            410: { description: "Link expired or revoked" },
          },
        },
      },
      "/public/book": {
        post: {
          summary: "Create a Booking",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["slug", "slot", "invitee_name", "invitee_email"],
                  properties: {
                    slug: { type: "string" },
                    slot: { type: "string", format: "date-time" },
                    invitee_name: { type: "string" },
                    invitee_email: { type: "string", format: "email" },
                    idempotency_key: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Booking created successfully" },
            409: { description: "Concurrency collision: slot already booked" },
          },
        },
      },
    },
  }

  return NextResponse.json(spec)
}

