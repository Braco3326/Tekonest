# Tekonest

Un nid pour les cultures et les métiers du son. Tekonest est une marque parisienne qui réunit des soirées métissées (musiques arabes, afro, électroniques), un réseau d'artistes et de techniciens payés correctement, et des outils pour apprendre le son (Apprendre, TekPractice).

**Nom** : toujours **TEKONEST** en capitales dans le logo et les titres de marque ; « Tekonest » dans une phrase. Jamais Techonest, Technest ou Thechnest.

## Voix

- Français d'abord, direct, chaleureux, sans jargon. « Nous », jamais « on ».
- Honnête sur l'état des choses : chaque offre porte un statut (Existe · En développement · En projet · À décider). Rien n'est présenté comme disponible s'il ne l'est pas.
- Les cultures sont nommées précisément (« musiques arabes, du Moyen-Orient au Maroc ») et racontées par celles et ceux qui les font vivre — jamais « oriental », jamais de décor exotique.
- Exemple : « Tekonest se construit pas à pas. Rien n'est encore en vente : ce site dit clairement ce qui existe et ce qui se prépare. »

## Fondations visuelles

**L'idée** : un nid tressé de fils, comme une boîte incrustée de Damas : du bois sombre, de la nacre, quelques pièces d'or. Beaucoup de vide autour, du détail précis là où il compte.

**Couleurs** (tokens `color`) :
- `ground` Papier `#F3EDE3` le jour, Nuit `#131114` pour les pages d'événements, le hero, les affiches.
- `ink` pour le texte et le logo ; `ink-2`, `ink-3` pour le secondaire.
- `ambre` (feuille d'or) : l'accent **sur Nuit uniquement**. Sur Papier il tombe à 2,2:1 — jamais en texte ni en logo sur fond clair.
- `prune` (bois teinté rouge) : l'accent sur Papier.
- `noyer` : les filets des Cadres. `nacre` : les pièces claires.

**Typographie** : Tektur (Google Fonts) pour l'affichage et le nom, IBM Plex Sans (Google Fonts) pour le texte. Pas d'autre police. Les titres en Tektur restent courts.

**Angles** : `radius-0` partout (la marqueterie est coupée droit). Seuls les statuts sont arrondis.

## Le logo — le nid tressé (L4)

Sept ellipses (rx 100, ry 82 sur une grille de 260) tournées de 360/7 et décalées de 8 unités : sept fils, sept personnes du réseau. Fichiers dans le groupe **Logos** :
- `TEKONEST-lockup` (nid au-dessus, nom dessous) — logo principal ; `-reverse` sur Nuit ; `-amber-on-night` pour affiches et soirées.
- `TEKONEST-horizontal` — en-tête de site.
- `tekonest-mark` — le nid seul (avatar) ; `tekonest-favicon` traits épaissis pour 16–32 px.
- Ne pas déformer, ne pas remplir, ne pas ajouter d'ombre. Zone de protection : la hauteur d'une ellipse ÷ 4.

## Les motifs damascènes (composants)

Tirés des boîtes incrustées de Damas (marqueterie de bois et de nacre) — on emprunte la **méthode**, pas l'ornement :
- **Cadre** : double filet `noyer` décalé de 7 px + un coin `ambre` en triangle. Pour les cartes et les blocs importants.
- **Médaillon** : une étoile à 12 branches {12/5}, trait fin, derrière le nid ou comme puce. **Un seul grand médaillon par page.**
- **Bande** : une rangée de 14 px de pièces répétées (losange nacre, carré ambre, carré prune) sur Nuit. Uniquement comme séparateur entre grandes parties, en pied de page, sur les affiches et le merch.
- **Onde** : l'ondulation de l'acier de Damas, des couches de lignes qui se plient comme une onde sonore. Fond de hero ou d'affiche, en ton sur ton (`noyer`/`ambre` sur Nuit), jamais derrière du texte courant.

**Règles** : pas de fausse calligraphie, pas de versets, pas de lanternes, mosaïques ou motifs collés en décor. Créditer la source (« inspiré de la marqueterie de Damas »). Idéalement, faire réaliser une vraie pièce par un artisan de Damas et la payer correctement.

## Mouvement

- Ouverture : **Poussière → nid** (les points se rassemblent en sept fils qui vibrent).
- Rythme : **le nid qui bat** (une onde ambre à chaque battement, ~112 BPM).
- Toujours respecter `prefers-reduced-motion` : montrer l'état final, sans mouvement.

## Accessibilité

WCAG 2.2 AA : texte ≥ 4,5:1, éléments non textuels ≥ 3:1. La couleur ne porte jamais seule un sens : les branches se distinguent par leur nom et leur style de filet, les statuts par une forme (● ◐ ○ □) et un texte.
