import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, createRounds, cleanState, chooseWinner, canStart, randomCode, validCode } from '../../labo/novytournoi/model.mjs';

export function tournament(n = 4) {
  const state = emptyState(); state.name = 'Tournoi de contrôle';
  state.players = Array.from({ length: n }, (_, i) => ({ id: 'player-' + i, name: 'Joueur ' + (i + 1) }));
  state.rounds = createRounds(state.players); state.started = true; return state;
}
test('Chaque format accepté fait jouer tous les inscrits au premier tour et mène au champion', () => {
  for (const n of [2, 4, 8, 16]) {
    const state = tournament(n);
    assert.deepEqual(new Set(state.rounds[0].flatMap(m => m.slots)), new Set(state.players.map(p => p.id)));
    assert.equal(state.rounds.flat().length, n - 1);
    for (const round of state.rounds) for (const m of round) {
      assert(m.slots.every(Boolean)); assert(chooseWinner(state, m.id, m.slots[0])); cleanState(state, { requireStarted: true });
    }
    assert(state.rounds.at(-1)[0].winner); assert(state.rounds.flat().every(m => !m.auto));
  }
});
test('Les tailles intermédiaires sont refusées', () => {
  for (let n = 0; n < 18; n++) if (![2, 4, 8, 16].includes(n)) {
    assert(!canStart(n)); assert.throws(() => createRounds(Array.from({ length: n }, (_, i) => ({ id: String(i) }))));
  }
});
test('Changer un gagnant invalide uniquement ses descendants', () => {
  const state = tournament(8);
  for (const round of state.rounds) for (const m of round) chooseWinner(state, m.id, m.slots[0]);
  const siblingWinner = state.rounds[1][1].winner;
  chooseWinner(state, state.rounds[0][0].id, state.rounds[0][0].slots[1]);
  assert.equal(state.rounds[1][0].winner, null); assert.equal(state.rounds[2][0].winner, null);
  assert.equal(state.rounds[1][1].winner, siblingWinner); cleanState(state);
});
test('Les faux gagnants, doublons, exemptions et champs privés ne passent pas dans le stockage public', () => {
  const state = tournament(); state.editorToken = 'private'; state.players[0].email = 'private';
  const sanitized = cleanState(state); assert(!('editorToken' in sanitized)); assert(!('email' in sanitized.players[0]));
  const duplicate = structuredClone(state); duplicate.rounds[0][0].slots[0] = duplicate.rounds[0][0].slots[1]; assert.throws(() => cleanState(duplicate));
  const premature = structuredClone(state); premature.rounds[1][0].winner = state.players[0].id; assert.throws(() => cleanState(premature));
  const bye = structuredClone(state); bye.rounds[0][0].slots[0] = null; assert.throws(() => cleanState(bye));
});
test('Les codes sont valides et ne proviennent pas du nom du tournoi', () => {
  const codes = new Set(Array.from({ length: 100 }, () => randomCode()));
  assert.equal(codes.size, 100); assert([...codes].every(validCode));
});
