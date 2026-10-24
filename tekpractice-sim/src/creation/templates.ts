/** Templates from content/templates/*.json (lazy chunks), and their DesignState. */
import type { DesignState } from '../trials/trial'
import { Template, type TemplateT } from './templateSchema'

const loaders = import.meta.glob<{ default: unknown }>('../../content/templates/*.json')

/** Every valid template; an invalid file is skipped with a warning. */
export async function loadTemplates(): Promise<TemplateT[]> {
  const out: TemplateT[] = []
  for (const [path, load] of Object.entries(loaders).sort(([a], [b]) => a.localeCompare(b))) {
    const parsed = Template.safeParse((await load()).default)
    if (parsed.success) out.push(parsed.data)
    else console.warn(`[creation] modèle ${path} invalide`, parsed.error.issues[0]?.message)
  }
  return out
}

export function templateToDesign(t: TemplateT): DesignState {
  return {
    roomId: t.roomId,
    rig: {
      instances: t.instances.map((i) => ({ ...i })),
      connections: t.connections.map((c) => ({ a: { ...c.a }, b: { ...c.b } })),
      controls: Object.fromEntries(Object.entries(t.controls).map(([k, v]) => [k, { ...v }])),
    },
    placements: t.placements.map((p) => ({ ...p, position_m: [p.position_m[0], p.position_m[1], p.position_m[2]] })),
  }
}
