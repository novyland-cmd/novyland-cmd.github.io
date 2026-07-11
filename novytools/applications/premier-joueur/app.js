// Sélection des éléments principaux de l'interface.
const mainButton = document.querySelector('#mainButton');
const conditionElement = document.querySelector('#condition-text');
const conditionImageElement = document.querySelector('#condition-image');
const categoryFiltersElement = document.querySelector('#category-filters');

// Dossier contenant les illustrations.
const IMAGE_FOLDER = 'images/';

// Liste explicite des fichiers PNG réellement disponibles dans le projet.
// Mets cette liste à jour chaque fois qu'une nouvelle image est ajoutée au dossier images/.
const availableImages = [
  'meeple-couronne.png',
  'meeple-carte.png',
  'meeple-jumelles.png',
  'meeple-megaphone.png',
  'meeple-chef.png',
  'meeple-livre.png',
  'meeple-cles.png',
  'meeple-pomme.png',
  'meeple-tasse.png',
  'meeple-telephone.png',
  'meeple-tshirt.png',
  'meeple-chaussures.png'
];

// Banque de conditions chargée depuis le fichier JSON.
let conditions = [];

// Catégorie active pendant la session actuelle.
let selectedCategory = 'all';

// Dernière condition affichée pendant la session actuelle.
let lastConditionId = null;

// Empêche une boucle infinie si une image de remplacement échoue aussi.
let fallbackAttempted = false;

// Initialisation de l'application au chargement de la page.
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  try {
    const loadedConditions = await loadConditions();

    // On conserve uniquement les entrées exploitables afin d'éviter
    // les erreurs si le JSON contient une valeur incomplète ou invalide.
    conditions = getValidConditions(loadedConditions);

    const categories = extractCategories(conditions);
    createCategoryFilters(categories);

    if (conditions.length === 0) {
      hideImage();
      displayCondition('Aucune condition valide n’est disponible pour le moment.');
      return;
    }

    // Affiche automatiquement une première condition au chargement.
    handleNewCondition();
  } catch (error) {
    console.error('Erreur lors du chargement des conditions :', error);

    // Le bouton « Toutes » reste disponible même si le JSON ne se charge pas.
    conditions = [];
    createCategoryFilters([]);
    hideImage();
    displayCondition('Impossible de charger les conditions.');
  }
}

async function loadConditions() {
  const response = await fetch('conditions.json');

  if (!response.ok) {
    throw new Error('Le fichier conditions.json est introuvable.');
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Le fichier conditions.json doit contenir un tableau.');
  }

  return data;
}

function getValidConditions(conditionList) {
  if (!Array.isArray(conditionList)) {
    return [];
  }

  return conditionList.filter((condition) => {
    return condition
      && typeof condition === 'object'
      && typeof condition.text === 'string'
      && condition.text.trim() !== '';
  });
}

function normalizeCategory(category) {
  if (typeof category !== 'string') {
    return '';
  }

  return category.trim();
}

function extractCategories(conditionList) {
  const uniqueCategories = new Set();

  conditionList.forEach((condition) => {
    const category = normalizeCategory(condition.category);

    if (category) {
      uniqueCategories.add(category);
    }
  });

  return Array.from(uniqueCategories).sort((categoryA, categoryB) => {
    return categoryA.localeCompare(categoryB, 'fr', { sensitivity: 'base' });
  });
}

function formatCategoryLabel(category) {
  const normalizedCategory = normalizeCategory(category);

  if (!normalizedCategory) {
    return '';
  }

  const readableLabel = normalizedCategory
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('fr-FR');

  return readableLabel.charAt(0).toLocaleUpperCase('fr-FR') + readableLabel.slice(1);
}

function createCategoryChip(category, label, isActive = false) {
  const chip = document.createElement('button');

  chip.type = 'button';
  chip.className = 'category-chip';
  chip.dataset.category = category;
  chip.textContent = label;
  chip.setAttribute('aria-pressed', String(isActive));

  if (isActive) {
    chip.classList.add('active');
  }

  chip.addEventListener('click', handleCategoryClick);
  return chip;
}

function createCategoryFilters(categories) {
  if (!categoryFiltersElement) {
    console.error('Le conteneur des filtres de catégories est introuvable.');
    return;
  }

  categoryFiltersElement.replaceChildren();
  selectedCategory = 'all';
  lastConditionId = null;

  // Le bouton « Toutes » est toujours créé en premier et actif par défaut.
  const allChip = createCategoryChip('all', 'Toutes', true);
  categoryFiltersElement.appendChild(allChip);

  categories.forEach((category) => {
    const label = formatCategoryLabel(category);
    const chip = createCategoryChip(category, label);
    categoryFiltersElement.appendChild(chip);
  });
}

function getSelectedCategory() {
  return selectedCategory;
}

function getFilteredConditions() {
  const activeCategory = getSelectedCategory();

  if (activeCategory === 'all') {
    return conditions;
  }

  return conditions.filter((condition) => {
    return normalizeCategory(condition.category) === activeCategory;
  });
}

