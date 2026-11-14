/** The cables a reopened project could not restore, as the lines of the visible note (« em prise ↔ rx prise »). Pure. */
export function droppedCableItems(cables: readonly { a: string | { instance: string; port: string }; b: string | { instance: string; port: string } }[]): string[] {
  const name = (r: string | { instance: string; port: string }): string => (typeof r === 'string' ? r.replace('.', ' ') : `${r.instance} ${r.port}`)
  return cables.map((c) => `${name(c.a)} ↔ ${name(c.b)}`)
}
