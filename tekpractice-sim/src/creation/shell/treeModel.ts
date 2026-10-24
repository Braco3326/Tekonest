/**
 * The « Projet » tree model (Task 9, C10: the tree is the keyboard path to
 * every object). Pure: builds the nodes from the design and implements the
 * WAI-ARIA tree keys (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/).
 * Layout inspired by pro acoustic-design tools: Lieu → Zones → Matériel →
 * Câbles → Points d'écoute.
 */
import type { DesignState } from '../../trials/trial'
import { cableKey } from '../sceneDiff'
import { COPY } from '../copy'

export type TreeNodeKind = 'lieu' | 'zones' | 'zone' | 'materiel' | 'device' | 'cables' | 'cable' | 'ecoute' | 'point'

export interface TreeNode {
  id: string
  kind: TreeNodeKind
  label: string
  children?: TreeNode[]
  target?: { instanceId?: string; cableKey?: string; zoneId?: string; pointId?: string }
  hideable: boolean
  /** A group with nothing in it yet says so (shown under the row, and its description). */
  emptyHint?: string
}

export interface TreeInput {
  placeLabel: string
  zones: { id: string; kind: string }[]
  design: DesignState
  deviceLabel(deviceId: string): string
  points: { id: string; label: string }[]
  /** French port name when the catalog has one; the port id otherwise. */
  portLabel?(deviceId: string, portId: string): string | undefined
}

const T = (): Readonly<Record<string, string>> => COPY.tree!

/** Zones named in French by kind (never the room file's raw id); a repeated kind is numbered: « Public », « Public 2 ». */
function zoneNodes(zones: { id: string; kind: string }[]): TreeNode[] {
  const seen = new Map<string, number>()
  return zones.map((z) => {
    const name = COPY.zoneKind?.[z.kind] ?? T().zone!
    const n = (seen.get(name) ?? 0) + 1
    seen.set(name, n)
    return { id: `zone:${z.id}`, kind: 'zone', label: n > 1 ? `${name} ${n}` : name, target: { zoneId: z.id }, hideable: true }
  })
}

export function buildTree(input: TreeInput): TreeNode[] {
  const { design } = input
  const deviceOf = new Map(design.rig.instances.map((i) => [i.instanceId, i.deviceId]))
  const port = (instance: string, portId: string): string => {
    const d = deviceOf.get(instance)
    return `${instance} ${(d && input.portLabel?.(d, portId)) || portId}`
  }
  return [
    {
      id: 'lieu',
      kind: 'lieu',
      label: T().place!.replace('{place}', input.placeLabel || T().noPlace!),
      hideable: false,
    },
    {
      id: 'zones',
      kind: 'zones',
      label: T().zones!,
      hideable: false,
      children: zoneNodes(input.zones),
    },
    {
      id: 'materiel',
      kind: 'materiel',
      label: T().gear!,
      hideable: false,
      ...(design.rig.instances.length ? {} : { emptyHint: T().noGear! }),
      children: design.rig.instances.map((i) => ({
        id: `device:${i.instanceId}`,
        kind: 'device',
        label: `${input.deviceLabel(i.deviceId)} (${i.instanceId})`,
        target: { instanceId: i.instanceId },
        hideable: true,
      })),
    },
    {
      id: 'cables',
      kind: 'cables',
      label: T().cables!,
      hideable: false,
      children: design.rig.connections.map(({ a, b }) => {
        const key = cableKey(a, b)
        return { id: `cable:${key}`, kind: 'cable', label: `${port(a.instance, a.port)} → ${port(b.instance, b.port)}`, target: { cableKey: key }, hideable: true }
      }),
    },
    {
      id: 'ecoute',
      kind: 'ecoute',
      label: T().points!,
      hideable: false,
      children: input.points.map((p) => ({ id: `point:${p.id}`, kind: 'point', label: p.label, target: { pointId: p.id }, hideable: false })),
    },
  ]
}

/** The `viewState.hidden` key of a node: a device by its instance id, a zone / cable by its node id; null when not hideable. */
export function hideKeyOf(node: TreeNode): string | null {
  if (!node.hideable) return null
  return node.kind === 'device' ? node.target!.instanceId! : node.id
}

const hasChildren = (n: TreeNode): boolean => !!n.children && n.children.length > 0

/** Visible rows in roving (document) order: roots, and the children of expanded nodes. */
export function flattenVisible(nodes: TreeNode[], expanded: ReadonlySet<string>): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (list: TreeNode[]): void => {
    for (const n of list) {
      out.push(n)
      if (hasChildren(n) && expanded.has(n.id)) walk(n.children!)
    }
  }
  walk(nodes)
  return out
}

/** The parent of `id`, or null for a root. */
export function parentOf(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.children?.some((c) => c.id === id)) return n
    const deeper = n.children ? parentOf(n.children, id) : null
    if (deeper) return deeper
  }
  return null
}

export type TreeKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End'

/** One WAI-ARIA tree key: the next focused row and expanded set (the input set is never mutated). */
export function treeKey(state: { focused: string; expanded: Set<string> }, key: TreeKey, nodes: TreeNode[]): { focused: string; expanded: Set<string> } {
  const expanded = new Set(state.expanded)
  const rows = flattenVisible(nodes, expanded)
  if (!rows.length) return { focused: state.focused, expanded }
  const i = rows.findIndex((n) => n.id === state.focused)
  if (i < 0) return { focused: rows[0].id, expanded }
  const node = rows[i]
  switch (key) {
    case 'ArrowDown':
      return { focused: rows[Math.min(rows.length - 1, i + 1)].id, expanded }
    case 'ArrowUp':
      return { focused: rows[Math.max(0, i - 1)].id, expanded }
    case 'Home':
      return { focused: rows[0].id, expanded }
    case 'End':
      return { focused: rows[rows.length - 1].id, expanded }
    case 'ArrowRight':
      if (!hasChildren(node)) return { focused: node.id, expanded }
      if (!expanded.has(node.id)) {
        expanded.add(node.id)
        return { focused: node.id, expanded }
      }
      return { focused: node.children![0].id, expanded }
    case 'ArrowLeft':
      if (hasChildren(node) && expanded.has(node.id)) {
        expanded.delete(node.id)
        return { focused: node.id, expanded }
      }
      return { focused: parentOf(nodes, node.id)?.id ?? node.id, expanded }
  }
}
