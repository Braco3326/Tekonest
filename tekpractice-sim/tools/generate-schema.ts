/**
 * generate-schema - writes the catalog JSON schema (from the zod source of truth in tools/schemas.ts) to content/catalog.schema.json, so editors
 * autocomplete / validate catalog.json via its "$schema" field. Re-run after any schema change: npm run gen:schema
 *
 * The text is built FIRST (tools/catalogSchemaText.ts), the file is written ONLY after that, in one call: a crash while importing or building leaves the
 * committed file as it was. (It used to print on stdout and rely on a shell redirect, which truncates the file before the script even starts.)
 * An optional first argument is another output path (tests/tools/schemas.test.ts runs the script into a temporary file and compares).
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { catalogSchemaText } from './catalogSchemaText'

const text = catalogSchemaText()
if (text.length < 1000) throw new Error('generate-schema: the schema text is implausibly short, nothing written')
writeFileSync(process.argv[2] ?? fileURLToPath(new URL('../content/catalog.schema.json', import.meta.url)), text)
