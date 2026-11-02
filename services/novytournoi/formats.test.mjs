import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, cleanState, chooseWinner, createRounds } from '../../labo/novytournoi/model.mjs';
import { availableModes, startFormat, standings } from '../../labo/novytournoi/formats.mjs';
const base = n => ({ ...emptyState(), name: 'Essai', players: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'Joueur ' + i })) });
function finish(state, pick = () => 0) {
  for (let guard = 0; guard < 100 && !state.championIds.length; guard++) {
    const match = state.rounds.flat().find(m => m.ready && !m.auto && !m.winner);
    assert(match, `Progression bloquée : ${state.mode}, ${state.players.length} joueurs`);
    chooseWinner(state, match.id, match.slots[pick(match, state)]);
    assert.deepEqual(cleanState(JSON.parse(JSON.stringify(state))), state);
  }
  assert(state.championIds.length); return state;
}
test('Modes proposés exactement selon les effectifs convenus', () => {
  assert.deepEqual(availableModes(2), ['double']);
  assert.deepEqual(availableModes(3), ['double', 'roundRobin']);
  assert.deepEqual(availableModes(4), ['single', 'double', 'roundRobin']);
  assert.deepEqual(availableModes(5), ['double', 'roundRobin']);
  for (let n = 6; n <= 16; n++) assert.deepEqual(availableModes(n), [8, 16].includes(n) ? ['single', 'swiss'] : ['swiss']);
});
test('La double élimination exige deux défaites et respecte le nombre de matchs', () => {
  for (let n = 2; n <= 5; n++) for (let sample = 0; sample < 30; sample++) {
    const state = finish(startFormat(base(n), 'double'), () => Math.random() < .5 ? 0 : 1);
    const matches = state.rounds.flat().filter(m => !m.auto);
    assert([2 * n - 2, 2 * n - 1].includes(matches.length));
    for (const p of state.players) {
      const losses = matches.filter(m => m.winner && m.slots.includes(p.id) && m.winner !== p.id).length;
      assert.equal(state.championIds.includes(p.id) ? losses <= 1 : losses === 2, true);
    }
  }
});
test('La finale de remise à zéro est obligatoire après la victoire du repêché', () => {
  let state = startFormat(base(2), 'double');
  chooseWinner(state, state.rounds[0][0].id, state.rounds[0][0].slots[0]);
  const final = state.rounds[1][0]; chooseWinner(state, final.id, final.slots[1]);
  assert.equal(state.championIds.length, 0); assert.equal(state.rounds.length, 3);
  chooseWinner(state, state.rounds[2][0].id, state.rounds[2][0].slots[0]); assert.equal(state.championIds.length, 1);
});
test('Tous contre tous : chaque paire joue une fois et les repos ne valent aucun point', () => {
  for (const n of [3, 4, 5]) {
    const state = finish(startFormat(base(n), 'roundRobin'));
    const real = state.rounds.flat().filter(m => !m.auto);
    assert.equal(real.length, n * (n - 1) / 2);
    assert.equal(new Set(real.map(m => m.slots.slice().sort().join('|'))).size, real.length);
    assert(standings(state).every(row => row.played === n - 1 && row.points === row.wins));
  }
});
test('Le suisse termine ses 3 rondes sans revanche, puis départage uniquement les premiers', () => {
  for (let n = 6; n <= 16; n++) for (let sample = 0; sample < 12; sample++) {
    const state = finish(startFormat(base(n), 'swiss'), () => Math.random() < .5 ? 0 : 1);
    const rounds = state.rounds.filter(r => r[0].phase === 'swiss');
    assert.equal(rounds.length, 3);
    const matches = rounds.flat().filter(m => !m.auto);
    assert.equal(new Set(matches.map(m => m.slots.slice().sort().join('|'))).size, matches.length);
    const ranked = standings(state), high = ranked[0].points, leaders = ranked.filter(p => p.points === high).map(p => p.id);
    assert(ranked.every(row => row.byes <= 1 && row.played + row.byes === 3));
    assert(leaders.includes(state.championIds[0]));
    if (leaders.length === 1) assert.equal(state.rounds.length, 3);
    else {
      const playoffs = state.rounds.filter(r => r[0].phase !== 'swiss').flat().filter(m => !m.auto);
      assert(playoffs.every(m => m.slots.every(id => leaders.includes(id))));
      for (const id of leaders) {
        const losses = playoffs.filter(m => m.slots.includes(id) && m.winner !== id).length;
        assert(state.championIds.includes(id) ? losses <= 1 : losses === 2);
      }
    }
    assert(JSON.stringify(state).length < 60000);
  }
});
test('Un changement suisse annule les rondes et le départage qui en dépendent', () => {
  const state = finish(startFormat(base(16), 'swiss'));
  const match = state.rounds[0][0]; chooseWinner(state, match.id, match.slots.find(id => id !== match.winner));
  assert.equal(state.championIds.length, 0); assert.equal(state.rounds.length, 2);
  assert(state.rounds[1].every(m => m.auto || !m.winner)); cleanState(state);
});
test('Le serveur rejette les tableaux et graines falsifiés et recalcule le champion', () => {
  const state = finish(startFormat(base(4), 'double'));
  const fake = structuredClone(state); fake.seed[0] = fake.seed[1]; assert.throws(() => cleanState(fake));
  const forged = structuredClone(state); forged.rounds[0][0].winner = 'intrus'; assert.throws(() => cleanState(forged));
  const skipped = structuredClone(state); skipped.rounds.pop(); assert.throws(() => cleanState(skipped));
  const pretend = structuredClone(state); pretend.championIds = ['intrus']; assert.deepEqual(cleanState(pretend).championIds, state.championIds);
});
test('Les sauvegardes et tableaux historiques restent lisibles', () => {
  const legacy = base(4); legacy.started = true; legacy.rounds = createRounds(legacy.players);
  assert.equal(cleanState(legacy).rounds.length, 2);
  const draft = base(5); draft.mode = 'roundRobin'; assert.equal(cleanState(draft).mode, 'roundRobin');
});
