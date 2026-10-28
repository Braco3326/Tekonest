/**
 * « Connecter à… » (Task 28, CA-02, C10): the keyboard and screen-reader way to cable. Opened from a free port's row in
 * Propriétés › Connexions; it lists the free ports of the other devices, grouped by device, and Entrée connects.
 *
 * - The modal contract is `modal.ts` (role="dialog" + aria-modal, the rest of the shell `inert`, edge sentinels keep Tab
 *   natural, Échap closes, focus goes back to the button that opened it). The 3D scene is inert behind it, so no
 *   pointer patch can start while it is open.
 * - A combobox pattern: focus stays in the « Filtrer » field; Flèche bas / haut move `aria-activedescendant` along the
 *   listbox, Entrée connects the active option, any other key types. Held keys never act (`e.repeat`).
 * - Incompatible ports are NOT options: they sit in a collapsed « Incompatibles » group, each with the rule that refuses
 *   it. The live count (`role="status"`, polite) says how many ports match.
 * - A change of the rig under the open dialog (an undo, a place change) closes it: its list could be wrong, and a stale
 *   port is never dispatched (the session also refuses). The success is announced once, politely, AFTER the dialog closed
 *   (the status bar is inert while it is open) and focus lands on the row it cabled.
 * DOM only: the rules are `connectModel.ts`; the dispatch is `history.do` through the session.
 */
import type { Registry } from '../../engine/CatalogLoader'
import type { PortRef } from '../../engine/types'
import { COPY } from '../copy'
import type { History } from '../history'
import type { CreationStore } from '../store'
import { ConnectSession, focusPlan, groupByDevice, type CloseReason, type RejectionText } from './connectModel'
import { connectorName, shortName, signalName } from './propertiesModel'
import { modalButton, modalRow, openModal } from './modal'
import './connectDialog.css'

export interface ConnectDialogDeps {
  registry: Registry
  store: Pick<CreationStore, 'canConnect' | 'connectionAt' | 'design' | 'subscribe'>
  history: Pick<History, 'do'>
  /** « Appareil (id) · prise » (history entry, announcement). */
  portName(ref: PortRef): string
  /** The one place that turns a refusal into text (the status bar's). */
  rejectionText: RejectionText
  /** A line for the status bar (announced politely). */
  announce(message: string): void
  undoLabel?(): string
  /** Called just before an intent is dispatched (the shell closes a stepper burst still open). */
  beforeDispatch?(): void
  /** Where focus can go when the dialog closes (each returns true when it took focus). See `focusPlan`. */
  focus: {
    /** The device Propriétés shows now (null = none). */
    panelDevice(): string | null
    /** The row of `from.port` on the device `from.instance`, only while Propriétés shows that device. */
    row(from: PortRef): boolean
    /** The Propriétés title (it takes focus: tabindex -1). */
    title(): boolean
    /** The 3D canvas. */
    canvas(): boolean
  }
}

export interface ConnectDialog {
  /** Opens the dialog for the free port `from`; `opener` is the button to give focus back to. */
  open(from: PortRef, opener: HTMLElement): void
  /** Closes it without connecting (a place change, a teardown). No-op when closed. */
  close(): void
  readonly isOpen: boolean
}

type Outcome = 'connected' | 'cancelled'

const C = (): Readonly<Record<string, string>> => COPY.connect!
const fill = (s: string, vars: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)

let seq = 0

