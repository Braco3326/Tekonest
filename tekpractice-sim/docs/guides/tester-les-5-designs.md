# Tester les cinq designs sur Votre PC

Ce guide Vous mène, pas à pas, à voir et à juger les cinq paquets de design de TekPractice (premier accueil, tutoriel, Oscar, couleurs et disposition). **Tout se passe sur Votre PC, sur une adresse locale (`localhost`) : rien n’est publié, rien n’est envoyé nulle part.**

Un paquet n’est pas un autre jeu : c’est la même simulation avec un autre habillage et un autre accueil. Sans `?design` dans l’adresse, Vous avez le jeu d’aujourd’hui, inchangé.

**Le verdict le plus important d’abord : l’épreuve des 3 minutes n’est pas tenue par les paquets 1 à 4.** Mesuré sur un parcours que le script connaît par cœur (plancher modélisé, **pas** un temps d’apprenant), un premier son demande 220 à 266 s par la boîte « Connecter à… » et 178 à 194 s par clic de port aux paquets 1 et 4 ; seul le paquet 5 (modèle déjà câblé) est loin sous 180 s (24 s). Le temps passe surtout à lire (environ 280 à 294 mots, 85 s), puis dans le temps machine du script (environ 66 s), puis dans les 30 gestes. Deux simplifications sont possibles et attendent Votre décision (elles changent la spécification, voir §8) : mettre les deux étapes du micro après le premier son, et proposer « Je branche pour vous » dès l’étape 8. Ces chiffres varient avec la charge de la machine (244,9 s au paquet 1 pendant un gros lot de tests).

**Un test propre, paquet après paquet.** La mémoire de la première visite et la sauvegarde automatique sont gardées **par adresse de navigateur** (`localhost:4392`), pas par paquet. Dès qu’un paquet a reçu une réponse, les suivants rouvrent le sélecteur ou Votre dernier banc au lieu de l’écran de départ, et un tutoriel resté en cours peut reprendre à une autre étape. **Pour chaque paquet, ouvrez donc une fenêtre de navigation privée neuve** (fermez *toutes* les fenêtres privées entre deux paquets : elles partagent la même mémoire tant qu’une reste ouverte), ou faites la remise à zéro complète du §5, quatrième ligne comprise.

## 1. Lancer

Dans un terminal (PowerShell), placez-Vous dans le dossier `tekpractice-sim` de la branche `design/onboarding-packs` (sur ce PC : `E:\dev\Tekonest-wt\onboarding\tekpractice-sim`), puis :

```powershell
npm run onboarding:local
```

Cette commande existe (script `onboarding:local` de `package.json`, fichier `tools/onboarding-local.mjs`). Si une variable d’environnement `TEKPRACTICE_BASE` est définie dans Votre terminal, les adresses ci-dessous ne répondront pas (page introuvable) : retirez-la avant de lancer. Elle fait trois choses, dans cet ordre :

1. elle **construit** cette copie du jeu (`npm run build`) : comptez un moment, et rien n’est servi si la construction échoue ;
2. elle **sert** le résultat sur le port **4392**, et seulement celui-là : si le port est déjà pris, elle s’arrête au lieu d’en prendre un autre ;
3. elle **affiche** les cinq adresses et un rappel pour revoir la première visite.

Laissez le terminal ouvert pendant que Vous testez. **Ctrl+C** arrête le serveur. Chaque nouvelle modification du code demande de relancer la commande (elle reconstruit à chaque fois).

*Ce que ce guide ne Vous garantit pas :* il a été écrit en lisant le script, sans le lancer. Si la commande échoue, copiez le message du terminal : c’est une information utile, pas une faute de Votre part.

## 2. Les cinq adresses

| Paquet | Nom | Adresse |
|---|---|---|
| 1 | Pas à pas | `http://localhost:4392/?design=1` |
| 2 | Atelier | `http://localhost:4392/?design=2` |
| 3 | Salle d’abord | `http://localhost:4392/?design=3` |
| 4 | Pupitre | `http://localhost:4392/?design=4` |
| 5 | Modèle d’abord | `http://localhost:4392/?design=5` |
| (aucun) | le jeu d’aujourd’hui | `http://localhost:4392/` |

Le paquet n’est **jamais mémorisé** : il vient de l’adresse. Pour passer d’un paquet à un autre, changez l’adresse (et rechargez) **dans une fenêtre privée neuve** (voir plus haut). Une adresse invalide (`?design=0`, `?design=6`, deux `design`) équivaut à l’absence de `?design`.

