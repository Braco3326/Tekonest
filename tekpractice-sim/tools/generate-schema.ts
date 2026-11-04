/**
 * generate-schema — emits the catalog JSON schema (from the zod source of
 * truth in tools/schemas.ts) on STDOUT, so editors autocomplete/validate
 * catalog.json via its "$schema" field.
 * Re-run after any schema change: npm run gen:schema
 * (the npm script redirects stdout into content/catalog.schema.json)
 *
 * `catalogSchemaText` is the same text as a function, so a test (tests/tools/schemas.test.ts) can hold the committed file to it.
 */
import { pathToFileURL } from 'node:url'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Catalog } from './schemas'

export function catalogSchemaText(): string {
  const schema = zodToJsonSchema(Catalog, { name: 'Catalog', $refStrategy: 'none' })
  return JSON.stringify(schema, null, 2) + '\n'
}

// Run as a script (`tsx tools/generate-schema.ts`): write to stdout. Imported by a test: write nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(catalogSchemaText())
