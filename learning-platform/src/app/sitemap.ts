import type { MetadataRoute } from "next";
import { COURSES } from "@/data/courses";
import { ANNALES, annaleSlug } from "@/data/annales";

const BASE = "https://teknest.fr";

export default function sitemap(): MetadataRoute.Sitemap {
  const statics = ["", "/cours", "/tuteur", "/annales", "/a-propos", "/inscription", "/connexion", "/verification"].map(
    (p) => ({
      url: `${BASE}${p}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : 0.8,
    })
  );
  const courses = COURSES.map((c) => ({
    url: `${BASE}/cours/${c.slug}`,
    changeFrequency: "weekly" as const,
    priority: c.status === "available" ? 0.9 : 0.5,
  }));
  const units = COURSES.flatMap((c) =>
    c.units.map((u) => ({
      url: `${BASE}/cours/${c.slug}/unite/${u.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }))
  );
  const annales = ANNALES.map((a) => ({
    url: `${BASE}/annales/${annaleSlug(a)}`,
    changeFrequency: "yearly" as const,
    priority: a.official ? 0.7 : 0.4,
  }));
  return [...statics, ...courses, ...units, ...annales];
}
