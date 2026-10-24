/**
 * Shelf — the sandbox's category shelves (Beat 3), read STRAIGHT from the
 * catalog (never duplicated). Two modes, gated by mastery (ADR-0004):
 *  - guided (low readiness): a 3-item palette + a one-line brief — the Beat 1
 *    "taste" of freedom;
 *  - free: every device, grouped by realWorld.category.
 * Clicks dispatch SPAWN intents; the rig save box saves a named rig through
 * the pure rigStore (rigs v2, ADR-0012 Décision 9), confirming a same-name replace.
 */
import type { Registry } from '../engine/CatalogLoader'
import type { Intent } from './intents'
import { loadRigs, type RigSaveFailure, type RigSaveResult, type RigWarning } from './rigStore'

export const GUIDED_PALETTE = ['shure-sm58', 'yamaha-rio3224-d2', 'yamaha-ql1']
export const GUIDED_BRIEF =
  'Palette guidée : connecte le micro à la console, via la stagebox. Ta liberté grandit avec ta readiness.'

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export class Shelf {
  constructor(
    root: HTMLElement,
    registry: Registry,
    guided: boolean,
    dispatch: (intent: Intent) => void,
    /** Saves through rigStore; `overwrite` only after the learner confirmed a same-name replace. */
    onSaveRig: (name: string, overwrite: boolean) => RigSaveResult,
    environments: readonly string[] = [],
    currentEnv = '',
    /** TEK Brain procedural rooms (B3): generated from data, loaded on demand. */
    roomList: readonly { id: string; name_fr: string }[] = [],
    currentRoom = '',
  ) {
    const devices = [...registry.deviceById.values()].filter((d) => d.ports.length > 0)
    const pool = guided ? devices.filter((d) => GUIDED_PALETTE.includes(d.id)) : devices

    const byCategory = new Map<string, typeof pool>()
    for (const d of pool) {
      const cat = d.realWorld.category
      byCategory.set(cat, [...(byCategory.get(cat) ?? []), d])
    }

    const sections = [...byCategory.entries()]
      .map(
        ([cat, items]) =>
          `<section class="shelf-cat"><h3>${esc(cat)}</h3>${items
            .map(
              (d) =>
                `<button class="shelf-item" data-device="${d.id}" title="${esc(d.realWorld.typicalUse)}">
                  <img src="/assets/thumbs/${d.id}.png" alt="" loading="lazy" onerror="this.remove()" />
                  <span>${esc(d.label)}</span>
                </button>`,
            )
            .join('')}</section>`,
      )
      .join('')

    const rooms = environments.length
      ? `<nav class="shelf-rooms">${environments
          .map(
            (id) =>
              `<a href="?level=sandbox&env=${id}" class="${id === currentEnv ? 'current' : ''}">${esc(id)}</a>`,
          )
          .join('')}</nav>`
      : ''
    const roomPicker = roomList.length
      ? `<label class="shelf-roompick">Salle générée (TEK Brain)
          <select id="room-pick"><option value="">— choisir —</option>${roomList
            .map((r) => `<option value="${esc(r.id)}"${r.id === currentRoom ? ' selected' : ''}>${esc(r.name_fr)}</option>`)
            .join('')}</select></label>`
      : ''

    const { rigs: saved, warnings } = loadRigs(window.localStorage)

    root.innerHTML = `
      <h2>Étagères${guided ? ' · palette guidée' : ''}</h2>
      ${rooms}
      ${roomPicker}
      ${guided ? `<p class="shelf-brief">${GUIDED_BRIEF}</p>` : ''}
      <div class="shelf-scroll">${sections}</div>
      <p class="shelf-rig-notice" role="status"></p>
      <div class="shelf-rigs"></div>
      <div class="shelf-save">
        <input id="rig-name" type="text" placeholder="Nom du rig…" maxlength="40" />
        <button id="rig-save">Sauver</button>
        <span id="rig-saved" role="status"></span>
      </div>
      <div class="shelf-confirm" id="rig-overwrite" role="alertdialog" aria-modal="true" data-owns-keys aria-labelledby="rig-ow-title" aria-describedby="rig-ow-body" hidden>
        <strong id="rig-ow-title">${esc(RIG_COPY.overwriteTitle)}</strong>
        <p id="rig-ow-body"></p>
        <div class="shelf-confirm-actions">
          <button type="button" id="rig-ow-replace">${esc(RIG_COPY.replace)}</button>
          <button type="button" id="rig-ow-rename">${esc(RIG_COPY.rename)}</button>
          <button type="button" id="rig-ow-cancel">${esc(RIG_COPY.cancel)}</button>
        </div>
      </div>`
    root.hidden = false
    const rigsEl = root.querySelector<HTMLElement>('.shelf-rigs')!
    const renderRigs = (rigs: { name: string; instances: unknown[] }[]): void => {
      rigsEl.hidden = rigs.length === 0
      rigsEl.innerHTML = rigs
        .map(
          (r) =>
            `<button class="shelf-rig" data-rig="${esc(r.name)}" title="${r.instances.length} appareil(s)">▶ ${esc(r.name)}</button>`,
        )
        .join('')
    }
    renderRigs(saved)

    root.querySelector<HTMLSelectElement>('#room-pick')?.addEventListener('change', (e) => {
      const id = (e.target as HTMLSelectElement).value
      location.href = id ? `?level=sandbox&room=${encodeURIComponent(id)}` : '?level=sandbox'
    })

    const input = root.querySelector<HTMLInputElement>('#rig-name')!
    const saveBtn = root.querySelector<HTMLButtonElement>('#rig-save')!
    // Live regions stay in the DOM; only their text changes (a11y).
    const status = root.querySelector<HTMLElement>('#rig-saved')!
    const noticeEl = root.querySelector<HTMLElement>('.shelf-rig-notice')!
    const confirmEl = root.querySelector<HTMLElement>('#rig-overwrite')!
    const showNotices = (ws: readonly RigWarning[]): void => {
      noticeEl.textContent = [...new Set(ws.map((w) => RIG_COPY.warning[w]))].join(' ')
    }
    showNotices(warnings)
    let statusTimer = 0
    let pending = ''
    const showStatus = (text: string, ok: boolean): void => {
      window.clearTimeout(statusTimer)
      status.textContent = text
      status.classList.toggle('rig-error', !ok)
      // Failures stay on screen (every failure is shown); successes fade.
      if (ok) statusTimer = window.setTimeout(() => (status.textContent = ''), 2500)
    }
    const hideConfirm = (): void => {
      confirmEl.hidden = true
      pending = ''
    }
    const closeConfirm = (focus: HTMLElement): void => {
      hideConfirm()
      focus.focus()
    }
    // The dialog owns its keys while it has focus (`data-owns-keys`: the Explore
    // capture listener steps aside): Esc = Annuler, Tab cycles its 3 buttons.
    confirmEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation() // FocusPatch must not move the camera
        closeConfirm(saveBtn)
      } else if (e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        const buttons = [...confirmEl.querySelectorAll<HTMLButtonElement>('button')]
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = (i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length
        buttons[i < 0 ? 0 : next].focus()
      }
    })
    const attempt = (name: string, overwrite: boolean): void => {
      hideConfirm()
      const r = onSaveRig(name, overwrite)
      if (r.ok) {
        showStatus(r.replaced ? RIG_COPY.replaced(name) : RIG_COPY.saved(name), true)
        const after = loadRigs(window.localStorage)
        renderRigs(after.rigs)
        showNotices([...r.warnings, ...after.warnings])
        return
      }
      if (r.reason === 'exists') {
        // Non-blocking in-page confirm; the safe choice (rename) has the focus.
        pending = name
        root.querySelector<HTMLElement>('#rig-ow-body')!.textContent = RIG_COPY.overwriteBody(name)
        confirmEl.hidden = false
        root.querySelector<HTMLButtonElement>('#rig-ow-rename')!.focus()
        return
      }
      showStatus(RIG_COPY.failure[r.reason], false)
    }

    root.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest<HTMLButtonElement>('.shelf-item')
      if (item) {
        dispatch({ type: 'SPAWN', deviceId: item.dataset.device! })
        return
      }
      const rig = (e.target as HTMLElement).closest<HTMLButtonElement>('.shelf-rig')
      if (rig) {
        dispatch({ type: 'LOAD_RIG', name: rig.dataset.rig! })
        return
      }
      switch ((e.target as HTMLElement).id) {
        case 'rig-save': {
          const name = input.value.trim()
          if (name) attempt(name, false)
          break
        }
        case 'rig-ow-replace': {
          const name = pending
          closeConfirm(input)
          if (name) attempt(name, true)
          break
        }
        case 'rig-ow-rename':
          closeConfirm(input)
          input.select()
          break
        case 'rig-ow-cancel':
          closeConfirm(saveBtn)
          break
      }
    })
  }
}