function getConditionIdentifier(condition) {
  if (condition.id !== null && condition.id !== undefined) {
    return String(condition.id);
  }

  // Repli utile si une condition ne possède pas d'identifiant explicite.
  return `${normalizeCategory(condition.category)}::${condition.text.trim()}`;
}

function getRandomCondition(conditionList) {
  if (!Array.isArray(conditionList) || conditionList.length === 0) {
    return null;
  }

  if (conditionList.length === 1) {
    return conditionList[0];
  }

  let selectedCondition;

  do {
    const randomIndex = Math.floor(Math.random() * conditionList.length);
    selectedCondition = conditionList[randomIndex];
  } while (getConditionIdentifier(selectedCondition) === lastConditionId);

  return selectedCondition;
}

function buildImagePath(fileName) {
  if (typeof fileName !== 'string' || fileName.trim() === '') {
    return null;
  }

  return `${IMAGE_FOLDER}${fileName.trim()}`;
}

function getRandomFallbackImage() {
  if (!Array.isArray(availableImages) || availableImages.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * availableImages.length);
  return buildImagePath(availableImages[randomIndex]);
}

function getConditionImagePath(condition) {
  if (!condition || typeof condition !== 'object') {
    return getRandomFallbackImage();
  }

  const imageName = typeof condition.image === 'string'
    ? condition.image.trim()
    : '';

  if (!imageName || !availableImages.includes(imageName)) {
    return getRandomFallbackImage();
  }

  return buildImagePath(imageName);
}

function resetImageErrorState() {
  fallbackAttempted = false;
}

function hideImage() {
  if (!conditionImageElement) {
    return;
  }

  conditionImageElement.hidden = true;
  conditionImageElement.removeAttribute('src');
  conditionImageElement.alt = '';
}

function animateImageChange() {
  if (!conditionImageElement) {
    return;
  }

  conditionImageElement.classList.remove('is-changing');
  void conditionImageElement.offsetWidth;
  conditionImageElement.classList.add('is-changing');
}

function displayConditionImage(condition) {
  if (!conditionImageElement) {
    return;
  }

  resetImageErrorState();

  const imagePath = getConditionImagePath(condition);

  if (!imagePath) {
    hideImage();
    return;
  }

  conditionImageElement.hidden = false;
  conditionImageElement.alt = `Illustration : ${condition.text.trim()}`;
  conditionImageElement.src = imagePath;
  animateImageChange();
}

function handleImageError() {
  if (!conditionImageElement) {
    return;
  }

  if (fallbackAttempted) {
    hideImage();
    return;
  }

  fallbackAttempted = true;
  const fallbackImagePath = getRandomFallbackImage();

  if (!fallbackImagePath || conditionImageElement.src.endsWith(fallbackImagePath)) {
    hideImage();
    return;
  }

  conditionImageElement.src = fallbackImagePath;
}

if (conditionImageElement) {
  conditionImageElement.addEventListener('error', handleImageError);
}

function animateConditionChange() {
  if (!conditionElement) {
    return;
  }

  conditionElement.classList.remove('is-changing');
  void conditionElement.offsetWidth;
  conditionElement.classList.add('is-changing');
}

function displayCondition(text) {
  if (!conditionElement) {
    throw new Error("L'élément d'affichage de la condition est introuvable.");
  }

  conditionElement.textContent = text;
  animateConditionChange();
}

function handleNewCondition() {
  const filteredConditions = getFilteredConditions();
  const randomCondition = getRandomCondition(filteredConditions);

  if (!randomCondition) {
    hideImage();
    displayCondition('Aucune condition disponible dans cette catégorie.');
    lastConditionId = null;
    return;
  }

  displayConditionImage(randomCondition);
  displayCondition(randomCondition.text.trim());
  lastConditionId = getConditionIdentifier(randomCondition);
}

function setActiveCategoryChip(activeChip) {
  if (!categoryFiltersElement) {
    return;
  }

  const categoryChips = categoryFiltersElement.querySelectorAll('.category-chip');

  categoryChips.forEach((chip) => {
    const isActive = chip === activeChip;

    chip.classList.toggle('active', isActive);
    chip.setAttribute('aria-pressed', String(isActive));
  });
}

function handleCategoryClick(event) {
  const clickedChip = event.currentTarget;
  const newCategory = clickedChip.dataset.category || 'all';

  selectedCategory = newCategory;
  lastConditionId = null;
  setActiveCategoryChip(clickedChip);
  handleNewCondition();
}

function animateButtonClick() {
  if (!mainButton) {
    return;
  }

  mainButton.classList.remove('is-pressed');
  void mainButton.offsetWidth;
  mainButton.classList.add('is-pressed');
}

// Le bouton principal affiche une nouvelle condition dans la catégorie active.
if (mainButton) {
  mainButton.textContent = 'Nouvelle condition';
  mainButton.addEventListener('click', () => {
    animateButtonClick();
    handleNewCondition();
  });
}
