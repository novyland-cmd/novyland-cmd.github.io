# Harmonisation de la navigation NovyLand

## Fichiers créés
- `assets/css/navigation.css`
- `assets/js/navigation.js`
- `NAVIGATION-IMPLEMENTATION.md`

## Fichiers modifiés
- `index.html`
- `jeux/index.html`
- `novytools/index.html`
- `novytools/pages/about.html`
- `novytools/pages/privacy.html`
- `novytools/pages/legal.html`
- `novytools/applications/premier-joueur/index.html`
- `novytools/applications/minuteur/index.html`
- `styles.css`
- `novytools/styles.css`
- `novytools/script.js`
- `novytools/applications/minuteur/script.js`

## Fichiers volontairement non modifiés
- `novytools/applications/premier-joueur/app.js`
- `novytools/applications/premier-joueur/conditions.json`
- `novytools/applications/premier-joueur/images/`
- `novytools/applications/minuteur/timer.js`
- `CNAME`
- `.git/`

## Architecture

```text
assets/
├── css/
│   └── navigation.css
└── js/
    └── navigation.js
```

Chaque page contient uniquement un point de montage `data-site-navigation` et un lien de repli vers Accueil NovyLand. Le module construit l’en-tête, le panneau, les sections et les liens à partir de `NAVIGATION_SECTIONS`.

La racine est calculée avec `new URL("../../", import.meta.url)`. Elle dépend donc de la position réelle du module commun, et non de `/`, du domaine, de `localhost` ou du nom du dépôt GitHub Pages.

La page active est déclarée par `data-page`; le module applique `aria-current="page"` à une seule entrée correspondante. Le contexte `data-context="novytools"` ajoute l’entrée distincte Accueil NovyTools.

L’entrée future Boutique pourra être ajoutée dans `NAVIGATION_SECTIONS`, à un seul endroit. Une entrée désactivée est rendue comme un `span aria-disabled="true"`, jamais comme un lien fictif.

## Vérification des destinations principales

| Page de départ | Lien | Destination |
|---|---|---|
| `/index.html` | Jeux | `/jeux/index.html` |
| `/jeux/index.html` | NovyTools | `/novytools/index.html` |
| `/novytools/index.html` | Accueil NovyLand | `/index.html` |
| `/novytools/pages/about.html` | Accueil NovyTools | `/novytools/index.html` |
| `/novytools/pages/privacy.html` | Mentions légales | `/novytools/pages/legal.html` |
| `/novytools/applications/premier-joueur/index.html` | Minuteur de jeu | `/novytools/applications/minuteur/index.html` |
| `/novytools/applications/minuteur/index.html` | Premier Joueur | `/novytools/applications/premier-joueur/index.html` |
| Toute page | Accueil NovyLand | `/index.html` |

## Logique métier

La logique de sélection de Premier Joueur (`app.js`, `conditions.json`, images) n’a pas été modifiée. Le moteur générique du minuteur (`timer.js`) n’a pas été modifié. Seul le code de menu du fichier d’intégration `minuteur/script.js` a été retiré, puisque la navigation est désormais gérée par le module commun.
