import { DATA_ITEMS, DRAFT_MARK, type DataItem, PRIVACY_SECTIONS } from './consentCopy'

/**
 * The PUBLIC privacy policy page of TekPractice (https://tekonest.com/tekpractice/confidentialite/), as data. Every French string of
 * the page is in this file; tools/privacyPage.ts turns it into HTML (a pure function) and tools/build-privacy-page.ts writes the file.
 *
 * Content: TekoData, E:\CLAUDE BU\reports\tekodata-privacy-policy.md (2026-11-16), with the edits ordered for the release where
 * sign-up is still OFF: every [bracketed] sentence deleted; Resend and Google named once live on Supabase (see PRIVACY_INCLUDES); one sentence at the
 * top of section 3 saying account creation is not open yet. Nothing here is legal advice: TekoData and the founder own the content.
 *
 * Voice: the page speaks AS Tekonest (« nous », TekoData's text) TO the reader (« vous »). The account dialog (consentCopy.ts) keeps
 * « vous » only; tests/accounts/privacyPolicy.test.ts pins the facts the two share.
 *
 * Inline markup in the strings: **bold**. The renderer links privacy@tekonest.com (mailto) and « cnil.fr » (https://www.cnil.fr) itself.
 */

/**
 * What the page says about the services that are NOT live in this release. The accounts release flips each one with ONE change:
 * - `resend`: Resend sends the service e-mails (section 5 bullet, section 6 sentence). True only once Resend is configured.
 * - `google`: « Continuer avec Google » (section 3 paragraph, section 5 bullet, section 6 sentence). True only once Google sign-in is configured.
 * - `signUpOpen`: account creation is open; while false, section 3 opens with the sentence that it is not open yet.
 */
export interface PrivacyIncludes {
  resend: boolean
  google: boolean
  signUpOpen: boolean
}

/** 2026-11-16: Resend and Google are live on the Supabase side (TekoData's word), so the page names them; sign-up itself is still not open. */
export const PRIVACY_INCLUDES: Readonly<PrivacyIncludes> = { resend: true, google: true, signUpOpen: false }

/**
 * The page-wide draft mark (in the <title> and the <h1>). ONE place: set it to false once TekoData and the founder have validated
 * the text, and « à valider » disappears from the whole page (a test pins that).
 */
export const PAGE_IS_DRAFT = true
export const PAGE_DRAFT_MARK = DRAFT_MARK

export const PRIVACY_PAGE_PATH = '/tekpractice/confidentialite/'
export const PRIVACY_PAGE_TITLE = 'Politique de confidentialité de TekPractice'
export const PRIVACY_PAGE_DESCRIPTION =
  'Comment TekPractice, publié par Tekonest, utilise vos données : ce qui est enregistré, pourquoi, où, combien de temps, et comment exercer vos droits.'
export const PRIVACY_UPDATED = 'Dernière mise à jour : 16 novembre 2026'
export const PRIVACY_CONTACT = 'privacy@tekonest.com'

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'table'; caption: string; head: [string, string, string]; rows: [string, string, string][] }

export interface PolicySection {
  id: string
  title: string
  blocks: Block[]
}

/** The dialog's own sentences the page repeats word for word (single source: consentCopy.ts). */
const dialogParagraph = (sectionId: string): string => {
  const s = PRIVACY_SECTIONS.find((x) => x.id === sectionId)
  if (!s || s.paragraphs.length === 0) throw new Error(`consentCopy has no section ${sectionId}`)
  return s.paragraphs[0]
}

/**
 * The data list of section 3: the dialog's DATA_ITEMS, in the same order, with the labels the page words differently, plus the
 * technical sign-in data the dialog does not list. A test maps every DATA_ITEMS key to its page item.
 */
export const PAGE_DATA_LABEL_OVERRIDES: Partial<Record<DataItem['key'], string>> = {
  password: 'votre mot de passe, transformé de façon irréversible par le service de connexion (personne ne peut le lire, pas même Tekonest)',
}

export const TECHNICAL_DATA_ITEM =
  'des informations techniques de connexion : la date de création du compte, la date de votre dernière connexion et, tant que vous êtes connecté(e), l’adresse IP et le type de navigateur utilisés pour cette connexion'

