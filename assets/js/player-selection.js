import { enhanceSelects, refreshSelect } from './select.js?v=20260905';

const AVAILABLE_LETTERS = Object.freeze("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
const AVAILABLE_COLORS = Object.freeze([
  { id: "red", label: "Rouge", value: "#c94b49" },
  { id: "blue", label: "Bleu", value: "#3976c5" },
  { id: "green", label: "Vert", value: "#4d8b59" },
  { id: "yellow", label: "Jaune", value: "#e0b83f", textColor: "#2b2b22" },
  { id: "orange", label: "Orange", value: "#df7a32" },
  { id: "purple", label: "Violet", value: "#8556a8" },
  { id: "turquoise", label: "Turquoise", value: "#2a9d9f" },
  { id: "pink", label: "Rose", value: "#b3497c" }
]);

export function getColorDefinition(colorId) {
  return AVAILABLE_COLORS.find((color) => color.id === colorId || color.value.toLowerCase() === String(colorId).toLowerCase()) || null;
}

export function applyTokenAppearance(token, player, accessible = true) {
  const color = getColorDefinition(player.colorId || player.color);
  token.textContent = player.letter || "?";
  token.style.backgroundColor = color?.value || player.colorValue || "#8b9490";
  token.style.color = color?.textColor || "#ffffff";
  if (accessible) {
    token.setAttribute("aria-label", `Jeton ${player.displayName || player.name || player.letter}`);
  }
}

/** Sélection commune : nombre, identité, jetons uniques, ordre et validation.
 * Une instance par page ; les limites restent propres à chaque application.
 */
export function createPlayerSelection({root, startButton, state = {players: []}, min = 1, max = 6, onChange = () => {}}) {
  if (min < 1 || max > AVAILABLE_COLORS.length || min > max) throw new RangeError('Nombre de joueurs non pris en charge.');
  const PLAYER_LIMITS = {min, max};
  root.innerHTML = `<header class="configuration-heading"><div><p class="eyebrow">Nouvelle partie</p><h2 id="configuration-title">Sélection des joueurs</h2></div><div class="player-count-field"><label for="player-count">Nombre de joueurs</label><select id="player-count" aria-describedby="player-count-help"></select><small id="player-count-help"></small></div></header><div id="players-list" class="players-list" aria-live="polite"></div><div class="configuration-actions"><p id="configuration-status" class="configuration-status" role="status"></p></div>`;
  const dom = {playerCount: root.querySelector('#player-count'), playersList: root.querySelector('#players-list'), status: root.querySelector('#configuration-status'), startButton};
  root.querySelector('.configuration-actions').append(startButton);
  root.querySelector('#player-count-help').textContent = `Choisissez entre ${min} et ${max} joueurs.`;
  for (let count = min; count <= max; count++) {
    const option = document.createElement('option'); option.value = count; option.textContent = `${count} joueur${count > 1 ? 's' : ''}`; dom.playerCount.append(option);
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
    const retainedPlayers = state.players.slice(0, normalizedCount);

    while (retainedPlayers.length < normalizedCount) {
      retainedPlayers.push(createDefaultPlayer(retainedPlayers.length));
    }

    state.playerCount = normalizedCount;
    state.players = retainedPlayers.map((player, index) => ({
      ...player,
      id: index + 1,
      turnOrder: player.turnOrder > normalizedCount ? null : player.turnOrder
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
      state.players
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
    for (let order = 1; order <= state.playerCount; order += 1) {
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

  function updateTokenPreview(playerId, animate = false) {
    const player = state.players.find((item) => item.id === playerId);
    const token = root.querySelector(`[data-token-player-id="${playerId}"]`);
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
    state.players.forEach((player) => fragment.append(createPlayerCard(player)));
    dom.playersList.replaceChildren(fragment);
    enhanceSelects(dom.playersList);
    state.players.forEach((player) => updateTokenPreview(player.id));
  }

  function findDuplicateValues(propertyName) {
    const counts = new Map();
    state.players.forEach((player) => {
      const value = String(player[propertyName] ?? "");
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    });
    return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
  }

  function validateConfiguration() {
    const messages = [];
    if (state.players.some((player) => !player.letter)) messages.push("choisissez une lettre pour chaque joueur");
    if (state.players.some((player) => !player.color)) messages.push("choisissez une couleur pour chaque joueur");
    if (state.players.some((player) => !player.turnOrder)) messages.push("choisissez un ordre pour chaque joueur");
    if (findDuplicateValues("letter").length) messages.push("les lettres doivent être uniques");
    if (findDuplicateValues("color").length) messages.push("les couleurs doivent être uniques");
    if (findDuplicateValues("turnOrder").length) messages.push("les ordres de jeu doivent être uniques");

    state.isConfigurationValid = messages.length === 0;
    dom.startButton.disabled = !state.isConfigurationValid;
    dom.status.classList.toggle("is-valid", state.isConfigurationValid);
    dom.status.classList.toggle("is-invalid", !state.isConfigurationValid && messages.length > 0);
    dom.status.textContent = state.isConfigurationValid
      ? "Configuration valide. La partie peut être démarrée."
      : `Configuration incomplète : ${messages.join("; ")}.`;
    return state.isConfigurationValid;
  }

  function refreshSelectAvailability() {
    state.players.forEach((player) => {
      const card = dom.playersList.querySelector(`[data-player-id="${player.id}"]`);
      if (!card) return;
      {
        const select = card.querySelector('[data-field="letter"]');
        select.replaceChildren(...buildLetterSelect(player).options);
        select.value = String(player.letter ?? "");
        refreshSelect(select);
      }
      {
        const select = card.querySelector('[data-field="color"]');
        select.replaceChildren(...buildColorSelect(player).options);
        select.value = String(player.color ?? "");
        refreshSelect(select);
      }
      {
        const select = card.querySelector('[data-field="turnOrder"]');
        select.replaceChildren(...buildTurnOrderSelect(player).options);
        select.value = String(player.turnOrder ?? "");
        refreshSelect(select);
      }
    });
  }

  function updatePlayerFromControl(control) {
    const playerId = Number.parseInt(control.dataset.playerId, 10);
    const fieldName = control.dataset.field;
    const player = state.players.find((item) => item.id === playerId);
    if (!player || !fieldName) return;

    player[fieldName] = fieldName === "turnOrder"
      ? (control.value ? Number.parseInt(control.value, 10) : null)
      : control.value.trim();

    if (fieldName === "letter" || fieldName === "color") updateTokenPreview(playerId, true);
    if (["letter", "color", "turnOrder"].includes(fieldName)) refreshSelectAvailability();
    validateConfiguration();
  }


  function reset(count = 2) {
    state.players = [];
    synchronizePlayers(count);
    dom.playerCount.value = String(state.playerCount);
    refreshSelect(dom.playerCount);
    renderPlayers(); validateConfiguration(); onChange();
  }
  dom.playerCount.addEventListener('change', () => {
    synchronizePlayers(dom.playerCount.value); renderPlayers(); validateConfiguration(); onChange();
  });
  dom.playersList.addEventListener('input', event => {
    const control = event.target.closest('[data-player-id][data-field]');
    if (control?.matches('input')) { updatePlayerFromControl(control); onChange(); }
  });
  dom.playersList.addEventListener('change', event => {
    const control = event.target.closest('[data-player-id][data-field]');
    if (control) { updatePlayerFromControl(control); onChange(); }
  });
  reset(); enhanceSelects(root);
  return Object.freeze({reset, validate: validateConfiguration, playerCount: dom.playerCount,
    getPlayers: () => state.players.map(player => ({...player})).sort((a,b) => a.turnOrder - b.turnOrder)});
}