/**
 * Rig save copy. Overwrite / saved / replaced / migrated strings are verbatim
 * from the copy deck (docs/copy/designer-nav-essais.md §7 and
 * `quarantine.migration.toast`). The failure / quarantine lines have NO deck
 * key yet: provisional, adapted from `storage.writeFailed` and
 * `quarantine.notice` — tekuxwriter to confirm.
 */
export const RIG_COPY = {
  overwriteTitle: 'Un montage porte déjà ce nom.',
  overwriteBody: (name: string): string => `Remplacer « ${name} » ? L'ancienne version sera perdue.`,
  replace: 'Remplacer',
  rename: 'Choisir un autre nom',
  cancel: 'Annuler',
  saved: (name: string): string => `Montage « ${name} » enregistré.`,
  replaced: (name: string): string => `Montage « ${name} » remplacé.`,
  warning: {
    migrated: 'Vos montages enregistrés ont été copiés vers le nouveau format. Les anciens sont conservés.',
    'migration-failed': "Vos montages n'ont pas pu être copiés vers le nouveau format. Les anciens sont conservés.",
    quarantined: "Montages enregistrés illisibles — mis de côté (quarantaine). Rien n'est effacé.",
    'quarantine-evicted': 'Une ancienne copie de secours des montages a été retirée.',
    'quarantine-failed': "Montages illisibles : rien n'a été effacé, mais aucun montage ne peut être enregistré pour l'instant.",
    'storage-unavailable': 'Les montages ne peuvent pas être lus dans ce navigateur (navigation privée ?).',
  } satisfies Record<RigWarning, string>,
  failure: {
    invalid: "Ce montage contient une position invalide : il n'a pas été enregistré.",
    empty: 'Donnez un nom au montage.',
    'read-only': "Les montages ne peuvent pas être enregistrés pour l'instant. Rien n'a été effacé.",
    quota: "L'enregistrement dans ce navigateur a échoué : la mémoire est pleine.",
    storage: "L'enregistrement dans ce navigateur a échoué.",
  } satisfies Record<Exclude<RigSaveFailure, 'exists'>, string>,
  /** Provisional (no deck key): LOAD_RIG on a name that is no longer stored. */
  missing: (name: string): string => `Le montage « ${name} » est introuvable dans ce navigateur. Rien n'a été chargé.`,
}
