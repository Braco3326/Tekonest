# Phase 4 — Site map and page outlines

> Revised 28 Oct 2026: two doors (*Se former*, *Créer avec nous*); the network is set aside and `reseau.html` is removed; `organiser.html` became `creer.html`. The sections below describing three doors, the Réseau page or the Organiser page are historical.

> Revised 24 Oct 2026: the Soirées page was removed from the site (it belongs to the separate project [Rebels × Tekonest](../projects/rebels-x-tekonest/README.md)); the home page no longer has a « Notre direction » section.

> Agents: **tekuxwriter** (copy) and **tekfrontenddesigner** (structure). Implemented in [`website-prototype/`](../website-prototype/).
> Navigation is **task-based**, not audience-based: Nielsen Norman Group warns that audience-split navigation degrades usability because people belong to several groups. Audience routing happens through the three **doors** on the home page.

```
Accueil (index.html)
├── Créer avec nous (creer.html)      — porteuses et porteurs de projet · quatre familles : création sonore, prise de son, live, direction artistique/mixage/mastering · « Offre en projet »
├── Apprendre (apprendre.html)        — étudiants BTS Son · cable ambre · « En développement »
├── TekPractice (tekpractice.html)    — étudiants BTS Son · cable bleu · « En développement »
├── L'histoire (histoire.html)        — tout le monde
├── Contact (contact.html)            — adresse e-mail à définir, pas de formulaire
└── Accessibilité (accessibilite.html, footer)
```

## Home page: answering the six questions

| Question | Where it is answered |
| --- | --- |
| What is Tekonest? | Hero h1 and lead: « Un nid pour les métiers du son. » plus the one-line offer |
| Why was it created? | « Pourquoi Tekonest existe »: the founding conviction and the origin of the name |
| Who is it for? | Three doors: Se former (BTS Son students) · Créer avec nous (organisateurs et lieux) · Rejoindre le réseau (artistes, techniciennes et techniciens) |
| What does each branch offer? | Doors, learning band and status board |
| How do the branches connect? | « Comment tout se relie »: each link labelled Prévu / En partie construit / À décider / Plus tard |
| What can I do here now? | Hero honesty line, doors (each leads to an explanatory page) and « Ce que vous pouvez faire aujourd'hui » (read the story, write to us) |

**Five-second test (proxy).** The first screen at 1440 px and 375 px shows the h1, the lead, the honesty line and the first door. At 1440 px all three doors and their status tags are visible above the fold. See [`07-review/screens/index-1440.jpg`](07-review/screens/index-1440.jpg).

## Branch page template

1. **Branch hero:** cable rule, status tag, h1 (a plain promise), lead.
2. **Three columns:** what exists today · what is being prepared · what is still to decide. Organiser uses a variant: what we could offer · why not yet · what you can do.
3. **Branch-specific block:**
   - Réseau: the 8-step pathway (a real sequence, so it is numbered);
   - Apprendre and TekPractice: a product preview in its own skin.
4. **Imagery:** honest photo slots, only where real photos exist.
5. **Action:**
   - disabled sign-up (Réseau);
   - "access coming soon" (Apprendre, TekPractice);
   - "Écrire à Tekonest" (Organiser).

## Calls to action, one per audience

| Audience | CTA label | Where it goes | Why it is honest |
| --- | --- | --- | --- |
| Artists, technicians | Rejoindre le réseau | Réseau page | Explains the principles; inscriptions open only after pay principles are published |
| Organisers | Parlez-nous de votre événement | Organiser page, then Contact | Says clearly that it is not an offer, a quote or a commitment. Also names partner projects such as Rebels × Tekonest (en réflexion), with no programme details |
| Students | La plateforme pour réussir le BTS Son / TekPractice | Branch pages | A disabled "Accès bientôt disponible" button, with no dead link |

**Before any external test:** set a contact e-mail (F-05). Until then « Écrire à Tekonest » leads to a contact page that says the address is still to be chosen.

## English later

All copy lives in `src/pages/*.html` fragments with `lang="fr"`. An English version would add `src/pages/en/` and a language switch in the header, with no layout change.
