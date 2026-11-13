import type { MetadataRoute } from "next"

// Purpose: Dynamic robots.txt per SOP P12 (staging noindex / production indexable)
// Why: Production allows public booking & landing routes; staging/preview disallows all

export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"

  if (!isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    }
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/book/", "/login", "/register", "/approval-pending"],
      disallow: [
        "/api/",
        "/platform-admin/",
        "/calendar",
        "/availability",
        "/integrations",
        "/links",
        "/team",
        "/settings",
        "/requests",
      ],
    },
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/sitemap.xml`,
  }
}

