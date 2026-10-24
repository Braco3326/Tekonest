/**
 * The « Projet » tree (Task 9, C10), WAI-ARIA tree pattern: one tab stop
 * (roving tabindex), ↑ ↓ ← → Home End (treeModel.treeKey), Entrée / Espace or a
 * click = select + fly. Each device / cable / zone row has an eye button
 * (« Masquer … » / « Afficher … ») that flips view state only: no history entry.
 * The eye is out of the tab order (one tab stop for the tree): → on a leaf row
 * reaches it, ← or Échap goes back to the row. DOM only: dispatches nothing to
 * the rig (C6). Rebuilt on demand by its owner (store / view-state changes).
 */
import { COPY } from '../copy'
import { flattenVisible, hideKeyOf, parentOf, treeKey, type TreeKey, type TreeNode } from './treeModel'

export interface ProjectTreeDeps {
  doc: Document
  container: HTMLElement
  nodes(): TreeNode[]
  /** The node shown as selected (aria-selected), or null. */
  selectedId(): string | null
  isHidden(key: string): boolean
  /** Entrée / Espace / click on a row. */
  activate(node: TreeNode): void
  /** The eye button. */
  toggleHidden(node: TreeNode, key: string): void
}

export interface ProjectTree {
  readonly element: HTMLElement
  render(): void
  /** Focus a row (default: the roving one). */
  focus(id?: string): void
}

const T = (): Readonly<Record<string, string>> => COPY.tree!
const TREE_KEYS = new Set<string>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'])
const SVG = 'http://www.w3.org/2000/svg'

function icon(doc: Document, kind: 'chevron' | 'eye' | 'eye-off'): SVGSVGElement {
  const svg = doc.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const path = (d: string): void => {
    const p = doc.createElementNS(SVG, 'path')
    p.setAttribute('d', d)
    p.setAttribute('fill', 'none')
    p.setAttribute('stroke', 'currentColor')
    p.setAttribute('stroke-width', '1.5')
    p.setAttribute('stroke-linecap', 'square')
    svg.appendChild(p)
  }
  if (kind === 'chevron') path('M6 4l4 4-4 4')
  else {
    path('M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z')
    path('M8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 1 0 0-3.6z')
    if (kind === 'eye-off') path('M2.5 13.5l11-11')
  }
  return svg
}

