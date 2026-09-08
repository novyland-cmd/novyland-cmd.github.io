# Sélecteur commun NovyLand

`select.js` est chargé par la navigation commune ; `select.css` par le thème commun.
Les `<select>` à choix unique sont automatiquement remplacés visuellement par
un bouton et une liste superposée de même largeur. Les listes ajoutées au DOM
sont aussi prises en charge. Les sélections multiples et listes `size > 1`
conservent leur contrôle natif.

Conserver un `<label for="…">` ou un nom accessible sur chaque `<select>`.
Le select reste la source de données pour les formulaires et les événements
`input` et `change`. Les options désactivées sont visibles mais non sélectionnables.
Les longues listes défilent dans leur propre panneau.

Après une modification directe de `.value` ou `.selectedIndex` en JavaScript,
appeler `refreshSelect(select)` pour mettre à jour le bouton. Pour ramener le
focus au contrôle visible, utiliser `focusSelect(select)`. `enhanceSelects(root)`
permet d'équiper immédiatement des champs nouvellement créés sans attendre
l'observateur ; les appels répétés ne dupliquent pas les contrôles.

```js
import { enhanceSelects, refreshSelect, focusSelect } from './select.js';
select.value = '2';
refreshSelect(select);
focusSelect(select);
```

Pour actualiser des options, conserver le select et remplacer ses enfants.
Les changements d'options et d'attributs sont observés automatiquement.
Le clavier prend en charge les flèches, Début/Fin, Entrée/Espace, Échap,
Tabulation et la recherche par caractères.
