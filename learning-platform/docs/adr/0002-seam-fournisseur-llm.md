# ADR 0002 — Seam fournisseur LLM : Claude et Gemini interchangeables

**Date :** 15 juillet 2026 · **Statut :** accepté · **Motivation :** demande du propriétaire (« peut-on connecter Gemini au tuteur ? »).

## Contexte

L'ADR 0001 a isolé le tuteur derrière l'interface client `AiTutor`, mais la route serveur `/api/tutor` appelait directement le SDK Anthropic. Le propriétaire souhaite pouvoir utiliser Gemini — notamment parce que Google AI Studio offre un palier gratuit, ce qui permet d'activer le tuteur sans coût.

## Décision

Un second seam, côté serveur cette fois : l'interface **`TutorLlm`** (`src/lib/ai/llm.ts`) réduit le contrat au strict nécessaire — `streamText({system[], messages, maxTokens}) → AsyncIterable<string>`. Deux implémentations :

| Impl | SDK | Modèle par défaut | Particularités |
|---|---|---|---|
| `AnthropicTutorLlm` | `@anthropic-ai/sdk` | `claude-opus-4-8` | thinking adaptatif, effort medium, prompt caching sur le bloc stable |
| `GeminiTutorLlm` | `@google/genai` (officiel) | `gemini-2.5-flash` | blocs système concaténés en `systemInstruction` ; cache implicite des modèles 2.5 |

**Sélection par environnement, zéro code** (`resolveProvider`, pur et testé) :
1. `TUTOR_PROVIDER` force un fournisseur (sa clé doit exister, sinon 501 — pas de repli silencieux vers un fournisseur non demandé) ;
2. sinon, première clé présente gagne, Anthropic en priorité ;
3. `TUTOR_MODEL` surcharge le modèle du fournisseur actif ;
4. aucune clé → la route répond 501, l'UI affiche l'état non configuré.

Tout le reste — corpus, retrieval, contrat de prompt socratique, validation des citations, garde-fous de requête, UI — est partagé à l'identique entre fournisseurs.

## Conséquences

- **Les garanties comportementales sont testables par fournisseur** : les tests d'intégration (`tutor.integration.test.ts`) passent désormais par la factory et s'exécutent contre le fournisseur configuré. Avant de mettre Gemini en production, exécuter `npx vitest run tutor.integration` avec `GEMINI_API_KEY` — les trois garanties (refus de réponse d'examen, aveu d'ignorance, citations valides) doivent tenir sur le modèle choisi, le contrat de prompt ayant été réglé sur Claude.
- Le prompt caching Anthropic est exprimé par le flag neutre `cacheable` sur les blocs système ; chaque impl le traduit dans son idiome (ou l'ignore).
- Ajouter un troisième fournisseur = une classe + une entrée dans la factory + un défaut de modèle.

## Alternatives écartées

- **Un agrégateur type gateway/OpenRouter** : dépendance d'infrastructure supplémentaire et perte des spécificités utiles (caching Anthropic) pour seulement deux fournisseurs.
- **Choix du fournisseur côté client** : la sélection appartient à l'exploitant (coûts, quotas), pas à l'utilisateur final ; l'env serveur est le bon niveau.
