/**
 * The catalog JSON schema as text, from the zod source of truth (tools/schemas.ts). A pure function with no `main` guard, so a test imports it
 * and tools/generate-schema.ts (the script behind `npm run gen:schema`) writes it unconditionally: nothing can make the script print nothing
 * and have the shell redirect truncate content/catalog.schema.json to an empty file.
 */
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Catalog } from './schemas'

export function catalogSchemaText(): string {
  const schema = zodToJsonSchema(Catalog, { name: 'Catalog', $refStrategy: 'none' })
  return JSON.stringify(schema, null, 2) + '\n'
}
