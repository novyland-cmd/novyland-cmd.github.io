# NovyTournoi

Accueil avec création d’un tournoi et consultation des résultats par code. Élimination directe à exactement 2, 4, 8 ou 16 joueurs, sans exemption. Deux vues : ronde par ronde et tableau complet.

## Fichiers

- `index.html`, `styles.css`, `app.mjs` : interface native, sans dépendance.
- `model.mjs` : tirage, propagation, validation et règle des formats, partagés avec le serveur.
- `cloud-config.json` : adresse publique du service Cloudflare ; vide jusqu’à son activation.
- `cloud-config.local.example.json` : exemple pour tester le Worker local.
- `../../services/novytournoi/` : Worker, configuration et tests.

La création fonctionne sur l’appareil sans service. Après activation du partage, le serveur devient la source des résultats, consultables avec le code et actualisés toutes les 10 secondes. Une clé privée distincte autorise les modifications. Aucun compte requis.

Les anciennes sauvegardes locales V1 sont conservées sous `novytournoi.v1` et les anciens tableaux avec exemptions restent consultables. Seuls les nouveaux formats sans exemption sont partageables. Les accès organisateur et écritures en attente sont stockés séparément sous `novytournoi.cloud.v1`. Ne pas partager un fichier d’accès organisateur.

Les exports/imports JSON et exports CSV restent disponibles. L’import d’un export de résultats crée une copie locale ; il ne permet pas de modifier le tournoi source. Voir le README du service pour la restauration d’accès et les tests.

Livraison locale uniquement : aucune publication, aucun commit ni déploiement.
