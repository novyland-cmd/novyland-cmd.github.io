# Harmonisation visuelle NovyLand

## Arborescence principale

```text
novyland-cmd.github.io/
├── CNAME
├── README.md
├── HARMONISATION-VISUELLE.md
├── index.html
├── styles.css
├── script.js
├── assets/
│   ├── css/
│   │   ├── theme.css
│   │   └── navigation.css
│   └── js/
│       └── navigation.js
├── jeux/
│   └── index.html
└── novytools/
    ├── index.html
    ├── styles.css
    ├── script.js
    ├── pages/
    │   ├── about.html
    │   ├── privacy.html
    │   └── legal.html
    └── applications/
        ├── premier-joueur/
        │   ├── index.html
        │   ├── app.css
        │   ├── app.js
        │   ├── conditions.json
        │   └── images/
        └── minuteur/
            ├── index.html
            ├── styles.css
            ├── script.js
            └── timer.js
```

## Fichier créé

- `assets/css/theme.css` : identité graphique et composants communs.

## Fichiers modifiés

- `assets/css/navigation.css`
- `index.html`
- `styles.css`
- `jeux/index.html`
- `novytools/index.html`
- `novytools/styles.css`
- `novytools/pages/about.html`
- `novytools/pages/privacy.html`
- `novytools/pages/legal.html`
- `novytools/applications/premier-joueur/index.html`
- `novytools/applications/premier-joueur/app.css`
- `novytools/applications/minuteur/index.html`
- `novytools/applications/minuteur/styles.css`

## Fichiers métier laissés inchangés

- `assets/js/navigation.js`
- `script.js`
- `novytools/script.js`
- `novytools/applications/premier-joueur/app.js`
- `novytools/applications/premier-joueur/conditions.json`
- toutes les images de Premier Joueur
- `novytools/applications/minuteur/script.js`
- `novytools/applications/minuteur/timer.js`
- `CNAME`

## Composants communs

| Composant | Classes principales |
|---|---|
| En-tête | `.novy-header`, `.novy-header__brand` |
| Menu burger | `.novy-nav__toggle`, `.novy-nav__panel`, `.novy-nav__link` |
| Bouton principal | `.button`, `.button-link`, `.button--primary` |
| Bouton secondaire | `.button--secondary` |
| Bouton discret | `.button--quiet` |
| Carte | `.content-card`, `.app-card`, `.product-card` |
| Panneau de lecture | `.info-card` |
| Pied de page | `.site-footer`, `.site-footer-links`, `.footer-nav` |
| Grilles | `.card-grid`, `.apps-grid`, `.games-grid`, `.product-grid` |
| Badge futur | `.badge` |
| Prix futur | `.price` |
| Promotion future | `.promo-section` |

## Variables CSS globales

- `--color-primary`
- `--color-primary-dark`
- `--color-secondary`
- `--color-accent`
- `--color-background`
- `--color-surface`
- `--color-surface-soft`
- `--color-text`
- `--color-text-muted`
- `--color-border`
- `--color-danger`
- `--shadow-small`
- `--shadow-medium`
- `--radius-small`
- `--radius-medium`
- `--radius-large`
- `--radius-pill`
- `--space-1` à `--space-6`
- `--content-width`
- `--reading-width`
- `--transition-duration`

Des alias compatibles avec les anciens CSS sont conservés afin de réduire le risque de régression.

## Répartition des styles

- `assets/css/theme.css` : variables, fond, typographie, conteneurs, titres, cartes, boutons, panneaux, grilles, pied de page, accessibilité, responsive et composants préparatoires à une future boutique.
- `assets/css/navigation.css` : uniquement l’en-tête dynamique et le menu burger commun.
- `styles.css` : accueil NovyLand et page Jeux.
- `novytools/styles.css` : ajustements de l’accueil NovyTools et des pages informatives.
- `premier-joueur/app.css` : image, condition, catégories et animation du tirage.
- `minuteur/styles.css` : affichage du temps et commandes du minuteur.

## Tableau de chargement des styles

| Page | Style commun | Style local | Composants principaux |
|---|---|---|---|
| Accueil NovyLand | `assets/css/theme.css` | `styles.css` | en-tête, cartes, boutons, pied de page |
| Jeux | `../assets/css/theme.css` | `../styles.css` | en-tête, panneau, grille préparée, pied de page |
| Accueil NovyTools | `../assets/css/theme.css` | `styles.css` | héros, cartes d’application, boutons |
| À propos | `../../assets/css/theme.css` | `../styles.css` | panneau de lecture, sections, publicité |
| Confidentialité | `../../assets/css/theme.css` | `../styles.css` | panneau de lecture, sections, publicité |
| Mentions légales | `../../assets/css/theme.css` | `../styles.css` | panneau de lecture, notes, publicité |
| Premier Joueur | `../../../assets/css/theme.css` | `../../styles.css`, `app.css` | carte, image, condition, catégories, bouton |
| Minuteur | `../../../assets/css/theme.css` | `styles.css` | carte, affichage temporel, commandes |

## Vérifications effectuées

- Tous les liens et ressources relatifs présents dans les fichiers HTML correspondent à des fichiers existants.
- Aucun style en ligne ni bloc `<style>` n’a été ajouté.
- La syntaxe de tous les fichiers JavaScript a été vérifiée avec Node.js.
- Les fichiers métier protégés n’ont aucune modification Git.
- `conditions.json`, `timer.js`, `app.js`, les images et `CNAME` sont inchangés.
- La logique métier de Premier Joueur et du Minuteur n’a pas été modifiée.
