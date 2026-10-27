# Activer Patrick et Anna dans Narrateur

Cette configuration est préparée mais pas encore déployée. Elle utilise votre compte ElevenLabs avec le modèle **Eleven v4**. Aucune clé API n'est intégrée au site et aucun appel payant n'a été effectué pour les tests.

## Fonctionnement

1. Le lecteur demande l'enregistrement correspondant au livret, au paragraphe et à la voix.
2. S'il existe déjà dans le stockage Cloudflare R2, il est lu sans appel à ElevenLabs.
3. Sinon, le lecteur demande votre **code de génération**. Il autorise le service à créer l'audio avec votre compte ElevenLabs.
4. Le MP3 est sauvegardé avant d'être renvoyé au lecteur. Les prochaines écoutes réutilisent ce fichier.

Les visiteurs sans code peuvent écouter les enregistrements existants. Ils ne peuvent pas en créer de nouveaux à vos frais. Par défaut, le code reste en mémoire dans la page ouverte. La case « Conserver l’autorisation sur cet appareil » permet de l’enregistrer dans le stockage local de ce navigateur pour les prochaines visites. Le bouton « Effacer l’autorisation sur cet appareil » supprime le code mémorisé et l’autorisation de la session. Un code refusé par le service est automatiquement oublié. L’autorisation mémorisée est propre à l’adresse du service audio. La clé ElevenLabs reste exclusivement dans les secrets du service Cloudflare.

Voix configurées, en français et en anglais :

| Voix | ID ElevenLabs |
| --- | --- |
| Patrick | `XTyroWkQl32ZSd3rRVZ1` |
| Anna | `PSVUmed8NvS8aUA3d5oO` |

## 1. Créer le compte Cloudflare

