import { availableModes, cleanFormatState, chooseFormatWinner } from './formats.mjs';
export const ALLOWED_COUNTS = [2, 4, 8, 16];
export const canStart = count => ALLOWED_COUNTS.includes(count);
export const emptyState = () => ({ name: '', players: [], rounds: [], started: false, view: 'rounds', currentRound: 0 });
export const normalizeCode = code => String(code).toUpperCase().replace(/[\s-]/g, '');
export const validCode = code => /^[A-HJ-NP-Z2-9]{12}$/.test(code);
export const displayCode = code => code.match(/.{1,4}/g)?.join('-') || code;
export function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), b => alphabet[b & 31]).join('');
}
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
export function createRounds(players) {
  if (!canStart(players.length)) throw Error('Il faut exactement 2, 4, 8 ou 16 participants.');
  const ids = players.map(p => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    // Rejection sampling avoids a biased draw.
    const limit = Math.floor(2 ** 32 / (i + 1)) * (i + 1);
    let value;
    do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
    const j = value % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return Array.from({ length: Math.log2(ids.length) }, (_, r) =>
    Array.from({ length: ids.length / 2 ** (r + 1) }, (_, i) => ({
      id: crypto.randomUUID(), slots: r === 0 ? ids.slice(i * 2, i * 2 + 2) : [null, null], winner: null, auto: false
    })));
}
export function propagate(state) {
  state.rounds.forEach((round, r) => round.forEach((match, i) => {
    if (r > 0) match.slots = [state.rounds[r - 1][i * 2].winner, state.rounds[r - 1][i * 2 + 1].winner];
    match.auto = r === 0 && match.slots.filter(Boolean).length === 1;
    if (match.auto) match.winner = match.slots.find(Boolean);
    else if (!match.slots.every(Boolean) || !match.slots.includes(match.winner)) match.winner = null;
  }));
}
export function chooseWinner(state, matchId, playerId) {
  if (state.engineVersion === 2) return chooseFormatWinner(state, matchId, playerId);
  const r = state.rounds.findIndex(round => round.some(m => m.id === matchId));
  if (r < 0) return false;
  const index = state.rounds[r].findIndex(m => m.id === matchId);
  const match = state.rounds[r][index];
  if (!match.slots.every(Boolean) || !match.slots.includes(playerId) || match.winner === playerId) return false;
  for (let level = r + 1, i = index; level < state.rounds.length; level++) {
    i = Math.floor(i / 2);
    state.rounds[level][i].winner = null;
  }
  match.winner = playerId;
  propagate(state);
  return true;
}
export function roundLabel(i, total) {
  return ({ 2: 'Finale', 4: 'Demi-finales', 8: 'Quarts de finale', 16: 'Huitièmes de finale' })[2 ** (total - i)] || `Tour ${i + 1}`;
}
// Return a fresh, whitelisted object. Public storage never accepts credentials or arbitrary fields.
function cleanLegacyState(input, { allowByes = false, requireStarted = false } = {}) {
  const fail = () => { throw Error('Les données du tournoi sont invalides.'); };
  const text = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;
  if (!input || typeof input !== 'object' || typeof input.name !== 'string' || input.name.length > 80 ||
      !Array.isArray(input.players) || input.players.length > 16 || typeof input.started !== 'boolean' ||
      !Array.isArray(input.rounds) || (requireStarted && !input.started)) fail();
  const state = { ...emptyState(), name: input.name, started: input.started };
  const ids = new Set(), names = new Set();
  state.players = input.players.map(p => {
    if (!p || !text(p.id, 100) || typeof p.name !== 'string' || !text(p.name.trim(), 60) || ids.has(p.id) || names.has(p.name.trim().toLocaleLowerCase('fr-CA'))) fail();
    ids.add(p.id); names.add(p.name.trim().toLocaleLowerCase('fr-CA'));
    return { id: p.id, name: p.name.trim() };
  });
  state.view = input.view === 'bracket' ? 'bracket' : 'rounds';
  state.currentRound = Number.isInteger(input.currentRound) ? input.currentRound : 0;
  if (!state.started) { if (input.rounds.length) fail(); state.mode = availableModes(state.players.length).includes(input.mode) ? input.mode : availableModes(state.players.length)[0] || ''; return state; }
  const n = state.players.length;
  if (!text(state.name.trim(), 80) || n < 2 || (!allowByes && !canStart(n))) fail();
  const size = 2 ** Math.ceil(Math.log2(n)), seenMatches = new Set(), firstPlayers = [];
  if (input.rounds.length !== Math.log2(size)) fail();
  state.rounds = input.rounds.map((round, r) => {
    if (!Array.isArray(round) || round.length !== size / 2 ** (r + 1)) fail();
    return round.map(m => {
      if (!m || !text(m.id, 100) || seenMatches.has(m.id) || !Array.isArray(m.slots) || m.slots.length !== 2 ||
          !m.slots.every(id => id === null || ids.has(id)) || (m.winner !== null && !ids.has(m.winner))) fail();
      seenMatches.add(m.id);
      if (r === 0) {
        if ((!allowByes && m.slots.some(id => id === null)) || m.slots.every(id => id === null)) fail();
        firstPlayers.push(...m.slots.filter(Boolean));
      }
      return { id: m.id, slots: [...m.slots], winner: m.winner, auto: false };
    });
  });
  if (firstPlayers.length !== n || new Set(firstPlayers).size !== n) fail();
  state.rounds.forEach((round, r) => round.forEach((m, i) => {
    if (r > 0) {
      const expected = [state.rounds[r - 1][i * 2].winner, state.rounds[r - 1][i * 2 + 1].winner];
      if (m.slots.some((id, j) => id !== expected[j])) fail();
    }
    m.auto = r === 0 && m.slots.filter(Boolean).length === 1;
    if (m.auto) { if (m.winner !== m.slots.find(Boolean)) fail(); }
    else if (m.winner !== null && (!m.slots.every(Boolean) || !m.slots.includes(m.winner))) fail();
  }));
  state.currentRound = Math.max(0, Math.min(state.rounds.length - 1, state.currentRound));
  return state;
}
export function cleanState(input, options = {}) {
  if (input?.engineVersion === 2) {
    if (typeof input.name !== 'string' || !input.name.trim()) throw Error('Les données du tournoi sont invalides.');
    const base = cleanLegacyState({ ...input, started: false, rounds: [] });
    return cleanFormatState(input, base);
  }
  if (input?.engineVersion !== undefined) throw Error('Les données du tournoi sont invalides.');
  return cleanLegacyState(input, options);
}
