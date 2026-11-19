const catalogueUrl = 'https://novyland-studio-api.novyland.workers.dev/api/public/catalogue';
const catalogueStatus = document.querySelector('#catalogue-status');
const catalogueGames = document.querySelector('#catalogue-games');
const catalogueList = document.querySelector('#catalogue-list');
const catalogueGame = document.querySelector('#catalogue-game');
const catalogueTitle = document.title;
const coverPattern = /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
let gamesById = new Map();
let openGameId = null;

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

function createCover(game) {
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

  return cover;
}

function createBadges(game, extra = []) {
  const details = [
    formatRange(game.min_players, game.max_players, game.min_players === 1 && game.max_players === 1 ? 'joueur' : 'joueurs'),
    formatRange(game.min_minutes, game.max_minutes, 'min'),
    positiveInteger(game.min_age) ? `${game.min_age} ans et +` : '',
    ...extra
  ].filter(Boolean);

  if (!details.length) return null;
  const badges = createElement('ul', 'catalogue-card-details');
  badges.setAttribute('role', 'list');
  badges.append(...details.map(detail => createElement('li', 'catalogue-card-detail', detail)));
  return badges;
}

function gameText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createGameCard(game) {
  const card = createElement('li', 'catalogue-card');
  card.append(createCover(game), createElement('h2', 'catalogue-card-title', game.title));
  if (gameText(game.subtitle)) {
    card.append(createElement('p', 'catalogue-card-description', game.subtitle));
  }

  const badges = createBadges(game);
  if (badges) card.append(badges);

  if (gameText(game.id)) {
    const link = createElement('a', 'button catalogue-card-link', 'Voir la fiche');
    link.id = `catalogue-link-${game.id}`;
    link.href = `#jeu=${encodeURIComponent(game.id)}`;
    link.setAttribute('aria-label', `Voir la fiche de ${game.title}`);
    card.append(link);
  }
  return card;
}

function publicLink(value, label) {
  const address = gameText(value);
  if (!address.startsWith('https://') && !address.startsWith('/')) return null;
  let url;
  try {
    url = new URL(address, catalogueUrl);
  } catch {
    return null;
  }
  if (url.href === catalogueUrl || url.protocol !== 'https:' || url.username || url.password) {
    return null;
  }

  const link = createElement('a', 'button button--secondary', label);
  link.href = url.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `${label} (nouvel onglet)`);
  return link;
}

function createGameDetail(game) {
  const back = createElement('a', 'catalogue-back', 'Retour au catalogue');
  back.href = '#catalogue';
  const layout = createElement('div', 'catalogue-game-layout');
  const sidebar = createElement('div', 'catalogue-game-sidebar');
  const content = createElement('div', 'catalogue-game-content');
  const title = createElement('h1', 'catalogue-game-title', game.title);
  title.id = 'catalogue-game-title';
  title.tabIndex = -1;
  content.append(title);
  if (gameText(game.subtitle)) {
    content.append(createElement('p', 'catalogue-card-description', game.subtitle));
  }

  const complexity = Number.isInteger(game.complexity) && game.complexity >= 1 && game.complexity <= 5
    ? `Complexité ${game.complexity}/5` : '';
  const badges = createBadges(game, [gameText(game.genre), complexity]);
  if (badges) content.append(badges);

  const version = gameText(game.current_version) || 'Non indiquée';
  const versionInfo = createElement('p', 'catalogue-game-version');
  versionInfo.append(createElement('strong', '', 'Version courante'), document.createTextNode(` · ${version}`));
  content.append(versionInfo);

  const actions = createElement('div', 'catalogue-game-actions');
  const rules = publicLink(game.rules_url, 'Voir le livret de règles');
  const unavailable = createElement('button', 'button button--secondary', 'Livret de règles indisponible');
  unavailable.type = 'button';
  unavailable.disabled = true;
  actions.append(rules || unavailable);
  for (const [url, label] of [
    [game.sell_sheet_url, 'Fiche de présentation'],
    [game.press_kit_url, 'Dossier de presse'],
    [game.pitch_video_url, 'Vidéo de présentation']
  ]) {
    const link = publicLink(url, label);
    if (link) actions.append(link);
  }
  content.append(actions);

  if (gameText(game.description)) {
    const section = createElement('section', 'catalogue-game-section');
    section.append(createElement('h2', '', 'Description'), createElement('p', '', game.description));
    content.append(section);
  }

  const mechanics = gameText(game.mechanics).split(',').map(gameText).filter(Boolean);
  if (mechanics.length) {
    const section = createElement('section', 'catalogue-game-section');
    const list = createElement('ul', 'catalogue-card-details');
    list.setAttribute('role', 'list');
    list.append(...mechanics.map(item => createElement('li', 'catalogue-card-detail', item)));
    section.append(createElement('h2', '', 'Mécaniques'), list);
    content.append(section);
  }

  sidebar.append(createCover(game));
  const credits = createElement('dl', 'catalogue-game-credits');
  for (const [label, name] of [['Conception', game.designer], ['Illustration', game.artist]]) {
    if (gameText(name)) credits.append(createElement('dt', '', label), createElement('dd', '', name));
  }
  if (credits.childElementCount) sidebar.append(credits);

  const hooks = Array.isArray(game.hooks) ? game.hooks.map(gameText).filter(Boolean) : [];
  if (hooks.length) {
    const list = createElement('ul', 'catalogue-game-hooks');
    list.setAttribute('role', 'list');
    list.append(...hooks.map(hook => createElement('li', '', hook)));
    sidebar.append(list);
  }

  layout.append(sidebar, content);
  catalogueGame.replaceChildren(back, layout);
  return title;
}

function showRoute() {
  const gameId = new URLSearchParams(window.location.hash.slice(1)).get('jeu');
  const game = gamesById.get(gameId);
  catalogueList.hidden = Boolean(game);
  catalogueGame.hidden = !game;

  if (game) {
    openGameId = gameId;
    const title = createGameDetail(game);
    document.title = `${game.title} | NovyLand Games`;
    window.scrollTo(0, 0);
    title.focus({ preventScroll: true });
    return;
  }

  catalogueGame.replaceChildren();
  document.title = catalogueTitle;
  if (openGameId) document.getElementById(`catalogue-link-${openGameId}`)?.focus();
  openGameId = null;
}

async function loadCatalogue() {
  catalogueStatus.textContent = 'Chargement du catalogue…';

  try {
    const response = await fetch(catalogueUrl, { credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const games = await response.json();
    if (!Array.isArray(games)) throw new Error('Format de catalogue inattendu');

    const titledGames = games.filter(game => gameText(game?.title));
    gamesById = new Map(titledGames.filter(game => gameText(game.id)).map(game => [game.id, game]));
    const cards = titledGames.map(createGameCard);
    catalogueGames.replaceChildren(...cards);
    catalogueGames.hidden = cards.length === 0;
    catalogueStatus.textContent = cards.length ? '' : 'Aucun jeu n’est actuellement publié dans le catalogue.';
    showRoute();
  } catch {
    catalogueStatus.textContent = 'Le catalogue est temporairement indisponible. Réessayez dans quelques instants.';
    const retry = createElement('button', 'catalogue-retry', 'Réessayer');
    retry.type = 'button';
    retry.addEventListener('click', loadCatalogue);
    catalogueStatus.append(' ', retry);
  }
}

window.addEventListener('hashchange', showRoute);
loadCatalogue();
