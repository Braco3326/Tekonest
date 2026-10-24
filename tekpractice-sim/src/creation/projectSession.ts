/**
 * The tab's project identity (Task 13 re-review): the name on screen, the
 * fingerprint of its last save (the « * » marker) and the stamp of its stored
 * row (the two-tab check). Undo / redo of « Ouvrir » / « Nouveau » restore
 * ONLY the name: the fingerprint and the stamp come from what this tab last
 * knew of that name (its latest save or open), never from the history entry,
 * which may be older (open B, save, undo, redo must not bring back the stamp
 * B had when it was opened). Pure, no DOM.
 */
export interface ProjectState {
  name: string | null
  savedFp: string | null
  stamp: string | null
}

export class ProjectSession {
  private known = new Map<string, { savedFp: string | null; stamp: string | null }>()
  state: ProjectState = { name: null, savedFp: null, stamp: null }

  /** A save, an open, a reopened autosave, « Nouveau »: this is now the project, and what this tab knows of its name. */
  set(s: ProjectState): void {
    this.state = { ...s }
    if (s.name !== null) this.known.set(s.name, { savedFp: s.savedFp, stamp: s.stamp })
  }

  /** Undo / redo: back to `name`, with this tab's latest fingerprint and stamp for it. */
  restoreName(name: string | null): void {
    const k = name === null ? undefined : this.known.get(name)
    this.state = { name, savedFp: k?.savedFp ?? null, stamp: k?.stamp ?? null }
  }
}
