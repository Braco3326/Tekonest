# ADR 0001 — Assistant IA : tuteur socratique ancré (RAG léger)

**Date :** 13 juillet 2026 · **Statut :** accepté · **Décideur :** construction autonome (mission brief), à ratifier par le propriétaire du produit.

## Contexte

Le brief produit exige un tuteur IA qui : (1) répond UNIQUEMENT depuis les sources de la plateforme (référentiel officiel, cours E3/PTES, index des annales, blocs RNCP) et cite sa source ; (2) est socratique — il guide, il ne donne jamais la réponse toute faite (positionnement anti-triche, opposé aux plateformes type Chegg) ; (3) explique une annale pas à pas, génère des exercices ciblés, détecte les points faibles depuis le ProgressStore ; (4) utilise l'API Claude en streaming, clé en variable d'environnement, derrière une interface swappable `AiTutor`.

## Décisions

### 1. Récupération : corpus typé + scoring lexical, pas de base vectorielle

Le « RAG » est un module de récupération sur les données typées existantes (`src/lib/ai/corpus.ts`) : les leçons sont aplaties en passages par section h2, le référentiel et les annales deviennent des passages dédiés, chacun avec un id stable citable. La recherche est un scoring lexical français (normalisation des accents, stop-words, fréquence plafonnée + bonus titre), top-6.

**Pourquoi :** le corpus est petit (~80 passages), déjà structuré et versionné dans le repo. Une base vectorielle ajouterait une dépendance d'infrastructure, un pipeline d'embeddings et de la latence pour un gain de rappel marginal à cette échelle. Le module expose `retrieve()` derrière une signature simple : si le corpus grossit (tous les cours ouverts), on remplace l'implémentation par des embeddings sans toucher ni au prompt ni à la route.

**Conséquence assumée :** le rappel lexical est imparfait (synonymes non couverts). Le prompt compense : sans extrait pertinent, le tuteur doit le dire et orienter, jamais improviser.

### 2. Ancrage et citations : contrat de prompt + validateur post-génération

Le prompt système impose : faits uniquement depuis le bloc SOURCES, syntaxe `[source: id]` après chaque affirmation, aveu explicite quand l'information manque. Côté serveur, un validateur (`findInvalidCitations`) vérifie après génération que chaque id cité existe dans le corpus ; toute citation inconnue déclenche un avertissement visible ajouté à la réponse. Côté client, les marqueurs de citation sont rendus comme des puces cliquables vers la page source.

**Pourquoi :** on ne peut pas garantir mécaniquement qu'un LLM n'invente rien ; on peut garantir que (a) il n'a accès qu'aux sources fournies dans son contexte, (b) toute référence fabriquée est détectée et signalée à l'étudiant. C'est la même philosophie de transparence que le reste du site.

### 3. Socratique : règle de prompt testée, pas de filtre côté code

Le refus de donner une réponse d'évaluation est porté par le prompt (règle n°2, avec l'exception explicite : le corrigé d'un exercice généré par le tuteur est permis). Vérifié par tests d'intégration live (`tutor.integration.test.ts`, sautés sans clé API). Un filtre côté code (regex sur « la réponse est ») serait trivialement contournable et produirait des faux positifs ; le comportement du modèle est le bon niveau d'application, et il est testé.

### 4. Architecture : route serveur Next + seam `AiTutor`

- **Interface `AiTutor`** (`src/lib/ai/types.ts`) : `streamReply(messages, context, signal) → AsyncIterable<string>`. Implémentation par défaut `ApiAiTutor` → `POST /api/tutor`. Le swap est une ligne dans `providers.tsx`, règle identique à `AuthProvider`/`ProgressStore`.
- **La clé ne quitte jamais le serveur** : `ANTHROPIC_API_KEY` est lue dans la route (`src/app/api/tutor/route.ts`), jamais exposée au client, jamais commitée (`.env*` est gitignoré ; `.env.example` documente les variables). Sans clé, la route répond 501 et l'UI affiche un état « non configuré » propre.
- **Streaming** : SDK officiel `@anthropic-ai/sdk`, `client.messages.stream()`, deltas texte re-streamés en `text/plain` chunké vers le client. Pas de SSE côté client (inutile pour un flux texte simple).

### 5. Modèle et paramètres

- **Modèle : `claude-opus-4-8` par défaut**, surchargeable via `TUTOR_MODEL` (env). Justification : recommandation par défaut d'Anthropic à date ; la qualité pédagogique et la fidélité aux consignes d'ancrage priment pour un tuteur qui engage la crédibilité du site. Si le coût par conversation devient un sujet, basculer `TUTOR_MODEL=claude-sonnet-5` est un changement d'env, pas de code.
- **`thinking: adaptive` + `effort: medium`** : le raisonnement aide sur la physique ; `medium` limite la latence d'un usage conversationnel. Pas de `temperature`/`top_p` (supprimés sur Opus 4.7+, requête rejetée sinon).
- **Prompt caching** : system scindé en deux blocs — bloc 1 stable (règles, jamais de contenu dynamique) avec `cache_control: ephemeral`, bloc 2 variable (passages + progression). NB : le minimum cachable d'Opus 4.8 est 4096 tokens ; si le bloc stable est en-dessous, le marqueur est simplement sans effet (aucune erreur).
- **Garde-fous requête** : 24 messages max, 4 000 caractères par message, dernier message obligatoirement étudiant, `max_tokens: 2048`, `maxDuration: 60 s`.

### 6. Points faibles : calcul pur côté client depuis le ProgressStore

`computeWeakSpots(course, progress)` (`src/lib/ai/weakSpots.ts`) : quiz échoué (< 70 %), réussi de justesse (< 85 %), examen non validé, unité non commencée. Calculé dans `TutorPanel` via les hooks existants et envoyé comme contexte — la route n'a pas besoin d'accéder au stockage, ce qui préserve le seam `ProgressStore`.

**Limite acceptée :** le client pourrait envoyer une progression falsifiée — sans enjeu ici (cela ne change que la personnalisation du tuteur). À revoir quand un vrai backend portera la progression.

### 7. Vie privée

Les conversations ne sont pas persistées côté serveur (la route est sans état). Elles transitent par l'API Anthropic sous les conditions de rétention du compte API. Affiché dans l'UI.

## Alternatives écartées

- **Appel Anthropic direct depuis le client** : exposerait la clé. Rejeté.
- **Base vectorielle (pgvector, Pinecone...)** : sur-ingénierie à cette échelle (décision 1).
- **Filtre anti-réponse côté code** : contournable et faux positifs (décision 3).
- **Historique de conversation persisté** : hors périmètre tant que le backend est mocké ; le jour venu, il passera par le `ProgressStore` réel.

## Tests

- `tutor.test.ts` (unitaires, toujours exécutés) : corpus/retrieval (dont requête hors-domaine → 0 passage), contrat du prompt (les 3 règles y figurent, stabilité byte-à-byte du bloc cachable), extraction/validation des citations, détection des points faibles.
- `tutor.integration.test.ts` (live, sautés sans `ANTHROPIC_API_KEY`) : refuse la lettre d'une question d'examen et guide ; avoue son ignorance sur un fait inventé ; cite des sources réelles et uniquement des sources réelles.
