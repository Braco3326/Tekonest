# Comptes TekPractice : mise en place de Supabase

Ce dossier contient ce qu’il faut pour brancher les comptes. **Rien n’a été exécuté** : le projet Supabase n’existe pas encore, et le code du jeu fonctionne sans lui (l’interrupteur `accounts` est éteint).

- `schema.sql` : la table `profiles` et ses règles d’accès (chaque personne ne voit que sa propre ligne).
- `functions/delete-account/` : la fonction qui supprime vraiment un compte (la ligne de profil et la connexion).

Aucune clé, aucune adresse de projet ne doit être écrite dans le dépôt. Un test (`tests/accounts/noSecrets.test.ts`) échoue si une clé ou une adresse de projet apparaît dans `src`, `supabase`, `tools`, `docs` ou un fichier `.env*` suivi par git.

## 1. Créer le projet

1. Créez un compte sur supabase.com, puis un nouveau projet.
2. **Région : Union européenne** (par exemple Francfort ou Paris). C’est ce que dit le texte de confidentialité ; ne choisissez pas une région hors de l’UE.
3. Notez le mot de passe de la base dans votre gestionnaire de mots de passe. Il ne va jamais dans le dépôt.

## 2. Créer la table

1. Dans le projet : **SQL Editor**, nouvelle requête.
2. Collez tout le contenu de `schema.sql`, puis **Run**. Vous pouvez le relancer sans risque.
3. Vérifiez dans **Table Editor** que `profiles` existe et que « RLS » (sécurité au niveau des lignes) est **activée**.

## 3. Réglages de connexion

Dans **Authentication** :

1. **Providers, Email** : activé. Longueur minimale du mot de passe : 8. Choisissez si l’adresse doit être confirmée par e-mail (« Confirm email ») : recommandé. Avec la confirmation, la personne confirme par le lien reçu, revient sur le jeu, et la fenêtre reprend à l’étape du profil.
2. **Providers, Google** : activé. Dans la console Google Cloud, créez un identifiant OAuth de type « Application Web ». Dans « URI de redirection autorisés », collez l’adresse de rappel (callback) que Supabase affiche sur cette page. Copiez ensuite l’identifiant et le secret client dans Supabase (jamais dans le dépôt).
3. **URL Configuration** :
   - Site URL : l’adresse publique du jeu (`https://tekonest.com/tekpractice/jouer/`).
   - Redirect URLs : la même adresse suivie de `**`, et `http://localhost:3000/**` pour les essais en local.

## 4. Déployer la fonction de suppression

Depuis le dossier `tekpractice-sim`, avec l’outil Supabase (installé à la demande par `npx`) :

```
npx supabase login
npx supabase link --project-ref <référence du projet>
npx supabase functions deploy delete-account
```

La référence du projet se lit dans **Project Settings, General**. Elle se tape dans votre terminal, elle ne s’écrit dans aucun fichier du dépôt (le dossier `supabase/.temp` créé par `link` est local ; ne l’ajoutez pas à git).

La fonction utilise les trois variables que Supabase fournit lui-même à ses fonctions (adresse, clé publique, clé de service). Vous n’avez rien à saisir. **La clé « service_role » ne sort jamais de Supabase** : elle ne va ni dans le navigateur, ni dans le jeu, ni dans Vercel.

La vérification de l’identité reste activée (réglage par défaut « Verify JWT ») : la fonction supprime uniquement le compte de la personne connectée, et ignore tout identifiant envoyé dans la requête.

## 5. Les deux variables du jeu (au moment du build)

Dans **Project Settings, API** : la ligne « Project URL » et la clé « anon public ». Elles se donnent au jeu au moment de la construction :

| Variable | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | la « Project URL » |
| `VITE_SUPABASE_ANON_KEY` | la clé « anon public » (jamais « service_role ») |

- En local : un fichier `.env.local` à la racine de `tekpractice-sim` (ignoré par git).
- Pour le site : dans les variables d’environnement de l’hébergeur, pour la construction.

La clé « anon public » est faite pour être visible dans le navigateur : ce sont les règles de `schema.sql` qui protègent les données, pas le secret de cette clé.

**Décision à prendre avant le déploiement :** `tools/deploy-guard.mjs` refuse tout build de déploiement dont une variable `VITE_*` contient « KEY ». `VITE_SUPABASE_ANON_KEY` tombe dans ce cas. Il faut donc, en toute connaissance de cause, autoriser ce seul nom dans le garde-fou (et rien d’autre). Tant que cette décision n’est pas prise, le déploiement s’arrête, ce qui est le comportement voulu.

## 6. Avant d’allumer l’interrupteur `accounts`

- [ ] Les textes de `src/accounts/consentCopy.ts` sont relus et validés (chaque section porte « à valider »), le responsable de traitement et le contact sont renseignés.
- [ ] Un accord de traitement des données (DPA) est signé avec Supabase.
- [ ] Les trois étapes ci-dessus sont faites (table, connexion, fonction).
- [ ] Les deux variables sont données au build.
- [ ] Le garde-fou de déploiement est ajusté (voir plus haut) et l’interrupteur `accounts` est allumé dans `src/features.ts`.

## 7. Liste de contrôle du premier aller-retour réel

À faire sur un build de test (adresse locale ou préproduction), avec une adresse e-mail à vous :

- [ ] **Inscription** : le consentement est coché, la tranche d’âge choisie, l’inscription par e-mail réussit (ou le message « confirmez votre adresse » s’affiche).
- [ ] **Confirmation** (si activée) : le lien du message ramène sur le jeu, la fenêtre reprend à l’étape du profil.
- [ ] **Profil** : la ligne apparaît dans **Table Editor, profiles**, avec l’identifiant de l’utilisateur, et seulement les champs prévus. `consent_at` est rempli.
- [ ] **Moins de 15 ans** : avec « moins de 15 ans » sans confirmation parentale, le compte ne se crée pas. Avec la confirmation, la ligne ne contient que ce qui est permis.
- [ ] **Connexion / déconnexion** : « Se déconnecter » puis connexion avec le même e-mail : le profil se recharge.
- [ ] **Google** : le bouton ouvre Google, la personne revient sur le jeu connectée ; la fenêtre demande le profil si elle n’en a pas encore.
- [ ] **Isolation** : avec un deuxième compte, vérifiez qu’il ne voit pas la ligne du premier (SQL Editor : `select count(*) from profiles` avec le rôle `authenticated` d’un autre utilisateur, ou simplement deux sessions de navigation privée).
- [ ] **Suppression** : « Supprimer mon compte », confirmation, puis vérification dans **Authentication, Users** (l’utilisateur a disparu) et **Table Editor, profiles** (la ligne a disparu). Se reconnecter avec les mêmes identifiants échoue.
- [ ] **Sans clés** : un build sans les deux variables n’affiche aucune erreur et n’appelle aucun service de comptes.
- [ ] **Réseau** : dans l’onglet Réseau du navigateur, pour une personne qui n’a jamais créé de compte (aucune session enregistrée dans son navigateur), rien n’est envoyé à Supabase tant qu’elle n’a pas coché le consentement puis validé un formulaire.