export interface PageDataItem {
  key: DataItem['key'] | 'technical'
  text: string
}

export function pageDataItems(): PageDataItem[] {
  return [...DATA_ITEMS.map((d) => ({ key: d.key, text: PAGE_DATA_LABEL_OVERRIDES[d.key] ?? d.label })), { key: 'technical', text: TECHNICAL_DATA_ITEM }]
}

const listOf = (items: string[]): string[] => items.map((t, i) => `${t}${i === items.length - 1 ? '.' : ' ;'}`)

export const SIGN_UP_NOT_OPEN =
  'La création de compte n’est pas encore ouverte : tant qu’elle ne l’est pas, rien n’est envoyé au service de comptes. Cette section décrit ce qui sera enregistré le jour où elle ouvrira.'

export const GOOGLE_DATA_PARAGRAPH =
  '**Si vous vous connectez avec Google**, Google nous transmet votre adresse e-mail, votre nom et le lien vers votre photo de profil Google. Ils sont enregistrés avec votre compte. Google sait alors que vous vous êtes connecté(e) à TekPractice.'
export const RESEND_RECIPIENT = '**Resend** : envoie les e-mails de service (confirmation, nouveau mot de passe) depuis l’adresse no-reply@tekonest.com.'
export const GOOGLE_RECIPIENT = '**Google** : seulement si vous choisissez « Continuer avec Google ».'

/** Section 6: the American companies named, and what each one may process outside the EU (TekoData's sentence, split per company). */
function transferParagraph(inc: PrivacyIncludes): string {
  const companies: { name: string; data: string }[] = [{ name: 'Cloudflare', data: 'votre adresse IP lors d’une visite' }]
  if (inc.google) companies.push({ name: 'Google', data: 'vos informations Google si vous utilisez ce bouton' })
  if (inc.resend) companies.push({ name: 'Resend', data: 'votre adresse e-mail pour l’envoi d’un message' })
  const names = companies.map((c) => c.name)
  const who =
    names.length === 1 ? `**${names[0]} est une société américaine**` : `**${names.slice(0, -1).join(', ')} et ${names[names.length - 1]} sont des sociétés américaines**`
  const data = companies.map((c) => c.data).join(', ')
  return `Cependant, ${who}. Certaines données (${names.length === 1 ? `par exemple ${data}` : data}) peuvent donc être traitées hors de l’Union européenne. Ces transferts sont encadrés par les garanties prévues par le RGPD.`
}

export const PRIVACY_INTRO =
  'TekPractice est un jeu d’apprentissage du son, publié par Tekonest sur tekonest.com. Cette page vous explique, simplement, quelles données sont utilisées, pourquoi, où elles vont et comment exercer vos droits.'

