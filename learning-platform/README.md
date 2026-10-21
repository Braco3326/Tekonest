# Tech Nest

Plateforme d'apprentissage gratuite pour réussir le **BTS Métiers de l'audiovisuel, option Métiers du Son** — conforme au référentiel officiel (arrêté du 4 juin 2013, RNCP37196).

**Production :** https://tech-nest-web-gamma.vercel.app

## Modèle pédagogique

Chaque cours correspond à une épreuve du BTS (E1–E6) avec son coefficient réel et ses blocs de compétences RNCP. Un cours = unités ordonnées (leçon + quiz) → enquête → examen blanc. L'examen ne se déverrouille qu'une fois toutes les unités et l'enquête terminées ; ≥ 70 % délivre un certificat (code de vérification, validité 3 ans).

Cours complet aujourd'hui : **E3 / Physique et technologie des équipements du son** (6 unités, examen blanc de 24 questions style annales). Les autres épreuves sont des coquilles honnêtes « en préparation ».

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Vitest. Auth et progression sont mockées (localStorage) derrière deux interfaces swappables (`AuthProvider`, `ProgressStore`) — voir `docs/PRODUCT-LATER.md` pour le passage à un vrai backend.

## Développement

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # 28 tests (gating + persistance)
npm run build
```

## Documentation

- `docs/design-system.md` — tokens et principes visuels
- `docs/PRODUCT-LATER.md` — seams d'architecture (backend, simulateur audio E4)
- `docs/ASSUMPTIONS.md` — hypothèses prises pendant la construction
