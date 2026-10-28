/**
 * The catalog proposals, as the KB sync wrote them (Task 30): a LAZY chunk. Nothing imports this file
 * statically; boot loads it with `import()` the first time the Bêta sheets are needed (the inventory
 * drawer opens, or a reopened project holds a device the catalog does not know), so the JSON
 * (200 kB of source, a 149 kB / 23 kB gzip chunk) is not part of the creation start chunk.
 *
 * The raw file only: `parseProposals` (betaDevices.ts) validates it. Regenerate it with `npm run sync:kb`;
 * never edit it by hand and never copy it into content/catalog.json from here.
 */
import proposals from '../../content/proposals/catalog-proposals.json'

export default proposals as unknown
