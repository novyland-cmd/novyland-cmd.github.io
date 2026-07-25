"use strict";

/**
 * Piste de score NovyTools
 * Centralise la configuration et l'état de la partie en mémoire JavaScript.
 */

const PLAYER_LIMITS = Object.freeze({ min: 1, max: 6 });
const SCORE_MILESTONES = Object.freeze([50, 100, 150, 200]);
const SCORE_TRACK_CONFIG = Object.freeze({ totalSpaces: 50, spacesPerRow: 10, maxDisplayedMilestone: 200 });
const TOKEN_LAYOUT_LIMIT = PLAYER_LIMITS.max;
const AVAILABLE_LETTERS = Object.freeze("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
const AVAILABLE_COLORS = Object.freeze([
  { id: "red", label: "Rouge", value: "#c94b49" },
  { id: "blue", label: "Bleu", value: "#3976c5" },
  { id: "green", label: "Vert", value: "#4d8b59" },
  { id: "yellow", label: "Jaune", value: "#e0b83f", textColor: "#2b2b22" },
  { id: "orange", label: "Orange", value: "#df7a32" },
  { id: "purple", label: "Violet", value: "#8556a8" },
  { id: "turquoise", label: "Turquoise", value: "#2a9d9f" }
]);

const scoreTrackState = {
  playerCount: 2,
  players: [],
  isConfigurationValid: false,
  game: null
};

const dom = {};


/** Retourne un score entier positif ou nul afin de protéger les calculs de piste. */
function normalizeScore(value) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return 0;
  return Math.max(0, Math.trunc(parsedValue));
}

/** Calcule la case visible correspondant au score total. */
function calculateTrackPosition(score) {
  const normalizedScore = normalizeScore(score);
  if (normalizedScore === 0) return 0;

  const remainder = normalizedScore % SCORE_TRACK_CONFIG.totalSpaces;
  return remainder === 0 ? SCORE_TRACK_CONFIG.totalSpaces : remainder;
}

/**
 * Calcule le dernier tour de 50 points entièrement dépassé.
 * Un score exact de 50 reste uniquement sur la case normale 50.
 * Un score exact de 100 affiche donc le palier 50 et la case normale 50.
 */
function calculateMilestone(score) {
  const normalizedScore = normalizeScore(score);
  if (normalizedScore <= SCORE_TRACK_CONFIG.totalSpaces) return 0;

  const completedMilestone = Math.floor((normalizedScore - 1) / SCORE_TRACK_CONFIG.totalSpaces)
    * SCORE_TRACK_CONFIG.totalSpaces;
  return Math.min(completedMilestone, SCORE_TRACK_CONFIG.maxDisplayedMilestone);
}

function cloneData(data) {
  return typeof structuredClone === "function"
    ? structuredClone(data)
    : JSON.parse(JSON.stringify(data));
}

function createDefaultPlayer(index) {
  return {
    id: index + 1,
    name: "",
    letter: AVAILABLE_LETTERS[index] || "",
    color: AVAILABLE_COLORS[index]?.id || "",
    turnOrder: index + 1
  };
}

function normalizePlayerCount(value) {
  const parsedValue = Number.parseInt(value, 10);
  if (Number.isNaN(parsedValue)) return PLAYER_LIMITS.min;
  return Math.min(PLAYER_LIMITS.max, Math.max(PLAYER_LIMITS.min, parsedValue));
}

function synchronizePlayers(playerCount) {
  const normalizedCount = normalizePlayerCount(playerCount);
  const retainedPlayers = scoreTrackState.players.slice(0, normalizedCount);

  while (retainedPlayers.length < normalizedCount) {
    retainedPlayers.push(createDefaultPlayer(retainedPlayers.length));
  }

  scoreTrackState.playerCount = normalizedCount;
  scoreTrackState.players = retainedPlayers.map((player, index) => ({
    ...player,
    id: index + 1
  }));
}

function createOption(value, label, selectedValue, disabled = false) {
  const option = document.createElement("option");
  option.value = String(value);
  option.textContent = label;
  option.selected = String(value) === String(selectedValue);
  option.disabled = disabled;
  return option;
}

function appendPlaceholder(select, label, selectedValue) {
  select.append(createOption("", label, selectedValue));
}

