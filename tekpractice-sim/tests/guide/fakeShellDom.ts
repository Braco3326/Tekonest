// A small fake DOM for the step card and the tutorial slot (unit tests run in node): elements with children, dataset, attributes, `contains`, `isConnected`, `remove`,
// `replaceChildren`, `querySelector` by `[data-testid="..."]`. Not a browser: the real layout is proven by tests/e2e/onboarding-stepcard.spec.ts.
export interface FakeEl {
  tagName: string
  className: string
  dataset: Record<string, string | undefined>
  children: FakeEl[]
  parent: FakeEl | null
  attrs: Record<string, string>
  textContent: string
  hidden: boolean
  tabIndex: number
  type?: string
  style: Record<string, string>
  isConnected: boolean
  append(...c: (FakeEl | string)[]): void
  appendChild(c: FakeEl): FakeEl
  replaceChildren(...c: FakeEl[]): void
  remove(): void
  contains(n: unknown): boolean
  setAttribute(k: string, v: string): void
  getAttribute(k: string): string | null
  addEventListener(t: string, fn: () => void): void
  focus(): void
  querySelector(sel: string): FakeEl | null
}

export function fakeShellDom(opts: { shell?: boolean } = {}) {
  const make = (tag: string): FakeEl => {
    const e: FakeEl = {
      tagName: tag.toUpperCase(),
      className: '',
      dataset: {},
      children: [],
      parent: null,
      attrs: {},
      textContent: '',
      hidden: false,
      tabIndex: 0,
      style: {},
      get isConnected(): boolean {
        for (let n: FakeEl | null = e; n !== null; n = n.parent) if (n === body) return true
        return false
      },
      append(...cs) {
        for (const c of cs) if (typeof c !== 'string') e.appendChild(c)
      },
      appendChild(c) {
        if (c.parent) c.parent.children = c.parent.children.filter((x) => x !== c)
        c.parent = e
        e.children.push(c)
        return c
      },
      replaceChildren(...cs) {
        for (const c of e.children) c.parent = null
        e.children = []
        for (const c of cs) e.appendChild(c)
      },
      remove() {
        if (e.parent) e.parent.children = e.parent.children.filter((x) => x !== e)
        e.parent = null
      },
      contains(n) {
        for (let x = n as FakeEl | null; x; x = x.parent) if (x === e) return true
        return false
      },
      setAttribute(k, v) {
        e.attrs[k] = v
      },
      getAttribute: (k) => e.attrs[k] ?? null,
      addEventListener() {},
      focus() {},
      querySelector(sel) {
        const want = /\[data-testid="([^"]+)"\]/.exec(sel)?.[1]
        const walk = (n: FakeEl): FakeEl | null => {
          for (const c of n.children) {
            if (want !== undefined && c.dataset.testid === want) return c
            const r = walk(c)
            if (r) return r
          }
          return null
        }
        return walk(e)
      },
    }
    return e
  }
  const body = make('body')
  const root = make('div')
  root.dataset.testid = 'creation-root'
  if (opts.shell !== false) body.appendChild(root)
  const doc = {
    body,
    documentElement: { clientWidth: 1366, clientHeight: 768, dataset: {} },
    defaultView: null,
    activeElement: null,
    createElement: make,
    createElementNS: (_ns: string, tag: string) => make(tag),
    getElementById: () => null,
    querySelector: (s: string) => body.querySelector(s),
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  }
  return { doc: doc as unknown as Document, body, root }
}