Les noms des paquets ne s’affichent nulle part dans le jeu (ils sont à valider par la relecture des textes) : Vous les reconnaissez à l’adresse et à l’aspect.

## 3. Ce que Vous verrez à chaque première visite

Sur un paquet, la première visite commence par un **écran de départ** : « Bienvenue : quelle est votre situation ? » avec quatre boutons (touches 1 à 4) :

- **Je découvre** ; **J’étudie le son** ; **Je monte un projet** ; **Je travaille dans le son**.

Puis une **offre** : « Faire le tutoriel (conseillé · N étapes, à votre rythme) » ou « Passer, je connais ». Les deux boutons sont égaux ; le tutoriel est conseillé, pas imposé. Votre choix ouvre la première salle du paquet, avec Oscar.

Pour juger un paquet tel qu’il est conçu, choisissez **Je découvre** (le paquet garde ses propres panneaux). « J’étudie le son » et « Je travaille dans le son » ouvrent les deux panneaux latéraux quand la fenêtre est assez large ; « Je travaille dans le son » met aussi Oscar en sourdine ; « Je monte un projet » ajoute, après le premier son, une carte sur Votre matériel et trois types de salle d’exemple.

Après un choix, la pastille de la barre d’état (« Profil : … · changer ») rouvre l’écran de départ. Le menu **Aide › Premiers pas** lance (ou relance) le tutoriel.

## 4. Ce qu’il faut regarder, paquet par paquet

Chaque paquet doit se reconnaître d’un coup d’œil, même en plissant les yeux. Pour chacun, regardez d’abord l’écran de départ, puis la première salle, puis le tutoriel jusqu’au premier son (« Écoute › Signal de test »).

**Paquet 1 — Pas à pas.** Un écran sombre où une seule chose est allumée : la prochaine cible, entourée d’Ambre. Panneaux latéraux repliés, tiroir d’inventaire qui reste ouvert, fiche d’étape en Prune, Oscar en bas à droite qui mène. Dix étapes. *Regardez :* est-ce rassurant ou condescendant ? Le tiroir ouvert recouvre-t-il trop la vue 3D (il couvre environ le tiers bas) ?

**Paquet 2 — Atelier.** Mêmes panneaux sombres, mais des bandeaux Prune en tête de panneau, les deux panneaux ouverts, des lignes serrées, la liste « Pourquoi je n’entends rien ? » installée en panneau au pied de Projet, les raccourcis à côté des commandes. Oscar en bas à gauche, qui ne mène pas. *Regardez :* est-ce dense mais lisible à 1366 × 768 ? La liste en panneau aide-t-elle ou encombre-t-elle ?

**Paquet 3 — Salle d’abord.** Une feuille Papier de plein jour (texte Nuit, liens et sélections Prune). La vue 3D reste sombre. Projet replié, Propriétés ouvert, Oscar en haut à droite. *Regardez :* le texte se lit-il partout ? L’anneau d’Oscar (resté Ambre sur sa carte sombre) se voit-il sur le Papier ? (C’est un choix de conception que le test ne mesure pas.)

**Paquet 4 — Pupitre.** À plat, des filets fins, aucun panneau en relief, aucun Prune ; anneau de focus Papier. Oscar **en sourdine** par défaut (le tutoriel est proposé, rien n’est suggéré de lui-même) ; le tiroir se referme après chaque pose ; le clavier d’abord. *Regardez :* un ingénieur s’y retrouve-t-il ? Un débutant, lui, s’y perd-il ?

**Paquet 5 — Modèle d’abord.** Un cadre et des panneaux Prune autour de la vue 3D. La première salle est un **modèle déjà câblé et alimenté** (une console, deux enceintes, un micro, une multiprise) ; le tutoriel n’a que **trois étapes** : le son, un débranchement, un rebranchement. *Regardez :* le modèle se lit-il dans la vue ? Les enceintes sombres sur fond sombre et le micro, très petit à cette distance, sont des limites connues.

