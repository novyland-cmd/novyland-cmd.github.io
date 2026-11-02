export const MODE_INFO = {
  single: { title: 'Élimination directe', description: 'Une défaite élimine le joueur. Tous jouent dès le premier tour.' },
  double: { title: 'Double élimination', description: 'Une première défaite mène au repêchage ; la deuxième élimine. La grande finale est rejouée si le finaliste invaincu perd. À 3 ou 5 joueurs, des exemptions équilibrent le tableau.' },
  roundRobin: { title: 'Tous contre tous', description: 'Chaque joueur affronte tous les autres. Une victoire vaut 1 point. Les confrontations entre joueurs à égalité départagent le classement ; si l’égalité persiste, les joueurs partagent la première place.' },
  swiss: { title: 'Suisse avec finale de départage', description: '3 rondes, contre des adversaires aux résultats similaires, sans rejouer le même adversaire. En nombre impair, un repos tournant vaut 1 point. Les joueurs à égalité en tête jouent ensuite en double élimination, avec zéro défaite au départ.' }
};
export function availableModes(n) {
  if (!Number.isInteger(n) || n < 2 || n > 16) return [];
  return [...([4, 8, 16].includes(n) ? ['single'] : []), ...(n <= 5 ? ['double'] : []), ...(n >= 3 && n <= 5 ? ['roundRobin'] : []), ...(n >= 6 ? ['swiss'] : [])];
}
const shuffle = items => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const limit = Math.floor(2 ** 32 / (i + 1)) * (i + 1); let value;
    do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
    const j = value % (i + 1); [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
export function startFormat(state, mode) {
  if (!availableModes(state.players.length).includes(mode)) throw Error('Mode indisponible pour ce nombre de joueurs.');
  return rebuild({ ...state, engineVersion: 2, mode, seed: shuffle(state.players.map(p => p.id)), started: true, rounds: [], currentRound: 0 }, {}).state;
}
function score(players, rounds) {
  const rows = players.map(p => ({ id: p.id, name: p.name, wins: 0, losses: 0, byes: 0, points: 0, played: 0 }));
  const byId = new Map(rows.map(row => [row.id, row]));
  for (const round of rounds) for (const match of round) {
    if (match.empty || !match.winner) continue;
    if (match.auto) { const row = byId.get(match.winner); row.byes++; if (match.phase === 'swiss') row.points++; continue; }
    const loser = match.slots.find(id => id !== match.winner);
    const a = byId.get(match.winner), b = byId.get(loser);
    a.wins++; a.points++; a.played++; b.losses++; b.played++;
  }
  return rows;
}
export function standings(state) {
  if (state.engineVersion !== 2) return [];
  const rounds = state.mode === 'swiss' ? state.rounds.filter(r => r[0]?.phase === 'swiss') : state.rounds;
  const rows = score(state.players, rounds);
  if (state.mode === 'roundRobin') {
    for (const row of rows) {
      const peers = new Set(rows.filter(other => other.points === row.points).map(other => other.id));
      row.headToHead = rounds.flat().filter(m => !m.auto && m.winner === row.id && m.slots.every(id => peers.has(id))).length;
    }
  }
  return rows.sort((a, b) => b.points - a.points || (b.headToHead || 0) - (a.headToHead || 0) || state.seed.indexOf(a.id) - state.seed.indexOf(b.id));
}
export const roundTitle = (state, index) => state.roundTitles?.[index] || `Tour ${index + 1}`;
export const champions = state => state.engineVersion === 2 ? state.championIds : (state.rounds.at(-1)?.[0]?.winner ? [state.rounds.at(-1)[0].winner] : []);
const resultMap = state => Object.fromEntries(state.rounds.flat().map(m => [m.id, m.winner]));

// Replaying a seed and results creates the same graph in the browser and the Worker.
// Sources distinguish an unresolved opponent from an actual empty bracket slot.
function rebuild(input, results) {
  const state = { ...input, rounds: [], roundTitles: [], championIds: [] }, nodes = new Map(), dependencies = new Map();
  const literal = id => ({ literal: id });
  const winner = id => ({ match: id, outcome: 'winner' });
  const loser = id => ({ match: id, outcome: 'loser' });
  function source(ref) {
    if ('literal' in ref) return { resolved: true, id: ref.literal };
    const node = nodes.get(ref.match);
    if (!node?.resolved) return { resolved: false, id: null };
    return { resolved: true, id: ref.outcome === 'winner' ? node.match.winner : node.match.auto ? null : node.match.slots.find(id => id !== node.match.winner) || null };
  }
  function addRound(title, defs, phase) {
    const round = defs.map(({ id, refs }) => {
      const values = refs.map(source), slots = values.map(v => v.id), ready = values.every(v => v.resolved);
      const actual = slots.filter(Boolean), auto = ready && actual.length < 2;
      const selected = ready && actual.length === 2 && slots.includes(results[id]) ? results[id] : null;
      const match = { id, slots, winner: auto ? actual[0] || null : selected, auto, empty: ready && actual.length === 0, ready, phase };
      nodes.set(id, { match, resolved: ready && (auto || !!selected) });
      dependencies.set(id, new Set(refs.filter(ref => ref.match).map(ref => ref.match)));
      return match;
    });
    state.rounds.push(round); state.roundTitles.push(title); return round;
  }
  const complete = round => round.every(m => m.auto || !!m.winner);
  function knockout(ids, prefix, double) {
    const size = 2 ** Math.ceil(Math.log2(ids.length)), k = Math.log2(size), byes = size - ids.length;
    const slots = []; let cursor = 0;
    for (let i = 0; i < byes; i++) slots.push(ids[cursor++], null);
    while (cursor < ids.length) slots.push(ids[cursor++]);
    const wb = [];
    for (let r = 0; r < k; r++) {
      const count = size / 2 ** (r + 1);
      const title = count === 1 ? 'Finale' : count === 2 ? 'Demi-finales' : count === 4 ? 'Quarts de finale' : 'Huitièmes de finale';
      wb[r] = addRound((prefix ? 'Départage · ' : '') + (double ? 'Principal · ' : '') + title,
        Array.from({ length: count }, (_, i) => ({ id: `${prefix}w${r}-${i}`, refs: r === 0 ? slots.slice(i * 2, i * 2 + 2).map(literal) : [winner(wb[r - 1][i * 2].id), winner(wb[r - 1][i * 2 + 1].id)] })), prefix ? 'tiebreak' : 'knockout');
    }
    if (!double) { if (nodes.get(wb.at(-1)[0].id).resolved) state.championIds = [wb.at(-1)[0].winner]; return; }
    let lower;
    if (k === 1) lower = loser(wb[0][0].id);
    else {
      let previous = addRound((prefix ? 'Départage · ' : '') + 'Repêchage · Tour 1',
        Array.from({ length: size / 4 }, (_, i) => ({ id: `${prefix}l0-${i}`, refs: [loser(wb[0][i * 2].id), loser(wb[0][i * 2 + 1].id)] })), 'repechage');
      let stage = 1;
      for (let r = 1; r < k; r++) {
        const last = previous;
        previous = addRound((prefix ? 'Départage · ' : '') + `Repêchage · Tour ${stage + 1}`,
          Array.from({ length: wb[r].length }, (_, i) => ({ id: `${prefix}l${stage}-${i}`, refs: [winner(last[i].id), loser(wb[r][wb[r].length - 1 - i].id)] })), 'repechage');
        stage++;
        if (r < k - 1) {
          const lastMinor = previous;
          previous = addRound((prefix ? 'Départage · ' : '') + `Repêchage · Tour ${stage + 1}`,
            Array.from({ length: lastMinor.length / 2 }, (_, i) => ({ id: `${prefix}l${stage}-${i}`, refs: [winner(lastMinor[i * 2].id), winner(lastMinor[i * 2 + 1].id)] })), 'repechage');
          stage++;
        }
      }
      lower = winner(previous[0].id);
    }
    const refs = [winner(wb.at(-1)[0].id), lower];
    const final = addRound((prefix ? 'Départage · ' : '') + 'Grande finale', [{ id: prefix + 'grand-final', refs }], 'final')[0];
    if (!final.winner) return;
    if (final.winner === final.slots[0]) state.championIds = [final.winner];
    else {
      const reset = addRound((prefix ? 'Départage · ' : '') + 'Grande finale · Match décisif', [{ id: prefix + 'reset-final', refs }], 'final')[0];
      if (reset.winner) state.championIds = [reset.winner];
    }
  }
  if (state.mode === 'single' || state.mode === 'double') knockout(state.seed, '', state.mode === 'double');
  else if (state.mode === 'roundRobin') {
    const ring = [...state.seed]; if (ring.length % 2) ring.push(null);
    for (let r = 0; r < ring.length - 1; r++) {
      addRound(`Ronde ${r + 1}`, Array.from({ length: ring.length / 2 }, (_, i) => ({ id: `rr${r}-${i}`, refs: [literal(ring[i]), literal(ring[ring.length - 1 - i])] })), 'roundRobin');
      ring.splice(1, 0, ring.pop());
    }
    if (state.rounds.every(complete)) {
      const ranked = standings(state), first = ranked[0];
      state.championIds = ranked.filter(row => row.points === first.points && row.headToHead === first.headToHead).map(row => row.id);
    }
  } else if (state.mode === 'swiss') {
    for (let r = 0; r < 3; r++) {
      const ranked = score(state.players, state.rounds).sort((a, b) => b.points - a.points || state.seed.indexOf(a.id) - state.seed.indexOf(b.id));
      const played = new Set(state.rounds.flat().filter(m => !m.auto).map(m => JSON.stringify([...m.slots].sort())));
      function pair(ids) {
        if (!ids.length) return [];
        const [a, ...rest] = ids;
        const points = id => ranked.find(p => p.id === id).points;
        const candidates = [...rest].sort((b, c) => Math.abs(points(a) - points(b)) - Math.abs(points(a) - points(c)) || state.seed.indexOf(b) - state.seed.indexOf(c));
        for (const b of candidates) {
          if (played.has(JSON.stringify([a, b].sort()))) continue;
          const tail = pair(rest.filter(id => id !== b)); if (tail) return [[a, b], ...tail];
        }
        return null;
      }
      let pairs;
      if (ranked.length % 2) {
        for (const bye of [...ranked].reverse().filter(p => !p.byes)) {
          const found = pair(ranked.filter(p => p.id !== bye.id).map(p => p.id));
          if (found) { pairs = [...found, [bye.id, null]]; break; }
        }
      } else pairs = pair(ranked.map(p => p.id));
      if (!pairs) throw Error('Données invalides : impossible de former les rencontres suisses.');
      const round = addRound(`Ronde suisse ${r + 1} / 3`, pairs.map((slots, i) => ({ id: `s${r}-${i}`, refs: slots.map(literal) })), 'swiss');
      // Pairings depend on every result from preceding Swiss rounds.
      for (const m of round) dependencies.set(m.id, new Set(state.rounds.slice(0, -1).flat().map(m => m.id)));
      if (!complete(round)) return { state, dependencies };
    }
    const ranked = score(state.players, state.rounds), top = Math.max(...ranked.map(p => p.points));
    const leaders = state.seed.filter(id => ranked.find(p => p.id === id).points === top);
    if (leaders.length === 1) state.championIds = leaders;
    else {
      const before = new Set(nodes.keys()); knockout(leaders, 'tie-', true);
      for (const [id, deps] of dependencies) if (!before.has(id)) for (const parent of before) deps.add(parent);
    }
  }
  return { state, dependencies };
}
export function chooseFormatWinner(state, matchId, playerId) {
  const match = state.rounds.flat().find(m => m.id === matchId);
  if (!match || match.auto || !match.ready || !match.slots.includes(playerId) || match.winner === playerId) return false;
  const results = resultMap(state), { dependencies } = rebuild(state, results), invalid = new Set([matchId]);
  let changed = true;
  while (changed) { changed = false; for (const [id, deps] of dependencies) if (!invalid.has(id) && [...deps].some(parent => invalid.has(parent))) { invalid.add(id); changed = true; } }
  for (const id of invalid) delete results[id];
  results[matchId] = playerId;
  Object.assign(state, rebuild(state, results).state); return true;
}
export function cleanFormatState(input, base) {
  const fail = () => { throw Error('Les données du tournoi sont invalides.'); };
  if (!availableModes(base.players.length).includes(input.mode) || !input.started ||
      !Array.isArray(input.seed) || input.seed.length !== base.players.length || new Set(input.seed).size !== base.players.length ||
      input.seed.some(id => !base.players.some(p => p.id === id)) || !Array.isArray(input.rounds) || input.rounds.length > 20) fail();
  const seen = new Set(), results = {};
  for (const round of input.rounds) {
    if (!Array.isArray(round) || round.length > 16) fail();
    for (const m of round) {
      if (!m || typeof m.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(m.id) || seen.has(m.id) || (m.winner !== null && !input.seed.includes(m.winner))) fail();
      seen.add(m.id); results[m.id] = m.winner;
    }
  }
  const output = rebuild({ ...base, engineVersion: 2, mode: input.mode, seed: [...input.seed], started: true }, results).state;
  if (input.rounds.length !== output.rounds.length) fail();
  output.rounds.forEach((round, r) => {
    if (input.rounds[r].length !== round.length) fail();
    round.forEach((m, i) => {
      const supplied = input.rounds[r][i];
      if (supplied.id !== m.id || supplied.winner !== m.winner || supplied.auto !== m.auto ||
          !Array.isArray(supplied.slots) || supplied.slots.length !== 2 || supplied.slots.some((id, j) => id !== m.slots[j])) fail();
    });
  });
  output.currentRound = Math.max(0, Math.min(output.rounds.length - 1, base.currentRound));
  return output;
}
