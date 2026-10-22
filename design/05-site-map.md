# Phase 4 — Site map and page outlines

> Agents: **tekuxwriter** (copy) and **tekfrontenddesigner** (structure). Implemented in [`website-prototype/`](../website-prototype/).
> Navigation is **task-based**, not audience-based: Nielsen Norman Group warns that audience-split navigation degrades usability because people belong to several groups. Audience routing happens through the three **doors** on the home page.

```
Accueil (index.html)
├── Soirées (soirees.html)            — public · cable sodium · « Soirée pilote en projet »
├── Réseau (reseau.html)              — artistes / technique · cable vert · « Réseau en projet »
├── Organiser (organiser.html)        — organisateurs · cable violet · « Offre en projet, pas encore proposée »
├── Apprendre (apprendre.html)        — étudiants BTS Son · cable ambre · « En développement »
├── TekPractice (tekpractice.html)    — étudiants BTS Son · cable bleu · « En développement »
├── L'histoire (histoire.html)        — tout le monde
├── Contact (contact.html)            — adresse e-mail à définir, pas de formulaire
└── Accessibilité (accessibilite.html, footer)
```

## Home page: answering the six questions

| Question | Where it is answered |
| --- | --- |
| What is Tekonest? | Hero h1 and lead: « Un nid pour les cultures et les métiers du son. » plus the one-line offer |
| Why was it created? | « Pourquoi Tekonest existe »: the founding conviction and the origin of the name |
| Who is it for? | Three doors: public · artistes, techniciennes et techniciens · organisateurs et lieux. Learning band: BTS Son students |
| What does each branch offer? | Doors, learning band and status board |
| How do the branches connect? | « Comment tout se relie »: each link labelled Prévu / En partie construit / À décider / Plus tard |
| What can I do here now? | Hero honesty line, doors (each leads to an explanatory page) and « Ce que vous pouvez faire aujourd'hui » (read the story, write to us) |

**Five-second test (proxy).** The first screen at 1440 px and 375 px shows the h1, the lead, the honesty line and the first door. At 1440 px all three doors and their status tags are visible above the fold. See [`07-review/screens/index-1440.jpg`](07-review/screens/index-1440.jpg).

## Branch page template

1. **Branch hero:** cable rule, status tag, h1 (a plain promise), lead.
2. **Three columns:** what exists today · what is being prepared · what is still to decide. Organiser uses a variant: what we could offer · why not yet · what you can do.
3. **Branch-specific block:**
   - Soirées: programming principles;
   - Réseau: the 8-step pathway (a real sequence, so it is numbered);
   - Apprendre and TekPractice: a product preview in its own skin.
4. **Imagery:** honest photo slots (Soirées).
5. **Action:**
   - disabled sign-up (Soirées, Réseau);
   - "access coming soon" (Apprendre, TekPractice);
   - "Écrire à Tekonest" (Organiser).

## Calls to action, one per audience

| Audience | CTA label | Where it goes | Why it is honest |
| --- | --- | --- | --- |
| Night-goers | Trouver une soirée | Soirées page | It shows the pilot is a project (no date); the sign-up is disabled |
| Artists, technicians | Rejoindre le réseau | Réseau page | Explains the principles; inscriptions open only after pay principles are published |
| Organisers | Parlez-nous de votre événement | Organiser page, then Contact | Says clearly that it is not an offer, a quote or a commitment |
| Students | La plateforme pour réussir le BTS Son / TekPractice | Branch pages | A disabled "Accès bientôt disponible" button, with no dead link |

**Before any external test:** set a contact e-mail (F-05). Until then « Écrire à Tekonest » leads to a contact page that says the address is still to be chosen.

## English later

All copy lives in `src/pages/*.html` fragments with `lang="fr"`. An English version would add `src/pages/en/` and a language switch in the header, with no layout change.