function getUsedValues(propertyName, excludedPlayerId) {
  return new Set(
    scoreTrackState.players
      .filter((player) => player.id !== excludedPlayerId)
      .map((player) => String(player[propertyName] ?? ""))
      .filter(Boolean)
  );
}

function buildLetterSelect(player) {
  const select = document.createElement("select");
  select.id = `player-letter-${player.id}`;
  select.dataset.playerId = String(player.id);
  select.dataset.field = "letter";
  select.required = true;
  select.setAttribute("aria-label", `Lettre du joueur ${player.id}`);
  appendPlaceholder(select, "Choisir", player.letter);

  const usedLetters = getUsedValues("letter", player.id);
  AVAILABLE_LETTERS.forEach((letter) => {
    select.append(createOption(letter, letter, player.letter, usedLetters.has(letter)));
  });
  return select;
}

function buildColorSelect(player) {
  const select = document.createElement("select");
  select.id = `player-color-${player.id}`;
  select.dataset.playerId = String(player.id);
  select.dataset.field = "color";
  select.required = true;
  select.setAttribute("aria-label", `Couleur du joueur ${player.id}`);
  appendPlaceholder(select, "Choisir", player.color);

  const usedColors = getUsedValues("color", player.id);
  AVAILABLE_COLORS.forEach((color) => {
    select.append(createOption(color.id, color.label, player.color, usedColors.has(color.id)));
  });
  return select;
}

function buildTurnOrderSelect(player) {
  const select = document.createElement("select");
  select.id = `player-order-${player.id}`;
  select.dataset.playerId = String(player.id);
  select.dataset.field = "turnOrder";
  select.required = true;
  select.setAttribute("aria-label", `Ordre de jeu du joueur ${player.id}`);
  appendPlaceholder(select, "Choisir", player.turnOrder);

  const usedOrders = getUsedValues("turnOrder", player.id);
  for (let order = 1; order <= scoreTrackState.playerCount; order += 1) {
    select.append(createOption(
      order,
      `${order}${order === 1 ? "er" : "e"}`,
      player.turnOrder,
      usedOrders.has(String(order))
    ));
  }
  return select;
}

function createField(labelText, control) {
  const wrapper = document.createElement("div");
  wrapper.className = "player-field";
  const label = document.createElement("label");
  label.htmlFor = control.id;
  label.textContent = labelText;
  wrapper.append(label, control);
  return wrapper;
}

function getColorDefinition(colorId) {
  return AVAILABLE_COLORS.find((color) => color.id === colorId) || null;
}

function applyTokenAppearance(token, player, accessible = true) {
  const color = getColorDefinition(player.colorId || player.color);
  token.textContent = player.letter || "?";
  token.style.backgroundColor = color?.value || player.colorValue || "#8b9490";
  token.style.color = color?.textColor || "#ffffff";
  if (accessible) {
    token.setAttribute("aria-label", `Jeton ${player.displayName || player.name || player.letter}`);
  }
}

function updateTokenPreview(playerId, animate = false) {
  const player = scoreTrackState.players.find((item) => item.id === playerId);
  const token = document.querySelector(`[data-token-player-id="${playerId}"]`);
  if (!player || !token) return;

  applyTokenAppearance(token, player);
  if (animate) {
    token.classList.remove("is-updated");
    requestAnimationFrame(() => {
      token.classList.add("is-updated");
      window.setTimeout(() => token.classList.remove("is-updated"), 180);
    });
  }
}

function createPlayerCard(player) {
  const card = document.createElement("article");
  card.className = "player-card";
  card.dataset.playerId = String(player.id);

  const heading = document.createElement("header");
  heading.className = "player-card-heading";
  const title = document.createElement("h3");
  title.textContent = `Joueur ${player.id}`;
  const subtitle = document.createElement("p");
  subtitle.textContent = "Configurez son jeton";
  heading.append(title, subtitle);

  const nameInput = document.createElement("input");
  nameInput.id = `player-name-${player.id}`;
  nameInput.type = "text";
  nameInput.maxLength = 30;
  nameInput.value = player.name;
  nameInput.placeholder = "Nom facultatif";
  nameInput.autocomplete = "off";
  nameInput.dataset.playerId = String(player.id);
  nameInput.dataset.field = "name";

  const fields = document.createElement("div");
  fields.className = "player-fields";
  fields.append(
    createField("Nom", nameInput),
    createField("Lettre", buildLetterSelect(player)),
    createField("Couleur", buildColorSelect(player)),
    createField("Ordre de jeu", buildTurnOrderSelect(player))
  );

  const tokenGroup = document.createElement("div");
  tokenGroup.className = "token-preview-group";
  const tokenLabel = document.createElement("span");
  tokenLabel.className = "token-preview-label";
  tokenLabel.textContent = "Jeton";
  const token = document.createElement("div");
  token.className = "player-token";
  token.dataset.tokenPlayerId = String(player.id);
  token.setAttribute("role", "img");
  tokenGroup.append(tokenLabel, token);

  card.append(heading, fields, tokenGroup);
  return card;
}

