# Narrateur — lecteur de passages

Première version du lecteur dans `/labo/narrateur/`, accessible depuis la carte Narrateur du labo. Application statique, sans compte et sans service distant pour la lecture.

## Utiliser le lecteur

Ouvrir la page depuis le site ou un serveur local. Choisir **Sleeping Gods · Français** ou **Sleeping Gods · Anglais** dans le menu **Bibliothèques disponibles**, saisir un identifiant (`9.2` ou `9,2`) et appuyer sur **Afficher** ou sur Entrée. Aucun passage n'est affiché au chargement du livret ; seul le réglage de taille du texte est mémorisé sur l'appareil.

Les bibliothèques destinées au site sont incluses dans `libraries/` et listées dans `libraries/catalog.json`. Elles contiennent les passages, leurs pages sources et leurs renvois, sans les données d'audit détaillées. Le livret choisi est téléchargé à la demande. Ajouter un livret au menu consiste à déposer un fichier compatible dans `libraries/` et à ajouter son identifiant, son libellé et son nom de fichier au catalogue.

Seules les bibliothèques publiées dans le catalogue sont proposées. L'application ne permet pas d'importer un fichier personnel. Le catalogue fonctionne de la même façon en local et sur le site publié.

Les renvois explicites sont cliquables et demandent confirmation, sans aperçu du titre ou du texte de destination. Les destinations absentes ou ambiguës ne peuvent pas être ouvertes. **Masquer le texte** efface le passage de la page ; Échap le masque également, sauf lorsqu'une boîte de confirmation est ouverte (Échap annule alors la confirmation). La barre de lecture reste accessible en faisant défiler un long passage.

Le réglage du texte va de 16 à 32 px. Les passages sont affichés comme du texte, jamais interprétés comme du HTML. Aucun historique de passages ni position de lecture n'est enregistré.

Pour le français, les retours de ligne dus aux colonnes du PDF sont remplacés par des espaces au milieu des phrases lors de l'affichage. Les séparations entre dialogues, choix, consignes et paragraphes sont conservées. Les fichiers sources et les positions des renvois ne sont pas modifiés.

## Vérifier le lecteur

Avec Node.js :

```sh
node --test scripts/library.test.mjs scripts/speech.test.mjs
```

Les tests utilisent des données fictives et, si elle est présente, la bibliothèque locale complète. Ils couvrent la numérotation, les alias, les doublons, les fichiers incompatibles, les positions Unicode après les symboles et la conservation intégrale du texte lors de l'insertion des liens. Les offsets `text_offset` de la bibliothèque comptent les points Unicode (Python) ; le lecteur les convertit en positions UTF-16 (JavaScript).

Pour un aperçu local depuis la racine du dépôt :

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Puis ouvrir `http://127.0.0.1:8765/labo/narrateur/`.

## Lecture vocale

**Patrick et Anna avec ElevenLabs v4** : l'intégration à la demande est préparée. Suivre le guide `services/narrateur-audio/INSTALLATION.md` à la racine du dépôt pour créer le service Cloudflare, enregistrer les secrets et renseigner `audio-config.json`. Tant que l'adresse du service est vide, seules les voix de l'appareil sont proposées. Les audios créés sont sauvegardés dans R2 et réutilisés ; les nouvelles générations demandent un code privé.

Le panneau **Écouter le passage** propose deux boutons à icônes : Lecture/Pause et Stop. Le premier lance la lecture, la met en pause puis la reprend au même endroit ; son icône et son libellé accessible suivent l’état de lecture. Stop arrête la lecture ; une nouvelle pression sur Lecture recommence au début. Les voix sont obtenues par l'API de synthèse du navigateur et filtrées selon la langue de la bibliothèque (français ou anglais). Les voix locales sont proposées en premier ; celles signalées comme distantes par le navigateur portent la mention « en ligne ». Leur disponibilité et leur prononciation dépendent du navigateur et de l'appareil. La vitesse peut être choisie avant la lecture, de 0,75 à 1,5 fois la vitesse normale.

Un changement de passage, de bibliothèque, un masquage ou la sortie de page annule la lecture. Les longs textes sont découpés en segments, et les événements tardifs d'une ancienne lecture ne peuvent pas relancer le récit précédent. La lecture n'est jamais lancée automatiquement.

La lecture du passage complet est disponible pour les deux bibliothèques actuelles. La narration seule reste désactivée : les textes ne comportent pas encore de séparation validée entre narration et consignes. Une future bibliothèque pourra fournir `narration_text` et `narration_verified: true` pour un passage relu ; ce mode sera alors activé uniquement pour ce passage. Les boutons sont désactivés avec un message explicatif si la synthèse ou une voix dans la langue du livret n'est pas disponible.

