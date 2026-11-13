import type { MetadataRoute } from "next"
import { createAdminClient } from "@/lib/supabase/admin"

// Purpose: Auto-generated XML sitemap for public pages per SOP P12
// Why: Enables search engine indexing of landing & public booking links

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/approval-pending`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ]

  try {
    const admin = createAdminClient()
    const { data: links } = await admin
      .from("booking_links")
      .select("slug, updated_at")
      .eq("status", "published")
      .eq("is_revoked", false)
      .limit(100)

    if (links && links.length > 0) {
      const dynamicRoutes: MetadataRoute.Sitemap = links.map((link) => ({
        url: `${baseUrl}/book/${link.slug}`,
        lastModified: link.updated_at ? new Date(link.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.9,
      }))
      return [...staticRoutes, ...dynamicRoutes]
    }
  } catch {
    // Return static routes if database lookup fails
  }

  return staticRoutes
}