function renderPlayers() {
  const fragment = document.createDocumentFragment();
  scoreTrackState.players.forEach((player) => fragment.append(createPlayerCard(player)));
  dom.playersList.replaceChildren(fragment);
  scoreTrackState.players.forEach((player) => updateTokenPreview(player.id));
}

function findDuplicateValues(propertyName) {
  const counts = new Map();
  scoreTrackState.players.forEach((player) => {
    const value = String(player[propertyName] ?? "");
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

function validateConfiguration() {
  const messages = [];
  if (scoreTrackState.players.some((player) => !player.letter)) messages.push("choisissez une lettre pour chaque joueur");
  if (scoreTrackState.players.some((player) => !player.color)) messages.push("choisissez une couleur pour chaque joueur");
  if (scoreTrackState.players.some((player) => !player.turnOrder)) messages.push("choisissez un ordre pour chaque joueur");
  if (findDuplicateValues("letter").length) messages.push("les lettres doivent être uniques");
  if (findDuplicateValues("color").length) messages.push("les couleurs doivent être uniques");
  if (findDuplicateValues("turnOrder").length) messages.push("les ordres de jeu doivent être uniques");

  scoreTrackState.isConfigurationValid = messages.length === 0;
  dom.startButton.disabled = !scoreTrackState.isConfigurationValid;
  dom.status.classList.toggle("is-valid", scoreTrackState.isConfigurationValid);
  dom.status.classList.toggle("is-invalid", !scoreTrackState.isConfigurationValid && messages.length > 0);
  dom.status.textContent = scoreTrackState.isConfigurationValid
    ? "Configuration valide. La partie peut être démarrée."
    : `Configuration incomplète : ${messages.join("; ")}.`;
  return scoreTrackState.isConfigurationValid;
}

function refreshSelectAvailability() {
  scoreTrackState.players.forEach((player) => {
    const card = dom.playersList.querySelector(`[data-player-id="${player.id}"]`);
    if (!card) return;
    card.querySelector('[data-field="letter"]').replaceWith(buildLetterSelect(player));
    card.querySelector('[data-field="color"]').replaceWith(buildColorSelect(player));
    card.querySelector('[data-field="turnOrder"]').replaceWith(buildTurnOrderSelect(player));
  });
}

function updatePlayerFromControl(control) {
  const playerId = Number.parseInt(control.dataset.playerId, 10);
  const fieldName = control.dataset.field;
  const player = scoreTrackState.players.find((item) => item.id === playerId);
  if (!player || !fieldName) return;

  player[fieldName] = fieldName === "turnOrder"
    ? (control.value ? Number.parseInt(control.value, 10) : null)
    : control.value.trim();

  if (fieldName === "letter" || fieldName === "color") updateTokenPreview(playerId, true);
  if (["letter", "color", "turnOrder"].includes(fieldName)) refreshSelectAvailability();
  validateConfiguration();
}

/**
 * Crée une case standard de la piste.
 * Les attributs de données permettront de retrouver et manipuler chaque case.
 */
function createTrackSpace(position) {
  const space = document.createElement("div");
  space.id = `score-space-${position}`;
  space.className = "score-track-space";
  space.dataset.trackPosition = String(position);
  space.dataset.spaceType = "numbered";
  space.setAttribute("role", "group");
  space.setAttribute("aria-label", `Case ${position}`);

  const number = document.createElement("span");
  number.className = "score-track-number";
  number.textContent = String(position);
  number.setAttribute("aria-hidden", "true");

  const tokenLayer = document.createElement("span");
  tokenLayer.className = "score-track-tokens";
  tokenLayer.dataset.tokenLayer = String(position);
  tokenLayer.dataset.layerType = "track";
  tokenLayer.setAttribute("aria-hidden", "true");

  space.append(number, tokenLayer);
  return space;
}

/** Crée une grande case de palier de deux colonnes. */
function createMilestoneSpace(value) {
  const isStart = value === 0;
  const space = document.createElement("div");
  space.id = isStart ? "score-space-start" : `score-milestone-${value}`;
  space.className = `score-track-space score-track-space--milestone${isStart ? " score-track-space--start" : ""}`;
  space.dataset.trackPosition = String(value);
  space.dataset.spaceType = isStart ? "start" : "milestone";
  space.setAttribute("role", "group");
  space.setAttribute("aria-label", isStart ? "Case Départ" : `Palier ${value}`);

  const label = document.createElement("span");
  label.className = "score-track-number";
  label.textContent = isStart ? "Départ" : String(value);
  label.setAttribute("aria-hidden", "true");

  const tokenLayer = document.createElement("span");
  tokenLayer.className = "score-track-tokens score-track-tokens--milestone";
  tokenLayer.dataset.tokenLayer = String(value);
  tokenLayer.dataset.layerType = "milestone";
  tokenLayer.setAttribute("aria-hidden", "true");

  space.append(label, tokenLayer);
  return space;
}

/** Organise un groupe de cases normales dans une rangée de dix colonnes. */
function createTrackRow(rowIndex, startPosition, endPosition) {
  const row = document.createElement("div");
  row.className = "score-track-row";
  row.dataset.trackRow = String(rowIndex);
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", `Rangée ${rowIndex}, cases ${startPosition} à ${endPosition}`);

  for (let position = startPosition; position <= endPosition; position += 1) {
    row.append(createTrackSpace(position));
  }

  return row;
}

/** Génère la rangée Départ et paliers, puis les 50 cases normales. */
function generateScoreTrack() {
  if (!dom.scoreTrack) return;

  const fragment = document.createDocumentFragment();
  const milestoneRow = document.createElement("div");
  milestoneRow.className = "score-track-milestone-row";
  milestoneRow.dataset.trackRow = "milestones";
  milestoneRow.setAttribute("role", "group");
  milestoneRow.setAttribute("aria-label", "Départ et paliers de 50 points");
  [0, ...SCORE_MILESTONES].forEach((value) => milestoneRow.append(createMilestoneSpace(value)));
  fragment.append(milestoneRow);

  const rowCount = Math.ceil(SCORE_TRACK_CONFIG.totalSpaces / SCORE_TRACK_CONFIG.spacesPerRow);
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const startPosition = (rowIndex * SCORE_TRACK_CONFIG.spacesPerRow) + 1;
    const endPosition = Math.min(
      startPosition + SCORE_TRACK_CONFIG.spacesPerRow - 1,
      SCORE_TRACK_CONFIG.totalSpaces
    );
    fragment.append(createTrackRow(rowIndex + 1, startPosition, endPosition));
  }

  dom.scoreTrack.replaceChildren(fragment);
}

/** Crée un jeton de piste ou de palier pour un joueur. */
function createTrackToken(player, tokenType = "track") {
  const token = document.createElement("span");
  token.id = `${tokenType}-token-${player.id}`;
  token.className = `score-track-token score-track-token--${tokenType}`;
  token.dataset.trackTokenPlayerId = String(player.id);
  token.dataset.playerId = String(player.id);
  token.dataset.tokenType = tokenType;
  token.setAttribute("role", "img");
  applyTokenAppearance(token, player);
  return token;
}

/** Retourne la couche de jetons d'une case et d'un type donnés. */
function getTokenLayer(position, layerType = "track") {
  const normalizedPosition = Number(position);
  return dom.scoreTrack?.querySelector(
    `[data-token-layer="${normalizedPosition}"][data-layer-type="${layerType}"]`
  ) || null;
}

/** Retourne tous les jetons présents dans une case donnée. */
function getTokensInSpace(position, layerType = "track") {
  const layer = getTokenLayer(position, layerType);
  return layer ? [...layer.querySelectorAll(".score-track-token")] : [];
}

/** Met à jour la disposition d'une couche de jetons. */
function updateTokenLayout(position, layerType = "track") {
  const layer = getTokenLayer(position, layerType);
  if (!layer) return;

  const tokenCount = Math.min(getTokensInSpace(position, layerType).length, TOKEN_LAYOUT_LIMIT);
  layer.dataset.tokenCount = String(tokenCount);
  for (let count = 0; count <= TOKEN_LAYOUT_LIMIT; count += 1) {
    layer.classList.toggle(`score-track-tokens--${count}`, count === tokenCount);
  }
}

/** Place le jeton principal du joueur sur la piste normale. */
function placePlayerTrackToken(player) {
  const previousPosition = Number.isInteger(player.trackPosition) ? player.trackPosition : 0;
  const nextPosition = calculateTrackPosition(player.score);
  const destinationLayer = nextPosition === 0
    ? getTokenLayer(0, "milestone")
    : getTokenLayer(nextPosition, "track");

  if (!destinationLayer) return false;

  let token = dom.scoreTrack.querySelector(
    `[data-track-token-player-id="${player.id}"][data-token-type="track"]`
  );
  if (!token) token = createTrackToken(player, "track");

  applyTokenAppearance(token, player);
  token.title = `${player.displayName} · Score ${player.score}`;
  token.dataset.score = String(player.score);
  destinationLayer.append(token);
  player.trackPosition = nextPosition;

  updateTokenLayout(previousPosition, previousPosition === 0 ? "milestone" : "track");
  updateTokenLayout(nextPosition, nextPosition === 0 ? "milestone" : "track");
  return true;
}

/** Place, déplace ou retire le second jeton indiquant le palier dépassé. */
function placePlayerMilestoneToken(player) {
  const previousMilestone = Number.isInteger(player.displayedMilestone) ? player.displayedMilestone : 0;
  const nextMilestone = calculateMilestone(player.score);
  let token = dom.scoreTrack.querySelector(
    `[data-track-token-player-id="${player.id}"][data-token-type="milestone"]`
  );

  if (nextMilestone === 0) {
    token?.remove();
    player.displayedMilestone = 0;
    if (previousMilestone) updateTokenLayout(previousMilestone, "milestone");
    return true;
  }

  const destinationLayer = getTokenLayer(nextMilestone, "milestone");
  if (!destinationLayer) return false;
  if (!token) token = createTrackToken(player, "milestone");

  applyTokenAppearance(token, player);
  token.title = `${player.displayName} · Palier ${nextMilestone} dépassé · Score ${player.score}`;
  token.dataset.score = String(player.score);
  token.dataset.milestone = String(nextMilestone);
  destinationLayer.append(token);
  player.displayedMilestone = nextMilestone;

  if (previousMilestone) updateTokenLayout(previousMilestone, "milestone");
  updateTokenLayout(nextMilestone, "milestone");
  return true;
}

/** Place les deux représentations possibles d'un joueur. */
function placePlayerToken(player) {
  if (!player || !dom.scoreTrack) return false;
  const trackPlaced = placePlayerTrackToken(player);
  const milestonePlaced = placePlayerMilestoneToken(player);
  return trackPlaced && milestonePlaced;
}

/** Synchronise tous les jetons avec l'état courant de la partie. */
function updateAllPlayerTokens() {
  if (!scoreTrackState.game || !dom.scoreTrack) return;

  const activeIds = new Set(scoreTrackState.game.players.map((player) => String(player.id)));
  dom.scoreTrack.querySelectorAll("[data-track-token-player-id]").forEach((token) => {
    if (!activeIds.has(token.dataset.trackTokenPlayerId)) token.remove();
  });

  scoreTrackState.game.players.forEach((player) => {
    player.score = normalizeScore(player.score);
    player.milestone = calculateMilestone(player.score);
    player.milestoneIndicators = SCORE_MILESTONES.map((value) => ({
      value,
      active: player.milestone >= value
    }));
    placePlayerToken(player);
  });

  dom.scoreTrack.querySelectorAll("[data-token-layer]").forEach((layer) => {
    updateTokenLayout(Number(layer.dataset.tokenLayer), layer.dataset.layerType || "track");
  });
}

/** Met à jour le score d'un joueur, puis synchronise son affichage. */
function updatePlayerScore(playerId, nextScore) {
  const game = scoreTrackState.game;
  if (!game) return false;

  const player = game.players.find((item) => item.id === Number(playerId));
  if (!player) return false;

  const previousScore = player.score;
  const previousPosition = player.trackPosition;
  player.score = normalizeScore(nextScore);
  player.milestone = calculateMilestone(player.score);
  player.milestoneIndicators = SCORE_MILESTONES.map((value) => ({
    value,
    active: player.milestone >= value
  }));

  placePlayerToken(player);
  renderGame();

  game.history.push({
    playerId: player.id,
    previousScore,
    score: player.score,
    previousPosition,
    trackPosition: player.trackPosition,
    milestone: player.milestone,
    changedAt: new Date().toISOString()
  });

  document.dispatchEvent(new CustomEvent("scoretrack:score-changed", {
    detail: cloneData(player)
  }));
  return true;
}

function createGamePlayer(configuredPlayer) {
  const color = getColorDefinition(configuredPlayer.color);
  return {
    id: configuredPlayer.id,
    name: configuredPlayer.name.trim(),
    displayName: configuredPlayer.name.trim() || configuredPlayer.letter,
    letter: configuredPlayer.letter,
    colorId: configuredPlayer.color,
    colorLabel: color?.label || "",
    colorValue: color?.value || "",
    turnOrder: configuredPlayer.turnOrder,
    score: 0,
    trackPosition: 0,
    milestone: 0,
    displayedMilestone: 0,
    milestoneIndicators: SCORE_MILESTONES.map((value) => ({ value, active: false })),
    isActive: false
  };
}

function setActivePlayer(playerId) {
  if (!scoreTrackState.game) return;
  scoreTrackState.game.players.forEach((player) => {
    player.isActive = player.id === playerId;
  });
  scoreTrackState.game.activePlayerId = playerId;
}

function initializeGame() {
  if (!validateConfiguration()) return null;

  const players = scoreTrackState.players
    .map(createGamePlayer)
    .sort((playerA, playerB) => playerA.turnOrder - playerB.turnOrder);

  scoreTrackState.game = {
    status: "in-progress",
    startedAt: new Date().toISOString(),
    activePlayerId: null,
    currentTurn: 1,
    players,
    history: []
  };

  setActivePlayer(players[0].id);
  return scoreTrackState.game;
}

function createGamePlayerSummary(player) {
  const item = document.createElement("article");
  item.className = "game-player-card";
  item.classList.toggle("is-active", player.isActive);
  item.dataset.gamePlayerId = String(player.id);

  const token = document.createElement("span");
  token.className = "player-token player-token--small";
  token.setAttribute("role", "img");
  applyTokenAppearance(token, player);

  const identity = document.createElement("div");
  identity.className = "game-player-identity";
  const name = document.createElement("h4");
  name.textContent = player.displayName;
  const order = document.createElement("p");
  order.textContent = `${player.turnOrder}${player.turnOrder === 1 ? "er" : "e"} joueur`;
  identity.append(name, order);

  const score = document.createElement("div");
  score.className = "game-player-score";
  const scoreLabel = document.createElement("span");
  scoreLabel.textContent = "Score";
  const scoreValue = document.createElement("strong");
  scoreValue.textContent = String(player.score);
  score.append(scoreLabel, scoreValue);

  const position = document.createElement("p");
  position.className = "game-player-position";
  position.textContent = player.trackPosition === 0
    ? "Départ"
    : `Case ${player.trackPosition}${player.milestone ? ` · Jeton de palier ${player.milestone}` : ""}`;

  item.append(token, identity, score, position);
  return item;
}

function getActivePlayer() {
  const game = scoreTrackState.game;
  return game?.players.find((player) => player.id === game.activePlayerId) || null;
}

function updateActivePlayerHighlights() {
  const activePlayer = getActivePlayer();
  const activePlayerId = activePlayer ? String(activePlayer.id) : "";

  dom.gamePlayersList.querySelectorAll("[data-game-player-id]").forEach((item) => {
    const isActive = item.dataset.gamePlayerId === activePlayerId;
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-current", isActive ? "true" : "false");
    if (isActive && activePlayer) {
      const color = getColorDefinition(activePlayer.colorId);
      item.style.setProperty("--active-player-color", color?.value || activePlayer.colorValue || "#8b9490");
      item.style.setProperty("--active-player-text", color?.textColor || "#ffffff");
    } else {
      item.style.removeProperty("--active-player-color");
      item.style.removeProperty("--active-player-text");
    }
  });

  dom.scoreTrack.querySelectorAll("[data-track-token-player-id]").forEach((token) => {
    token.classList.toggle("is-active", token.dataset.trackTokenPlayerId === activePlayerId);
  });
}

function renderActivePlayerPanel(activePlayer) {
  if (!activePlayer) return;

  const color = getColorDefinition(activePlayer.colorId);
  applyTokenAppearance(dom.activePlayerToken, activePlayer, false);
  dom.activePlayerTitle.textContent = activePlayer.name
    ? `${activePlayer.letter} — ${activePlayer.name}`
    : activePlayer.letter;
  dom.activePlayerOrder.textContent = `${activePlayer.turnOrder}${activePlayer.turnOrder === 1 ? "er" : "e"} dans l’ordre de jeu`;
  dom.activePlayerScore.textContent = String(activePlayer.score);
  dom.activePlayerPosition.textContent = activePlayer.trackPosition === 0
    ? "Départ"
    : String(activePlayer.trackPosition);
  dom.activePlayerMilestone.textContent = activePlayer.milestone === 0
    ? "Départ"
    : String(activePlayer.milestone);
  dom.decreaseScoreButton.disabled = activePlayer.score === 0;

  dom.gameInformation.style.setProperty("--active-player-color", color?.value || activePlayer.colorValue || "#8b9490");
  dom.gameInformation.style.setProperty("--active-player-text", color?.textColor || "#ffffff");
  dom.gameInformation.style.setProperty("--active-player-tint", `${color?.value || activePlayer.colorValue || "#8b9490"}1f`);
}

function renderGame() {
  const game = scoreTrackState.game;
  if (!game) return;

  const fragment = document.createDocumentFragment();
  game.players.forEach((player) => fragment.append(createGamePlayerSummary(player)));
  dom.gamePlayersList.replaceChildren(fragment);

  updateAllPlayerTokens();

  const activePlayer = getActivePlayer();
  renderActivePlayerPanel(activePlayer);
  updateActivePlayerHighlights();
}

function modifyActivePlayerScore(delta) {
  const activePlayer = getActivePlayer();
  if (!activePlayer) return;
  updatePlayerScore(activePlayer.id, activePlayer.score + delta);
}

function goToNextPlayer() {
  const game = scoreTrackState.game;
  if (!game || game.players.length === 0) return;

  const currentIndex = game.players.findIndex((player) => player.id === game.activePlayerId);
  const nextIndex = (currentIndex + 1) % game.players.length;
  setActivePlayer(game.players[nextIndex].id);
  game.currentTurn += 1;
  renderGame();

  document.dispatchEvent(new CustomEvent("scoretrack:turn-changed", {
    detail: cloneData(getActivePlayer())
  }));
}

function showGameScreen() {
  dom.configurationPanel.hidden = true;
  dom.gameScreen.hidden = false;
  dom.appTitle.textContent = "Partie en cours";
  dom.appSubtitle.textContent = "Modifiez le score du joueur actif, puis passez au joueur suivant.";
  dom.notifications.hidden = true;
  renderGame();
  dom.gameScreen.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showConfigurationScreen() {
  dom.gameScreen.hidden = true;
  dom.configurationPanel.hidden = false;
  dom.appTitle.textContent = "Configuration de la partie";
  dom.appSubtitle.textContent = "Préparez les joueurs, leur jeton et leur ordre de jeu avant de démarrer la partie.";
  dom.notifications.hidden = true;
  dom.playerCount.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetGame() {
  dom.scoreTrack?.querySelectorAll("[data-track-token-player-id]").forEach((token) => token.remove());
  dom.scoreTrack?.querySelectorAll("[data-token-layer]").forEach((layer) => {
    updateTokenLayout(Number(layer.dataset.tokenLayer), layer.dataset.layerType || "track");
  });
  scoreTrackState.game = null;
  scoreTrackState.playerCount = 2;
  scoreTrackState.players = [];
  scoreTrackState.isConfigurationValid = false;
  dom.playerCount.value = "2";
  synchronizePlayers(2);
  renderPlayers();
  validateConfiguration();
  showConfigurationScreen();

  document.dispatchEvent(new CustomEvent("scoretrack:game-reset"));
}

function openNewGameConfirmation() {
  if (!scoreTrackState.game || scoreTrackState.game.status !== "in-progress") {
    resetGame();
    return;
  }

  if (typeof dom.newGameDialog.showModal === "function") {
    dom.newGameDialog.showModal();
  } else if (window.confirm("La partie actuelle sera perdue. Commencer une nouvelle partie ?")) {
    resetGame();
  }
}

function handleConfirmationClose() {
  if (dom.newGameDialog.returnValue === "confirm") resetGame();
}

function handleStartGame() {
  const game = initializeGame();
  if (!game) return;
  showGameScreen();

  document.dispatchEvent(new CustomEvent("scoretrack:game-started", {
    detail: cloneData(game)
  }));
}

function bindEvents() {
  dom.playerCount.addEventListener("change", (event) => {
    synchronizePlayers(event.target.value);
    renderPlayers();
    validateConfiguration();
    dom.notifications.hidden = true;
  });

  dom.playersList.addEventListener("input", (event) => {
    const control = event.target.closest("[data-player-id][data-field]");
    if (control) updatePlayerFromControl(control);
  });

  dom.playersList.addEventListener("change", (event) => {
    const control = event.target.closest("[data-player-id][data-field]");
    if (control) updatePlayerFromControl(control);
  });

  dom.startButton.addEventListener("click", handleStartGame);
  dom.decreaseScoreButton.addEventListener("click", () => modifyActivePlayerScore(-1));
  dom.increaseScoreButton.addEventListener("click", () => modifyActivePlayerScore(1));
  dom.endTurnButton.addEventListener("click", goToNextPlayer);
  dom.newGameButton.addEventListener("click", openNewGameConfirmation);
  dom.newGameDialog.addEventListener("close", handleConfirmationClose);
}

function initializeScoreTrackApp() {
  Object.assign(dom, {
    appTitle: document.getElementById("app-title"),
    appSubtitle: document.getElementById("app-subtitle"),
    configurationPanel: document.getElementById("player-configuration"),
    playerCount: document.getElementById("player-count"),
    playersList: document.getElementById("players-list"),
    startButton: document.getElementById("start-game-button"),
    status: document.getElementById("configuration-status"),
    gameScreen: document.getElementById("game-screen"),
    newGameButton: document.getElementById("new-game-button"),
    gameInformation: document.getElementById("game-information"),
    activePlayerToken: document.getElementById("active-player-token"),
    activePlayerTitle: document.getElementById("active-player-title"),
    activePlayerOrder: document.getElementById("active-player-order"),
    activePlayerScore: document.getElementById("active-player-score"),
    activePlayerPosition: document.getElementById("active-player-position"),
    activePlayerMilestone: document.getElementById("active-player-milestone"),
    decreaseScoreButton: document.getElementById("decrease-score-button"),
    increaseScoreButton: document.getElementById("increase-score-button"),
    endTurnButton: document.getElementById("end-turn-button"),
    gamePlayersList: document.getElementById("game-players-list"),
    scoreTrack: document.getElementById("score-track"),
    newGameDialog: document.getElementById("new-game-dialog"),
    notifications: document.getElementById("app-notifications")
  });

  if (Object.values(dom).some((element) => !element)) {
    console.warn("Piste de score : certains éléments requis sont introuvables.");
    return;
  }

  synchronizePlayers(dom.playerCount.value);
  generateScoreTrack();
  renderPlayers();
  bindEvents();
  validateConfiguration();
  document.documentElement.classList.add("score-app-ready");

  window.scoreTrackApp = Object.freeze({
    getConfiguration: () => cloneData({
      playerCount: scoreTrackState.playerCount,
      players: scoreTrackState.players
    }),
    getGame: () => cloneData(scoreTrackState.game),
    getState: () => cloneData(scoreTrackState),
    startGame: handleStartGame,
    resetGame,
    generateScoreTrack,
    calculateTrackPosition,
    calculateMilestone,
    updatePlayerScore,
    modifyActivePlayerScore,
    goToNextPlayer,
    updateAllPlayerTokens,
    getTokensInSpace,
    getTrackSpace: (position) => document.querySelector(`[data-track-position="${position}"]`)
  });
}

document.addEventListener("DOMContentLoaded", initializeScoreTrackApp, { once: true });
