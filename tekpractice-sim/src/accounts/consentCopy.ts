import type { ProfileKey } from './profileModel'

/**
 * DRAFT legal copy for the account: the privacy notice, the consent text, the parent confirmation text.
 * EVERY section is marked « à valider »: none of it is validated by a lawyer or by the person responsible, and the placeholders
 * between square brackets must be filled in before the `accounts` switch is turned on. Plain French, « vous ».
 */

export const DRAFT_MARK = 'à valider'

export interface CopySection {
  id: string
  title: string
  mark: typeof DRAFT_MARK
  /** One string per paragraph; a line that starts with « - » is a list item. */
  paragraphs: string[]
}

const section = (id: string, title: string, paragraphs: string[]): CopySection => ({ id, title, mark: DRAFT_MARK, paragraphs })

/** The heading shown to the learner: the title and the draft mark. */
export function headingOf(s: CopySection): string {
  return `${s.title} (${s.mark})`
}

/** The whole text of a section as one string (heading and paragraphs), for tests and for search. */
export function plainText(s: CopySection): string {
  return [headingOf(s), ...s.paragraphs].join('\n')
}

export interface DataItem {
  /** A profile key, or one of the two sign-in items. */
  key: ProfileKey | 'email' | 'password'
  label: string
}

/** The data collected, item for item. A test pins this list to the allowed profile keys. */
export const DATA_ITEMS: DataItem[] = [
  { key: 'email', label: 'votre adresse e-mail' },
  { key: 'password', label: 'votre mot de passe (conservé sous forme chiffrée par le service de connexion ; il n’est pas lisible)' },
  { key: 'ageRange', label: 'votre tranche d’âge' },
  { key: 'goal', label: 'votre but choisi dans le jeu (par exemple une formation)' },
  { key: 'firstName', label: 'votre prénom (facultatif)' },
  { key: 'region', label: 'votre ville ou votre région (facultatif)' },
  { key: 'school', label: 'votre établissement, si votre but est une formation (facultatif)' },
  { key: 'parentalConfirmation', label: 'la confirmation d’un parent ou tuteur, si vous avez moins de 15 ans' },
  { key: 'consentAt', label: 'la date de votre consentement' },
]

export const PRIVACY_TITLE = 'Vos données et votre compte'

export const PRIVACY_SECTIONS: CopySection[] = [
  section('responsable', 'Qui est responsable de vos données', [
    'Le responsable du traitement de vos données est [nom et prénom], à titre personnel, en France.',
  ]),
  section('finalites', 'Pourquoi vos données sont utilisées', [
    'Vos données servent à une seule chose : créer et faire fonctionner votre compte (votre profil et votre but dans le jeu). Vos projets restent sur votre appareil.',
    'Il n’y a aucune publicité, aucune vente ni cession de vos données, et aucun profilage.',
  ]),
  section('base-legale', 'Sur quelle base', [
    'Vos données ne sont enregistrées qu’avec votre consentement. Vous pouvez le retirer à tout moment, en supprimant votre compte depuis « Mon compte ».',
  ]),
  section('donnees', 'Les données enregistrées', [
    'Voici les seules données enregistrées :',
    ...DATA_ITEMS.map((d) => `- ${d.label} ;`),
    'Il n’y a pas de date de naissance, pas de numéro de téléphone, pas d’adresse postale et aucun champ pour votre employeur.',
    'Jouer sans compte n’enregistre rien sur les serveurs de TekPractice : votre travail reste sur votre appareil.',
  ]),
  section('hebergement', 'Où elles sont hébergées', [
    'Vos données sont hébergées chez Supabase, à Francfort (Allemagne), dans l’Union européenne.',
  ]),
  section('conservation', 'Combien de temps', [
    'Vos données sont conservées jusqu’à la suppression de votre compte. « Supprimer mon compte » efface votre profil et votre connexion, sans possibilité de retour.',
  ]),
  section('droits', 'Vos droits', [
    'Vous avez le droit :',
    '- d’accès à vos données ;',
    '- de rectification, pour les corriger ;',
    '- d’effacement, pour les supprimer ;',
    '- de portabilité, pour les récupérer ;',
    '- de retirer votre consentement à tout moment.',
    'Vous pouvez aussi déposer une réclamation auprès de la CNIL (cnil.fr).',
  ]),
  section('moins-de-15-ans', 'Si vous avez moins de 15 ans', [
    'Un compte ne peut être créé qu’avec la confirmation d’un parent ou d’un tuteur. Sans cette confirmation, seuls la tranche d’âge et le but sont demandés, et vous continuez à jouer sans compte, sur votre appareil.',
  ]),
  section('contact', 'Contact', [
    'Pour exercer vos droits ou poser une question : privacy@tekonest.com.',
  ]),
]

/** The sentence next to the unticked consent box. */
export const CONSENT_TEXT: CopySection = section('consentement', 'Votre consentement', [
  'Vous acceptez que TekPractice enregistre les données listées ci-dessus pour créer votre compte. Vous pouvez retirer ce consentement à tout moment en supprimant votre compte.',
])

/** The sentence next to the parent or guardian box (learners under 15). */
export const PARENT_CONFIRMATION_TEXT: CopySection = section('confirmation-parentale', 'Confirmation d’un parent ou tuteur', [
  'Vous confirmez être le parent ou le tuteur légal de la personne qui crée ce compte, et vous autorisez cette création.',
])

export const ALL_LEGAL_TEXTS: CopySection[] = [...PRIVACY_SECTIONS, CONSENT_TEXT, PARENT_CONFIRMATION_TEXT]