export function createConnectDialog(d: ConnectDialogDeps): ConnectDialog {
  let current: { close(): void } | null = null

  const portDescription = (ref: PortRef): string => {
    const inst = d.store.design().rig.instances.find((i) => i.instanceId === ref.instance)
    const port = inst && d.registry.deviceById.get(inst.deviceId)?.ports.find((p) => p.portId === ref.port)
    const head = `${inst ? shortName(d.registry, inst.deviceId) : ref.instance} (${ref.instance}) · ${ref.port}`
    return port ? `${head} · ${connectorName(d.registry, port.connector)} · ${signalName(d.registry, port.signal)}` : head
  }

  function open(from: PortRef, opener: HTMLElement): void {
    current?.close()
    const session = new ConnectSession({
      store: d.store,
      history: d.history,
      registry: d.registry,
      from,
      portName: d.portName,
      rejectionText: d.rejectionText,
      ...(d.beforeDispatch ? { beforeDispatch: d.beforeDispatch } : {}),
    })
    const id = `cr-connect-${++seq}`
    let ended = false
    let end: (v: Outcome) => void = () => {}
    let staleClosed = false
    /** Set before `end` when the close is not the learner's: a rig change under it, or the place (the whole design). */
    let reason: CloseReason | null = null
    const roomAtOpen = d.store.design().roomId
    const unsubscribe = d.store.subscribe((change) => {
      // Its own CONNECT notifies during the dispatch: not a reason to close. Anything else is.
      if (ended || !session.onStoreChange()) return
      staleClosed = true
      // A new design (a place, « Nouveau », « Ouvrir », an undo of one) replaces the rig the dialog was about.
      reason = change.intents.some((i) => i.type === 'APPLY_DESIGN') || d.store.design().roomId !== roomAtOpen ? 'place' : 'stale'
      end('cancelled')
    })
    // An outside close (the shell changed place, or is torn down): the rig this was about is gone.
    const handle = {
      close: () => {
        reason ??= 'place'
        end('cancelled')
      },
    }
    current = handle

    const result = openModal<Outcome>({
      id: 'cr-connect-dialog',
      title: C().title!,
      body: fill(C().body!, { port: portDescription(from) }),
      cancel: 'cancelled',
      build(box, done) {
        end = (v) => {
          if (ended) return
          ended = true
          unsubscribe()
          done(v)
        }
        box.classList.add('cr-connect')

        const label = document.createElement('label')
        label.className = 'cr-dialog-label'
        label.htmlFor = `${id}-filter`
        label.textContent = C().filter!
        const input = document.createElement('input')
        input.id = `${id}-filter`
        input.className = 'cr-dialog-input'
        input.type = 'text'
        input.autocomplete = 'off'
        input.spellcheck = false
        input.dataset.testid = 'connect-filter'
        input.setAttribute('role', 'combobox')
        input.setAttribute('aria-autocomplete', 'list')
        input.setAttribute('aria-expanded', 'true')
        input.setAttribute('aria-controls', `${id}-list`)

        const count = document.createElement('p')
        count.className = 'cr-connect-count'
        count.setAttribute('role', 'status')
        count.dataset.testid = 'connect-count'

        const list = document.createElement('div')
        list.id = `${id}-list`
        list.className = 'cr-connect-list'
        list.setAttribute('role', 'listbox')
        list.setAttribute('aria-label', C().listName!)
        list.dataset.testid = 'connect-list'

        const toggle = document.createElement('button')
        toggle.type = 'button'
        toggle.id = `${id}-toggle`
        toggle.className = 'cr-dialog-btn cr-connect-toggle'
        toggle.dataset.testid = 'connect-rejected-toggle'
        toggle.setAttribute('aria-expanded', 'false')
        toggle.setAttribute('aria-controls', `${id}-rejected`)
        const rejectedBox = document.createElement('div')
        rejectedBox.id = `${id}-rejected`
        rejectedBox.className = 'cr-connect-rejected'
        rejectedBox.dataset.testid = 'connect-rejected'
        rejectedBox.hidden = true
        // A scrolling region needs a keyboard way in (axe: scrollable-region-focusable): it is a Tab stop after its button.
        rejectedBox.tabIndex = 0
        rejectedBox.setAttribute('role', 'region')
        rejectedBox.setAttribute('aria-labelledby', toggle.id)
        const hint = document.createElement('p')
        hint.className = 'cr-connect-hint'
        hint.textContent = C().rejectedHint!
        const rejectedList = document.createElement('ul')
        rejectedList.className = 'cr-connect-rejected-list'
        rejectedBox.append(hint, rejectedList)

        const alert = document.createElement('p')
        alert.className = 'cr-dialog-error'
        alert.setAttribute('role', 'alert')
        alert.dataset.testid = 'connect-alert'

        const cancel = modalButton(C().cancel!, false)
        cancel.dataset.testid = 'connect-cancel'
        cancel.addEventListener('click', () => end('cancelled'))

        let rejectedOpen = false
        let lastCount = ''
        const optionId = (i: number): string => `${id}-opt-${i}`

        const act = (): void => {
          const r = session.activate({ repeat: false })
          if (r.kind === 'refused') {
            // A refusal is a message: said in the dialog, the status bar's list got it from history.onRefused.
            alert.textContent = fill(COPY.patch!.errorLabel!, { title: r.message })
            return
          }
          if (r.kind !== 'connected') return
          // Close FIRST: the status bar is inert while the dialog is open, and a live region inside inert content is not read.
          end('connected')
          d.announce(fill(C().statusConnected!, { a: r.a, b: r.b, undo: d.undoLabel?.() ?? 'Ctrl+Z' }))
        }

        const renderActive = (): void => {
          const at = session.activeIndex
          let n = 0
          for (const opt of list.querySelectorAll<HTMLElement>('[role="option"]')) {
            const on = n === at
            opt.setAttribute('aria-selected', String(on))
            if (on) {
              input.setAttribute('aria-activedescendant', opt.id)
              opt.scrollIntoView?.({ block: 'nearest' })
            }
            n++
          }
          if (at < 0) input.removeAttribute('aria-activedescendant')
        }

        const renderRejected = (): void => {
          const items = session.rejectedVisible
          toggle.hidden = items.length === 0
          toggle.textContent = fill(C().rejectedToggle!, { n: String(items.length) })
          rejectedBox.hidden = items.length === 0 || !rejectedOpen
          rejectedList.replaceChildren(
            ...items.map((e) => {
              const li = document.createElement('li')
              li.className = 'cr-connect-rejected-item'
              const name = document.createElement('span')
              name.className = 'cr-connect-rejected-name'
              name.textContent = e.label
              const why = document.createElement('span')
              why.className = 'cr-connect-reason'
              why.textContent = e.reason
              li.append(name, why)
              if (e.detail) {
                const teach = document.createElement('span')
                teach.className = 'cr-connect-teach'
                teach.textContent = e.detail
                li.append(teach)
              }
              return li
            })
          )
        }

        const render = (): void => {
          const groups = groupByDevice(session.visible)
          let n = 0
          list.replaceChildren(
            ...groups.map((g) => {
              const group = document.createElement('div')
              group.className = 'cr-connect-group'
              group.setAttribute('role', 'group')
              const head = document.createElement('div')
              head.className = 'cr-connect-group-title'
              head.id = `${id}-g-${g.instance}`
              head.textContent = g.device
              group.setAttribute('aria-labelledby', head.id)
              group.appendChild(head)
              for (const e of g.items) {
                const opt = document.createElement('div')
                opt.id = optionId(n++)
                opt.className = 'cr-connect-opt'
                opt.setAttribute('role', 'option')
                // The full name (device included): an active-descendant is read without its group.
                opt.setAttribute('aria-label', e.label)
                opt.dataset.port = `${e.ref.instance}.${e.ref.port}`
                opt.textContent = e.port
                opt.addEventListener('click', () => {
                  session.setActive(e.ref)
                  renderActive()
                  act()
                })
                group.appendChild(opt)
              }
              return group
            })
          )
          list.hidden = session.visible.length === 0
          const total = session.visible.length
          const text = total
            ? total === 1
              ? C().countOne!
              : fill(C().countMany!, { n: String(total) })
            : session.ok.length === 0
              ? C().none!
              : fill(C().noMatch!, { query: session.query.trim() })
          if (text !== lastCount) {
            lastCount = text
            count.textContent = text
          }
          renderActive()
          renderRejected()
        }

        input.addEventListener('input', () => {
          alert.textContent = ''
          session.setQuery(input.value)
          render()
        })
        input.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            session.move(e.key === 'ArrowDown' ? 1 : -1)
            renderActive()
          } else if (e.key === 'Enter') {
            e.preventDefault()
            // A held Entrée (including the press that opened this dialog) never acts: only a fresh press does.
            if (!e.repeat) act()
          }
        })
        toggle.addEventListener('click', () => {
          rejectedOpen = !rejectedOpen
          toggle.setAttribute('aria-expanded', String(rejectedOpen))
          renderRejected()
        })

        box.append(label, input, count, list, toggle, rejectedBox, alert, modalRow(cancel))
        render()
        return { first: input, edges: () => [input, cancel] }
      },
    })

    void result.then((outcome) => {
      unsubscribe() // closed by Échap or by another modal too
      ended = true
      const superseded = current !== null && current !== handle // a newer dialog owns focus now
      if (current === handle) current = null
      if (staleClosed) d.announce(C().statusClosedStale!)
      if (superseded) return
      // The modal gave focus back to the opener; that is right only while the opener still denotes this device and port
      // (the panel patches in place when nothing structural changed, and rebuilds - new buttons - when it did).
      const openerSame =
        opener.isConnected && opener.dataset.key === `connect:${from.port}` && d.focus.panelDevice() === from.instance && d.store.design().rig.instances.some((i) => i.instanceId === from.instance)
      const tryTarget = {
        opener: () => {
          if (document.activeElement !== opener) opener.focus()
          return document.activeElement === opener
        },
        row: () => d.focus.row(from),
        title: () => d.focus.title(),
        canvas: () => d.focus.canvas(),
      }
      for (const target of focusPlan(reason ?? (outcome === 'connected' ? 'connected' : 'cancelled'), openerSame)) if (tryTarget[target]()) return
    })
  }

  return {
    open,
    close: () => current?.close(),
    get isOpen() {
      return current !== null
    },
  }
}
