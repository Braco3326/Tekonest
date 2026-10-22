/**
 * Runtime schema for content/rooms/*.json (synced from knowledge-base/tek-brain/rooms
 * by tools/sync-rooms.ts). zod fail-fast with a JSON path, like the catalog.
 */
import { z } from 'zod'

const Range = z.object({ min: z.number(), typical: z.number().positive(), max: z.number() })

export const RoomFile = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name_fr: z.string(),
  name_en: z.string().optional(),
  family: z.string().optional(),
  size: z.enum(['small', 'medium', 'large']).optional(),
  review: z.string().optional(),
  dimensions_m: z.object({ length: Range, width: Range, height: Range }),
  zones: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      rect_m: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      floor_y_m: z.number().optional(),
    }),
  ),
  openings: z.array(
    z.object({
      wall: z.enum(['front', 'rear', 'left', 'right']),
      kind: z.string(),
      offset_m: z.number(),
      width_m: z.number().positive(),
      height_m: z.number().positive(),
    }),
  ),
  procedural: z.object({
    wall_color: z.string(),
    floor_color: z.string(),
    ceiling_color: z.string(),
    prop_hints: z.array(z.string()),
  }),
  lighting: z.object({ mood: z.string(), color_temp_k: z.number() }),
  source_count: z.number().int().nonnegative().optional(),
})
export type RoomFileT = z.infer<typeof RoomFile>

export const RoomIndex = z.object({
  rooms: z.array(z.object({ id: z.string(), name_fr: z.string(), family: z.string(), size: z.string() })),
})
