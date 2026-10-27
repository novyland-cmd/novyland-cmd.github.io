# Narrateur — lecteur de passages

Première version du lecteur dans `/labo/narrateur/`, accessible depuis la carte Narrateur du labo. Application statique, sans compte et sans service distant pour la lecture.

## Utiliser le lecteur

Ouvrir la page depuis le site ou un serveur local. Choisir **Sleeping Gods · Français** ou **Sleeping Gods · Anglais** dans le menu **Bibliothèques disponibles**, saisir un identifiant (`9.2` ou `9,2`) et appuyer sur **Afficher** ou sur Entrée. Aucun passage n'est affiché au chargement du livret ; le réglage de taille du texte est mémorisé sur l’appareil. L’autorisation ElevenLabs peut aussi y être conservée.

Les bibliothèques destinées au site sont incluses dans `libraries/` et listées dans `libraries/catalog.json`. Elles contiennent les passages, leurs pages sources et leurs renvois, sans les données d'audit détaillées. Le livret choisi est téléchargé à la demande. Ajouter un livret au menu consiste à déposer un fichier compatible dans `libraries/` et à ajouter son identifiant, son libellé et son nom de fichier au catalogue.

### Novyland · Quête 1

`libraries/novyland-quete1-fr.json` contient l’introduction `0` et les 300 passages français fournis, de `1` à `300`. Choisir **Novyland · Quête 1 · Français**, puis saisir un passage (par exemple `2`). Les renvois entre cases sont cliquables avec confirmation. Le fichier fourni est conservé intégralement. Redéployer le Worker pour rendre cette bibliothèque disponible avec Patrick et Anna.

### Cozy Sticker Ville

`libraries/cozy-sticker-ville-fr.json` contient 529 entrées (236 passages principaux et 293 résultats de choix) issues du PDF scanné du 25 octobre 2026 à 15 h 44 (31 pages du PDF, pages imprimées 6 à 36). Cette version remplace l’extrait de test sans changer l’identifiant `cozy-sticker-ville-fr` du catalogue. Les règles des pages 1 à 5 ne figurent pas dans le document. Les titres d’origine sont conservés ; les résultats portent simplement le libellé de leur choix. L’empreinte SHA-256 et la provenance figurent dans les métadonnées de la bibliothèque.

La reconnaissance de caractères est corrigée sur les images des pages. Les codes d’autocollants, quantités, conditions, ressources et jalons sont conservés ; les symboles Sablier, Bois, Étoile, Couronne et Hache sont transcrits en mots, et les faces de dé en nombres. Les 54 renvois explicites vers un passage sont résolus. Les numéros qui indiquent un emplacement d’autocollant restent du texte. L’entrée 18.7 réunit la fin de la page 18 et le début de la page 19 ; ses deux pages sources sont conservées. Les tableaux de 31.1, 35.1 et 36.1 sont transcrits en texte structuré, avec des correspondances explicites entre dés, nourriture et poissons.

Les fins de ligne de la page 7, coupées dans l’ancien extrait, sont lisibles dans ce nouveau scan et ont été rétablies. Les options C/D de « Nouveau visiteur » dans 7.2 suivent l’impression malgré le choix A/B qui les précède : les liens A/B conduisent aux résultats C/D par ordre, avec une note explicite. Les quatre sous-histoires non numérotées restent dans 7.2 ; aucun identifiant 7.3 à 7.6 n’est inventé. Le numéro 8.2, caché par une coche, est confirmé par ses consignes.

Les résultats sont des entrées autonomes, par exemple `12.2A` et `12.2B`, reliées par le champ standard `references` comme les renvois de Sleeping Gods. `12.2` contient uniquement la question et ses choix. Après confirmation, sélectionner A ouvre `12.2A` et remplace entièrement le passage précédent ; la voix lit seulement le résultat. On peut aussi saisir directement `12,2a`. Les bibliothèques n’utilisent plus `choices`, `choice_references`, un état de sélection local ou des vues filtrées pour la lecture.

Les suffixes sont A/B/C/D pour les lettres, OUI/NON (`14.4OUI`), N suivi de la quantité (`13.2N0` à `13.2N3`) et R suivi de la plage du dé (`26.6R1A3`, `26.6R4A6`, `26.6R7PLUS`). Les lettres répétées de 7.2 sont préfixées par G et leur groupe : `7.2G1C`, `7.2G1D`, `7.2G2A`, `7.2G2B`, `7.2G4A`, `7.2G4B`. Les 355 renvois utilisent le même rendu, la même confirmation et le même lecteur audio. Les trois choix de 16.7 ouvrent directement `9.9A`, `9.9B` ou `9.9C`. Un renvoi vers une option depuis un résultat, comme 8.6B vers 8.6A, fonctionne de la même façon.

Chaque résultat conserve son `parent_id`, son `choice_label`, ses pages sources et sa plage dans le texte avant découpage (`source_text_range`). L’outil de maintenance `scripts/split_library_choices.py` transforme une bibliothèque avec choix intégrés en bibliothèque à entrées distinctes, en recalculant les positions Unicode et en vérifiant les identifiants et les destinations. L’audit compare tous les résultats et toutes les introductions : seuls les libellés de début de résultat (A., B., etc.) et les espaces périphériques sont retirés. Aucun texte de conséquence n’est ajouté aux entrées principales.

Les quantités 0, 1, 2 et 3 nourritures sont cliquables dans 13.2 et 13.4. Les plages de résultats de dés sont sélectionnables dans 15.8, 15.9 et 26.6. Les entrées qui demandent de lire la première histoire sans autocollant nécessitent le livret physique : l’application ne suit pas les autocollants.

Pour tester : choisir **Cozy Sticker Ville · Français**, puis essayer `18.7` (continuation entre pages), `16.7` (renvoi avec choix conservé), `13.2` (nourriture), `26.6` (dé), `35.1` et `36.1` (pêche), `6.5` (ancien renvoi absent désormais disponible). Les voix de l’appareil fonctionnent immédiatement. Redéployer le Worker pour mettre à jour la bibliothèque utilisée par Patrick et Anna ; les secrets existants sont conservés. Le site et le Worker lisent la même entrée autonome et une empreinte du texte empêche de lire un ancien récit si leurs bibliothèques diffèrent.

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

Dans 13.2 et 13.4, « Dépensez 0 à 3 nourritures » est présenté comme quatre liens : 0 nourriture, 1 nourriture, 2 nourritures et 3 nourritures. La sélection révèle uniquement l’effet de la quantité choisie.


## Atelier des récits indépendant

L’édition se trouve dans l’application indépendante `/labo/atelier-des-recits/`, accessible depuis sa propre carte dans le Labo. Le Narrateur reste consacré à la lecture des livrets publiés : il ne contient ni éditeur intégré, ni iframe, ni catalogue de brouillons. L’atelier conserve les exports compatibles avec le format des bibliothèques du Narrateur.

Les deux applications utilisent le même code privé, vérifié par la route `/authorize` du service audio pour l’atelier. La mémorisation facultative utilise la même clé de stockage, associée à l’adresse du service. Effacer une autorisation mémorisée dans une application la retire aussi de l’autre.
