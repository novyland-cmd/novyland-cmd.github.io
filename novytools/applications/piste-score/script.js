import { focusSelect } from "../../../assets/js/select.js?v=20260905";
import { createPlayerSelection, getColorDefinition, applyTokenAppearance } from "../../../assets/js/player-selection.js";

"use strict";

/**
 * Piste de score NovyTools
 * Centralise la configuration et l'état de la partie en mémoire JavaScript.
 */

const PLAYER_LIMITS = Object.freeze({ min: 1, max: 6 });
const SCORE_MILESTONES = Object.freeze([50, 100, 150, 200]);
const SCORE_TRACK_CONFIG = Object.freeze({ totalSpaces: 50, spacesPerRow: 10, maxDisplayedMilestone: 200 });
const TOKEN_LAYOUT_LIMIT = PLAYER_LIMITS.max;


const scoreTrackState = {
  playerCount: 2,
  players: [],
  isConfigurationValid: false,
  game: null
};

const dom = {};
let playerSelection;


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
  if (!playerSelection.validate()) return null;

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

  item.append(token, identity, score);
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
  updateScoreStepControls();

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

function updateScoreStepControls() {
  const step = dom.scoreStep.valueAsNumber;
  const valid = dom.scoreStep.checkValidity() && Number.isSafeInteger(step);
  const player = getActivePlayer();
  dom.scoreStep.setAttribute("aria-invalid", String(!valid));
  dom.scoreStepError.hidden = valid;
  dom.scoreStepError.textContent = valid ? "" : "Saisissez un entier de 1 à 999 999.";
  dom.decreaseScoreButton.disabled = !valid || !player || player.score === 0;
  dom.increaseScoreButton.disabled = !valid || !player || !Number.isSafeInteger(player.score + step);
  if (valid) {
    const points = `${step} point${step > 1 ? "s" : ""}`;
    dom.decreaseScoreButton.setAttribute("aria-label", `Retirer ${points}`);
    dom.increaseScoreButton.setAttribute("aria-label", `Ajouter ${points}`);
  }
  dom.scoreStepPresets.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(valid && Number(button.dataset.scoreStep) === step));
  });
  return valid;
}

function applyScoreStep(direction) {
  if (!updateScoreStepControls()) return;
  const player = getActivePlayer();
  if (!player) return;
  const nextScore = Math.max(0, player.score + direction * dom.scoreStep.valueAsNumber);
  if (!Number.isSafeInteger(nextScore) || nextScore === player.score) return;
  updatePlayerScore(player.id, nextScore);
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
  focusSelect(dom.playerCount);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetGame() {
  dom.scoreTrack?.querySelectorAll("[data-track-token-player-id]").forEach((token) => token.remove());
  dom.scoreTrack?.querySelectorAll("[data-token-layer]").forEach((layer) => {
    updateTokenLayout(Number(layer.dataset.tokenLayer), layer.dataset.layerType || "track");
  });
  scoreTrackState.game = null;
  dom.scoreStep.value = "1";
  dom.scoreStepPresets.hidden = true;
  updateScoreStepControls();
  playerSelection.reset();
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
  dom.startButton.addEventListener("click", handleStartGame);
  dom.decreaseScoreButton.addEventListener("click", () => applyScoreStep(-1));
  dom.increaseScoreButton.addEventListener("click", () => applyScoreStep(1));
  dom.scoreStep.addEventListener("input", updateScoreStepControls);
  dom.scoreStep.addEventListener("focus", () => { dom.scoreStepPresets.hidden = false; });
  dom.scoreStep.addEventListener("click", () => { dom.scoreStepPresets.hidden = false; });
  dom.scoreStep.parentElement.addEventListener("focusout", (event) => {
    if (!dom.scoreStep.parentElement.contains(event.relatedTarget)) dom.scoreStepPresets.hidden = true;
  });
  dom.scoreStep.parentElement.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      dom.scoreStep.focus();
      dom.scoreStepPresets.hidden = true;
      event.preventDefault();
    }
  });
  // Conserve le focus jusqu’au clic, même si le navigateur ne focalise pas les boutons.
  dom.scoreStepPresets.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-score-step]")) event.preventDefault();
  });
  dom.scoreStepPresets.addEventListener("click", (event) => {
    const button = event.target.closest("[data-score-step]");
    if (!button) return;
    dom.scoreStep.value = button.dataset.scoreStep;
    updateScoreStepControls();
    dom.scoreStep.focus();
    dom.scoreStepPresets.hidden = true;
  });
  dom.endTurnButton.addEventListener("click", goToNextPlayer);
  dom.newGameButton.addEventListener("click", openNewGameConfirmation);
  dom.newGameDialog.addEventListener("close", handleConfirmationClose);
}

function initializeScoreTrackApp() {
  Object.assign(dom, {
    appTitle: document.getElementById("app-title"),
    appSubtitle: document.getElementById("app-subtitle"),
    configurationPanel: document.getElementById("player-configuration"),
    startButton: document.getElementById("start-game-button"),
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
    scoreStep: document.getElementById("score-step"),
    scoreStepPresets: document.getElementById("score-step-presets"),
    scoreStepError: document.getElementById("score-step-error"),
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

  playerSelection = createPlayerSelection({root: dom.configurationPanel, startButton: dom.startButton,
    state: scoreTrackState, min: PLAYER_LIMITS.min, max: PLAYER_LIMITS.max, onChange: () => { dom.notifications.hidden = true; }});
  dom.playerCount = playerSelection.playerCount;
  generateScoreTrack();
  bindEvents();
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeScoreTrackApp, { once: true });
} else {
  initializeScoreTrackApp();
}