export function mountProjectTree(d: ProjectTreeDeps): ProjectTree {
  const { doc } = d
  const tree = doc.createElement('ul')
  tree.className = 'cr-tree-root'
  tree.setAttribute('role', 'tree')
  tree.setAttribute('aria-label', COPY.shell!.tree!)
  tree.dataset.testid = 'tree'
  const help = doc.createElement('p')
  help.id = 'cr-tree-help'
  help.className = 'cr-sr-only'
  help.textContent = T().help!
  tree.setAttribute('aria-describedby', help.id)
  d.container.replaceChildren(tree, help)

  let nodes: TreeNode[] = []
  let focused = 'lieu'
  let expanded = new Set<string>()
  let lastSelected: string | null = null
  let labelSeq = 0
  const byId = new Map<string, TreeNode>()

  const rowOf = (id: string): HTMLElement | null => tree.querySelector<HTMLElement>(`[role="treeitem"][data-node-id="${CSS.escape(id)}"]`)
  const eyeOf = (id: string): HTMLButtonElement | null => rowOf(id)?.querySelector<HTMLButtonElement>(':scope > .cr-tree-item > .cr-eye') ?? null

  const build = (list: TreeNode[], level: number, parent: HTMLElement, selected: string | null): void => {
    list.forEach((n, i) => {
      byId.set(n.id, n)
      const li = doc.createElement('li')
      li.setAttribute('role', 'treeitem')
      li.dataset.nodeId = n.id
      li.dataset.kind = n.kind
      li.setAttribute('aria-level', String(level))
      li.setAttribute('aria-setsize', String(list.length))
      li.setAttribute('aria-posinset', String(i + 1))
      li.setAttribute('aria-selected', String(n.id === selected))
      li.tabIndex = n.id === focused ? 0 : -1
      const hasKids = !!n.children?.length
      if (hasKids) li.setAttribute('aria-expanded', String(expanded.has(n.id)))
      const labelId = `cr-tree-l${++labelSeq}`

      const row = doc.createElement('div')
      row.className = 'cr-tree-item'
      row.style.setProperty('--cr-tree-level', String(level - 1))
      const twisty = doc.createElement('span')
      twisty.className = 'cr-twisty'
      if (hasKids) twisty.appendChild(icon(doc, 'chevron'))
      const label = doc.createElement('span')
      label.className = 'cr-tree-text'
      label.id = labelId
      label.textContent = n.label
      label.title = n.label // long cable names are cut with an ellipsis in the 200 px panel
      row.append(twisty, label)
      const ids = [labelId]
      if (n.children) {
        const count = doc.createElement('span')
        count.className = 'cr-tree-count'
        count.id = `${labelId}-n`
        count.textContent = String(n.children.length)
        row.appendChild(count)
        ids.push(count.id)
      }
      const key = hideKeyOf(n)
      if (key && d.isHidden(key)) {
        // Hidden is said, not only shown (line-through): « fosse, masqué ».
        const state = doc.createElement('span')
        state.className = 'cr-sr-only'
        state.id = `${labelId}-h`
        state.textContent = T().hiddenState!
        row.appendChild(state)
        ids.push(state.id)
      }
      li.setAttribute('aria-labelledby', ids.join(' '))
      if (key) {
        const hidden = d.isHidden(key)
        if (hidden) li.dataset.hidden = 'true'
        const eye = doc.createElement('button')
        eye.type = 'button'
        eye.className = 'cr-eye'
        eye.tabIndex = -1
        const name = (hidden ? T().show! : T().hide!).replace('{item}', n.label)
        eye.setAttribute('aria-label', name)
        eye.title = name
        eye.dataset.testid = 'tree-eye'
        eye.appendChild(icon(doc, hidden ? 'eye-off' : 'eye'))
        eye.addEventListener('click', (e) => {
          e.stopPropagation()
          d.toggleHidden(n, key)
        })
        row.appendChild(eye)
      }
      li.appendChild(row)
      if (hasKids && expanded.has(n.id)) {
        const group = doc.createElement('ul')
        group.setAttribute('role', 'group')
        build(n.children!, level + 1, group, selected)
        li.appendChild(group)
      }
      parent.appendChild(li)
    })
  }

  const render = (): void => {
    // Where the keyboard was, to put it back after the rebuild.
    const active = doc.activeElement
    const had = active instanceof HTMLElement && tree.contains(active)
    const onEye = had && active.classList.contains('cr-eye')

    nodes = d.nodes()
    const selected = d.selectedId()
    // A selection made elsewhere (canvas, [ ]) becomes the roving row and its group opens.
    if (selected !== lastSelected && selected !== null && !had) {
      const p = parentOf(nodes, selected)
      if (p) expanded.add(p.id)
      focused = selected
    }
    lastSelected = selected
    const visible = flattenVisible(nodes, expanded)
    if (!visible.some((n) => n.id === focused)) {
      // The row went away (device removed): its parent, else the first row.
      const p = parentOf(nodes, focused)
      focused = p && visible.some((n) => n.id === p.id) ? p.id : (visible[0]?.id ?? 'lieu')
    }
    byId.clear()
    tree.replaceChildren()
    build(nodes, 1, tree, selected)
    if (had) (onEye ? (eyeOf(focused) ?? rowOf(focused)) : rowOf(focused))?.focus()
  }

  const moveTo = (id: string): void => {
    focused = id
    for (const li of tree.querySelectorAll<HTMLElement>('[role="treeitem"]')) li.tabIndex = li.dataset.nodeId === id ? 0 : -1
    rowOf(id)?.focus()
  }

  tree.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const t = e.target as HTMLElement
    const li = t.closest<HTMLElement>('[role="treeitem"]')
    if (!li) return
    const id = li.dataset.nodeId!
    if (t.classList.contains('cr-eye')) {
      // On the eye: ← / Échap back to its row (Entrée / Espace stay the button's).
      if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        e.preventDefault()
        moveTo(id)
      }
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const n = byId.get(id)
      if (n?.children?.length) toggle(id) // a group's default action: open / close
      else if (n) d.activate(n)
      return
    }
    if (!TREE_KEYS.has(e.key)) return
    e.preventDefault()
    const n = byId.get(id)
    if (e.key === 'ArrowRight' && n && !n.children?.length) {
      eyeOf(id)?.focus()
      return
    }
    const next = treeKey({ focused: id, expanded }, e.key as TreeKey, nodes)
    const changed = next.expanded.size !== expanded.size || [...next.expanded].some((x) => !expanded.has(x))
    expanded = next.expanded
    focused = next.focused
    if (changed) render()
    moveTo(focused)
  })

  tree.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')
    if (!li) return
    e.stopPropagation() // the innermost row only
    const id = li.dataset.nodeId!
    const n = byId.get(id)
    if (!n) return
    // A click on a group opens / closes it; on an item it selects (and flies).
    if (n.children?.length) return toggle(id)
    moveTo(id)
    d.activate(n)
  })

  const toggle = (id: string): void => {
    if (expanded.has(id)) expanded.delete(id)
    else expanded.add(id)
    focused = id
    render()
    rowOf(id)?.focus()
  }

  // Keep the roving row in sync when focus lands on a row by any means (pointer).
  tree.addEventListener('focusin', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')
    if (li && (e.target as HTMLElement) === li && li.dataset.nodeId !== focused) {
      focused = li.dataset.nodeId!
      for (const r of tree.querySelectorAll<HTMLElement>('[role="treeitem"]')) r.tabIndex = r === li ? 0 : -1
    }
  })

  render()
  return {
    element: tree,
    render,
    focus(id) {
      moveTo(id ?? focused)
    },
  }
}
