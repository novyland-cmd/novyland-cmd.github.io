const catalogueUrl = 'https://novyland-studio-api.novyland.workers.dev/api/public/catalogue';
const catalogueStatus = document.querySelector('#catalogue-status');
const catalogueGames = document.querySelector('#catalogue-games');
const coverPattern = /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function formatRange(min, max, unit) {
  if (!positiveInteger(min)) return positiveInteger(max) ? `Jusqu’à ${max} ${unit}` : '';
  if (!positiveInteger(max)) return `Dès ${min} ${unit}`;
  if (min === max) return `${min} ${unit}`;
  return `${min} à ${max} ${unit}`;
}

function createElement(tag, className, content) {
  const element = document.createElement(tag);
  element.className = className;
  if (content) element.textContent = content;
  return element;
}

function createGameCard(game) {
  const card = createElement('li', 'catalogue-card');
  const cover = createElement('div', 'catalogue-card-cover');
  const placeholder = createElement('span', 'catalogue-cover-placeholder', 'Couverture indisponible');
  cover.append(placeholder);

  if (typeof game.cover === 'string' && coverPattern.test(game.cover)) {
    const image = createElement('img', 'catalogue-cover-image');
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      image.remove();
      placeholder.hidden = false;
    }, { once: true });
    placeholder.hidden = true;
    image.src = game.cover;
    cover.append(image);
  }

  card.append(cover, createElement('h2', 'catalogue-card-title', game.title));
  if (typeof game.subtitle === 'string' && game.subtitle.trim()) {
    card.append(createElement('p', 'catalogue-card-description', game.subtitle));
  }

  const details = [
    formatRange(game.min_players, game.max_players, game.min_players === 1 && game.max_players === 1 ? 'joueur' : 'joueurs'),
    formatRange(game.min_minutes, game.max_minutes, 'min'),
    positiveInteger(game.min_age) ? `${game.min_age} ans et +` : ''
  ].filter(Boolean);

  if (details.length) {
    const badges = createElement('ul', 'catalogue-card-details');
    badges.setAttribute('role', 'list');
    badges.append(...details.map(detail => createElement('li', 'catalogue-card-detail', detail)));
    card.append(badges);
  }

  return card;
}

async function loadCatalogue() {
  catalogueStatus.textContent = 'Chargement du catalogue…';

  try {
    const response = await fetch(catalogueUrl, { credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const games = await response.json();
    if (!Array.isArray(games)) throw new Error('Format de catalogue inattendu');

    const cards = games
      .filter(game => typeof game?.title === 'string' && game.title.trim())
      .map(createGameCard);
    catalogueGames.replaceChildren(...cards);
    catalogueGames.hidden = cards.length === 0;
    catalogueStatus.textContent = cards.length ? '' : 'Aucun jeu n’est actuellement publié dans le catalogue.';
  } catch {
    catalogueStatus.textContent = 'Le catalogue est temporairement indisponible. Réessayez dans quelques instants.';
    const retry = createElement('button', 'catalogue-retry', 'Réessayer');
    retry.type = 'button';
    retry.addEventListener('click', loadCatalogue);
    catalogueStatus.append(' ', retry);
  }
}

loadCatalogue();
