# Atelier des récits

Application indépendante du Labo, accessible à `/labo/atelier-des-recits/`. Elle ouvre directement son formulaire d’autorisation, sans dépendre d’une page du Narrateur ou d’une iframe.

Le même code privé que pour les voix ElevenLabs est vérifié via `POST /authorize` sur le service configuré dans `audio-config.json`. Cette vérification ne génère aucun audio et ne consomme aucun crédit. La case de mémorisation utilise la même clé que le Narrateur ; une autorisation mémorisée peut ainsi être réutilisée dans les deux applications. **Verrouiller** ferme l’atelier pour la session ouverte ; **Effacer l’autorisation** retire le code enregistré de cet appareil.

Les fonctions comprennent les bibliothèques, les passages, les choix, les renvois, les notes, les étiquettes, les états de relecture, la lecture de vérification et les imports/exports JSON ou TXT. **Livrets du site** crée une copie de travail d’un livret publié, sans le modifier. La lecture des brouillons se fait dans la vue **Lecture** de l’atelier. L’export Narrateur reste disponible pour produire une bibliothèque compatible.

Les brouillons existants sont conservés sous la clé `atelier-recits-v1`, sur la même origine du site : déplacer la page ne les efface pas. Les données restent sur cet appareil ; exportez-les pour les sauvegarder ou les transférer. Un stockage indisponible ou plein est signalé ; les données restent alors en mémoire jusqu’à la fermeture. Une sauvegarde illisible n’est jamais écrasée et peut être exportée.

Les modules de données et de validation sont locaux à cette application. Le seul accès facultatif aux fichiers du Narrateur sert à copier ses livrets publiés ; le fonctionnement de l’éditeur et l’import de fichiers personnels restent indépendants du lecteur.

Validation depuis la racine du dépôt :

```sh
node --test labo/atelier-des-recits/scripts/*.test.mjs labo/narrateur/scripts/*.test.mjs services/narrateur-audio/worker.test.mjs
```
