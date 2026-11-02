# Service partagé NovyTournoi

Worker Cloudflare distinct du Narrateur, avec un Durable Object SQLite par tournoi. Il réutilise la connexion Wrangler du compte existant, sans toucher au Worker ni au stockage audio.

## État du déploiement

Service déployé et vérifié le 1er novembre 2026 :

- URL : https://novyland-tournoi.novyland.workers.dev
- Version Cloudflare : `753a27b3-d3bb-46af-a4ea-9a301bc7a420`
- Stockage : Durable Objects SQLite, binding `TOURNAMENTS`.
- Adresse renseignée dans le fichier local `labo/novytournoi/cloud-config.json`.

Le site GitHub Pages doit également recevoir ce fichier de configuration actualisé pour activer le bouton de partage. Aucun commit ni push GitHub n’a été effectué lors du déploiement du service.

## Utilisation

L’organisateur crée le tableau sur son appareil puis active le partage. Le service conserve pseudonymes, tableau, gagnants, révision et date de mise à jour. Un code public de 12 caractères et un lien donnent accès à une vue spectateur sans modification. Les résultats se rafraîchissent toutes les 10 secondes, avec un bouton d’actualisation.

La clé organisateur de 256 bits est générée sur son appareil. Elle ne figure ni dans le code public, ni dans les liens, ni dans les exports de résultats. Le service conserve uniquement son empreinte SHA-256. Chaque écriture est vérifiée côté serveur et protégée contre les modifications concurrentes par un numéro de révision. Les tentatives rejouées après une réponse perdue sont idempotentes.

La page conserve l’écriture en attente localement si Internet est indisponible. Les modifications suivantes sont bloquées jusqu’à confirmation de cette écriture. En cas de conflit, l’organisateur peut exporter sa copie puis recharger la version du serveur. Les accès à plusieurs tournois sont conservés sur l’appareil et listés à l’accueil.

Un export JSON ordinaire ne donne pas le droit de modifier le tournoi partagé. Le bouton « Sauvegarder mon accès organisateur » crée un fichier privé ; il peut être restauré avec « Importer JSON » depuis une configuration locale. Sans ce fichier et sans les données du navigateur, l’accès organisateur ne peut pas être récupéré : aucun compte n’est utilisé.

## Essayer sans déployer

1. Depuis ce dossier : `npm install`, puis `npm run dev`.
2. Remplacer temporairement `labo/novytournoi/cloud-config.json` par le contenu de `cloud-config.local.example.json`.
3. Servir la racine du dépôt à `http://127.0.0.1:8765` et ouvrir `/labo/novytournoi/`.
4. Créer un tournoi, activer le partage, puis ouvrir son lien dans un autre onglet pour consulter les résultats. Le stockage du Worker est local dans `.wrangler/` ; ce code local n’est pas consultable depuis Internet.
5. Restaurer l’adresse publique du service déployé après les essais locaux.

Vérifications : `npm test` pour le modèle ; `node integration.test.mjs http://127.0.0.1:8788` pour les routes et le stockage du Worker local démarré.

## Mise à jour ultérieure du service

1. Reconnecter le compte avec `npx wrangler login`, puis le vérifier avec `npx wrangler whoami`.
2. Vérifier les domaines dans `ALLOWED_ORIGINS` de `wrangler.jsonc`.
3. Déployer ce service avec `npm run deploy`. Sa migration crée son propre espace Durable Objects ; aucune base D1 ou clé Cloudflare ne doit être ajoutée au site public.
4. Copier l’URL réellement retournée par Cloudflare dans `labo/novytournoi/cloud-config.json`, sous `endpoint`.
5. Publier les fichiers statiques uniquement après validation. Tester depuis deux appareils : création, consultation, modification et actualisation.

Les données sont conservées sans expiration automatique ni suppression distante dans cette version. Les personnes qui connaissent le code peuvent consulter les pseudonymes et les résultats. Les créations sont ouvertes sans compte : avant une ouverture à grande échelle, décider d’une politique de création et de rétention adaptée au site.

Références : [Durable Objects SQLite](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) et [configuration des bindings](https://developers.cloudflare.com/durable-objects/get-started/).
