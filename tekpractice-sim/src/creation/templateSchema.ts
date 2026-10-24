/**
 * A Mode Création template (C15/L3): a whole rig + placements in a place, as
 * data. Pure zod; applied through `templateToDesign` (templates.ts).
 */
import { z } from 'zod'

export const PortRef = z.object({ instance: z.string(), port: z.string() })
export const PlacementSchema = z.object({
  instanceId: z.string(),
  deviceId: z.string(),
  position_m: z.tuple([z.number(), z.number(), z.number()]),
  yawDeg: z.number(),
  tiltDeg: z.number().optional(),
  mount: z.enum(['floor', 'stand', 'flown']).optional(),
})

export const Template = z.object({
  id: z.string(),
  name_fr: z.string(),
  roomId: z.string(),
  instances: z.array(z.object({ instanceId: z.string(), deviceId: z.string() })),
  connections: z.array(z.object({ a: PortRef, b: PortRef })),
  controls: z.record(z.record(z.union([z.boolean(), z.string()]))),
  placements: z.array(PlacementSchema),
})
export type TemplateT = z.infer<typeof Template>
