/**
 * generate-schema - emits the catalog JSON schema (from the zod source of
 * truth in tools/schemas.ts) on STDOUT, so editors autocomplete/validate
 * catalog.json via its "$schema" field.
 * Re-run after any schema change: npm run gen:schema
 * (the npm script redirects stdout into content/catalog.schema.json)
 *
 * The text comes from tools/catalogSchemaText.ts; this file only writes it, always (no "am I the main module" test: a wrong guess there
 * would print nothing and the redirect would leave an empty schema file). tests/tools/schemas.test.ts runs this very script and compares.
 */
import { catalogSchemaText } from './catalogSchemaText'

process.stdout.write(catalogSchemaText())