Créez un compte sur [Cloudflare](https://dash.cloudflare.com/sign-up). Il n'est pas nécessaire de transférer votre domaine ou votre site GitHub Pages : seul le service audio sera hébergé chez Cloudflare.

Activez **R2 Object Storage** dans le tableau de bord. Cloudflare peut vous demander d'activer la facturation pour ce stockage. Consultez les [tarifs R2](https://developers.cloudflare.com/r2/pricing/) et les [tarifs Workers](https://developers.cloudflare.com/workers/platform/pricing/) dans votre compte avant d'activer ces ressources.

## 2. Installer et déployer le service

Installez [Node.js LTS](https://nodejs.org/) si `npm` n'est pas disponible sur votre ordinateur. Dans un terminal, ouvrez ce dossier :

```sh
cd /Users/landryy/Projets/GitHub/novyland-cmd.github.io/services/narrateur-audio
npm install
npx wrangler login
```

Une page Cloudflare s'ouvre : connectez-vous et autorisez Wrangler à déployer sur votre compte.

Créez le stockage privé des audios, puis déployez :

```sh
npx wrangler r2 bucket create novyland-narrateur-audio
npm run deploy
```

Si le bucket existe déjà, ne le recréez pas : passez au déploiement. Conservez l'adresse HTTPS affichée, par exemple `https://novyland-narrateur-audio.votre-compte.workers.dev`.

Le premier déploiement peut être réalisé sans les secrets : aucun nouvel audio ne pourra être généré tant qu'ils ne sont pas configurés.

## 3. Configurer les deux secrets

Dans le même terminal :

```sh
npx wrangler secret put ELEVENLABS_API_KEY
```

Collez votre clé ElevenLabs dans la saisie privée demandée. Ne la placez pas dans un fichier du site, dans `audio-config.json`, dans `wrangler.jsonc` ou dans une commande contenant sa valeur.

Créez ensuite un **code de génération distinct de la clé ElevenLabs**, avec au moins 24 caractères, idéalement un mot de passe aléatoire de 32 caractères ou plus. Conservez-le dans votre gestionnaire de mots de passe. Puis :

```sh
npx wrangler secret put GENERATION_TOKEN
```

Collez ce code dans la saisie privée. C'est ce code que vous saisirez dans le lecteur lorsqu'un nouvel audio devra être créé. Les personnes à qui vous le communiquez pourront également déclencher des générations sur votre compte, dans la limite quotidienne configurée.

## 4. Relier le lecteur au service

Dans le fichier `labo/narrateur/audio-config.json` du site, remplacez la valeur vide par **l'adresse réelle du Worker**, sans `/audio` à la fin :

```json
{
  "endpoint": "https://novyland-narrateur-audio.votre-compte.workers.dev"
}
```

Ce fichier est public : il doit contenir uniquement l'adresse du service, jamais les secrets. Publiez ensuite les modifications du site selon votre procédure habituelle.

Le site et le Worker sont deux déploiements distincts : publier les fichiers sur GitHub Pages ne déploie pas le Worker. Les commandes ci-dessus déploient le Worker ; la publication du site met à jour le lecteur et son adresse de service. Après une modification des textes, redéployez aussi le Worker pour qu’il utilise les mêmes bibliothèques que le site. Le lecteur vérifie une empreinte du texte : si les versions diffèrent, il refuse la lecture ElevenLabs plutôt que de lire un ancien récit.

## 5. Faire le premier essai

1. Rechargez Narrateur et choisissez un livret.
2. Dans **Voix**, choisissez **Patrick · ElevenLabs v4** ou **Anna · ElevenLabs v4**.
3. Affichez un paragraphe, puis appuyez sur ▶.
4. Saisissez votre code de génération si l'audio n'existe pas encore. La génération est payante sur votre compte ElevenLabs.
5. Attendez la création, puis vérifiez la lecture, la pause et la reprise.
6. Arrêtez et relancez le même passage avec la même voix : le service doit réutiliser le MP3. La consommation de caractères ElevenLabs ne doit pas augmenter pour cette seconde écoute.

La présence d'un ID de voix ne garantit pas que votre compte puisse l'utiliser : si ElevenLabs refuse la génération, vérifiez l'accès à Patrick/Anna, la disponibilité du modèle v4, les permissions de la clé et votre solde.

## Limite de dépense et réglages

Dans `wrangler.jsonc`, `MAX_DAILY_CHARACTERS` est fixé à **30 000 caractères par jour UTC**, partagés entre toutes les langues, toutes les voix et tous les utilisateurs du code. C'est un plafond de texte envoyé, pas un montant monétaire garanti. Configurez également une limite de consommation sur la clé dans ElevenLabs.

La limite est enregistrée durablement. Elle est réservée avant chaque appel et reste consommée en cas d'échec, car une requête interrompue peut déjà avoir été facturée. Les audios existants restent lisibles même si la limite est atteinte.

Après avoir modifié cette limite ou la liste `ALLOWED_ORIGINS`, exécutez `npm run deploy`. Les origines autorisées incluent NovyLand, GitHub Pages et les aperçus locaux sur les ports 8765 et 5500 (127.0.0.1 ou localhost). Si l'adresse du site change, ajoutez son origine exacte. Cette liste ne remplace pas le code de génération.

La vitesse du lecteur modifie la vitesse de lecture du MP3 : elle ne génère pas de nouveau fichier. Patrick et Anna, ainsi que les versions française et anglaise, ont chacun leurs propres enregistrements.

Les fichiers audio dépendent du texte, de la langue, du modèle, de l'ID de voix et de `AUDIO_REVISION`. Une modification du texte, après redéploiement du Worker, crée automatiquement un nouvel audio à la prochaine demande. Si vous changez les réglages d'une voix dans ElevenLabs et souhaitez de nouveaux enregistrements, augmentez `AUDIO_REVISION`, puis redéployez. Cela ne supprime pas les anciens fichiers R2.

Le bouton Stop annule le téléchargement et la lecture sur l'appareil. Si ElevenLabs a déjà commencé une génération, elle peut rester facturée ; le service termine et conserve l'audio pour une prochaine écoute.

## Désactiver ou renouveler l'accès

- Pour empêcher les nouvelles générations, changez le secret `GENERATION_TOKEN`. Les audios déjà sauvegardés restent disponibles.
- Pour désactiver les voix ElevenLabs dans le lecteur, remettez `"endpoint": ""` dans `audio-config.json`, puis republiez le site.
- Les voix de l'appareil restent disponibles comme solution de repli.

## Vérifications réalisées sans appels payants

Depuis la racine du dépôt :

```sh
node --test services/narrateur-audio/worker.test.mjs labo/narrateur/scripts/library.test.mjs labo/narrateur/scripts/speech.test.mjs labo/narrateur/scripts/remote-audio.test.mjs
```

Les tests simulent ElevenLabs et le stockage. Ils couvrent notamment les codes invalides, les voix et passages autorisés, le cache, les demandes simultanées, le budget, les erreurs du fournisseur et l'arrêt pendant le téléchargement. Le premier appel réel reste à faire après configuration de votre compte.

Références : [ElevenLabs TTS](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), [secrets Cloudflare](https://developers.cloudflare.com/workers/configuration/secrets/), [stockage R2 depuis un Worker](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).


## Autorisation de l’atelier d’édition

L’application indépendante **Atelier des récits**, dans `/labo/atelier-des-recits/`, utilise aussi le code `GENERATION_TOKEN`. Elle vérifie directement son autorisation auprès de ce Worker, sans passer par le lecteur. La route **POST `/authorize`** reçoit le code dans l’en-tête `Authorization: Bearer …` et renvoie `{ "code": "authorized" }` lorsque le code est valide. Elle applique les mêmes origines autorisées et ne génère aucun audio, ne lit aucun objet R2 et ne réserve aucun budget. Les requêtes sans code ou avec un code invalide reçoivent une réponse 401. Aucun nouveau secret n’est nécessaire.

Redéployez ce Worker pour activer la nouvelle route avant de publier l’atelier indépendant. Les brouillons et leurs exports restent sur l’appareil ; le Worker ne reçoit aucun texte édité. Les voix ElevenLabs restent réservées aux livrets publiés. La même option de mémorisation du code dans le navigateur s’applique aux voix et à l’atelier.
