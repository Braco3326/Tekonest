import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AGE_RANGES } from '../../src/accounts/ageRange'
import { toRow } from '../../src/accounts/supabaseService'
import { normaliseProfile } from '../../src/accounts/profileModel'

const sql = readFileSync(resolve(__dirname, '..', '..', 'supabase', 'schema.sql'), 'utf8')
const code = sql.replace(/--[^\n]*/g, '')

describe('supabase/schema.sql', () => {
  it('creates table profiles keyed on auth.users with a cascade', () => {
    expect(code).toMatch(/create table if not exists public\.profiles/)
    expect(code).toMatch(/id uuid primary key references auth\.users \(id\) on delete cascade/)
  })

  it('declares exactly the columns the adapter writes, plus created_at', () => {
    const r = normaliseProfile({ ageRange: '22-25', consentAt: '2026-11-15T10:00:00Z' })
    if (!r.ok) throw new Error('fixture')
    const body = /create table if not exists public\.profiles \(([\s\S]*?)\n\);/.exec(code)?.[1] ?? ''
    const columns = body
      .split('\n')
      .map((l) => /^\s{2}([a-z_]+) (uuid|text|timestamptz|boolean)\b/.exec(l)?.[1])
      .filter((c): c is string => !!c)
    expect(columns.sort()).toEqual([...Object.keys(toRow('u', r.profile)), 'created_at'].sort())
  })

  it('has a CHECK with the eight age ranges, in the same spelling as the client', () => {
    const m = /age_range text not null check \(age_range in \(([^)]*)\)\)/.exec(code)
    expect(m).not.toBeNull()
    const values = [...(m?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1])
    expect(values).toEqual([...AGE_RANGES])
  })

  it('has consent_at not null', () => {
    expect(code).toMatch(/consent_at timestamptz not null/)
  })

  it('turns row level security on', () => {
    expect(code).toMatch(/alter table public\.profiles enable row level security/)
  })

  it('has one policy per operation, each limited to the owner, and none for anon or public', () => {
    const policies = [...code.matchAll(/create policy "([^"]+)" on public\.profiles\s+for (\w+) to (\w+)([\s\S]*?);/g)]
    expect(policies.map((p) => p[2]).sort()).toEqual(['delete', 'insert', 'select', 'update'])
    for (const p of policies) {
      expect(p[3]).toBe('authenticated')
      expect(p[4]).toMatch(/auth\.uid\(\)\) = id/)
    }
    expect(code).toMatch(/revoke all on table public\.profiles from anon/)
  })

  it('enforces the under-15 minimum in the database too', () => {
    expect(code).toMatch(/age_range <> '-15' or parental_confirmation or \(first_name is null and region is null and school is null\)/)
  })

  it('names no project, key or user', () => {
    expect(sql).not.toMatch(/eyJ|supabase\.co/)
  })
})