À savoir pour juger : les paquets 1 et 3 ont **le même parcours** (mêmes dix étapes, mêmes indices, même fiche d’étape, Oscar qui mène) et se distinguent par la disposition et les couleurs ; les paquets 1 et 2 ne diffèrent dans leurs couleurs que par le bandeau. Les parcours distincts sont donc au nombre de deux (dix étapes, ou trois au paquet 5) plus les réglages d’Oscar. Au paquet 4, le bouton « Je branche pour vous » reste inactif pendant tout le tutoriel (le délai d’indice y vaut 0 : il ne se débloque jamais).

À juger sur les cinq : l’équilibre Nuit / Papier / Ambre / Prune, le nom de chaque paquet, la place d’Oscar, et surtout la question du fondateur : **un débutant complet arrive-t-il à un premier son sans aide ?**

## 5. Revoir la première visite

La première visite est mémorisée dans le navigateur, **par adresse** (ici `localhost:4392`). Pour la revoir :

1. Ouvrez l’adresse d’un paquet, puis les outils du navigateur (**F12**), onglet **Console**.
2. Collez ces trois lignes (elles retirent seulement la mémoire de l’accueil et du tutoriel ; Vos projets enregistrés restent) :

```js
localStorage.removeItem('audio-sim/creation-onboarding.v1')
localStorage.removeItem('oscar-guide.onboarding.v1')
localStorage.removeItem('oscar-guide.state.v1')
```

3. Rechargez la page.

Ce que contient chaque clé (lu dans le code) : `audio-sim/creation-onboarding.v1` = Votre profil, la réponse à l’offre, la demande de tutoriel et la fermeture de la carte « Votre matériel » ; `oscar-guide.onboarding.v1` = l’état du tutoriel (étape en cours, étapes faites ou passées) ; `oscar-guide.state.v1` = l’état d’Oscar (la sourdine, la progression du parcours en cours).

**Si la page rouvre directement une salle au lieu de l’écran de départ**, c’est qu’une sauvegarde automatique existe sur cette adresse : le jeu la rouvre et n’affiche pas l’écran de départ. Deux issues :

- ouvrez l’adresse dans une **fenêtre de navigation privée** (rien n’y est mémorisé au départ ; la mémoire disparaît quand la fenêtre se ferme) — le plus simple ;
- ou ajoutez une quatrième ligne `localStorage.removeItem('audio-sim/creation.v1')` : **elle efface la sauvegarde automatique de cette adresse** (Vos projets nommés, clé `audio-sim/creation-projects.v1`, ne sont pas touchés).

Le rappel que `npm run onboarding:local` affiche ne cite que les trois premières clés ; ne Vous inquiétez pas de la différence, la quatrième ligne ci-dessus est seulement pour le cas de la sauvegarde. À éviter : `localStorage.clear()`, qui efface aussi Vos projets sur cette adresse.

Autre façon de voir l’écran de départ sans rien effacer : la pastille « Profil : … · changer » de la barre d’état.

## 6. Les adresses d’examen restent muettes

Sur une adresse d’examen, **rien de l’accueil n’apparaît** : ni écran de départ, ni offre, ni Oscar, ni tutoriel, ni fiche d’étape, ni changement de panneaux ou de couleurs. C’est une règle non négociable. Essayez, par exemple :

- `http://localhost:4392/?level=a1&mode=exam` (l’examen existant) ;
- `http://localhost:4392/?design=3&mode=exam` (un paquet **et** un examen : l’examen l’emporte, tout reste silencieux).

Sur la page du Mode Création, tout paramètre `mode`, `level` ou `legacy` sort de la pratique (règle du code : `src/guide/mode.ts`). Les tests vérifient aussi que `?legacy=1&design=2` et `?level=a1&design=2` ne portent aucun aspect de paquet.

## 7. Sans Oscar : `?oscar=0`

Ajoutez `oscar=0` à l’adresse (`http://localhost:4392/?design=2&oscar=0`) pour essayer le paquet **sans Oscar**. L’écran de départ ne montre alors que le choix du profil (pas d’offre de tutoriel ; le profil reste modifiable par la pastille de la barre d’état), Oscar n’apparaît pas, et Aide n’a pas « Premiers pas ». L’aspect du paquet, la liste « Pourquoi je n’entends rien ? » et, pour le profil « Je monte un projet », la carte après le premier son restent.

## 8. Ce qui n’est pas mesuré

À savoir avant de Vous fier à ce que Vous voyez. Chaque point est un manque connu, pas une promesse.

**Personne n’a encore regardé ni écouté :**

