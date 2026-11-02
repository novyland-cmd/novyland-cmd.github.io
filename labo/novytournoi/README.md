# NovyTournoi

Accueil avec création d’un tournoi et consultation des résultats par code. Formats proposés selon le nombre de joueurs, de 2 à 16. Deux vues : ronde par ronde et tableau complet.

## Fichiers

- `index.html`, `styles.css`, `app.mjs` : interface native, sans dépendance.
- `model.mjs` : lecture des sauvegardes historiques et validation.
- `formats.mjs` : modes disponibles, calendriers, tableaux, classements et progression, partagés avec le serveur.
- `cloud-config.json` : adresse publique du service Cloudflare déployé.
- `cloud-config.local.example.json` : exemple pour tester le Worker local.
- `../../services/novytournoi/` : Worker, configuration et tests.

La création fonctionne sur l’appareil sans service. Après activation du partage, le serveur devient la source des résultats, consultables avec le code et actualisés toutes les 10 secondes. Une clé privée distincte autorise les modifications. Aucun compte requis.

Les anciennes sauvegardes locales V1 sont conservées sous `novytournoi.v1` et les anciens tableaux avec exemptions restent consultables. Les nouveaux tournois utilisent le moteur version 2 ; les formats convenus sont tous partageables après mise à jour du Worker. Les accès organisateur et écritures en attente sont stockés séparément sous `novytournoi.cloud.v1`. Ne pas partager un fichier d’accès organisateur.

Les exports/imports JSON et exports CSV restent disponibles. L’import d’un export de résultats crée une copie locale ; il ne permet pas de modifier le tournoi source. Voir le README du service pour la restauration d’accès et les tests.

Depuis « Reprendre sur cet appareil », le bouton « Retirer de cet appareil » efface la copie locale après confirmation. Pour un tournoi partagé, il efface aussi l’accès organisateur de ce navigateur, sans supprimer les résultats Cloudflare. Exporter l’accès organisateur avant de le retirer pour pouvoir le restaurer plus tard. La confirmation avertit également de la perte des résultats encore en attente d’enregistrement.

## Modes proposés

| Joueurs | Choix |
|---|---|
| 2 | Double élimination |
| 3 | Double élimination, tous contre tous |
| 4 | Élimination directe, double élimination, tous contre tous |
| 5 | Double élimination, tous contre tous |
| 6–7 | Suisse |
| 8 | Élimination directe, suisse |
| 9–15 | Suisse |
| 16 | Élimination directe, suisse |

- Double élimination : tableaux principal et repêchage ; deux défaites éliminent. La grande finale est rejouée si le gagnant du repêchage bat le joueur invaincu. À 3 ou 5 joueurs, des cases vides donnent lieu à des exemptions ; elles ne comptent pas comme matchs joués.
- Tous contre tous : chaque paire se rencontre une fois. Les repos ne donnent aucun point. Classement par victoires, puis victoires dans les confrontations entre joueurs ayant le même nombre de points. Une égalité persistante donne une première place partagée ; la finale en double élimination concerne seulement le mode suisse.
- Suisse : exactement 3 rondes. Appariements selon les points en privilégiant les scores proches et sans revanche. En effectif impair, le repos vaut un point ; il est attribué en priorité aux joueurs ayant le moins de points et aucun joueur n’en reçoit deux. Une ronde doit être terminée avant de générer la suivante.
- Après le suisse : si un joueur finit seul en tête, il gagne. Tous les joueurs à égalité au maximum de points jouent sinon un départage en double élimination, avec zéro défaite au départ. Les défaites suisses ne participent pas à l’élimination de cette phase. À deux qualifiés, le titre se joue en deux victoires.

Les tours suivants sont recalculés lorsqu’un résultat dont ils dépendent change. Le Worker reconstruit le tableau depuis le tirage et les résultats : les champs dérivés envoyés par le navigateur ne font pas autorité. Le classement et le format font partie de la sauvegarde et de la consultation par code.

Les changements du site restent locaux jusqu’à publication GitHub. Aucun commit ni push automatique.
