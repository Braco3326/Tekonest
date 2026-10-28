# Propositions pour Oscar

Générées par `npx tsx tools/propose-content.ts` à partir de la base de connaissances (`knowledge-base/`). Rien ici ne modifie `content/catalog.json` (le seul catalogue vérifié) ni la liste des niveaux jouables : c'est à toi de relire puis de copier ce que tu veux garder.

**Les appareils de `catalog-proposals.json` alimentent l'onglet « Bêta » du Mode Création** (Task 30) : ils y sont proposés tels quels, avec la pastille « non vérifié » et le comportement approximatif (seuls les ports déclarés ci-dessous existent ; aucune fiche n'a été relue avant d'être exposée, seulement marquée). Ils ne sont **pas** dans le catalogue vérifié et n'entrent dans aucun niveau. Les brouillons de niveaux, eux, ne sont pas en jeu.

| Fichier | Contenu |
|---|---|
| `catalog-proposals.json` | Entrées de catalogue prêtes à copier pour les appareils de la KB notés « forte valeur simulateur » et absents du catalogue. Validées avec le schéma `Device` du catalogue. Les ports viennent des connecteurs sourcés de la KB (2 ports max par type, comme le catalogue). `requiresPhantom` n'est posé que si la spec sourcée de la KB indique +48 V. **À vérifier à la main** : les autres flags (`providesPhantom`, horloge, `isMonitorOut`, Dante) et les catégories. `skipped` liste les appareils écartés et pourquoi. |
| `../levels/drafts/*.json` | Brouillons de niveaux tirés des scénarios TEK Brain. Chaque liaison du scénario est résolue en vraie paire de ports avec le `canConnect` du moteur. Le bloc `draft` liste les nœuds sans appareil au catalogue et les liaisons non résolues. Titre préfixé « [BROUILLON] ». Non enregistrés dans `src/main.ts`. |

Pour publier un brouillon : relis-le, ajoute un `layout`, choisis un `environment`, renomme l'id (sans `draft-`), copie-le dans `content/levels/` et enregistre-le dans `src/main.ts` (`LEVELS`), puis lance `npm run validate:catalog`.