- Aucun passage **humain** visuel, ni avec un lecteur d’écran : tout ce qui est « mesuré » l’est par des programmes (contrastes calculés, géométrie, axe).
- Aucun **apprenant réel** n’a été chronométré. Le « test des 3 minutes » (un débutant complet arrive à un premier son en 3 minutes sans aide) est **un plancher modélisé pour un parcours déjà connu**, pas un temps d’apprenant : un script qui connaît tous les gestes, auquel on ajoute un temps de lecture modélisé. Chiffres du dernier relevé (machine du script + lecture modélisée, en secondes ; source : lignes `PROXY` et valeurs figées de `tests/e2e/first-timer-proxy.spec.ts` ; les rapports de séance détaillés sont locaux et non versionnés) : parcours par boîte « Connecter à… », paquets 1 à 4 : 220 à 266 s ; par clic de port, paquets 1 et 4 : 178 à 194 s ; paquet 5 : 24 s. Plusieurs de ces planchers dépassent déjà 180 s ; ils ne démontrent donc pas les 3 minutes. La vraie épreuve (cinq débutants par paquet, sans aide, chronométrés) reste à faire.
- Le **budget de mots** du parcours (200) est dépassé : 294 mots sur les parcours par dialogue (le texte de la boîte « Connecter à… » compte pour 91), 203 par clic de port aux paquets 1 et 4 (paquet 5 : 34).

**Des cas techniques non mesurés :**

- Les **couleurs forcées** (contraste élevé de Windows) et la largeur de **375 px** ne sont pas mesurées pour les paquets.
- Les **captures de référence** (comparaison d’images) n’existent que pour **Windows** (`win32`), et la **scène 3D n’y figure pas** : la vue 3D est masquée dans ces images ; le style de la scène n’est donc pas protégé par elles.
- Les modèles 3D portent des images dérivées de photos produit : **regardez-les avant de les montrer à qui que ce soit**.
- L’**anneau d’Oscar sur le Papier** du paquet 3 n’est pas mesuré.
- La part de Prune des paquets 1, 2 et 5 sort de la ligne prévue (mesurée : environ 10 %, 7,7 % et 54 % ; prévu : environ 3 %, 20 % et 45 %) : à juger à l’écran.
- Le texte de tous les écrans (« à valider ») n’a pas encore été relu par la personne qui tient les textes. La **réaction audible** à un câble débranché pendant l’écoute n’est pas vérifiée : le texte de l’étape ne dit donc pas ce qu’on entend (le simulateur compte seulement deux voix, puis une, puis deux, sans l’afficher).

**Défauts connus, mesurés et non corrigés (ne Vous étonnez pas de les voir) :**

- **Le centre de la vue 3D est couvert** par la bulle ou l’icône d’Oscar à 1366 px sur les paquets **2, 3 et 4** (relevés : 6 mesures sur 12 aux paquets 2 et 4, une seule au paquet 3, à l’étape 7 ; les paquets 1 et 5 tiennent).
- **L’icône d’Oscar se pose sur l’appareil montré** (écart nul à 4 px de l’anneau) aux paquets **2, 3 et 4** : aux étapes 4, 6 et 8 pour les paquets 2 et 4, à l’étape 9 pour les paquets 2, 3 et 4.
- **Le parcours « clic sur les prises »** (au lieu de la boîte « Connecter à… ») **échoue aux paquets 2 et 3** : il s’arrête à l’étape 5 ou 8 (une prise de la console est refusée). La boîte « Connecter à… » fonctionne.
- Une bulle « Hors de vue pour le moment… » peut clignoter pendant que la caméra se déplace toute seule.
- Sur une connexion lente, un guide qui ne se charge pas peut laisser Oscar absent sans message (non reproduit en 390 chargements, cause probable seulement).
- Au paquet 5, la barre d’état peut dire « Prêt » alors que le son joue (à vérifier).
- En 1024 et 820 px, la barre d’état tronque ses messages et l’onglet du tiroir est coupé.

**Pour la suite (décisions qui Vous appartiennent) :** mettre les deux étapes du micro après le premier son et proposer « Je branche pour vous » dès l’étape 8 (la spécification définit aujourd’hui le premier son avec un micro) ; quel paquet devient celui par défaut ; l’« IA » dans « Oscar, assistant IA » ; la fiche d’étape dans les paquets 2 et 4 ; le texte qui remplace celui des règles R1 à R5 ; le choix de montrer ou non les modèles dans les images du storyboard.
