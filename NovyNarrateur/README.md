# NovyNarrateur — Hello World

Première étape de NovyNarrateur, une future application de narration pour jeux de société. Cette version affiche une page de bienvenue en français et un bouton pour vérifier JavaScript. Elle s’adapte aux téléphones, tablettes et ordinateurs.

La photographie, l’OCR et les voix locale et IA viendront dans les prochaines étapes ; elles ne sont pas encore intégrées.

## Les quatre fichiers

```text
NovyNarrateur/
├── index.html    # Contenu de la page
├── styles.css    # Apparence et adaptation aux écrans
├── script.js     # Réaction au clic sur le bouton
└── README.md     # Ce guide
```

Aucune installation, aucune compilation et aucune clé API ne sont nécessaires. Les fichiers CSS et JavaScript sont liés avec des chemins relatifs compatibles avec GitHub Pages.

## 1. Ouvrir la page sur votre ordinateur

1. Si vous avez téléchargé l’archive ZIP, décompressez-la.
2. Ouvrez le dossier `NovyNarrateur`, puis double-cliquez sur `index.html`.
3. Cliquez sur **Tester JavaScript** : un message vert confirme que JavaScript fonctionne. Les clics suivants mettent à jour le nombre de tests.

Vous pouvez aussi utiliser la touche Tab pour atteindre le bouton, puis Entrée ou Espace pour le déclencher. Si JavaScript est désactivé, un message explique comment l’activer.

## 2. Créer votre dépôt GitHub

Un dépôt est le dossier de votre projet hébergé sur GitHub. Aucun dépôt n’a encore été créé ni relié pour ce projet.

1. Connectez-vous à [GitHub](https://github.com), ou créez un compte.
2. Cliquez sur **+**, puis **New repository**.
3. Nommez le dépôt `novynarrateur`.
4. Choisissez **Public** pour utiliser GitHub Pages avec un compte gratuit. Le code et le site seront accessibles publiquement.
5. Activez **Add a README file** pour initialiser le dépôt, puis cliquez sur **Create repository**. Nous remplacerons ce README par celui du projet.

## 3. Ajouter le projet, sans terminal

1. Dans le dépôt, ouvrez l’onglet **Code**.
2. Cliquez sur **Add file → Upload files**.
3. Glissez les **quatre fichiers à l’intérieur** du dossier `NovyNarrateur` dans la zone de dépôt. Ne glissez ni le dossier lui-même ni l’archive ZIP.
4. Saisissez un message, par exemple : `Créer la page Hello World de NovyNarrateur`.
5. Enregistrez avec **Commit changes** sur la branche `main`.
6. Vérifiez que `index.html`, `styles.css`, `script.js` et `README.md` apparaissent directement à la racine du dépôt.

Cette méthode place une copie du projet sur GitHub. Pour les mises à jour, modifiez vos fichiers locaux et téléversez à nouveau les fichiers concernés, ou utilisez Git comme expliqué plus bas.

## 4. Publier sur GitHub Pages

1. Ouvrez **Settings** dans votre dépôt, puis **Pages**.
2. Sous **Build and deployment**, choisissez **Deploy from a branch** comme **Source**.
3. Choisissez la branche **main** et le dossier **/ (root)**, puis **Save**.
4. Attendez la fin de la publication, puis revenez dans **Settings → Pages** et cliquez sur **Visit site**. La publication peut prendre jusqu’à dix minutes.

L’adresse sera généralement `https://VOTRE-PSEUDO.github.io/novynarrateur/`, avec votre propre identifiant GitHub à la place de `VOTRE-PSEUDO`. Utilisez le lien indiqué par GitHub comme référence.

Ouvrez ce lien sur votre téléphone, votre tablette et votre ordinateur. Vérifiez que le texte reste lisible, que la page ne déborde pas horizontalement et que le bouton affiche bien la confirmation.

Les prochaines modifications enregistrées sur `main` seront publiées automatiquement.

## Option : relier votre dossier local avec Git

Cette option remplace le téléversement manuel. Elle nécessite Git et une authentification GitHub configurée sur votre ordinateur.

Si vous débutez avec Git, la méthode ci-dessus suffit. Pour conserver ensuite une copie locale reliée à ce dépôt, clonez-le avec GitHub Desktop ou Git.

Si vous choisissez Git dès le départ, créez à l’étape 2 un dépôt **vide**, sans README, licence ni fichier .gitignore, et sautez l’étape 3. Dans un terminal ouvert **dans le dossier contenant les quatre fichiers**, exécutez :

```sh
git init -b main
git add index.html styles.css script.js README.md
git commit -m "Créer la page Hello World de NovyNarrateur"
```

Copiez ensuite l’adresse HTTPS de votre dépôt depuis son bouton **Code**. Remplacez `VOTRE-PSEUDO` dans l’exemple suivant avant de l’exécuter :

```sh
git remote add origin https://github.com/VOTRE-PSEUDO/novynarrateur.git
git push -u origin main
```

Suivez ensuite l’étape 4 pour activer GitHub Pages. Pour publier une modification ultérieure :

```sh
git add index.html styles.css script.js README.md
git commit -m "Mettre à jour la page d’accueil"
git push
```

## Si quelque chose ne fonctionne pas

- **Page introuvable** : vérifiez la branche `main`, le dossier `/ (root)` et la présence de `index.html` à la racine. Consultez aussi l’onglet **Actions** du dépôt si la publication échoue.
- **Styles absents ou bouton inactif** : vérifiez que `styles.css` et `script.js` sont au même niveau que `index.html`, avec exactement ces noms en minuscules.
- **Ancienne version affichée** : attendez la fin de la publication et actualisez la page.
- **Git demande votre identité** : configurez votre nom et votre adresse de commit avant de recommencer le commit. Une adresse GitHub « noreply » peut être utilisée.
- **Dépôt déjà rempli** : privilégiez le téléversement manuel ou clonez le dépôt avant de modifier les fichiers. N’utilisez pas de push forcé.

## Documentation officielle

- [Créer un site GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Configurer la source de publication](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
