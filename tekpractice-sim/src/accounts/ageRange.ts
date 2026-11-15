/**
 * The eight age ranges of the account profile. A range, never a birthdate: nothing finer is collected.
 * `-15` is the only range under 15; it triggers the parent-confirmation rule (see fieldsFor.ts).
 */
export const AGE_RANGES = ['-15', '15-17', '18-21', '22-25', '26-30', '31-35', '36-40', '41+'] as const

export type AgeRange = (typeof AGE_RANGES)[number]

const LABELS: Record<AgeRange, string> = {
  '-15': 'moins de 15 ans',
  '15-17': '15 à 17 ans',
  '18-21': '18 à 21 ans',
  '22-25': '22 à 25 ans',
  '26-30': '26 à 30 ans',
  '31-35': '31 à 35 ans',
  '36-40': '36 à 40 ans',
  '41+': '41 ans et plus',
}

export function isAgeRange(v: unknown): v is AgeRange {
  return typeof v === 'string' && (AGE_RANGES as readonly string[]).includes(v)
}

export function ageRangeLabel(r: AgeRange): string {
  return LABELS[r]
}

export function isUnder15(r: AgeRange): boolean {
  return r === '-15'
}