/** The whole page body, for a given set of includes (default: this release). */
export function policySections(inc: PrivacyIncludes = PRIVACY_INCLUDES): PolicySection[] {
  return [
    {
      id: 'responsable',
      title: '1. Qui est responsable de vos données',
      blocks: [
        { kind: 'p', text: dialogParagraph('responsable') },
        { kind: 'p', text: `Pour toute question ou pour exercer vos droits : **${PRIVACY_CONTACT}**.` },
      ],
    },
    {
      id: 'sans-compte',
      title: '2. Jouer sans compte : rien n’est envoyé',
      blocks: [
        {
          kind: 'p',
          text: 'Vous pouvez utiliser TekPractice sans créer de compte. Dans ce cas, **aucune donnée personnelle n’est envoyée à Tekonest**. Votre travail (vos projets, vos plans 2D, vos réglages, votre progression dans le tutoriel et le but que vous avez choisi) est enregistré **uniquement dans votre navigateur, sur votre appareil**. Tekonest n’y a pas accès.',
        },
        { kind: 'p', text: 'Tant que vous n’avez pas coché la case de consentement puis validé un formulaire de compte, le jeu n’envoie rien au service de comptes.' },
      ],
    },
    {
      id: 'donnees',
      title: '3. Si vous créez un compte : les données enregistrées',
      blocks: [
        ...(inc.signUpOpen ? [] : [{ kind: 'p', text: SIGN_UP_NOT_OPEN } as Block]),
        { kind: 'p', text: 'Voici les seules données enregistrées sur nos serveurs :' },
        { kind: 'ul', items: listOf(pageDataItems().map((d) => d.text)) },
        ...(inc.google ? [{ kind: 'p', text: GOOGLE_DATA_PARAGRAPH } as Block] : []),
        {
          kind: 'p',
          text: 'Il n’y a **pas** de date de naissance, pas de numéro de téléphone, pas d’adresse postale et aucun champ pour votre employeur. **Vos projets ne sont pas envoyés** : ils restent sur votre appareil, même avec un compte.',
        },
      ],
    },
    {
      id: 'finalites',
      title: '4. Pourquoi, et sur quelle base',
      blocks: [
        {
          kind: 'table',
          caption: 'Ce que nous faisons de vos données, pourquoi, et sur quelle base légale',
          head: ['Ce que nous faisons', 'Pourquoi', 'Base légale'],
          rows: [
            [
              'Créer et faire fonctionner votre compte (connexion, profil, but)',
              'Vous permettre de vous connecter et de retrouver votre profil',
              'Votre **consentement**, donné en cochant la case avant la création du compte. Vous pouvez le retirer à tout moment en supprimant votre compte.',
            ],
            [
              'Garder des informations techniques de connexion (adresse IP, navigateur)',
              'Protéger votre compte et le service contre les abus',
              'Notre **intérêt légitime** à sécuriser le service',
            ],
            [
              'Vous envoyer des e-mails de service (confirmation de votre adresse, nouveau mot de passe)',
              'Faire fonctionner le compte',
              'Votre **consentement** (création du compte)',
            ],
            [
              `Répondre à vos messages à ${PRIVACY_CONTACT}`,
              'Traiter vos demandes',
              'Notre **obligation légale** de répondre à vos demandes sur vos données',
            ],
          ],
        },
        { kind: 'p', text: 'Il n’y a **aucune publicité**, aucune vente ni cession de vos données, aucun profilage et aucune décision automatique vous concernant.' },
      ],
    },
    {
      id: 'destinataires',
      title: '5. Qui reçoit vos données',
      blocks: [
        {
          kind: 'p',
          text: 'Seul Tekonest a accès à vos données de compte. Pour faire fonctionner le service, nous faisons appel à des prestataires (des « sous-traitants ») qui ne peuvent utiliser vos données que pour nous rendre ce service :',
        },
        {
          kind: 'ul',
          items: [
            '**Supabase** : héberge les comptes et la base de données, à **Francfort (Allemagne)**, dans l’Union européenne.',
            `**Cloudflare** : héberge le site tekonest.com et le transmet à votre navigateur. Comme pour tout site web, votre adresse IP lui est communiquée à chaque visite. Cloudflare achemine aussi les messages envoyés à ${PRIVACY_CONTACT} vers la boîte de réception de Tekonest.`,
            ...(inc.resend ? [RESEND_RECIPIENT] : []),
            ...(inc.google ? [GOOGLE_RECIPIENT] : []),
          ],
        },
      ],
    },
    {
      id: 'transferts',
      title: '6. Transferts hors de l’Union européenne',
      blocks: [
        { kind: 'p', text: 'Vos données de compte sont stockées dans l’Union européenne (Francfort).' },
        { kind: 'p', text: transferParagraph(inc) },
      ],
    },
    {
      id: 'conservation',
      title: '7. Combien de temps',
      blocks: [
        {
          kind: 'ul',
          items: [
            '**Votre compte et votre profil** : jusqu’à ce que vous supprimiez votre compte.',
            '**Les informations techniques de connexion** (adresse IP, navigateur) : jusqu’à votre déconnexion, la fin de votre session ou la suppression de votre compte. Les journaux techniques de Supabase sont effacés automatiquement après une courte durée.',
            '**Les données enregistrées sur votre appareil** : jusqu’à ce que vous les effaciez (par exemple en vidant les données du site dans votre navigateur).',
            `**Vos messages à ${PRIVACY_CONTACT}** : le temps de traiter votre demande.`,
          ],
        },
        { kind: 'p', text: 'Quand vous cliquez sur « **Supprimer mon compte** », votre profil et votre compte de connexion sont effacés immédiatement, sans retour possible.' },
      ],
    },
    {
      id: 'moins-de-15-ans',
      title: '8. Les moins de 15 ans',
      blocks: [
        { kind: 'p', text: 'En France, il faut avoir au moins 15 ans pour consentir seul(e) à l’utilisation de ses données en ligne.' },
        {
          kind: 'ul',
          items: [
            'Si vous avez **moins de 15 ans**, un compte ne peut être créé qu’avec la **confirmation d’un parent ou d’un tuteur**, donnée dans le formulaire.',
            'Sans cette confirmation, **aucun compte n’est créé** : vous continuez à jouer sans compte et rien n’est envoyé à Tekonest.',
            'Le prénom, la ville ou la région et l’établissement ne sont demandés qu’une fois cette confirmation donnée.',
          ],
        },
      ],
    },
    {
      id: 'cookies',
      title: '9. Cookies et stockage sur votre appareil',
      blocks: [
        { kind: 'p', text: 'TekPractice **ne dépose aucun cookie** et n’utilise **aucun outil de mesure d’audience ni de publicité**.' },
        { kind: 'p', text: 'Le jeu utilise le stockage local de votre navigateur, uniquement pour fonctionner :' },
        {
          kind: 'ul',
          items: listOf([
            'vos projets et leur sauvegarde automatique',
            'vos plans 2D',
            'votre progression dans le tutoriel, le profil et le but choisis au démarrage',
            'votre réglage d’affichage graphique',
            'si vous êtes connecté(e) : votre session de connexion, pour ne pas avoir à vous reconnecter à chaque visite',
          ]),
        },
        {
          kind: 'p',
          text: 'Ces informations restent sur votre appareil. Elles sont nécessaires au fonctionnement du jeu et ne demandent donc pas votre accord. Vous pouvez les effacer à tout moment depuis les réglages de votre navigateur (attention : vos projets enregistrés seront alors perdus).',
        },
      ],
    },
    {
      id: 'securite',
      title: '10. Sécurité',
      blocks: [
        {
          kind: 'ul',
          items: [
            'Les échanges entre votre navigateur et nos services sont chiffrés (HTTPS).',
            'Votre mot de passe n’est jamais conservé en clair.',
            'La base de données est protégée par des règles d’accès : chaque personne connectée ne peut lire, modifier ou supprimer **que sa propre ligne**. Une personne non connectée n’a accès à rien.',
            'La clé d’administration du service ne quitte jamais les serveurs de Supabase ; elle n’est jamais envoyée à votre navigateur.',
            'La suppression d’un compte ne peut être demandée que par la personne connectée elle-même.',
          ],
        },
      ],
    },
    {
      id: 'droits',
      title: '11. Vos droits',
      blocks: [
        { kind: 'p', text: 'Vous avez le droit :' },
        {
          kind: 'ul',
          items: [
            '**d’accès** : savoir quelles données nous avons sur vous, et en recevoir une copie ;',
            '**de rectification** : faire corriger vos données ;',
            '**d’effacement** : faire supprimer vos données. Le plus simple : « Mon compte », puis « **Supprimer mon compte** » ;',
            '**de portabilité** : recevoir vos données dans un format lisible par une machine ;',
            '**d’opposition** : vous opposer à l’usage de vos données fondé sur notre intérêt légitime ;',
            '**de retirer votre consentement** à tout moment, en supprimant votre compte ;',
            'de donner des **directives** sur le sort de vos données après votre décès.',
          ],
        },
        {
          kind: 'p',
          text: `Pour la suppression, le bouton « Supprimer mon compte » suffit. Pour tous les autres droits, écrivez à **${PRIVACY_CONTACT}** depuis l’adresse e-mail de votre compte. Nous vous répondrons dans un délai d’**un mois**.`,
        },
        { kind: 'p', text: 'Si vous estimez que vos droits ne sont pas respectés, vous pouvez déposer une réclamation auprès de la **CNIL** (cnil.fr).' },
      ],
    },
    {
      id: 'modifications',
      title: '12. Modifications',
      blocks: [
        {
          kind: 'p',
          text: 'Si cette politique change, la nouvelle version sera publiée sur cette page avec sa date de mise à jour. En cas de changement important, nous vous préviendrons dans le jeu ou par e-mail.',
        },
      ],
    },
  ]
}