Référence : [API SpeechSynthesis (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis).

## Fichiers locaux

La bibliothèque est dans `.local/sleeping-gods-fr/passages.json`. Le rapport lisible est dans `.local/sleeping-gods-fr/rapport.md` ; les détails des contrôles sont dans `.local/sleeping-gods-fr/validation.json`. La revue visuelle et ses images sont conservées dans ce même dossier (`revue-visuelle.md`, `controle-visuel-*.png`).

Le dossier `.local/` est exclu de Git : les bibliothèques intégrales d'extraction, les rapports et les images de contrôle restent sur cet ordinateur. Les deux bibliothèques compactes dans `libraries/` sont en revanche destinées à accompagner la publication de l'application, à la demande de l'utilisateur.

## Reproduire

Avec Python 3 et `pdfplumber` installé :

```sh
python3 scripts/extract_sleeping_gods.py "/chemin/vers/le/livret.pdf"
python3 scripts/validate_library.py .local/sleeping-gods-fr/passages.json
```

Le script est adapté à la mise en page du PDF fourni, pas à tous les PDF de tous les jeux. L'empreinte SHA-256 et la version de l'extracteur PDF sont enregistrées pour identifier précisément la source. Une mise en page différente doit faire l'objet d'une nouvelle vérification.

## Contrat de données (version 1)

- `game_id`, `language`, `source` : jeu, langue, provenance, empreinte et numérotation des pages.
- `passages` : liste des passages, chacun avec `id` (chaîne), `key` (clé unique), `title` (ou `null` si absent du livret), `text`, `source_pages`, `source_segments`, `references`, `validation`.
- `lookup` : identifiant → liste de clés. Une liste vide signifie introuvable ; plusieurs clés signifient ambiguïté. Ne jamais sélectionner silencieusement le premier résultat.
- `aliases` : variantes de notation uniquement. Dans ce livret, `D1.7` renvoie à `D.I.7`, et de même pour les trois autres identifiants de cette section.
- `source_lines` : lignes du PDF avec numéro de page, colonne, rectangle en points PDF et séquences de glyphes par police (`spans`). Les espaces inférés par l'extraction figurent dans `text` ; les glyphes bruts peuvent ne pas les contenir.
- `heading_lines`, `lines` : indices, à partir de zéro, dans `source_lines`. Les titres sont séparés du corps du passage.
- `sections` : titres de chapitres et texte introductif hors paragraphes. Ils ne sont pas ajoutés au passage précédent.

Les numéros de page sont ceux du PDF, à partir de 1, couverture comprise. Chaque colonne se lit intégralement de haut en bas avant la suivante, puis on passe à la page suivante. Les puces de la colonne droite débordent à gauche : la séparation tient compte de cette particularité.

Le champ `text` garde les retours à la ligne du PDF, les conditions, les choix, les récompenses, les symboles, les fautes et les termes anglais présents dans la source. Aucun résumé, réécriture, correction de numéro ou titre inventé n'est introduit. Les polices sont conservées pour faciliter une future distinction entre narration et consignes ; aucune classification sémantique de ce type n'est encore garantie.

Les renvois ont un état `resolved`, `missing` ou `ambiguous`. La détection `identifier_in_text` est un candidat sans verbe de renvoi explicite : le lecteur ne doit pas en déduire automatiquement une action. Les références aux cartes, combats ou quêtes ne sont pas des identifiants de paragraphes.

## Niveau de contrôle

Résultat pour le livret fourni : **1 000 passages distincts**, dont 123 sans intitulé dans la source et 107 répartis sur plusieurs pages. Aucun doublon de titre de paragraphe, aucune ligne non affectée ou répétée, aucun marqueur de caractère non décodé détecté. Sept destinations de renvoi sont absentes : `70.8`, `159`, `159.1`, `159.2`, `159.3`, `159.4` et `F13`. Ces références restent signalées comme introuvables.

L'extraction vérifie la couverture des caractères de chaque page, la répartition unique de toutes les lignes, les identifiants répétés, les destinations des renvois, les trous de numérotation et les caractères non décodés. Le validateur indépendant contrôle l'index, les frontières, les continuations, les pages sources et plusieurs cas de régression du livret.

`automated_checks_only` signifie contrôles structurels réussis, pas relecture humaine intégrale. `review_required` indique une ambiguïté ou un renvoi introuvable. Les trous de numérotation signalent une particularité de la source ; ils ne prouvent pas, à eux seuls, une erreur d'extraction. Les passages concernés restent disponibles avec leurs signalements.
