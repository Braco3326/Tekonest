/**
 * The profile chip « Profil : X · changer » (onboarding packs, T2.4b, spec 4.1): a small button in the status bar that reopens the start stage of the place
 * picker. DOM only. It has no style of its own: it takes the checklist chip's classes (`cr-status-checklist` slot, `cr-checklist-chip` button), so it shrinks
 * and clips like it on a narrow bar and the paused-autosave warning has the room first.
 */
export interface ProfileChipDeps {
  doc: Document
  /** The status bar; the chip's own slot is inserted before the checklist slot. */
  slot: HTMLElement
  /** The chip's text (« Profil : X · changer »), or null while there is no profile to name (the chip is hidden). Read at each render. */
  label(): string | null
  /** The button's `title`. */
  hint: string
  onClick(): void
}

export interface ProfileChip {
  render(): void
}

export function mountProfileChip(d: ProfileChipDeps): ProfileChip {
  const holder = d.doc.createElement('span')
  holder.className = 'cr-status-checklist'
  const chip = d.doc.createElement('button')
  chip.type = 'button'
  chip.className = 'cr-checklist-chip cr-profile-chip'
  chip.dataset.testid = 'profile-chip'
  chip.title = d.hint
  chip.hidden = true
  chip.addEventListener('click', () => d.onClick())
  holder.appendChild(chip)
  d.slot.before(holder)
  return {
    render() {
      const text = d.label()
      chip.hidden = text === null
      if (text !== null && chip.textContent !== text) chip.textContent = text
      holder.style.display = text === null ? 'none' : '' // the holder has its own display: flex on a phone, which a hidden attribute would not beat
    },
  }
}
