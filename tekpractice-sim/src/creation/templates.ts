/** Templates from content/templates/*.json (lazy chunks), and their DesignState. */
import type { DesignState } from '../trials/trial'
import { Template, type TemplateT } from './templateSchema'

const loaders = import.meta.glob<{ default: unknown }>('../../content/templates/*.json')

/**
 * A template, or null (warned with the zod JSON path) when it is invalid or,
 * given `placeKeys` (the picker's place cards), when its roomId is not a place.
 */
export function parseTemplate(raw: unknown, file: string, placeKeys?: ReadonlySet<string>): TemplateT | null {
  const parsed = Template.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    console.warn(`[creation] modèle ${file} invalide à ${issue?.path.join('.') || '(racine)'} : ${issue?.message}`)
    return null
  }
  if (placeKeys && !placeKeys.has(parsed.data.roomId)) {
    console.warn(`[creation] modèle ${file} ignoré : lieu inconnu ${parsed.data.roomId}`)
    return null
  }
  return parsed.data
}

/** Every valid template (see `parseTemplate`); an invalid file is skipped with a warning. */
export async function loadTemplates(placeKeys?: ReadonlySet<string>): Promise<TemplateT[]> {
  const out: TemplateT[] = []
  for (const [path, load] of Object.entries(loaders).sort(([a], [b]) => a.localeCompare(b))) {
    const t = parseTemplate((await load()).default, path, placeKeys)
    if (t) out.push(t)
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
