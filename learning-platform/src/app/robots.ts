import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private/user-specific surfaces — nothing indexable there.
      disallow: ["/profil", "/certificats", "/api/"],
    },
    sitemap: "https://teknest.fr/sitemap.xml",
  };
}
